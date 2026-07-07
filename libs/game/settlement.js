import "server-only";

import { createHash } from "node:crypto";
import { requestStructuredCompletion } from "@/libs/gpt";
import { createUsageCollector } from "./sessionUsage";
import {
  buildDesiredReliefForSide,
  buildOverviewForSide,
  ensureTemplate,
  getOpposingSide,
  getPartyName,
  getPlayerSide,
  getTemplate,
  uniqueList,
} from "./engine/shared";

const SETTLEMENT_MODEL =
  process.env.OPENAI_SETTLEMENT_MODEL?.trim() ||
  process.env.OPENAI_GAMEPLAY_MODEL?.trim() ||
  "gpt-5.4-mini";
const SETTLEMENT_PREVIEW_MODEL =
  process.env.OPENAI_SETTLEMENT_PREVIEW_MODEL?.trim() ||
  process.env.OPENAI_SETTLEMENT_MODEL?.trim() ||
  process.env.OPENAI_GAMEPLAY_MODEL?.trim() ||
  "gpt-5.4-mini";

const SETTLEMENT_REJECTION_BASE_COOLDOWN_MS = 60 * 1000;

export const clampMood = (value) =>
  Math.max(-100, Math.min(100, Math.round(Number(value) || 0)));

export const calculateSettlementRejectionCooldownMs = (rejectionCount = 1) =>
  SETTLEMENT_REJECTION_BASE_COOLDOWN_MS *
  2 ** Math.max(0, (Number(rejectionCount) || 1) - 1);

export const getSettlementCooldownState = (settlement = {}, now = new Date()) => {
  const cooldownUntil = settlement?.cooldownUntil
    ? new Date(settlement.cooldownUntil)
    : null;
  const remainingMs =
    cooldownUntil && Number.isFinite(cooldownUntil.getTime())
      ? Math.max(0, cooldownUntil.getTime() - new Date(now).getTime())
      : 0;

  return {
    active: remainingMs > 0,
    remainingMs,
    cooldownUntil: remainingMs > 0 ? cooldownUntil : null,
  };
};

const coerceString = (value = "") => (typeof value === "string" ? value.trim() : "");

const coerceStringList = (value = [], limit = 5) =>
  uniqueList((Array.isArray(value) ? value : []).map(coerceString)).slice(0, limit);

const normalizeDraftTerms = (terms = {}) => {
  if (Array.isArray(terms)) {
    return terms
      .map((term) => {
        if (Array.isArray(term)) {
          return {
            label: coerceString(term[0]),
            value: coerceString(term[1]),
          };
        }

        return {
          label: coerceString(term?.label),
          value: coerceString(term?.value),
        };
      })
      .filter((term) => term.label && term.value)
      .slice(0, 8);
  }

  return Object.entries(terms || {})
    .map(([label, value]) => ({
      label: coerceString(label),
      value: coerceString(value),
    }))
    .filter((term) => term.label && term.value)
    .slice(0, 8);
};

const SETTLEMENT_TERM_LABELS = [
  "Settlement Amount",
  "Payment Timeline",
  "Corrective Work",
  "Release Terms",
  "Costs",
  "Fault",
];

const toDisplayTermLabel = (value = "") =>
  coerceString(value)
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());

const getCanonicalSettlementTermLabel = (term = "") => {
  const text = String(term || "");

  if (/\$|payment|pay|amount|refund|return|balance/i.test(text)) return "Settlement Amount";
  if (/day|week|month|deadline|within|timeline|date|prompt/i.test(text)) return "Payment Timeline";
  if (/punch|credit|repair|corrective|work|perform|complete/i.test(text)) return "Corrective Work";
  if (/future|relationship|release|waive|claim|dismiss/i.test(text)) return "Release Terms";
  if (/cost|fee|fees|interest/i.test(text)) return "Costs";
  if (/fault|admission|liability/i.test(text)) return "Fault";

  return "";
};

const normalizeSettlementTermsAsRows = (terms = []) => {
  const labeledTerms = normalizeDraftTerms(terms);

  if (labeledTerms.length) {
    return labeledTerms;
  }

  const byLabel = new Map();
  for (const term of coerceStringList(terms, 8)) {
    const [rawLabel, ...rawValueParts] = term.split(":");
    const parsedLabel =
      rawValueParts.length > 0 && rawLabel.trim().length <= 28
        ? rawLabel.trim()
        : getCanonicalSettlementTermLabel(term);
    const value = rawValueParts.length > 0 ? rawValueParts.join(":").trim() : term;
    const canonicalLabel = SETTLEMENT_TERM_LABELS.includes(parsedLabel)
      ? parsedLabel
      : getCanonicalSettlementTermLabel(parsedLabel || term);
    const label =
      canonicalLabel ||
      (rawValueParts.length > 0 && parsedLabel ? toDisplayTermLabel(parsedLabel) : "");

    if (label && !byLabel.has(label) && value) {
      byLabel.set(label, value);
    }
  }

  return Array.from(byLabel.entries()).map(([label, value]) => ({ label, value }));
};

export const extractSettlementTermsFromMessage = (message = "") => {
  const text = coerceString(message).replace(/\s+/g, " ");
  if (!text) {
    return [];
  }

  const byLabel = new Map();
  const clauses = text
    .replace(/^\s*(?:counteroffer|proposal|offer|terms)\s*:\s*/i, "")
    .split(/(?:\s*;\s*|\s+\u2022\s+|\s+\|\s+|\.\s+)/)
    .map((clause) => clause.trim())
    .filter(Boolean)
    .slice(0, 10);

  for (const clause of clauses) {
    const [rawLabel, ...rawValueParts] = clause.split(":");
    const hasExplicitLabel = rawValueParts.length > 0 && rawLabel.trim().length <= 36;
    const value = hasExplicitLabel ? coerceString(rawValueParts.join(":")) : clause;
    const label =
      (hasExplicitLabel &&
        (SETTLEMENT_TERM_LABELS.includes(toDisplayTermLabel(rawLabel))
          ? toDisplayTermLabel(rawLabel)
          : getCanonicalSettlementTermLabel(rawLabel) || toDisplayTermLabel(rawLabel))) ||
      getCanonicalSettlementTermLabel(clause);

    if (label && value && !byLabel.has(label)) {
      byLabel.set(label, value);
    }
  }

  return Array.from(byLabel.entries()).map(([label, value]) => ({ label, value }));
};

const devFacingSettlementPreviewPattern =
  /\b(ai|model|generated|schema|deterministic|scoring|preview)\b/i;

const cleanClientPreviewCopy = (value = "", fallback = "") => {
  const text = coerceString(value);

  if (!text || devFacingSettlementPreviewPattern.test(text)) {
    return fallback;
  }

  return text;
};

const hashInt = (value = "") =>
  parseInt(createHash("sha256").update(String(value)).digest("hex").slice(0, 8), 16);

export const deterministicMood = (seed = "", side = "client") =>
  clampMood((hashInt(`${seed}:${side}`) % 201) - 100);

const getSettlementSeed = (caseSession = {}) =>
  String(
    caseSession?._id ||
      caseSession?.id ||
      caseSession?.slug ||
      caseSession?.templateSlug ||
      caseSession?.title ||
      "settlement"
  );

export const getInitialSettlementMoods = (caseSession = {}) => ({
  player: deterministicMood(getSettlementSeed(caseSession), "client"),
  opponent: deterministicMood(getSettlementSeed(caseSession), "opponent"),
});

const getSettlementMoodKeyForSide = (side) =>
  side === "opponent" ? "opponent" : "player";

const getSettlementMoodForSide = (moods = {}, side = "client") =>
  Number(moods?.[getSettlementMoodKeyForSide(side)] || 0);

export const normalizeSettlement = (settlement = {}, caseSession = {}) => ({
  status: settlement?.status || "none",
  moods: {
    ...getInitialSettlementMoods(caseSession),
    ...(settlement?.moods || {}),
  },
  transcript: Array.isArray(settlement?.transcript) ? settlement.transcript : [],
  currentTerms: coerceStringList(settlement?.currentTerms, 6),
  finalTerms: coerceStringList(settlement?.finalTerms, 6),
  outcomeSummary: coerceString(settlement?.outcomeSummary),
  failureReason: coerceString(settlement?.failureReason),
  rejectionCount: Math.max(0, Number(settlement?.rejectionCount) || 0),
  cooldownUntil: settlement?.cooldownUntil || null,
  startedAt: settlement?.startedAt || null,
  completedAt: settlement?.completedAt || null,
});

const buildSettlementPromptContext = ({ caseSession, settlement, message, actorSide }) => {
  const template = ensureTemplate(getTemplate(caseSession));
  const playerSide = getPlayerSide(caseSession);
  const representedSide = actorSide === "opponent" ? "opponent" : playerSide;
  const otherSide = getOpposingSide(representedSide);

  return {
    matter: {
      title: caseSession.title,
      category: caseSession.primaryCategory,
      complexity: caseSession.complexity,
      overview: caseSession.premise?.overview || buildOverviewForSide(template, representedSide),
      requestedRelief:
        caseSession.premise?.desiredRelief ||
        buildDesiredReliefForSide(template, representedSide),
    },
    parties: {
      client: {
        name: getPartyName(template, "client"),
        objective: buildDesiredReliefForSide(template, "client"),
        mood: settlement.moods.player,
      },
      opponent: {
        name: getPartyName(template, "opponent"),
        objective: buildDesiredReliefForSide(template, "opponent"),
        mood: settlement.moods.opponent,
      },
    },
    representedClient: {
      side: representedSide,
      name: getPartyName(template, representedSide),
      objective: buildDesiredReliefForSide(template, representedSide),
      mood: getSettlementMoodForSide(settlement.moods, representedSide),
    },
    opposingClient: {
      side: otherSide,
      name: getPartyName(template, otherSide),
      objective: buildDesiredReliefForSide(template, otherSide),
      mood: getSettlementMoodForSide(settlement.moods, otherSide),
    },
    actorSide: representedSide,
    respondingSide: otherSide,
    currentTerms: settlement.currentTerms,
    recentTranscript: settlement.transcript.slice(-8),
    latestMessage: message,
  };
};

const normalizeAiSettlementResult = (
  aiResult = {},
  currentSettlement = {},
  { actorSide = "client" } = {}
) => {
  const representedSide = actorSide === "opponent" ? "opponent" : "client";
  const otherSide = getOpposingSide(representedSide);
  const representedMoodKey = getSettlementMoodKeyForSide(representedSide);
  const otherMoodKey = getSettlementMoodKeyForSide(otherSide);
  const playerDelta = Math.max(-35, Math.min(35, Number(aiResult?.playerMoodDelta || 0)));
  const opponentDelta = Math.max(-35, Math.min(35, Number(aiResult?.opponentMoodDelta || 0)));
  const moods = {
    player: clampMood(currentSettlement.moods?.player || 0),
    opponent: clampMood(currentSettlement.moods?.opponent || 0),
  };
  moods[representedMoodKey] = clampMood((moods[representedMoodKey] || 0) + playerDelta);
  moods[otherMoodKey] = clampMood((moods[otherMoodKey] || 0) + opponentDelta);
  const currentTerms = coerceStringList(
    aiResult?.currentTerms?.length ? aiResult.currentTerms : currentSettlement.currentTerms,
    6
  );
  const clientAccepts = Boolean(aiResult?.clientAccepts);
  const opponentAccepts = Boolean(aiResult?.opponentAccepts);
  const failed = moods.player <= -100 || moods.opponent <= -100 || Boolean(aiResult?.negotiationFailed);
  const settled = !failed && clientAccepts && opponentAccepts && currentTerms.length > 0;

  return {
    responseText:
      coerceString(aiResult?.responseText) ||
      "The other side is not ready to settle on that proposal yet.",
    clientReaction: coerceString(aiResult?.clientReaction),
    moods,
    currentTerms,
    finalTerms: settled ? currentTerms : [],
    outcomeSummary: settled
      ? coerceString(aiResult?.outcomeSummary) || "Both parties accepted the settlement terms."
      : "",
    failureReason: failed
      ? coerceString(aiResult?.failureReason) ||
        "Negotiations broke down because at least one party has no remaining willingness to negotiate."
      : "",
    status: settled ? "settled" : failed ? "failed" : "active",
    accepted: settled,
    rejected: Boolean(aiResult?.initialRejected) && !settled && !failed,
  };
};

const fallbackSettlementResult = ({ settlement, message, actorSide = "client" }) => {
  const text = String(message || "");
  const cooperative = /\b(settle|resolve|compromise|offer|payment|agreement|terms|without court|avoid court)\b/i.test(text);
  const insulting = /\b(idiot|moron|stupid|dumb|clown|loser|pathetic|worthless|trash|garbage|fuck|fucking|shit|bullshit|asshole|bastard|shut up)\b/i.test(text);
  const hostile = /\b(never|refuse|threat|destroy|humiliate|liar|fraud|bad faith)\b/i.test(text);
  const playerDelta = insulting ? -18 : cooperative ? 8 : hostile ? -18 : -2;
  const opponentDelta = insulting ? -35 : cooperative ? 12 : hostile ? -24 : -4;
  const representedSide = actorSide === "opponent" ? "opponent" : "client";
  const otherSide = getOpposingSide(representedSide);
  const currentTerms = cooperative
    ? uniqueList([
        ...settlement.currentTerms,
        "The parties will resolve the dispute without a courtroom ruling.",
      ]).slice(0, 6)
    : settlement.currentTerms;

  return normalizeAiSettlementResult(
    {
      responseText: cooperative
        ? "I am willing to keep talking, but I need terms that protect my side too."
        : "That does not give me enough reason to settle right now.",
      clientReaction: cooperative
        ? "Your client remains open to a practical deal."
        : "Your client is becoming less patient with the negotiation.",
      playerMoodDelta: playerDelta,
      opponentMoodDelta: opponentDelta,
      currentTerms,
      clientAccepts:
        currentTerms.length > 0 &&
        getSettlementMoodForSide(settlement.moods, representedSide) + playerDelta >= 60,
      opponentAccepts:
        currentTerms.length > 0 &&
        getSettlementMoodForSide(settlement.moods, otherSide) + opponentDelta >= 60,
      initialRejected: !cooperative,
    },
    settlement,
    { actorSide }
  );
};

const fallbackOpeningSettlementMessage = ({ caseSession }) => {
  const template = ensureTemplate(getTemplate(caseSession));
  const playerSide = getPlayerSide(caseSession);
  const clientName = getPartyName(template, playerSide);
  const desiredRelief =
    caseSession.premise?.desiredRelief || buildDesiredReliefForSide(template, playerSide);

  return [
    `My client, ${clientName}, is willing to discuss resolving this without court.`,
    `A practical resolution should address ${desiredRelief || "the main relief at issue"} while avoiding more time and cost for both sides.`,
    "If your side is open to that, please respond with concrete terms we can review with our client.",
  ].join(" ");
};

const fallbackAiSettlementPreview = () => ({
  label: "Client is still thinking",
  tone: "amber",
  score: 0,
  note:
    "The huddle is not ready yet. You can still send a clear, concrete proposal.",
  drivers: ["Keep the amount, timing, release, costs, and fault language concrete."],
  privateClientLine: "Walk me through why this protects me before you offer it.",
  suggestedRevision: "Make the amount, timing, release, costs, and fault language concrete.",
  model: SETTLEMENT_PREVIEW_MODEL,
  source: "fallback",
});

const normalizeAiSettlementPreview = (aiResult = {}) => {
  const score = clampMood(aiResult?.score);
  const rawTone = coerceString(aiResult?.tone).toLowerCase();
  const tone = ["emerald", "amber", "red"].includes(rawTone)
    ? rawTone
    : score >= 35
    ? "emerald"
    : score < -15
    ? "red"
    : "amber";
  const drivers = coerceStringList(aiResult?.drivers, 4);
  const clientFacingDrivers = drivers
    .map((driver) => cleanClientPreviewCopy(driver))
    .filter(Boolean)
    .slice(0, 4);

  return {
    label: cleanClientPreviewCopy(aiResult?.label, "Client reaction ready"),
    tone,
    score,
    note:
      cleanClientPreviewCopy(
        aiResult?.note,
        "The client has a private reaction to these terms."
      ),
    drivers: clientFacingDrivers.length
      ? clientFacingDrivers
      : ["The client is weighing the practical tradeoffs."],
    privateClientLine: cleanClientPreviewCopy(aiResult?.privateClientLine),
    suggestedRevision: cleanClientPreviewCopy(aiResult?.suggestedRevision),
    draftTerms: normalizeDraftTerms(aiResult?.draftTerms || {}),
    model: SETTLEMENT_PREVIEW_MODEL,
    source: "ai",
  };
};

export const previewSettlementDraftForClient = async ({
  caseSession,
  draftTerms,
  message = "",
  clientInstruction = "",
  userId,
}) => {
  const usageCollector = createUsageCollector("settlement");
  const currentSettlement = normalizeSettlement(caseSession.settlement || {}, caseSession);
  const playerSide = getPlayerSide(caseSession);
  const normalizedDraftTerms = normalizeDraftTerms(draftTerms);
  const representedClientMoneyPosture =
    playerSide === "opponent"
      ? "If the draft makes the represented client pay money, lower payment is normally better. Treat a higher payment only as a pragmatic concession for certainty, speed, or risk control."
      : "If the draft gives the represented client money, a refund, or recovery, higher recovery is normally better. Treat a lower recovery only as an acceptable floor or close-now compromise, not as the client's preferred goal.";

  try {
    const aiResult = await requestStructuredCompletion({
      userId,
      model: SETTLEMENT_PREVIEW_MODEL,
      temperature: 0.35,
      maxTokens: 550,
      retryAttempts: 0,
      usageLabel: "settlement.clientPreview",
      onUsage: usageCollector.record,
      systemPrompt:
        "You simulate the represented client privately during settlement negotiations in a legal strategy game. The player is the lawyer. Evaluate the draft terms as a private client huddle before opposing counsel hears them. Output valid JSON only.",
      userPrompt: JSON.stringify({
        task: clientInstruction
          ? "The lawyer is privately talking to the represented client. Respond with a concise client reaction and revise the draft settlement terms to reflect that private instruction where appropriate."
          : "Give a concise private client reaction to the lawyer's draft settlement terms before they are presented to the other side.",
        rules: [
          "Speak from the represented client's practical perspective, not as a judge and not as opposing counsel.",
          "Do not decide whether the opponent accepts. Only evaluate whether the represented client can live with the draft.",
          "Preserve the represented client's economic interest. Do not tell a money-seeking client they prefer less money, or a paying client they prefer paying more.",
          "When recommending a worse monetary term for the represented client, frame it as an acceptable floor, risk-adjusted compromise, or close-now authority, not as the client's goal.",
          "For a claimant, refund-seeker, or recovery-seeker, say the client can live with a lower amount if it closes now rather than saying they would rather ask for less.",
          "For a payer, say the client can stretch to a higher amount to avoid risk rather than saying they prefer paying more.",
          "Do not ask the lawyer to weaken the monetary position unless you explain the tradeoff: faster payment, certainty, narrow release, fee or cost waiver, or litigation risk.",
          "Use the case facts, requested relief, current settlement moods, current public terms, and recent transcript.",
          "Flag unclear or risky wording. Reward concrete timing, protected fault language, clear release scope, and terms that match client priorities.",
          "If the lawyer privately asks the client for authority, preferences, reassurance, or a new settlement direction, use that message to revise draftTerms while preserving the client's interests.",
          "Return draftTerms as labeled rows only when the private client huddle should update the lawyer's draft.",
          "Do not invent new facts or legal outcomes.",
          "Keep label under 7 words, note under 24 words, each driver under 12 words, and privateClientLine under 20 words.",
          "Never mention AI, models, prompts, previews, scoring, schemas, or generation.",
          "Tone must be one of: emerald, amber, red.",
          "Score must be a number from -100 to 100.",
        ],
        outputSchema: {
          label: "string",
          tone: "emerald | amber | red",
          score: "number",
          note: "string",
          drivers: ["string"],
          privateClientLine: "string",
          suggestedRevision: "string",
          draftTerms: [{ label: "string", value: "string" }],
        },
        context: {
          ...buildSettlementPromptContext({
            caseSession,
            settlement: currentSettlement,
            message,
            actorSide: playerSide,
          }),
          representedSide: playerSide,
          clientMoneyPosture: representedClientMoneyPosture,
          draftTerms: normalizedDraftTerms,
          privateLawyerMessageToClient: coerceString(clientInstruction),
          factSheet: caseSession.factSheet || {},
          recentIntake: (caseSession.interviewTranscript || []).slice(-8),
        },
      }),
    });

    return {
      preview: aiResult
        ? normalizeAiSettlementPreview(aiResult)
        : fallbackAiSettlementPreview(),
      usageEntries: usageCollector.entries,
    };
  } catch (error) {
    console.error("settlement client preview failed", error);
    return {
      preview: fallbackAiSettlementPreview(),
      usageEntries: usageCollector.entries,
    };
  }
};

export const generateOpeningSettlementMessage = async ({ caseSession, userId }) => {
  const usageCollector = createUsageCollector("settlement");
  const currentSettlement = normalizeSettlement(caseSession.settlement || {}, caseSession);
  const playerSide = getPlayerSide(caseSession);

  try {
    const aiResult = await requestStructuredCompletion({
      userId,
      model: SETTLEMENT_MODEL,
      temperature: 0.55,
      maxTokens: 500,
      retryAttempts: 1,
      usageLabel: "settlement.openingDraft",
      onUsage: usageCollector.record,
      systemPrompt:
        "You draft editable opening settlement messages for a legal strategy game. Write as the player's counsel to opposing counsel. The player already has client authority to explore settlement. Output valid JSON only.",
      userPrompt: JSON.stringify({
        task: "Draft one concise opening settlement message. It should be practical, calm, and specific enough to start negotiation without conceding liability.",
        rules: [
          "Write in first person plural as counsel: 'my client' or 'we'.",
          "Do not claim facts that are not in the case file or intake transcript.",
          "Do not say the case is weak unless the fact sheet clearly supports that.",
          "Include a concrete settlement frame, but leave room for counteroffer.",
          "Keep it under 120 words.",
        ],
        outputSchema: {
          message: "string",
        },
        context: {
          ...buildSettlementPromptContext({
            caseSession,
            settlement: currentSettlement,
            message: "",
            actorSide: playerSide,
          }),
          factSheet: caseSession.factSheet || {},
          recentIntake: (caseSession.interviewTranscript || []).slice(-10),
        },
      }),
    });
    const message = coerceString(aiResult?.message);

    return {
      message: message || fallbackOpeningSettlementMessage({ caseSession }),
      usageEntries: usageCollector.entries,
    };
  } catch (error) {
    console.error("settlement opening draft failed", error);
    return {
      message: fallbackOpeningSettlementMessage({ caseSession }),
      usageEntries: usageCollector.entries,
    };
  }
};

export const runSettlementExchange = async ({
  caseSession,
  message,
  userId,
  terms = {},
  actorSide = null,
  initial = false,
}) => {
  const usageCollector = createUsageCollector("settlement");
  const currentSettlement = normalizeSettlement(caseSession.settlement || {}, caseSession);
  const activeSettlement = {
    ...currentSettlement,
    status: currentSettlement.status === "none" ? "proposed" : currentSettlement.status,
    startedAt: currentSettlement.startedAt || new Date(),
  };
  const playerSide = actorSide || getPlayerSide(caseSession);
  const playerProposalTerms = extractSettlementTermsFromMessage(message);
  let result = null;

  try {
    const aiResult = await requestStructuredCompletion({
      userId,
      model: SETTLEMENT_MODEL,
      temperature: 0.65,
      maxTokens: 1200,
      retryAttempts: 1,
      usageLabel: "settlement.exchange",
      onUsage: usageCollector.record,
      systemPrompt:
        "You simulate out-of-court settlement negotiations in a legal strategy game. Human lawyers negotiate, but the simulated parties decide whether terms are acceptable. Use the deterministic moods as negotiation willingness: high mood means cooperative, low mood means defensive, -100 means no room remains. Write natural party/counsel-facing responses and output valid JSON only.",
      userPrompt: JSON.stringify({
        task: initial
          ? "Evaluate the opening settlement message. Decide whether the other side enters negotiation and how both parties react."
          : "Continue settlement negotiation. Update moods, terms, party reactions, and whether both parties accept.",
        rules: [
          "Do not decide outcomes by legal merit alone; willingness, face-saving, risk, and concrete terms matter.",
          "If the message is hostile, vague, or one-sided, reduce mood and do not accept.",
          "If the message offers concrete reciprocal terms, improve mood and update currentTerms.",
          "If the lawyer presents terms that are materially worse than the represented client's priorities, unclear, outside the client's authority, or not privately aligned with the client, reduce the represented client's mood even if the other side might like the move.",
          "Clients should dislike being talked over. A lawyer can still send the message, but the represented client may lose trust when the public proposal ignores their private reaction.",
          "Both clientAccepts and opponentAccepts must be true only when both simulated parties accept the same currentTerms.",
          "For the initial message, set initialRejected true if the responding side refuses to enter settlement talks.",
          "Keep responseText in the voice of the responding opposing party or opposing counsel.",
          "Keep clientReaction as a short note from the represented client/party about whether they can live with the proposal.",
          "playerMoodDelta changes the representedClient mood. opponentMoodDelta changes the opposingClient mood.",
          "Mood deltas must be numbers between -35 and 35.",
        ],
        outputSchema: {
          responseText: "string",
          clientReaction: "string",
          playerMoodDelta: "number",
          opponentMoodDelta: "number",
          currentTerms: ["string"],
          clientAccepts: "boolean",
          opponentAccepts: "boolean",
          initialRejected: "boolean",
          negotiationFailed: "boolean",
          failureReason: "string",
          outcomeSummary: "string",
        },
        context: buildSettlementPromptContext({
          caseSession,
          settlement: activeSettlement,
          message,
          actorSide: playerSide,
        }),
      }),
    });

    result = aiResult
      ? normalizeAiSettlementResult(aiResult, activeSettlement, { actorSide: playerSide })
      : fallbackSettlementResult({ settlement: activeSettlement, message, actorSide: playerSide });
  } catch (error) {
    console.error("settlement exchange failed", error);
    result = fallbackSettlementResult({ settlement: activeSettlement, message, actorSide: playerSide });
  }

  if (initial && result.rejected) {
    result.status = "rejected";
  }

  const rejected = result.status === "rejected";
  const rejectionCount = rejected
    ? (Number(activeSettlement.rejectionCount) || 0) + 1
    : Number(activeSettlement.rejectionCount) || 0;
  const cooldownUntil = rejected
    ? new Date(Date.now() + calculateSettlementRejectionCooldownMs(rejectionCount))
    : null;
  const terminal = ["settled", "failed"].includes(result.status);
  const settled = result.status === "settled";
  const completedAt = terminal ? new Date() : null;

  const nextSettlement = {
    ...activeSettlement,
    status: result.status,
    moods: result.moods,
    currentTerms: result.currentTerms,
    finalTerms: result.finalTerms,
    resolved: terminal,
    resolution: settled ? "settled" : result.status === "failed" ? "failed" : "",
    resolvedAt: completedAt,
    accepted: settled,
    acceptedAt: settled ? completedAt : null,
    acceptedByUserId: settled ? userId : null,
    acceptedBySide: settled ? playerSide : "",
    outcomeSummary: result.outcomeSummary,
    failureReason: result.failureReason,
    rejectionCount,
    cooldownUntil,
    completedAt,
    transcript: [
      ...activeSettlement.transcript,
      {
        role: "player",
        speaker: "You",
        text: message,
        terms: playerProposalTerms,
        moodSnapshot: activeSettlement.moods,
      },
      {
        role: "opponent",
        speaker: getPartyName(ensureTemplate(getTemplate(caseSession)), getOpposingSide(playerSide)),
        text: result.responseText,
        terms: normalizeSettlementTermsAsRows(result.currentTerms),
        moodSnapshot: result.moods,
      },
      ...(result.clientReaction
        ? [
            {
              role: "client",
              speaker: getPartyName(ensureTemplate(getTemplate(caseSession)), playerSide),
              text: result.clientReaction,
              moodSnapshot: result.moods,
            },
          ]
        : []),
    ],
  };

  return {
    settlement: nextSettlement,
    usageEntries: usageCollector.entries,
    rejected,
    settled: result.status === "settled",
    failed: result.status === "failed",
  };
};
