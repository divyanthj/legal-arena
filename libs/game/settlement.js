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
  const otherSide = getOpposingSide(actorSide);

  return {
    matter: {
      title: caseSession.title,
      category: caseSession.primaryCategory,
      complexity: caseSession.complexity,
      overview: caseSession.premise?.overview || buildOverviewForSide(template, playerSide),
      requestedRelief: caseSession.premise?.desiredRelief || buildDesiredReliefForSide(template, playerSide),
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
    actorSide,
    respondingSide: otherSide,
    currentTerms: settlement.currentTerms,
    recentTranscript: settlement.transcript.slice(-8),
    latestMessage: message,
  };
};

const normalizeAiSettlementResult = (aiResult = {}, currentSettlement = {}) => {
  const playerDelta = Math.max(-35, Math.min(35, Number(aiResult?.playerMoodDelta || 0)));
  const opponentDelta = Math.max(-35, Math.min(35, Number(aiResult?.opponentMoodDelta || 0)));
  const moods = {
    player: clampMood((currentSettlement.moods?.player || 0) + playerDelta),
    opponent: clampMood((currentSettlement.moods?.opponent || 0) + opponentDelta),
  };
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

const fallbackSettlementResult = ({ settlement, message }) => {
  const text = String(message || "");
  const cooperative = /\b(settle|resolve|compromise|offer|payment|agreement|terms|without court|avoid court)\b/i.test(text);
  const hostile = /\b(never|refuse|threat|destroy|humiliate|liar|fraud|bad faith)\b/i.test(text);
  const playerDelta = cooperative ? 8 : hostile ? -18 : -2;
  const opponentDelta = cooperative ? 12 : hostile ? -24 : -4;
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
      clientAccepts: currentTerms.length > 0 && settlement.moods.player + playerDelta >= 60,
      opponentAccepts: currentTerms.length > 0 && settlement.moods.opponent + opponentDelta >= 60,
      initialRejected: !cooperative,
    },
    settlement
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
          "Both clientAccepts and opponentAccepts must be true only when both simulated parties accept the same currentTerms.",
          "For the initial message, set initialRejected true if the responding side refuses to enter settlement talks.",
          "Keep responseText in the voice of the responding opposing party or opposing counsel.",
          "Keep clientReaction as a short note from the represented client/party about whether they can live with the proposal.",
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
      ? normalizeAiSettlementResult(aiResult, activeSettlement)
      : fallbackSettlementResult({ settlement: activeSettlement, message });
  } catch (error) {
    console.error("settlement exchange failed", error);
    result = fallbackSettlementResult({ settlement: activeSettlement, message });
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

  const nextSettlement = {
    ...activeSettlement,
    status: result.status,
    moods: result.moods,
    currentTerms: result.currentTerms,
    finalTerms: result.finalTerms,
    outcomeSummary: result.outcomeSummary,
    failureReason: result.failureReason,
    rejectionCount,
    cooldownUntil,
    completedAt: ["settled", "failed"].includes(result.status) ? new Date() : null,
    transcript: [
      ...activeSettlement.transcript,
      {
        role: "player",
        speaker: "You",
        text: message,
        moodSnapshot: activeSettlement.moods,
      },
      {
        role: "opponent",
        speaker: getPartyName(ensureTemplate(getTemplate(caseSession)), getOpposingSide(playerSide)),
        text: result.responseText,
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
