import "server-only";

import { createHash } from "node:crypto";
import { requestStructuredCompletion } from "@/libs/gpt";
import { getLawbookRules } from "@/data/legalArenaLawbook";
import {
  lockCaseAssessment,
  normalizeCaseAssessment,
} from "./caseAssessment";
import {
  buildDesiredReliefForSide,
  buildInterviewAgentContext,
  buildOverviewForSide,
  ensureTemplate,
  getOpposingSide,
  getInterviewSubjectForSide,
  getPartyName,
  getPlayerSide,
  getClaimForParty,
  getTemplate,
  mergeFactSheet,
  normalizeFactSheetPatch,
  coerceString,
  coerceStringList,
  uniqueList,
} from "./engine/shared";
import { normalizeInterviewResult } from "./engine/interview";
import {
  buildCounselContext,
  buildCourtroomAgentContext,
  normalizeCounselAnalysis,
  normalizeCourtResult,
} from "./engine/courtroom";
import {
  getCourtroomDifficultyProfile,
  getOpponentResponsePromptRules,
} from "./courtroomDifficulty";
import { createUsageCollector } from "./sessionUsage";
import { generateClientMemoryExcerpt } from "./clientMemory";
import {
  buildMemoryClaimFactSheetPatch,
  mergeMemoryClaims,
  normalizeMemoryClaims,
} from "./memoryClaims";

const INTERVIEW_RESPONSE_MAX_TOKENS = 1500;
const INTERVIEW_RESPONSE_TEMPERATURE = 0.7;
const GAMEPLAY_MODEL =
  process.env.OPENAI_GAMEPLAY_MODEL?.trim() || "gpt-5.4-mini";
const CLIENT_MEMORY_MODEL =
  process.env.OPENAI_CLIENT_MEMORY_MODEL?.trim() || GAMEPLAY_MODEL;

const shortHash = (value = "") =>
  createHash("sha256")
    .update(String(value || ""))
    .digest("hex")
    .slice(0, 8);

const getSessionCacheIdentity = (caseSession = {}) =>
  String(
    caseSession?._id ||
      caseSession?.id ||
      caseSession?.caseTemplateId ||
      caseSession?.templateSlug ||
      "session"
  );

const buildGameplayPromptCacheKey = ({
  caseSession,
  phase = "gameplay",
  family = "completion",
  model = GAMEPLAY_MODEL,
} = {}) =>
  [
    "la",
    phase,
    family,
    shortHash(model),
    shortHash(getSessionCacheIdentity(caseSession)),
  ].join(":");

const blankConversationFactSheet = () => ({
  summary: [],
  theory: [],
  desiredRelief: [],
  timeline: [],
  supportingFacts: [],
  risks: [],
  knownFacts: [],
  knownClaims: [],
  disputedFacts: [],
  corroboratedFacts: [],
  sourceLinks: [],
  missingEvidence: [],
  openQuestions: [],
  discoveredFactIds: [],
  discoveredClaimIds: [],
  discoveredEvidenceIds: [],
  ready: false,
});

const factSheetHasVisibleContent = (factSheet = {}) =>
  [
    "summary",
    "theory",
    "desiredRelief",
    "timeline",
    "supportingFacts",
    "risks",
    "knownFacts",
    "knownClaims",
    "disputedFacts",
    "corroboratedFacts",
    "sourceLinks",
    "missingEvidence",
    "openQuestions",
  ].some((field) => Array.isArray(factSheet?.[field]) && factSheet[field].length > 0);

const normalizeLegacyClientMemoryText = (clientMemory) => {
  if (!clientMemory || typeof clientMemory !== "object" || Array.isArray(clientMemory)) {
    return "";
  }

  return [
    clientMemory.clientNarrative,
    clientMemory.clientStory,
    clientMemory.voice,
    clientMemory.posture,
    ...(Array.isArray(clientMemory.personalMemory) ? clientMemory.personalMemory : []),
    ...(Array.isArray(clientMemory.evidenceAccess) ? clientMemory.evidenceAccess : []),
    ...(Array.isArray(clientMemory.uncertainty) ? clientMemory.uncertainty : []),
    ...(Array.isArray(clientMemory.blindSpots) ? clientMemory.blindSpots : []),
    ...(Array.isArray(clientMemory.motivations) ? clientMemory.motivations : []),
    ...(Array.isArray(clientMemory.boundaries) ? clientMemory.boundaries : []),
  ]
    .map((item) => coerceString(item))
    .filter(Boolean)
    .join("\n\n");
};

const getClientMemoryClaims = (clientMemory, side = "client") =>
  normalizeMemoryClaims(clientMemory?.memoryClaims || clientMemory?.claims || [], side);

const getClientMemoryText = (clientMemory) => {
  if (typeof clientMemory === "string") {
    return coerceString(clientMemory);
  }

  return normalizeLegacyClientMemoryText(clientMemory);
};

const hasUsableClientMemory = (clientMemory) => getClientMemoryText(clientMemory).length >= 80;

const withClientMemoryClaims = (clientMemory, newClaims = [], side = "client") => {
  const mergedClaims = mergeMemoryClaims(getClientMemoryClaims(clientMemory, side), newClaims, side);
  if (!mergedClaims.length) {
    return clientMemory || null;
  }

  if (clientMemory && typeof clientMemory === "object" && !Array.isArray(clientMemory)) {
    return {
      ...clientMemory,
      memoryClaims: mergedClaims,
    };
  }

  return {
    clientStory: getClientMemoryText(clientMemory),
    memoryClaims: mergedClaims,
  };
};

const moneyPattern = /\$[\d,]+(?:\.\d{2})?|\b\d{2,6}\s+dollars?\b/i;

const extractMoneyAnchorLines = (value) =>
  String(value || "")
    .split(/\n+|(?<=[.!?])\s+/)
    .map((item) => item.trim())
    .filter((item) => item && moneyPattern.test(item))
    .map((item) => item.replace(/\s+/g, " "));

const buildClientMemoryMoneyAnchors = ({ caseSession, template }) => {
  const safeTemplate = ensureTemplate(template || getTemplate(caseSession));
  const textCorpus = [
    caseSession?.title,
    caseSession?.premise?.overview,
    caseSession?.premise?.desiredRelief,
    caseSession?.premise?.openingStatement,
    safeTemplate.title,
    safeTemplate.overview,
    safeTemplate.desiredRelief,
    safeTemplate.openingStatement,
    ...(safeTemplate.canonicalFacts || []).flatMap((fact) => [
      fact.label,
      fact.canonicalDetail,
    ]),
    ...(safeTemplate.evidenceItems || []).flatMap((item) => [
      item.label,
      item.detail,
    ]),
  ].filter(Boolean);

  return uniqueList(textCorpus.flatMap(extractMoneyAnchorLines)).slice(0, 8);
};

const buildTemplateOpposingMemoryClaims = ({ template, playerSide }) => {
  const safeTemplate = ensureTemplate(template);
  const opposingSide = getOpposingSide(playerSide);

  return normalizeMemoryClaims(
    (safeTemplate.canonicalFacts || [])
      .map((fact) => {
        const claim = getClaimForParty(fact, opposingSide);
        return claim?.claimedDetail
          ? {
              text: claim.claimedDetail,
              topicKey: fact.factId || fact.label,
              side: opposingSide,
              stance: claim.stance || "claims",
            }
          : null;
      })
      .filter(Boolean),
    opposingSide
  );
};

const normalizeClientMemory = (aiResult) => {
  if (typeof aiResult === "string") {
    return coerceString(aiResult);
  }

  if (!aiResult || typeof aiResult !== "object") {
    return null;
  }

  const story =
    coerceString(aiResult.clientStory) ||
    coerceString(aiResult.clientNarrative) ||
    coerceString(aiResult.story) ||
    coerceString(aiResult.narrative);

  if (story.length < 80) {
    return null;
  }

  const memoryClaims = normalizeMemoryClaims(aiResult.memoryClaims || aiResult.claims || []);

  return {
    clientStory: story,
    memoryClaims,
  };
};

export const ensureClientMemory = async ({
  caseSession,
  template,
  playerSide,
  userId,
  onUsage,
}) => {
  if (hasUsableClientMemory(caseSession?.clientMemory)) {
    return { clientMemory: caseSession.clientMemory, created: false };
  }

  const playerPartyName = getPartyName(template, playerSide);
  const interviewSubject = getInterviewSubjectForSide(template, playerSide);
  const interviewSubjectName = interviewSubject.name || playerPartyName;
  const opposingPartyName = getPartyName(template, getOpposingSide(playerSide));
  const actorContext = buildInterviewAgentContext({
    template,
    playerSide,
    factSheet: caseSession.factSheet || {},
  });
  const moneyAnchors = buildClientMemoryMoneyAnchors({ caseSession, template });

  try {
    const aiResult = await requestStructuredCompletion({
      userId,
      model: CLIENT_MEMORY_MODEL,
      temperature: 0.45,
      maxTokens: 1200,
      retryAttempts: 1,
      usageLabel: "intake.clientMemory",
      promptCacheKey: buildGameplayPromptCacheKey({
        caseSession,
        phase: "intake",
        family: "clientMemory",
        model: CLIENT_MEMORY_MODEL,
      }),
      onUsage,
      systemPrompt:
        "You convert a legal simulation's canonical case packet into one freeform first-person client memory story for intake. Write the interview subject's subjective truth as they see it: what they remember, believe, doubt, minimize, exaggerate, misunderstand, resent, or are embarrassed to admit. The client may be wrong, self-serving, defensive, selectively truthful, or may add plausible case-domain details that are party-side claims rather than canon. You may invent plausible objective-sounding party claims when they fit the dispute, but do not create new evidence artifacts, court outcomes, admissions by the other side, or facts that obviously contradict the supplied case frame. Do not write a JSON dossier, labels, bullet sections, lawyer advice, investigation instructions, strategy coaching, scoring language, hidden metadata, or schema language inside the story. Output valid JSON only.",
      userPrompt: JSON.stringify({
        representedPartyName: interviewSubjectName,
        legalPartyName: playerPartyName,
        interviewSubject,
        opposingPartyName,
        representedSide: playerSide,
        overview: buildOverviewForSide(template, playerSide),
        desiredRelief: buildDesiredReliefForSide(template, playerSide),
        openingStatement: caseSession.premise?.openingStatement || "",
        moneyAnchors,
        canonicalRoleContext: actorContext,
        task: `Write one private freeform client memory story for ${interviewSubjectName}, who is being interviewed for the represented ${playerSide} side.`,
        styleRules: [
          "Write in first person as the interview subject, not as a narrator.",
          "Make it feel like a messy but coherent story this person could tell their own lawyer.",
          "Include confidence, uncertainty, self-serving explanations, omissions, and emotional posture inside the prose.",
          "Mention evidence only as something the person believes they have, saw, sent, received, lacks, or thinks someone else controls.",
          "Keep evidence inventory separate: invented details are party claims, not new documents, photos, messages, witnesses, records, or proof.",
          "Add 2 to 5 memoryClaims for material party-side factual assertions from the story, including any plausible invented claims.",
          "Use stable topicKey strings such as deposit-amount, withheld-amount, possession-bike, condition-wall, payment-date, consent-repair, or causation-damage.",
          "Preserve exact dollar figures from moneyAnchors in the story when they matter to deposit, deduction, refund, invoice, rent, payment, or requested-relief questions.",
          "For security-deposit disputes, make the original deposit amount and the amount withheld, returned, or deducted answerable unless the canonical context truly provides no such number.",
          "Do not include headings, field names, arrays, ids, fact ids, evidence ids, or JSON-looking structure inside the story.",
        ],
        outputSchema: {
          clientStory: "string",
          memoryClaims: [
            {
              text: "string",
              topicKey: "string",
              side: "client|opponent",
              stance: "claims|denies|admits|uncertain",
            },
          ],
        },
      }),
    });
    const clientMemory = normalizeClientMemory(aiResult);

    return clientMemory
      ? { clientMemory, created: true }
      : { clientMemory: null, created: false };
  } catch (error) {
    console.error("client memory generation failed", error);
    return { clientMemory: null, created: false };
  }
};

export const continueInterview = async ({ caseSession, question, userId }) => {
  const usageCollector = createUsageCollector("intake");
  const template = ensureTemplate(getTemplate(caseSession));
  const playerSide = getPlayerSide(caseSession);
  const legalPartyName = getPartyName(template, playerSide);
  const interviewSubject = getInterviewSubjectForSide(template, playerSide);
  const playerPartyName = interviewSubject.name || legalPartyName;
  const opposingPartyName = getPartyName(template, getOpposingSide(playerSide));
  const transcriptFactSheet = rebuildFactSheetFromTranscript({
    caseSession,
    template,
  });
  const currentConversationFactSheet = factSheetHasVisibleContent(caseSession.factSheet)
    ? mergeFactSheet(blankConversationFactSheet(), caseSession.factSheet, template, {
        playerSide,
      })
    : transcriptFactSheet;
  const clientMemoryResult = await ensureClientMemory({
    caseSession,
    template,
    playerSide,
    userId,
    onUsage: usageCollector.record,
  });
  const clientMemoryExcerpt =
    clientMemoryResult.clientMemory &&
    (clientMemoryResult.created || !String(caseSession.clientMemoryExcerpt || "").trim())
      ? await generateClientMemoryExcerpt({
          clientMemory: clientMemoryResult.clientMemory,
          partyName: legalPartyName,
          playerSide,
          userId,
          promptCacheKey: buildGameplayPromptCacheKey({
            caseSession,
            phase: "intake",
            family: "clientMemoryExcerpt",
            model: CLIENT_MEMORY_MODEL,
          }),
          onUsage: usageCollector.record,
        })
      : "";
  const interviewContext = clientMemoryResult.clientMemory
    ? {
        mode: "stored_client_memory",
        clientMemory: getClientMemoryText(clientMemoryResult.clientMemory),
        memoryClaims: getClientMemoryClaims(clientMemoryResult.clientMemory, playerSide),
      }
    : {
        mode: "canonical_context",
        ...buildInterviewAgentContext({
          template,
          playerSide,
          factSheet: currentConversationFactSheet,
        }),
      };
  const clientResponseSystemPrompt = clientMemoryResult.clientMemory
    ? "You are simulating a legal-case interview subject speaking to the lawyer for the represented side during intake. Treat this as a role actor, not a script expander. Use the stored freeform client memory story and memoryClaims as the interview subject's private source of truth. The story and claims are the client's subjective truth as they see it, not guaranteed objective canon. For narrow follow-up questions, answer only the narrow detail asked by retrieving the closest remembered sentence, existing memory claim, uncertainty, or evidence-access statement from the story. If an amount, date, name, location, or count question asks for a central case detail that is missing from the story and claims, you may give one plausible party-side claim or estimate the person would reasonably know or assert, then include it in newMemoryClaims. Phrase uncertain invented details as recollection, belief, or estimate, not proven fact. If the recent transcript already contains the broad story, treat the latest question as a continuation and do not repeat facts already stated unless the answer would be unclear without one brief reference. Retell the stored client memory only if the lawyer explicitly asks for the whole story, timeline, or full explanation. The visible fact sheet and recent transcript are conversation context only. The partyResponse must sound like the interview subject speaking in first person; never write dossier language such as 'Maria says,' 'client says,' 'the tenant says,' 'the plaintiff says,' or any third-person self-reference by the speaker. The partyResponse must answer only the lawyer's latest question. Do not volunteer extra explanation, legal analysis, investigation advice, next steps, or caveats the lawyer did not ask for. For yes/no questions, start with yes, no, or not sure, then add at most one short plain-language sentence if needed. For amount, date, name, location, or count questions, answer in one sentence with that detail only; use existing memoryClaims first, and create newMemoryClaims only when the missing detail is central, plausible, and this person would reasonably assert it. Do not invent documents, photos, receipts, witnesses, messages, admissions, records, or automatic evidence. If the lawyer asks whether you have, can provide, send, share, or show photos, records, documents, or other evidence, answer in one sentence only. If you have it, say yes and briefly identify it. If you do not have it, say no or not that I know of and stop. If someone else likely has it, add one short sentence naming who. Never answer a proof-possession question by retelling the full memory story or timeline. Never say 'confirmed in the file,' 'not confirmed in the file,' 'proof gaps,' 'the record,' or similar dossier language in partyResponse; speak from memory. Do not tell the lawyer how to investigate, what to pin down next, or how to run the case. Never mention internal schemas, canonical truth, or metadata. Output valid JSON only."
    : "You are simulating a legal-case party speaking to their own lawyer during intake. Treat this as a role actor, not a script expander. The canonical story is the real event history; structured facts and evidence are helper maps, not the only memory you have. Answer first from the represented party's lived perspective, thought process, and accessible story memory. Decide what to reveal, hedge, minimize, or withhold based on the latest question and the party profile. The partyResponse must sound like the represented party speaking in first person; never write dossier language such as 'Maria says,' 'client says,' 'the tenant says,' 'the plaintiff says,' or any third-person self-reference by the represented party. The partyResponse must answer only the lawyer's latest question. Do not volunteer extra explanation, legal analysis, investigation advice, next steps, or caveats the lawyer did not ask for. For yes/no questions, start with yes, no, or not sure, then add at most one short plain-language sentence if needed. If the lawyer asks whether you have, can provide, send, share, or show photos, records, documents, or other evidence, answer directly about whether you personally have it. If you have it, say yes and briefly identify it. If you do not have it, say no or not that I know of and stop. If someone else likely has it, add one short sentence naming who. Never say 'confirmed in the file,' 'not confirmed in the file,' 'proof gaps,' 'the record,' or similar dossier language in partyResponse; speak as the client from memory. For ordinary factual questions, answer from memory as concretely as you honestly can before talking about records. If the lawyer asks a broad question, connect it to the nearest relevant events, mental states, evidence, or ambiguity in the canonical story instead of stonewalling. If the lawyer asks for names, dates, amounts, or other facts already present in the hidden world state or side-specific memory, give the fact instead of saying you need to check records. Use uncertainty only for genuine hearsay, missing records, low-access facts, or exact details the represented party would not know. If you do not remember an exact detail, say that plainly and stop. Do not tell the lawyer how to investigate, what to pin down next, or how to run the case. Speak like a normal person in first person. Never mention internal schemas, canonical truth, or metadata. Keep fact-sheet updates concise, but you may fill summary, theory, and desiredRelief when the case posture is already clear from the intake or the lawyer asks for them. When records are produced or confirmed, add them to corroboratedFacts/sourceLinks; when records cannot be produced, add the specific missing item to missingEvidence. Output valid JSON only.";

  const aiResult = await requestStructuredCompletion({
    userId,
    model: GAMEPLAY_MODEL,
    temperature: INTERVIEW_RESPONSE_TEMPERATURE,
    maxTokens: INTERVIEW_RESPONSE_MAX_TOKENS,
    retryAttempts: 1,
    usageLabel: "intake.partyResponse",
    promptCacheKey: buildGameplayPromptCacheKey({
      caseSession,
      phase: "intake",
      family: "partyResponse",
      model: GAMEPLAY_MODEL,
    }),
    onUsage: usageCollector.record,
    systemPrompt: clientResponseSystemPrompt,
    userPrompt: JSON.stringify({
      stage: "interview",
      task: clientMemoryResult.clientMemory
        ? `Answer the lawyer's latest question as ${playerPartyName}. You are the represented ${playerSide} side. Use the stored freeform client memory story, memoryClaims, current visible fact sheet, and recent transcript to choose what this person would naturally say and what they would keep back for now. Add newMemoryClaims only for plausible party-side factual claims newly asserted in this answer.`
        : `Answer the lawyer's latest question as ${playerPartyName}. You are the represented ${playerSide} side. Use the hidden canonical world and your side-specific memory to choose what this person would naturally say and what they would keep back for now.`,
      roleArchitecture: {
        representedPartyName: playerPartyName,
        representedLegalPartyName: legalPartyName,
        interviewSubject,
        opposingPartyName,
        representedSide: playerSide,
        overview: buildOverviewForSide(template, playerSide),
        desiredRelief: buildDesiredReliefForSide(template, playerSide),
        actorContext: interviewContext,
      },
      outputSchema: {
        partyResponse: "string",
        newMemoryClaims: [
          {
            text: "string",
            topicKey: "string",
            side: "client|opponent",
            stance: "claims|denies|admits|uncertain",
          },
        ],
        summary: "string",
        theory: "string",
        desiredRelief: "string",
        revealedFactIds: ["string"],
        revealedEvidenceIds: ["string"],
        timeline: ["string"],
        supportingFacts: ["string"],
        risks: ["string"],
        knownClaims: ["string"],
        disputedFacts: ["string"],
        corroboratedFacts: ["string"],
        sourceLinks: ["string"],
        missingEvidence: ["string"],
        openQuestions: ["string"],
        relatedFactIds: ["string"],
      },
      currentFactSheet: currentConversationFactSheet,
      recentTranscript: caseSession.interviewTranscript.slice(-6),
      latestQuestion: question,
    }),
  });

  const interviewResult = normalizeInterviewResult({
    aiResult,
    template,
    caseSession,
    question,
    factSheet: currentConversationFactSheet,
    playerSide,
  });
  const nextClientMemory = withClientMemoryClaims(
    clientMemoryResult.clientMemory,
    interviewResult.newMemoryClaims,
    playerSide
  );

  const conversationPatch = await buildConversationFactSheetPatch({
    userId,
    currentFactSheet: currentConversationFactSheet,
    recentTranscript: caseSession.interviewTranscript.slice(-8),
    latestQuestion: question,
    latestAnswer: interviewResult.partyResponse,
    caseSession,
    playerSide,
    playerPartyName: legalPartyName,
    opposingPartyName,
    onUsage: usageCollector.record,
  });
  const memoryClaimPatch = buildMemoryClaimFactSheetPatch({
    ownClaims: getClientMemoryClaims(nextClientMemory, playerSide),
    opposingClaims: buildTemplateOpposingMemoryClaims({
      template,
      playerSide,
    }),
    side: playerSide,
  });
  const combinedPatch = mergeFactSheetPatches(memoryClaimPatch, conversationPatch);
  const nextFactSheet = mergeFactSheet(currentConversationFactSheet, combinedPatch, template, {
    playerSide,
  });
  const nextAssessment = await assessCaseSuccessChance({
    userId,
    caseSession,
    factSheet: nextFactSheet,
    latestQuestion: question,
    latestAnswer: interviewResult.partyResponse,
    previousAssessment: caseSession.caseAssessment,
    usageLabel: "intake.assessment",
    onUsage: usageCollector.record,
  });

  return {
    ...interviewResult,
    clientMemory:
      clientMemoryResult.created || interviewResult.newMemoryClaims.length
        ? nextClientMemory
        : null,
    interviewSubjectName: playerPartyName,
    patch: combinedPatch,
    nextFactSheet,
    caseAssessment: nextAssessment,
    usageEntries: usageCollector.entries,
    clientMemoryExcerpt,
  };
};

const mergeFactSheetPatches = (...patches) => {
  const normalizedPatches = patches
    .filter(Boolean)
    .map((patch) => normalizeFactSheetPatch(patch));
  const listFields = [
    "summary",
    "theory",
    "desiredRelief",
    "timeline",
    "supportingFacts",
    "risks",
    "knownFacts",
    "knownClaims",
    "disputedFacts",
    "corroboratedFacts",
    "sourceLinks",
    "missingEvidence",
    "openQuestions",
    "discoveredFactIds",
    "discoveredClaimIds",
    "discoveredEvidenceIds",
  ];

  return normalizeFactSheetPatch(
    listFields.reduce((merged, field) => {
      merged[field] = uniqueList(normalizedPatches.flatMap((patch) => patch[field] || []));
      return merged;
    }, {})
  );
};

export const assessCaseSuccessChance = async ({
  userId,
  caseSession,
  factSheet,
  latestQuestion = "",
  latestAnswer = "",
  previousAssessment = null,
  usageLabel = "intake.assessment",
  onUsage,
}) => {
  const template = ensureTemplate(getTemplate(caseSession));
  const playerSide = getPlayerSide(caseSession);
  const rules = getLawbookRules().map((rule) => ({
    id: rule.id,
    title: rule.title,
    principle: rule.principle,
  }));
  const visibleTranscript = [
    ...(caseSession.interviewTranscript || []).slice(-8),
    latestQuestion
      ? {
          role: "player",
          speaker: "You",
          text: latestQuestion,
        }
      : null,
    latestAnswer
      ? {
          role: "party",
          speaker: getPartyName(template, playerSide),
          text: latestAnswer,
        }
      : null,
  ].filter(Boolean);

  try {
    const aiResult = await requestStructuredCompletion({
      userId,
      model: GAMEPLAY_MODEL,
      temperature: 0.25,
      maxTokens: 600,
      retryAttempts: 1,
      usageLabel,
      promptCacheKey: buildGameplayPromptCacheKey({
        caseSession,
        phase: usageLabel.startsWith("courtroom") ? "courtroom" : "intake",
        family: "assessment",
        model: GAMEPLAY_MODEL,
      }),
      onUsage,
      systemPrompt:
        "You estimate the player's chance of winning a legal simulation if they go to court with only the visible case file. Use only the supplied transcript, fact sheet, side, and public lawbook labels. Do not infer from hidden truth, canonical story, template facts, or evidence that is not visible. Output valid JSON only.",
      userPrompt: JSON.stringify({
        task: "Estimate the player's success chance from the visible intake record.",
        representedSide: playerSide,
        representedPartyName: getPartyName(template, playerSide),
        opposingPartyName: getPartyName(template, getOpposingSide(playerSide)),
        lawbookRules: rules,
        scoringGuidance: [
          "Higher chance for corroborated facts, specific timeline, clear requested relief, and addressed disputes.",
          "Lower chance for missing evidence, vague memory, unresolved risks, unsupported key points, and thin legal fit.",
          "Return 0-100 as the player's chance to win in court with this record.",
          "Give 2-3 short tooltip reasons.",
        ],
        outputSchema: {
          successChance: "number",
          reasons: ["string"],
        },
        factSheet,
        recentTranscript: visibleTranscript,
      }),
    });

    return normalizeCaseAssessment(aiResult, previousAssessment);
  } catch (error) {
    console.error("case success assessment failed", error);
    return normalizeCaseAssessment(previousAssessment);
  }
};

export const lockAssessmentForCourt = (assessment = null) => lockCaseAssessment(assessment);

const buildConversationFactSheetPatch = async ({
  userId,
  currentFactSheet,
  recentTranscript,
  latestQuestion,
  latestAnswer,
  caseSession,
  playerSide,
  playerPartyName,
  opposingPartyName,
  onUsage,
}) => {
  try {
    const aiResult = await requestStructuredCompletion({
      userId,
      model: GAMEPLAY_MODEL,
      temperature: 0.35,
      maxTokens: 900,
      retryAttempts: 1,
      usageLabel: "intake.factSheetPatch",
      promptCacheKey: buildGameplayPromptCacheKey({
        caseSession,
        phase: "intake",
        family: "factSheetPatch",
        model: GAMEPLAY_MODEL,
      }),
      onUsage,
      systemPrompt:
        "You update a lawyer's private working fact sheet from the conversation only. You do not know the hidden case truth, canonical story, template facts, evidence graph, or any source outside the transcript you are given. Write short, neutral lawyer notes, not transcript summaries or client voice. If something was not said or clearly implied in the conversation, leave it out. Output valid JSON only.",
      userPrompt: JSON.stringify({
        task: "Create a fact-sheet patch from only the visible intake conversation.",
        representedSide: playerSide,
        representedPartyName: playerPartyName,
        opposingPartyName,
        styleRules: [
          "Use concise bullet fragments, not paragraphs.",
          "Use neutral lawyer-note voice only. Never write in first person.",
          "Do not copy the client's answer into the fact sheet.",
          "Each note should usually be 4 to 12 words.",
          "Add at most one new note per section for this exchange.",
          "Do not start any note with 'I,' 'my,' 'we,' 'our,' 'I recall,' 'I believe,' or 'what I have.'",
          "Avoid boilerplate prefixes; write the note itself.",
          "Merge with existing notes mentally and only add a note if it is materially new, sharper, or more specific.",
          "Do not state anything as proven unless the client actually said it or produced it.",
          "Only put concrete evidence artifacts in corroboratedFacts, such as a receipt, photo, text message, invoice, letter, inspection report, checklist, or named witness. Never put raw client testimony, denials, vague labels like 'relevant messages,' or full client answer text in corroboratedFacts.",
          "When naming evidence, identify the artifact and purpose where possible, such as 'Texts approving launch' rather than 'messages.'",
          "If the client confirms a photo, record, invoice, receipt, document, witness, or other proof exists, was shown, was produced, or is in hand, put a short artifact label in corroboratedFacts.",
          "If the client says proof your side needs does not exist, was not shown, cannot be provided, or still needs to be found, put that note in missingEvidence.",
          "If the client says the opposing side controls or failed to provide proof for its own position, do not put that in missingEvidence. Put it in supportingFacts or disputedFacts as an opponent proof problem.",
          "Do not mention canonical truth, hidden facts, templates, schemas, or source of truth.",
          "Return only new or revised notes supported by the visible conversation.",
        ],
        outputSchema: {
          summary: ["string"],
          theory: ["string"],
          desiredRelief: ["string"],
          timeline: ["string"],
          supportingFacts: ["string"],
          risks: ["string"],
          knownClaims: ["string"],
          disputedFacts: ["string"],
          corroboratedFacts: ["string"],
          sourceLinks: ["string"],
          missingEvidence: ["string"],
          openQuestions: ["string"],
        },
        currentFactSheet,
        recentTranscript,
        latestExchange: {
          playerQuestion: latestQuestion,
          clientAnswer: latestAnswer,
        },
      }),
    });

    const patch = normalizeFactSheetPatch({
      summary: coerceStringList(aiResult?.summary, 3),
      theory: coerceStringList(aiResult?.theory, 3),
      desiredRelief: coerceStringList(aiResult?.desiredRelief, 2),
      timeline: coerceStringList(aiResult?.timeline, 4),
      supportingFacts: coerceStringList(aiResult?.supportingFacts, 5),
      risks: coerceStringList(aiResult?.risks, 4),
      knownFacts: [],
      knownClaims: coerceStringList(aiResult?.knownClaims, 5),
      disputedFacts: coerceStringList(aiResult?.disputedFacts, 4),
      corroboratedFacts: coerceStringList(aiResult?.corroboratedFacts, 4),
      sourceLinks: coerceStringList(aiResult?.sourceLinks, 4),
      missingEvidence: coerceStringList(aiResult?.missingEvidence, 4),
      openQuestions: coerceStringList(aiResult?.openQuestions, 3),
      discoveredFactIds: [],
      discoveredClaimIds: [],
      discoveredEvidenceIds: [],
    });

    if (
      patch.summary.length ||
      patch.theory.length ||
      patch.desiredRelief.length ||
      patch.timeline.length ||
      patch.supportingFacts.length ||
      patch.risks.length ||
      patch.disputedFacts.length ||
      patch.corroboratedFacts.length ||
      patch.missingEvidence.length
    ) {
      return patch;
    }
  } catch (error) {
    console.error("conversation fact sheet update failed", error);
  }

  return normalizeFactSheetPatch({});
};

export const rebuildFactSheetFromTranscript = ({ caseSession, template }) => {
  ensureTemplate(template || getTemplate(caseSession));
  return blankConversationFactSheet();
};

export const generatePlaintiffCourtOpeningStatement = async ({
  caseSession,
  userId,
  onUsage,
}) => {
  const template = ensureTemplate(getTemplate(caseSession));
  const rules = getLawbookRules();
  const playerSide = getPlayerSide(caseSession);
  const plaintiffSide = getOpposingSide(playerSide);
  const aiResult = await requestStructuredCompletion({
    userId,
    model: GAMEPLAY_MODEL,
    temperature: 0.65,
    maxTokens: 700,
    retryAttempts: 1,
    usageLabel: "courtroom.opening",
    promptCacheKey: buildGameplayPromptCacheKey({
      caseSession,
      phase: "courtroom",
      family: "opening",
      model: GAMEPLAY_MODEL,
    }),
    onUsage,
    systemPrompt:
      "You are simulating opposing counsel's opening statement in a legal strategy game. The player represents the defense/opposing side, so you speak for the plaintiff/client side. Use only the supplied courtroom architecture, lawbook rules, and side file. Write courtroom advocacy, not a template, product explanation, coaching note, dossier summary, or deterministic script. Do not mention the fact sheet, prepared case file, game, score, pressure, schemas, hidden data, or internal records. Output JSON only.",
    userPrompt: JSON.stringify({
      task: "Generate the plaintiff-side opening statement that starts court before the defense/player responds.",
      representedOpeningParty: getPartyName(template, plaintiffSide),
      defenseParty: getPartyName(template, playerSide),
      courtroomArchitecture: buildCourtroomAgentContext({
        caseSession,
        template,
        rules,
        counselAnalysis: {},
        shouldReturnVerdict: false,
      }),
      styleRules: [
        "Write as plaintiff-side counsel speaking aloud to the judge.",
        "Keep it concise: 2 to 5 short paragraphs.",
        "Sound human and adversarial, not like a generated checklist.",
        "Argue from the plaintiff-side record and requested relief.",
        "Do not use repeated formula lines like 'The evidence will show' for every point.",
        "Do not compliment, coach, or address the player.",
      ],
      outputSchema: {
        openingStatement: "string",
      },
    }),
  });
  const openingStatement = coerceString(aiResult?.openingStatement);

  if (!openingStatement) {
    throw new Error("Courtroom opening generation returned no statement.");
  }

  return openingStatement;
};

export const runCourtroomRound = async ({ caseSession, argument, userId }) => {
  const usageCollector = createUsageCollector("courtroom");
  const template = ensureTemplate(getTemplate(caseSession));
  const rules = getLawbookRules();
  const shouldReturnVerdict =
    caseSession.score.roundsCompleted + 1 >= caseSession.maxCourtRounds;
  const difficultyProfile = getCourtroomDifficultyProfile(caseSession.complexity);

  const counselAnalysisResult = await requestStructuredCompletion({
    userId,
    model: GAMEPLAY_MODEL,
    temperature: 0.6,
    maxTokens: 900,
    retryAttempts: 1,
    usageLabel: "courtroom.counselAnalysis",
    promptCacheKey: buildGameplayPromptCacheKey({
      caseSession,
      phase: "courtroom",
      family: "counselAnalysis",
      model: GAMEPLAY_MODEL,
    }),
    onUsage: usageCollector.record,
    systemPrompt:
      "You are simulating the player's side counsel in a legal game. Your job is not to invent new facts. Read the player's latest courtroom argument as an attempted advocacy move, then interpret the strongest responsible version of it using only the public case file and lawbook rules already available to the player. Output valid JSON only.",
    userPrompt: JSON.stringify({
      task: "Interpret the player's courtroom move as a counsel-side position statement before the opponent responds.",
      stage: "courtroom",
      counselContext: buildCounselContext({ caseSession, template, rules }),
      outputSchema: {
        playerTheory: "string",
        citedFacts: ["string"],
        citedClaimIds: ["string"],
        citedRules: ["string"],
        strengths: ["string"],
        weaknesses: ["string"],
      },
      latestPlayerArgument: argument,
    }),
  });
  const counselAnalysis = normalizeCounselAnalysis({
    aiResult: counselAnalysisResult,
    caseSession,
    rules,
  });

  const aiResult = await requestStructuredCompletion({
    userId,
    model: GAMEPLAY_MODEL,
    temperature: 0.65,
    maxTokens: 1500,
    retryAttempts: 1,
    usageLabel: shouldReturnVerdict ? "courtroom.roundWithVerdict" : "courtroom.round",
    promptCacheKey: buildGameplayPromptCacheKey({
      caseSession,
      phase: "courtroom",
      family: shouldReturnVerdict ? "roundWithVerdict" : "round",
      model: GAMEPLAY_MODEL,
    }),
    onUsage: usageCollector.record,
    systemPrompt:
      "You are simulating a courtroom exchange in a legal strategy game. The courtroom is fully record-bound. Use role actors, not deterministic scripts. One role is the player's counsel position, one role is opposing counsel, and one role is the bench. Opposing counsel is always talented, adversarial, strategic, and professionally restrained: they should attack the player's legal theory, proof, credibility, requested relief, or handling of disputes using only opposingCounsel.preparedCaseFile, the lawbook, and the courtroom transcript. Opposing counsel may make narrow concessions only when they are tactically necessary, but must not compliment, praise, coach, validate, or give feedback on the player's advocacy. The bench should score the exchange based only on each side's visible courtroom file, facts actually presented, argument quality, proof gaps, the lawbook, judge profile, and hidden courtroom calibration. The bench must apply every materially cited lawbook rule that fits the visible record, including category-specific rules, and must follow the bench ruleApplicationGuidance when weighing burden, proof, and remedies. Do not infer, cite, or credit any fact, story detail, claim, or evidence outside the supplied side files. Outcomes may vary in close cases based on judicial weighting, but they must remain explainable and sensitive to the record. Never reveal or refer to calibration, difficulty, complexity scaling, junior counsel, senior counsel, scoring bounds, or hidden tuning in player-facing text. Do not narrate metadata or internal schemas. Output JSON only.",
    userPrompt: JSON.stringify({
      task: shouldReturnVerdict
        ? "Generate the opposing counsel response, the bench scoring, and the final verdict."
        : "Generate the opposing counsel response and the bench scoring for this round.",
      stage: "courtroom",
      opponentResponseRules: [
        "Write the opponentResponse as opposing counsel's courtroom argument only.",
        "Make opponentResponse sound like counsel speaking aloud to the judge. Use courtroom advocacy, not product, coaching, dossier, or internal case-analysis language.",
        "Do not mention the fact sheet, prepared case file, public case file, proof gaps, player, game, scoring, pressure, strengths, weaknesses, hidden data, or internal records as labels. Say evidence, testimony, documents, burden, record, counsel, client, or Court instead.",
        "Do not start with praise, compliments, validation, or debate-club etiquette.",
        "Do not say the player's argument is good, strong, compelling, persuasive, fair, valid, or well argued.",
        "Do not coach the player or explain how they could improve.",
        "If acknowledging an undisputed fact, immediately pivot to why it does not carry the legal burden or requested relief.",
        ...difficultyProfile.promptGuidance,
        ...getOpponentResponsePromptRules(difficultyProfile),
        "Never mention the hidden courtroom calibration or why the response is more focused or more layered.",
        "Use only opposingCounsel.preparedCaseFile as opposing counsel's factual and evidentiary portfolio.",
        "Do not cite or imply hidden canonical story facts, full template facts, or unsurfaced evidence.",
      ],
      verdictPerspectiveRules: [
        "Round scores measure advocacy performance only; they do not decide who legally wins the verdict.",
        "If returning a verdict, winner must match the legal ruling stated in summary: use player when the represented player's side wins, opponent when opposing counsel's side wins, and draw only for a true split or too-close ruling.",
        "A side can score higher on argument quality and still lose if the legal elements, burden, or requested remedy are not proven.",
        "If returning a verdict, explicitly apply any category-specific lawbook rules that materially fit the case, especially Rule 9 and Rule 11 in security-deposit disputes.",
        "If returning a verdict in a security-deposit dispute, address burden allocation: the tenant must show withholding and the challenged deduction theory; the landlord must justify deductions with itemization, actual costs, or specific condition evidence.",
        "If returning a verdict, treat visible approximate party-side amounts as claims or testimony. Approximation may limit the size or precision of relief, but it should not by itself erase the claim.",
        "If returning a verdict, prefer partial relief or a reduced award when the record supports an improper deduction category but not the full requested amount.",
        "If returning a verdict, highlights must list only points that helped the represented player's side.",
        "If returning a verdict, concerns must list only points that weakened the represented player's side.",
        "Do not put adverse findings against the represented player in highlights, even if they were important to the court's ruling.",
        "Write verdict.summary, highlights, and concerns for the player as the reader. Prefer 'you', 'your side', and 'the other side' over role labels like plaintiff or defendant.",
        "Still respect representedSide when using 'you': 'you' means only the represented player's side, not the opposing side.",
        "Keep highlights and concerns short, direct, and player-facing: for example, 'You established the deposit amount' or 'You did not tie the requested relief to specific deductions.'",
        "Do not prefix highlights or concerns with bullets, hyphens, numbering, or markdown.",
      ],
      outputSchema: {
        opponentResponse: "string",
        playerDelta: "number",
        opponentDelta: "number",
        citedFacts: ["string"],
        citedRules: ["string"],
        citedClaimIds: ["string"],
        strengths: ["string"],
        weaknesses: ["string"],
        benchSignal: "string",
        verdict: shouldReturnVerdict
          ? {
              winner: "player|opponent|draw",
              summary: "string",
              highlights: ["string"],
              concerns: ["string"],
            }
          : null,
      },
      courtroomArchitecture: buildCourtroomAgentContext({
        caseSession,
        template,
        rules,
        counselAnalysis,
        shouldReturnVerdict,
      }),
      latestPlayerArgument: argument,
    }),
  });

  return {
    ...normalizeCourtResult({
      aiResult,
      counselAnalysis,
      shouldReturnVerdict,
      caseSession,
      rules,
    }),
    usageEntries: usageCollector.entries,
  };
};

export const finalizeFactSheetInput = ({ factSheet, caseTemplate }) => {
  const template = ensureTemplate(
    caseTemplate?.toJSON ? caseTemplate.toJSON() : caseTemplate
  );
  const normalized = mergeFactSheet(
    {
      summary: [],
      timeline: [],
      supportingFacts: [],
      risks: [],
      theory: [],
      desiredRelief: [],
      openQuestions: [],
      knownFacts: [],
      knownClaims: [],
      disputedFacts: [],
      corroboratedFacts: [],
      sourceLinks: [],
      missingEvidence: [],
      discoveredFactIds: [],
      discoveredClaimIds: [],
      discoveredEvidenceIds: [],
      ready: false,
    },
    factSheet,
    template
  );

  const completedSections = [
    normalized.theory.length,
    normalized.timeline.length,
    normalized.supportingFacts.length || normalized.knownClaims.length,
    normalized.risks.length,
    normalized.disputedFacts.length,
    normalized.corroboratedFacts.length,
    normalized.missingEvidence.length,
    normalized.desiredRelief.length,
  ].filter(Boolean).length;
  const hasCaseSubstance = Boolean(
    normalized.theory.length ||
      normalized.timeline.length ||
      normalized.supportingFacts.length ||
      normalized.knownClaims.length ||
      normalized.disputedFacts.length ||
      normalized.corroboratedFacts.length
  );
  const missing = [];
  const warnings = [];

  if (!normalized.theory.length) {
    warnings.push("case theory");
  }
  if (!normalized.timeline.length) {
    warnings.push("timeline");
  }
  if (
    normalized.supportingFacts.length < 2 &&
    normalized.knownClaims.length < 1 &&
    normalized.corroboratedFacts.length < 1
  ) {
    warnings.push("supporting facts or records");
  }
  if (normalized.risks.length === 0 && normalized.disputedFacts.length === 0) {
    warnings.push("dispute or risk");
  }
  if (!normalized.desiredRelief.length) {
    missing.push("requested relief");
  }
  if (!hasCaseSubstance) {
    missing.push("at least one claim, fact, dispute, or record");
  }
  if (completedSections < 4) {
    missing.push("at least four case-file sections");
  }

  return {
    factSheet: {
      ...normalized,
      ready: missing.length === 0,
    },
    missing,
    warnings,
  };
};
