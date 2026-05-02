import "server-only";

import {
  buildSuggestedQuestionsForSide,
  cleanPartyClaimText,
  dedupeSuggestedQuestions,
  enrichTemplateForGameplay,
  getEvidenceItemsForFact,
  getInterviewBlueprintForSide,
  normalizeTemplateParty,
} from "../templateInterview";
import { buildStoryContextForSide, getCanonicalStoryWorld } from "../storyWorld";

export const uniqueList = (items = []) =>
  [...new Set(items.filter(Boolean).map((item) => String(item).trim()).filter(Boolean))];

export const clamp = (value, min, max) => Math.min(Math.max(value, min), max);
export const lowerFirst = (value = "") =>
  value ? `${value.charAt(0).toLowerCase()}${value.slice(1)}` : "";
export const LOW_SIGNAL_TOKENS = new Set([
  "about",
  "after",
  "before",
  "does",
  "have",
  "kind",
  "landlord",
  "person",
  "questions",
  "reasons",
  "repairs",
  "send",
  "sent",
  "tell",
  "that",
  "what",
  "when",
  "where",
  "which",
  "with",
  "would",
  "your",
]);
export const DEFAULT_PLAYER_SIDE = "client";
export const OPPOSING_SIDE = {
  client: "opponent",
  opponent: "client",
};
export const tokenize = (value = "") =>
  String(value)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((token) => token.length > 2 && !LOW_SIGNAL_TOKENS.has(token));

export const countSharedTokens = (left = "", right = "") => {
  const leftTokens = new Set(tokenize(left));
  const rightTokens = new Set(tokenize(right));

  let matches = 0;
  leftTokens.forEach((token) => {
    if (rightTokens.has(token)) {
      matches += 1;
    }
  });

  return matches;
};

export const hashString = (value = "") => {
  let hash = 0;

  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }

  return hash;
};

export const humanizeClaimText = (value = "") => {
  const text = String(value || "").trim();

  if (!text) {
    return "";
  }

  return text
    .replace(/\bfrom the modeled claims\b/gi, "")
    .replace(/\bmodeled claims\b/gi, "what I remember")
    .replace(/\bmodelled claims\b/gi, "what I remember")
    .replace(/\bclient account pending refinement\b/gi, "I need to explain that more clearly")
    .replace(
      /\bthe opponent would use this point to challenge the client's credibility:\s*/gi,
      ""
    )
    .replace(
      /\bthe opponent is likely to minimize the importance of this event or frame it differently:\s*/gi,
      ""
    )
    .replace(/\bopponent disputes the client's framing\b/gi, "they're going to dispute my side of it")
    .replace(/\bI don't have (a|any) (modeled|modelled) claim here\b/gi, "I do not remember the exact detail")
    .replace(/\bthe client\b/gi, "I")
    .replace(/\s{2,}/g, " ")
    .replace(/\s+\./g, ".")
    .trim();
};

export const stripClaimScaffolding = (value = "") =>
  cleanPartyClaimText(
    String(value || "")
      .trim()
      .replace(/\bfrom the modeled claims\b/gi, "")
      .replace(/\bmodeled claims\b/gi, "what I remember")
      .replace(/\bmodelled claims\b/gi, "what I remember")
      .replace(/\bclient account pending refinement\b/gi, "I need to explain that more clearly")
      .replace(/\bI don't have (a|any) (modeled|modelled) claim here\b/gi, "I do not remember the exact detail")
      .replace(/\s{2,}/g, " ")
      .replace(/\s+\./g, ".")
  );

export const isMetaResponse = (value = "") => {
  const text = String(value || "").trim().toLowerCase();

  if (!text) {
    return true;
  }

  return [
    "modeled claim",
    "modelled claim",
    "pending refinement",
    "schema",
    "exact words",
    "i don't have a modeled claim",
    "i dont have a modeled claim",
    "i don't have any modeled claim",
    "i dont have any modeled claim",
  ].some((pattern) => text.includes(pattern));
};

export const toSpokenSentence = (value = "") => {
  const text = humanizeClaimText(value);
  if (!text) {
    return "";
  }

  return text.charAt(0).toLowerCase() + text.slice(1);
};

export const getTemplate = (caseSession) => {
  const populatedTemplate = caseSession.caseTemplateId?.toJSON
    ? caseSession.caseTemplateId.toJSON()
    : caseSession.caseTemplateId;
  const usableTemplate =
    populatedTemplate && (populatedTemplate.title || populatedTemplate.overview)
      ? populatedTemplate
      : null;

  return (
    usableTemplate ||
    caseSession.templateSnapshot || {
        title: caseSession.title,
        slug: caseSession.templateSlug || caseSession.scenarioId,
        overview: caseSession.premise?.overview || "",
        desiredRelief: caseSession.premise?.desiredRelief || "",
        openingStatement: caseSession.premise?.openingStatement || "",
        starterTheory: caseSession.factSheet?.theory || "",
        practiceArea: caseSession.practiceArea,
        primaryCategory: caseSession.primaryCategory,
        complexity: caseSession.complexity,
        courtName: caseSession.premise?.courtName || "",
        plaintiffName: caseSession.premise?.clientName || "",
        defendantName: caseSession.premise?.opponentName || "",
        legalTags: [],
        canonicalStory: caseSession.canonicalStory || null,
      }
  );
};

export const ensureTemplate = (template) => ({
  canonicalFacts: [],
  evidenceItems: [],
  interviewBlueprint: {},
  legalTags: [],
  overview: "",
  starterTheory: "",
  desiredRelief: "",
  clientName: "Client",
  opponentName: "Opponent",
  title: "Case",
  ...enrichTemplateForGameplay(template || {}),
  canonicalStory: getCanonicalStoryWorld(template || {}),
});

export const getClaimId = (factId, party) => `${party}:${factId}`;
export const getTemplatePartyForSessionSide = (side) =>
  normalizeTemplateParty(side === "opponent" ? "defendant" : "plaintiff");
export const getOtherTemplateParty = (templateSide) =>
  templateSide === "defendant" ? "plaintiff" : "defendant";

export const getClaimForParty = (fact, party) =>
  (fact.claims || []).find(
    (claim) => claim.party === getTemplatePartyForSessionSide(party)
  ) || null;

export const getPlayerSide = (caseSession) =>
  caseSession?.playerSide === "opponent" ? "opponent" : DEFAULT_PLAYER_SIDE;

export const getOpposingSide = (side) => OPPOSING_SIDE[side] || DEFAULT_PLAYER_SIDE;

export const getPartyName = (template, side) =>
  side === "opponent" ? template.opponentName : template.clientName;
export const getPartyProfileForSide = (template, side) =>
  template.partyProfiles?.[getTemplatePartyForSessionSide(side)] || {
    communicationStyle: "plain",
    intelligence: 0.5,
    memoryDiscipline: 0.5,
    honesty: 0.7,
    emotionalControl: 0.5,
    speechDeterminism: 0.5,
  };

export const buildDesiredReliefForSide = (template, side) =>
  side === "client"
    ? template.desiredRelief
    : `Deny or materially reduce ${template.clientName}'s requested relief.`;

export const buildTheoryForSide = (template, side) =>
  side === "client"
    ? template.starterTheory
    : `${template.opponentName} should prevail because the record leaves enough dispute, credibility pressure, or proof gaps to defeat ${template.clientName}'s request for relief.`;

export const buildOverviewForSide = (template, side) => {
  if (side === "client") {
    return template.overview;
  }

  const requestedRelief = String(template.desiredRelief || "").trim();

  return requestedRelief
    ? `${template.opponentName} is defending against ${template.clientName}'s request for ${requestedRelief.charAt(0).toLowerCase()}${requestedRelief.slice(
        1
      )}`
    : `${template.opponentName} is defending against ${template.clientName}'s claims in ${template.courtName}.`;
};

export const buildSummaryForSide = (template, side) => {
  const playerPartyName = getPartyName(template, side);
  const sideLabel = side === "client" ? "claimant-side" : "defense-side";

  return `${buildOverviewForSide(template, side)} ${playerPartyName} is building the strongest ${sideLabel} record available.`;
};

export const buildInterviewDisputeNote = (item) => {
  const label = String(item.fact.label || item.fact.canonicalDetail || "this point").trim();
  return `The other side may dispute ${lowerFirst(label)}.`;
};

export const sortClaimsByRecallPriority = (claims = []) =>
  [...claims].sort((left, right) => {
    const leftScore =
      (left.fact.discoverability?.priority || 0) +
      (left.playerClaim.confidence || 0) * 2 +
      (left.playerClaim.accessLevel === "direct"
        ? 1
        : left.playerClaim.accessLevel === "partial"
        ? 0.4
        : 0);
    const rightScore =
      (right.fact.discoverability?.priority || 0) +
      (right.playerClaim.confidence || 0) * 2 +
      (right.playerClaim.accessLevel === "direct"
        ? 1
        : right.playerClaim.accessLevel === "partial"
        ? 0.4
        : 0);

    return rightScore - leftScore;
  });

export const buildMemoryStyleClaimText = (claim, fact, profile = {}, question = "") => {
  const detail = humanizeClaimText(claim?.claimedDetail || "");

  if (!detail) {
    return "";
  }

  const confidence = claim?.confidence ?? 0.75;
  const accessLevel = claim?.accessLevel || "direct";
  const stance = claim?.stance || "admits";
  const communicationStyle = profile.communicationStyle || "plain";
  const speechDeterminism = profile.speechDeterminism ?? 0.5;
  const memoryDiscipline = profile.memoryDiscipline ?? 0.5;
  const honesty = profile.honesty ?? 0.7;
  const styleKey = `${question}:${fact?.factId || ""}:${claim?.claimedDetail || ""}`;
  const variantIndex = hashString(styleKey) % 3;

  if (speechDeterminism < 0.4 && variantIndex === 1 && confidence < 0.75) {
    return `I think ${lowerFirst(detail)}`;
  }

  if (stance === "omits" || confidence < 0.45 || memoryDiscipline < 0.4) {
    return variantIndex === 0
      ? `I may not have this exactly right, but ${lowerFirst(detail)}`
      : `I am not totally sure I have this straight, but ${lowerFirst(detail)}`;
  }

  if (accessLevel === "hearsay") {
    return variantIndex === 0
      ? `What I heard was that ${lowerFirst(detail)}`
      : `From what I was told, ${lowerFirst(detail)}`;
  }

  if (accessLevel === "partial" || confidence < 0.7) {
    return variantIndex === 0
      ? `As I remember it, ${lowerFirst(detail)}`
      : `As best as I can recall, ${lowerFirst(detail)}`;
  }

  if (fact?.kind === "risk") {
    return communicationStyle === "guarded" || honesty < 0.55
      ? `I guess what worries me is that ${lowerFirst(detail)}`
      : `What worries me is that ${lowerFirst(detail)}`;
  }

  if (communicationStyle === "precise" && confidence >= 0.75) {
    return detail;
  }

  if (communicationStyle === "rambling" && speechDeterminism < 0.6) {
    return variantIndex === 0
      ? `I mean, from where I sit, ${lowerFirst(detail)}`
      : `The way I remember it, ${lowerFirst(detail)}`;
  }

  if (communicationStyle === "guarded") {
    return `From what I can say for sure, ${lowerFirst(detail)}`;
  }

  if (communicationStyle === "combative") {
    return `Look, ${lowerFirst(detail)}`;
  }

  return detail;
};
export const formatOpponentPosition = (value = "") => {
  const cleaned = stripClaimScaffolding(value);

  if (!cleaned) {
    return "";
  }

  if (
    /^(the other side|the opposing side|opposing counsel|opposing party|the opposition)\b/i.test(
      cleaned
    )
  ) {
    return cleaned;
  }

  return `The other side is likely to argue that ${cleaned.charAt(0).toLowerCase()}${cleaned.slice(
    1
  )}`;
};

export const normalizeFactSheetPatch = (patch = {}) => ({
  ...patch,
  timeline: (patch.timeline || []).map((item) => humanizeClaimText(item)),
  supportingFacts: (patch.supportingFacts || []).map((item) =>
    humanizeClaimText(item)
  ),
  risks: (patch.risks || []).map((item) => humanizeClaimText(item)),
  knownFacts: (patch.knownFacts || []).map((item) => humanizeClaimText(item)),
  knownClaims: (patch.knownClaims || []).map((item) => humanizeClaimText(item)),
  disputedFacts: (patch.disputedFacts || []).map((item) =>
    formatOpponentPosition(item)
  ),
  corroboratedFacts: (patch.corroboratedFacts || []).map((item) =>
    humanizeClaimText(item)
  ),
  sourceLinks: patch.sourceLinks || [],
  missingEvidence: (patch.missingEvidence || []).map((item) => humanizeClaimText(item)),
  openQuestions: patch.openQuestions || [],
  discoveredFactIds: patch.discoveredFactIds || [],
  discoveredClaimIds: patch.discoveredClaimIds || [],
  discoveredEvidenceIds: patch.discoveredEvidenceIds || [],
});

export const buildOpenQuestions = (
  template,
  side,
  excludedFactIds = [],
  excludedEvidenceIds = [],
  limit = 3
) =>
  buildSuggestedQuestionsForSide(ensureTemplate(template), side, {
    excludedFactIds,
    excludedEvidenceIds,
    limit,
  });

export const getInterviewQuestionHistory = (caseSession, currentQuestion = "") =>
  uniqueList([
    ...((caseSession?.interviewTranscript || [])
      .filter((entry) => entry.role === "player")
      .map((entry) => entry.text)),
    currentQuestion,
  ]);

export const resolveFactSheetOpenQuestions = ({
  template,
  playerSide = DEFAULT_PLAYER_SIDE,
  currentOpenQuestions = [],
  patchOpenQuestions = [],
  discoveredFactIds = [],
  discoveredEvidenceIds = [],
  blockedQuestions = [],
  limit = 3,
}) =>
  dedupeSuggestedQuestions(
    [
      ...(patchOpenQuestions || []),
      ...(currentOpenQuestions || []),
      ...buildOpenQuestions(
        template,
        playerSide,
        discoveredFactIds,
        discoveredEvidenceIds,
        Math.max(limit * 4, 8)
      ),
    ],
    {
      excludedQuestions: blockedQuestions,
      limit,
    }
  );

export const mergeFactSheet = (current, patch, template, options = {}) => {
  const {
    playerSide = DEFAULT_PLAYER_SIDE,
    questionHistory = [],
    openQuestionLimit = 3,
  } = options;
  const safeTemplate = ensureTemplate(template);
  const normalizedCurrent = normalizeFactSheetPatch(current);
  const normalizedPatch = normalizeFactSheetPatch(patch);
  const discoveredFactIds = uniqueList([
    ...(normalizedCurrent.discoveredFactIds || []),
    ...(normalizedPatch.discoveredFactIds || []),
  ]);
  const discoveredClaimIds = uniqueList([
    ...(normalizedCurrent.discoveredClaimIds || []),
    ...(normalizedPatch.discoveredClaimIds || []),
  ]);
  const discoveredEvidenceIds = uniqueList([
    ...(normalizedCurrent.discoveredEvidenceIds || []),
    ...(normalizedPatch.discoveredEvidenceIds || []),
  ]);
  const openQuestions = resolveFactSheetOpenQuestions({
    template: safeTemplate,
    playerSide,
    currentOpenQuestions: normalizedCurrent.openQuestions || [],
    patchOpenQuestions: normalizedPatch.openQuestions || [],
    discoveredFactIds,
    discoveredEvidenceIds,
    blockedQuestions: questionHistory,
    limit: openQuestionLimit,
  });
  const next = {
    ...current,
    summary:
      normalizedPatch.summary?.trim() ||
      normalizedCurrent.summary ||
      buildSummaryForSide(safeTemplate, playerSide),
    timeline: uniqueList([
      ...(normalizedCurrent.timeline || []),
      ...(normalizedPatch.timeline || []),
    ]),
    supportingFacts: uniqueList([
      ...(normalizedCurrent.supportingFacts || []),
      ...(normalizedPatch.supportingFacts || []),
    ]),
    risks: uniqueList([
      ...(normalizedCurrent.risks || []),
      ...(normalizedPatch.risks || []),
    ]),
    theory:
      normalizedPatch.theory?.trim() ||
      normalizedCurrent.theory ||
      buildTheoryForSide(safeTemplate, playerSide),
    desiredRelief:
      normalizedPatch.desiredRelief?.trim() ||
      normalizedCurrent.desiredRelief ||
      buildDesiredReliefForSide(safeTemplate, playerSide),
    openQuestions,
    knownFacts: uniqueList([
      ...(normalizedCurrent.knownFacts || []),
      ...(normalizedPatch.knownFacts || []),
    ]),
    knownClaims: uniqueList([
      ...(normalizedCurrent.knownClaims || []),
      ...(normalizedPatch.knownClaims || []),
    ]),
    disputedFacts: uniqueList([
      ...(normalizedCurrent.disputedFacts || []),
      ...(normalizedPatch.disputedFacts || []),
    ]),
    corroboratedFacts: uniqueList([
      ...(normalizedCurrent.corroboratedFacts || []),
      ...(normalizedPatch.corroboratedFacts || []),
    ]),
    sourceLinks: uniqueList([
      ...(normalizedCurrent.sourceLinks || []),
      ...(normalizedPatch.sourceLinks || []),
    ]),
    missingEvidence: uniqueList([
      ...(normalizedCurrent.missingEvidence || []),
      ...(normalizedPatch.missingEvidence || []),
    ]),
    discoveredFactIds,
    discoveredClaimIds,
    discoveredEvidenceIds,
  };

  next.ready =
    Boolean(next.summary && next.theory && next.desiredRelief) &&
    next.timeline.length >= 1 &&
    (next.supportingFacts.length >= 2 || next.corroboratedFacts.length >= 1);

  return next;
};

export const coerceString = (value = "") =>
  typeof value === "string" ? value.trim() : "";

export const coerceStringList = (value, limit = Infinity) =>
  uniqueList((Array.isArray(value) ? value : []).map((item) => coerceString(item))).slice(
    0,
    limit
  );

export const sanitizeIdList = (value, validIds = [], limit = 8) => {
  const validSet = new Set(validIds);

  return coerceStringList(value, limit * 2)
    .filter((item) => validSet.has(item))
    .slice(0, limit);
};

export const hasOpponentPraise = (value = "") =>
  [
    /\b(?:good|great|excellent|strong|solid|compelling|persuasive)\s+argument\b/i,
    /\b(?:well argued|well said|nicely put|fair point)\b/i,
    /\b(?:you|counsel)\s+(?:make|made|raise|raised)\s+(?:a\s+)?(?:good|great|strong|solid|fair|valid|compelling|persuasive)\s+point\b/i,
    /\b(?:i|we)\s+(?:appreciate|commend|respect|acknowledge)\s+(?:your|counsel's)\s+(?:argument|point|position|advocacy)\b/i,
    /\bopposing counsel(?:'s)?\s+(?:argument|point|position)\s+is\s+(?:good|great|strong|solid|fair|valid|compelling|persuasive)\b/i,
  ].some((pattern) => pattern.test(String(value || "")));

export const normalizeOpponentResponse = (value, fallback = "") => {
  const response = coerceString(value);

  if (!response || hasOpponentPraise(response)) {
    return fallback;
  }

  return response;
};

export const buildEvidencePromptPacket = (item = {}, discoveredEvidenceIds = []) => ({
  id: item.id,
  label: item.label,
  detail: item.detail,
  type: item.type,
  availabilityStatus: item.availabilityStatus,
  holderSide: item.holderSide,
  linkedFactIds: item.linkedFactIds || [],
  surfacedToLawyer: discoveredEvidenceIds.includes(item.id),
});

export const buildClaimPromptPacket = (claim = null) =>
  claim
    ? {
        claimedDetail: claim.claimedDetail,
        stance: claim.stance,
        confidence: claim.confidence,
        accessLevel: claim.accessLevel,
        deceptionProfile: claim.deceptionProfile,
        keywords: claim.keywords || [],
      }
    : null;

export const buildRoleFactPacket = ({
  template,
  fact,
  playerSide,
  discoveredFactIds = [],
  discoveredEvidenceIds = [],
}) => {
  const playerClaim = getClaimForParty(fact, playerSide);
  const opposingClaim = getClaimForParty(fact, getOpposingSide(playerSide));

  return {
    factId: fact.factId,
    label: fact.label,
    kind: fact.kind,
    truthStatus: fact.truthStatus,
    phase: fact.discoverability?.phase || "interview",
    priority: fact.discoverability?.priority || 3,
    canonicalTruth: fact.canonicalDetail,
    surfacedToLawyer: discoveredFactIds.includes(fact.factId),
    myVersion: buildClaimPromptPacket(playerClaim),
    otherSideVersion: buildClaimPromptPacket(opposingClaim),
    linkedEvidence: getEvidenceItemsForFact(template, fact).map((item) =>
      buildEvidencePromptPacket(item, discoveredEvidenceIds)
    ),
  };
};

export const buildCanonicalWorldPacket = (template, discoveredFactIds = [], discoveredEvidenceIds = []) => ({
  facts: (template.canonicalFacts || []).map((fact) => ({
    factId: fact.factId,
    label: fact.label,
    kind: fact.kind,
    truthStatus: fact.truthStatus,
    canonicalDetail: fact.canonicalDetail,
    phase: fact.discoverability?.phase || "interview",
    priority: fact.discoverability?.priority || 3,
    evidenceRefs: fact.evidenceRefs || [],
    surfacedToLawyer: discoveredFactIds.includes(fact.factId),
  })),
  evidence: (template.evidenceItems || []).map((item) =>
    buildEvidencePromptPacket(item, discoveredEvidenceIds)
  ),
});

export const buildInterviewAgentContext = ({ template, playerSide, factSheet }) => {
  const safeTemplate = ensureTemplate(template);
  const templateSide = getTemplatePartyForSessionSide(playerSide);
  const blueprint = getInterviewBlueprintForSide(safeTemplate, templateSide);

  return {
    representedParty: {
      side: templateSide,
      name: getPartyName(safeTemplate, playerSide),
      objective: buildDesiredReliefForSide(safeTemplate, playerSide),
      profile: getPartyProfileForSide(safeTemplate, playerSide),
      opening: blueprint?.opening || "",
      posture: blueprint?.posture || "",
      suggestedQuestions: blueprint?.suggestedQuestions || [],
      priorityFactIds: blueprint?.priorityFactIds || [],
      storyMemory: buildStoryContextForSide(safeTemplate, templateSide),
    },
    otherParty: {
      side: getTemplatePartyForSessionSide(getOpposingSide(playerSide)),
      name: getPartyName(safeTemplate, getOpposingSide(playerSide)),
    },
    canonicalWorld: buildCanonicalWorldPacket(
      safeTemplate,
      factSheet.discoveredFactIds || [],
      factSheet.discoveredEvidenceIds || []
    ),
    representedPartyMemory: (safeTemplate.canonicalFacts || []).map((fact) =>
      buildRoleFactPacket({
        template: safeTemplate,
        fact,
        playerSide,
        discoveredFactIds: factSheet.discoveredFactIds || [],
        discoveredEvidenceIds: factSheet.discoveredEvidenceIds || [],
      })
    ),
    canonicalStoryWorld: getCanonicalStoryWorld(safeTemplate),
  };
};
