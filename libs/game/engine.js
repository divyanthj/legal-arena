import "server-only";

import { requestStructuredCompletion } from "@/libs/gpt";
import { getLawbookRules } from "@/data/legalArenaLawbook";
import {
  buildMissingEvidenceNotesForSide,
  buildSuggestedQuestionsForSide,
  cleanPartyClaimText,
  enrichTemplateForGameplay,
  getEvidenceItemsForFact,
  getInterviewBlueprintForSide,
  normalizeTemplateParty,
} from "./templateInterview";

const uniqueList = (items = []) =>
  [...new Set(items.filter(Boolean).map((item) => String(item).trim()).filter(Boolean))];

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);
const lowerFirst = (value = "") =>
  value ? `${value.charAt(0).toLowerCase()}${value.slice(1)}` : "";
const LOW_SIGNAL_TOKENS = new Set([
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
const DEFAULT_PLAYER_SIDE = "client";
const OPPOSING_SIDE = {
  client: "opponent",
  opponent: "client",
};
const tokenize = (value = "") =>
  String(value)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((token) => token.length > 2 && !LOW_SIGNAL_TOKENS.has(token));

const countSharedTokens = (left = "", right = "") => {
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

const hashString = (value = "") => {
  let hash = 0;

  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }

  return hash;
};

const humanizeClaimText = (value = "") => {
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

const stripClaimScaffolding = (value = "") =>
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

const isMetaResponse = (value = "") => {
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

const toSpokenSentence = (value = "") => {
  const text = humanizeClaimText(value);
  if (!text) {
    return "";
  }

  return text.charAt(0).toLowerCase() + text.slice(1);
};

const getTemplate = (caseSession) =>
  caseSession.caseTemplateId?.toJSON
    ? caseSession.caseTemplateId.toJSON()
    : caseSession.caseTemplateId;

const ensureTemplate = (template) => ({
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
});

const getClaimId = (factId, party) => `${party}:${factId}`;
const getTemplatePartyForSessionSide = (side) =>
  normalizeTemplateParty(side === "opponent" ? "defendant" : "plaintiff");
const getOtherTemplateParty = (templateSide) =>
  templateSide === "defendant" ? "plaintiff" : "defendant";

const getClaimForParty = (fact, party) =>
  (fact.claims || []).find(
    (claim) => claim.party === getTemplatePartyForSessionSide(party)
  ) || null;

const getPlayerSide = (caseSession) =>
  caseSession?.playerSide === "opponent" ? "opponent" : DEFAULT_PLAYER_SIDE;

const getOpposingSide = (side) => OPPOSING_SIDE[side] || DEFAULT_PLAYER_SIDE;

const getPartyName = (template, side) =>
  side === "opponent" ? template.opponentName : template.clientName;
const getPartyProfileForSide = (template, side) =>
  template.partyProfiles?.[getTemplatePartyForSessionSide(side)] || {
    communicationStyle: "plain",
    intelligence: 0.5,
    memoryDiscipline: 0.5,
    honesty: 0.7,
    emotionalControl: 0.5,
    speechDeterminism: 0.5,
  };

const buildDesiredReliefForSide = (template, side) =>
  side === "client"
    ? template.desiredRelief
    : `Deny or materially reduce ${template.clientName}'s requested relief.`;

const buildTheoryForSide = (template, side) =>
  side === "client"
    ? template.starterTheory
    : `${template.opponentName} should prevail because the record leaves enough dispute, credibility pressure, or proof gaps to defeat ${template.clientName}'s request for relief.`;

const buildOverviewForSide = (template, side) => {
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

const buildSummaryForSide = (template, side) => {
  const playerPartyName = getPartyName(template, side);
  const sideLabel = side === "client" ? "claimant-side" : "defense-side";

  return `${buildOverviewForSide(template, side)} ${playerPartyName} is building the strongest ${sideLabel} record available.`;
};

const buildInterviewDisputeNote = (item) => {
  const label = String(item.fact.label || item.fact.canonicalDetail || "this point").trim();
  return `The other side may dispute ${lowerFirst(label)}.`;
};

const sortClaimsByRecallPriority = (claims = []) =>
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

const buildMemoryStyleClaimText = (claim, fact, profile = {}, question = "") => {
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

const buildRelevantMissingEvidenceNotes = ({
  safeTemplate,
  playerSide,
  partyClaims = [],
  matchedEvidence = [],
}) => {
  const linkedEvidence = uniqueList([
    ...matchedEvidence.map((item) => item.id),
    ...partyClaims.flatMap((item) =>
      getEvidenceItemsForFact(safeTemplate, item.fact).map((evidenceItem) => evidenceItem.id)
    ),
  ])
    .map((id) => (safeTemplate.evidenceItems || []).find((item) => item.id === id))
    .filter(Boolean)
    .filter((item) => item.availabilityStatus !== "confirmed");

  return uniqueList(
    linkedEvidence.map((item) => buildMissingEvidenceNotesForSide({
      ...safeTemplate,
      evidenceItems: [item],
    }, playerSide)[0]).filter(Boolean)
  );
};

const formatOpponentPosition = (value = "") => {
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

const normalizeFactSheetPatch = (patch = {}) => ({
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

const buildOpenQuestions = (
  template,
  side,
  excludedFactIds = [],
  excludedEvidenceIds = []
) =>
  buildSuggestedQuestionsForSide(ensureTemplate(template), side, {
    excludedFactIds,
    excludedEvidenceIds,
  });

const mergeFactSheet = (current, patch, template) => {
  const safeTemplate = ensureTemplate(template);
  const normalizedCurrent = normalizeFactSheetPatch(current);
  const normalizedPatch = normalizeFactSheetPatch(patch);
  const next = {
    ...current,
    summary:
      normalizedPatch.summary?.trim() ||
      normalizedCurrent.summary ||
      safeTemplate.overview,
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
      safeTemplate.starterTheory,
    desiredRelief:
      normalizedPatch.desiredRelief?.trim() ||
      normalizedCurrent.desiredRelief ||
      safeTemplate.desiredRelief,
    openQuestions: uniqueList(
      normalizedPatch.openQuestions ||
        normalizedCurrent.openQuestions ||
        buildOpenQuestions(safeTemplate, DEFAULT_PLAYER_SIDE)
    ),
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
    discoveredFactIds: uniqueList([
      ...(normalizedCurrent.discoveredFactIds || []),
      ...(normalizedPatch.discoveredFactIds || []),
    ]),
    discoveredClaimIds: uniqueList([
      ...(normalizedCurrent.discoveredClaimIds || []),
      ...(normalizedPatch.discoveredClaimIds || []),
    ]),
    discoveredEvidenceIds: uniqueList([
      ...(normalizedCurrent.discoveredEvidenceIds || []),
      ...(normalizedPatch.discoveredEvidenceIds || []),
    ]),
  };

  next.ready =
    Boolean(next.summary && next.theory && next.desiredRelief) &&
    next.timeline.length >= 1 &&
    (next.supportingFacts.length >= 2 || next.corroboratedFacts.length >= 1);

  return next;
};

const scoreFactForQuestion = (fact, question, playerSide, template) => {
  const templateSide = getTemplatePartyForSessionSide(playerSide);
  const playerClaim = (fact.claims || []).find((claim) => claim.party === templateSide);
  const blueprint = getInterviewBlueprintForSide(template, templateSide);
  const priorityBoost = (blueprint?.priorityFactIds || []).includes(fact.factId) ? 3 : 0;
  const questionTokens = tokenize(question);
  const keywords = uniqueList([
    ...(playerClaim?.keywords || []),
  ]);
  const searchableTokens = uniqueList([
    ...keywords.flatMap((keyword) => tokenize(keyword)),
    ...tokenize(playerClaim?.claimedDetail || ""),
    ...((fact.followUpQuestions || []).flatMap((value) => tokenize(value))),
  ]);

  const exactMatchCount = searchableTokens.filter((token) =>
    questionTokens.includes(token)
  ).length;
  const partialMatchCount = searchableTokens.filter((token) =>
    question.toLowerCase().includes(token)
  ).length;
  const minimumSignal =
    exactMatchCount > 0 || partialMatchCount >= 2 || questionTokens.length <= 2;

  if (!minimumSignal) {
    return 0;
  }

  return (
    exactMatchCount * 2 +
    partialMatchCount * 0.5 +
    (fact.discoverability?.priority || 0) / 10 +
    priorityBoost
  );
};

const pickRelevantFacts = (template, question, playerSide, discoveredFactIds = []) => {
  const safeTemplate = ensureTemplate(template);
  const templateSide = getTemplatePartyForSessionSide(playerSide);
  const blueprint = getInterviewBlueprintForSide(safeTemplate, templateSide);
  const interviewFacts = (safeTemplate.canonicalFacts || []).filter(
    (fact) =>
      fact.discoverability?.phase !== "courtroom" &&
      (fact.claims || []).some((claim) => claim.party === templateSide)
  );

  const ranked = interviewFacts
    .map((fact) => ({
      fact,
      score: scoreFactForQuestion(fact, question, playerSide, safeTemplate),
    }))
    .sort((left, right) => right.score - left.score);

  const topScore = ranked[0]?.score || 0;
  const relevanceThreshold =
    topScore >= 4 ? Math.max(2.5, topScore * 0.6) : topScore >= 2 ? 2 : Infinity;
  const matched = ranked
    .filter((entry) => entry.score >= relevanceThreshold)
    .map((entry) => entry.fact);

  if (matched.length > 0) {
    const freshMatches = matched.filter(
      (fact) => !discoveredFactIds.includes(fact.factId)
    );

    return freshMatches.length > 0 ? freshMatches : matched;
  }

  return [];
};

const scoreEvidenceForQuestion = (item, question, template, playerSide) => {
  const safeTemplate = ensureTemplate(template);
  const templateSide = getTemplatePartyForSessionSide(playerSide);
  const otherTemplateSide = getOtherTemplateParty(templateSide);
  const linkedFacts = (safeTemplate.canonicalFacts || []).filter((fact) =>
    (item.linkedFactIds || []).includes(fact.factId)
  );
  const playerClaims = linkedFacts
    .map((fact) => (fact.claims || []).find((claim) => claim.party === templateSide))
    .filter(Boolean);
  const canSeeEvidenceDetail =
    item.holderSide !== otherTemplateSide || item.availabilityStatus !== "confirmed";
  const questionTokens = tokenize(question);
  const searchableTokens = uniqueList([
    ...((item.followUpQuestions || []).flatMap((value) => tokenize(value))),
    ...playerClaims.flatMap((claim) => tokenize(claim.claimedDetail)),
    ...playerClaims.flatMap((claim) => claim.keywords || []).flatMap((value) => tokenize(value)),
    ...(canSeeEvidenceDetail ? tokenize(item.label) : []),
    ...(canSeeEvidenceDetail ? tokenize(item.detail) : []),
  ]);

  const exactMatchCount = searchableTokens.filter((token) =>
    questionTokens.includes(token)
  ).length;
  const partialMatchCount = searchableTokens.filter((token) =>
    question.toLowerCase().includes(token)
  ).length;
  const minimumSignal =
    exactMatchCount > 0 || partialMatchCount >= 2 || questionTokens.length <= 2;

  if (!minimumSignal) {
    return 0;
  }

  return exactMatchCount * 2 + partialMatchCount * 0.5;
};

const pickRelevantEvidence = (
  template,
  question,
  playerSide,
  discoveredEvidenceIds = []
) => {
  const safeTemplate = ensureTemplate(template);
  const evidenceItems = safeTemplate.evidenceItems || [];
  const ranked = evidenceItems
    .map((item) => ({
      item,
      score: scoreEvidenceForQuestion(item, question, safeTemplate, playerSide),
    }))
    .sort((left, right) => right.score - left.score);

  const topScore = ranked[0]?.score || 0;
  const relevanceThreshold =
    topScore >= 3 ? Math.max(2, topScore * 0.6) : topScore >= 1.5 ? 1.5 : Infinity;
  const matched = ranked
    .filter((entry) => entry.score >= relevanceThreshold)
    .map((entry) => entry.item);

  if (matched.length > 0) {
    const freshMatches = matched.filter(
      (item) => !discoveredEvidenceIds.includes(item.id)
    );

    return freshMatches.length > 0 ? freshMatches : matched;
  }

  return [];
};

const buildEvidenceResponseSegment = (item, side) => {
  const label = String(item.label || item.detail || "that record").trim();
  const lowerLabel = label.charAt(0).toLowerCase() + label.slice(1);
  const templateSide = getTemplatePartyForSessionSide(side);
  const holderIsSelf = item.holderSide === templateSide || item.holderSide === "shared";
  const holderIsOtherParty =
    (side === "client" && item.holderSide === "defendant") ||
    (side === "opponent" && item.holderSide === "plaintiff");

  switch (item.availabilityStatus) {
    case "confirmed":
      if (holderIsOtherParty) {
        return `They should have ${lowerLabel}, and that is something we can press on.`;
      }
      if (item.holderSide === "third-party") {
        return `A third party should have ${lowerLabel} on that point.`;
      }
      return `I can point to ${lowerLabel} on that point.`;
    case "mentioned":
      if (holderIsOtherParty) {
        return `I think they may have ${lowerLabel}, but I have not confirmed it yet.`;
      }
      if (item.holderSide === "third-party") {
        return `I think a third party may have ${lowerLabel}, but I have not confirmed it yet.`;
      }
      return `I think there should be ${lowerLabel}, but I cannot say that for certain yet.`;
    case "missing":
      if (holderIsOtherParty) {
        return `I do not have ${lowerLabel}, and the other side may be the one holding it.`;
      }
      return `I do not have ${lowerLabel} in hand yet.`;
    case "contested":
      return `There is ${lowerLabel}, but the other side is likely to fight over what it really shows.`;
    default:
      return `I am not sure yet whether ${lowerLabel} exists or who has it.`;
  }
};

const buildEvidencePossessionResponse = (item, side) => {
  const label = String(item.label || item.detail || "that record").trim();
  const lowerLabel = lowerFirst(label);
  const templateSide = getTemplatePartyForSessionSide(side);
  const holderIsSelf = item.holderSide === templateSide || item.holderSide === "shared";
  const holderIsOtherParty =
    (side === "client" && item.holderSide === "defendant") ||
    (side === "opponent" && item.holderSide === "plaintiff");

  if (holderIsOtherParty) {
    return `No, I do not have ${lowerLabel}. The other side should be the one with it.`;
  }

  if (item.holderSide === "third-party") {
    return `No, I do not have ${lowerLabel}. A third party is more likely to have it.`;
  }

  switch (item.availabilityStatus) {
    case "confirmed":
      return holderIsSelf
        ? `Yes, I have ${lowerLabel}.`
        : `Yes, ${lowerLabel} should be available to both sides.`;
    case "missing":
      return `No, I do not have ${lowerLabel}.`;
    case "mentioned":
    case "unknown":
      return holderIsSelf
        ? `No, I cannot say that I have ${lowerLabel} right now.`
        : `No, I do not have ${lowerLabel} right now.`;
    case "contested":
      return holderIsSelf
        ? `Yes, I have ${lowerLabel}, but there may be a fight about what it really shows.`
        : `There is ${lowerLabel}, but there may be a fight about what it really shows.`;
    default:
      return `No, I do not have ${lowerLabel} right now.`;
  }
};

const evidenceIsHeldByOtherParty = (item, side) =>
  (side === "client" && item.holderSide === "defendant") ||
  (side === "opponent" && item.holderSide === "plaintiff");

const findSupportingEvidenceForClaims = ({
  matchedEvidence = [],
  partyClaims = [],
  playerSide,
}) => {
  const linkedFactIds = new Set(partyClaims.map((item) => item.fact.factId));
  const claimCorpus = partyClaims
    .map((item) =>
      [
        item.playerClaim?.claimedDetail || "",
        item.fact?.canonicalDetail || "",
        item.fact?.label || "",
      ].join(" ")
    )
    .join(" ");

  return matchedEvidence.filter((item) => {
    if (item.availabilityStatus !== "confirmed") {
      return false;
    }

    if (evidenceIsHeldByOtherParty(item, playerSide)) {
      return false;
    }

    const linkedToClaim = (item.linkedFactIds || []).some((factId) => linkedFactIds.has(factId));
    if (!linkedToClaim) {
      return false;
    }

    const evidenceCorpus = [item.label || "", item.detail || ""].join(" ");
    return countSharedTokens(evidenceCorpus, claimCorpus) > 0;
  });
};

const buildEvidenceHolderResponseSegment = (item) => {
  const label = String(item.label || item.detail || "that record").trim();
  const lowerLabel = label.charAt(0).toLowerCase() + label.slice(1);

  switch (item.holderSide) {
    case "third-party":
      return item.availabilityStatus === "confirmed"
        ? `A third party has ${lowerLabel}, but I do not know which one yet.`
        : `I do not know which third party has ${lowerLabel} yet. I only know a third party may have it, but I have not confirmed who.`;
    case "shared":
      return `Both sides should be able to access ${lowerLabel}.`;
    case "plaintiff":
      return `From my side, I should be the one with ${lowerLabel}.`;
    case "defendant":
      return `The other side should be the one holding ${lowerLabel}.`;
    default:
      return `I do not know who has ${lowerLabel} yet.`;
  }
};

const MONTH_NAME_PATTERN =
  /\b(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|sept|oct|nov|dec)\b/i;
const EXACT_DATE_PATTERN =
  /\b\d{1,2}[/-]\d{1,2}(?:[/-]\d{2,4})?\b|\b\d{4}-\d{2}-\d{2}\b|\b\d{1,2}(st|nd|rd|th)\b/i;
const CONTACT_METHOD_PATTERN =
  /\b(phone|email|e-mail|text|sms|call|called|voicemail|letter|mail|mailed|portal|chat|in person|in-person)\b/i;
const AMOUNT_PATTERN =
  /\$\s?\d[\d,]*(?:\.\d{2})?|\b\d[\d,]*(?:\.\d{2})?\s?(dollars?|usd|bucks)\b/i;

const questionAsksForExactDate = (lowerQuestion = "") =>
  lowerQuestion.includes("exact date") ||
  lowerQuestion.includes("exact dates") ||
  lowerQuestion.includes("what date") ||
  lowerQuestion.includes("what dates") ||
  lowerQuestion.includes("which date") ||
  lowerQuestion.includes("which dates") ||
  lowerQuestion.includes("end date") ||
  lowerQuestion.includes("start date") ||
  lowerQuestion.includes("lease end") ||
  lowerQuestion.includes("lease start") ||
  lowerQuestion.includes("when exactly") ||
  (lowerQuestion.includes("date") &&
    (lowerQuestion.includes("pay") ||
      lowerQuestion.includes("paid") ||
      lowerQuestion.includes("due") ||
      lowerQuestion.includes("notice") ||
      lowerQuestion.includes("contact"))) ||
  (/\bwhen\b/.test(lowerQuestion) &&
    (lowerQuestion.includes("pay") ||
      lowerQuestion.includes("paid") ||
      lowerQuestion.includes("due") ||
      lowerQuestion.includes("served") ||
      lowerQuestion.includes("contacted")));

const questionAsksForContactMethod = (lowerQuestion = "") =>
  lowerQuestion.includes("contact method") ||
  lowerQuestion.includes("how did") ||
  lowerQuestion.includes("what method") ||
  lowerQuestion.includes("which method") ||
  lowerQuestion.includes("phone or email") ||
  (lowerQuestion.includes("contact") &&
    (lowerQuestion.includes("phone") ||
      lowerQuestion.includes("email") ||
      lowerQuestion.includes("text") ||
      lowerQuestion.includes("call") ||
      lowerQuestion.includes("method")));

const questionAsksForAmount = (lowerQuestion = "") =>
  lowerQuestion.includes("how much") ||
  lowerQuestion.includes("what amount") ||
  lowerQuestion.includes("what was the amount") ||
  lowerQuestion.includes("exact amount") ||
  lowerQuestion.includes("how many dollars");

const hasExactDateDetail = (value = "") =>
  MONTH_NAME_PATTERN.test(value) || EXACT_DATE_PATTERN.test(value);

const hasContactMethodDetail = (value = "") => CONTACT_METHOD_PATTERN.test(value);

const hasAmountDetail = (value = "") => AMOUNT_PATTERN.test(value);

const hasUncertaintyLanguage = (value = "") =>
  /\b(i do not|i don't|cannot|can't|not sure|do not have|don't have|do not know|don't know)\b/i.test(
    value
  );

const isResponsiveInterviewAnswer = (question = "", answer = "") => {
  const lowerQuestion = String(question || "").trim().toLowerCase();
  const normalizedAnswer = String(answer || "").trim();

  if (!normalizedAnswer) {
    return false;
  }

  if (questionAsksForExactDate(lowerQuestion)) {
    return hasExactDateDetail(normalizedAnswer) || hasUncertaintyLanguage(normalizedAnswer);
  }

  if (questionAsksForContactMethod(lowerQuestion)) {
    return (
      hasContactMethodDetail(normalizedAnswer) || hasUncertaintyLanguage(normalizedAnswer)
    );
  }

  if (questionAsksForAmount(lowerQuestion)) {
    return hasAmountDetail(normalizedAnswer) || hasUncertaintyLanguage(normalizedAnswer);
  }

  return true;
};

const buildSpecificDetailFallback = ({
  lowerQuestion,
  corpus,
  bestKnownDetail,
  matchedEvidence,
  supportingEvidence,
  leadQuestion,
  playerSide,
}) => {
  const proofQuestion =
    lowerQuestion.includes("concrete") ||
    lowerQuestion.includes("specific") ||
    lowerQuestion.includes("proof") ||
    lowerQuestion.includes("evidence") ||
    lowerQuestion.includes("record");
  const possessionQuestion =
    (lowerQuestion.includes("do you have") ||
      lowerQuestion.includes("did you have") ||
      lowerQuestion.includes("do you got") ||
      lowerQuestion.includes("have the") ||
      lowerQuestion.includes("have any") ||
      lowerQuestion.includes("have a") ||
      lowerQuestion.includes("got the") ||
      lowerQuestion.includes("got any") ||
      lowerQuestion.includes("did you take") ||
      lowerQuestion.includes("did you get") ||
      lowerQuestion.includes("is there a")) &&
    (lowerQuestion.includes("photo") ||
      lowerQuestion.includes("photos") ||
      lowerQuestion.includes("picture") ||
      lowerQuestion.includes("pictures") ||
      lowerQuestion.includes("video") ||
      lowerQuestion.includes("videos") ||
      lowerQuestion.includes("document") ||
      lowerQuestion.includes("documents") ||
      lowerQuestion.includes("record") ||
      lowerQuestion.includes("records") ||
      lowerQuestion.includes("email") ||
      lowerQuestion.includes("emails") ||
      lowerQuestion.includes("text") ||
      lowerQuestion.includes("texts") ||
      lowerQuestion.includes("message") ||
      lowerQuestion.includes("messages"));
  const asksForExactDate = questionAsksForExactDate(lowerQuestion);
  const asksForContactMethod = questionAsksForContactMethod(lowerQuestion);
  const asksForAmount = questionAsksForAmount(lowerQuestion);
  const bestEvidence = matchedEvidence[0] || null;

  if (asksForExactDate && !hasExactDateDetail(corpus)) {
    return `I do not have the exact date${lowerQuestion.includes("dates") ? "s" : ""} in front of me right now. The best I can say from what I have is that ${toSpokenSentence(
      bestKnownDetail
    ) || "I only remember the general sequence, not the exact day"}.${
      leadQuestion ? ` The next thing we should pin down is: ${leadQuestion}` : ""
    }`;
  }

  if (asksForContactMethod && !hasContactMethodDetail(corpus)) {
    return `I cannot confirm whether that was by phone, email, text, or something else from what I have right now.${
      supportingEvidence[0]
        ? ` ${buildEvidenceResponseSegment(supportingEvidence[0], playerSide)}`
        : leadQuestion
        ? ` The next thing we should pin down is: ${leadQuestion}`
        : ""
    }`;
  }

  if (asksForAmount && !hasAmountDetail(corpus)) {
    return `I do not have the exact amount in front of me right now.${
      leadQuestion ? ` The next thing we should pin down is: ${leadQuestion}` : ""
    }`;
  }

  if (proofQuestion && supportingEvidence.length === 0) {
    return `I do not have confirmed proof in hand on that point right now.${
      leadQuestion ? ` The next thing we should pin down is: ${leadQuestion}` : ""
    }`;
  }

  if (possessionQuestion && bestEvidence) {
    return buildEvidencePossessionResponse(bestEvidence, playerSide);
  }

  return "";
};

const buildInterviewFallback = ({ caseSession, template, question, factSheet }) => {
  const safeTemplate = ensureTemplate(template);
  const playerSide = getPlayerSide(caseSession);
  const opponentSide = getOpposingSide(playerSide);
  const partyProfile = getPartyProfileForSide(safeTemplate, playerSide);
  const lowerQuestion = String(question || "").trim().toLowerCase();
  const recentPartyResponses = caseSession.interviewTranscript
    .filter((entry) => entry.role === "party")
    .slice(-3)
    .map((entry) => entry.text?.trim())
    .filter(Boolean);
  const matchedFacts = pickRelevantFacts(
    safeTemplate,
    question,
    playerSide,
    factSheet.discoveredFactIds
  );

  const partyClaims = sortClaimsByRecallPriority(
    matchedFacts
    .map((fact) => ({
      fact,
      playerClaim: getClaimForParty(fact, playerSide),
      opposingClaim: getClaimForParty(fact, opponentSide),
    }))
    .filter((item) => item.playerClaim && !isMetaResponse(item.playerClaim.claimedDetail))
  );

  const factLinkedEvidence = uniqueList(
    partyClaims.flatMap((item) =>
      getEvidenceItemsForFact(safeTemplate, item.fact).map((evidenceItem) => evidenceItem.id)
    )
  )
    .map((id) => (safeTemplate.evidenceItems || []).find((item) => item.id === id))
    .filter(Boolean);
  const matchedEvidence = uniqueList([
    ...factLinkedEvidence.map((item) => item.id),
    ...pickRelevantEvidence(
      safeTemplate,
      question,
      playerSide,
      factSheet.discoveredEvidenceIds
    ).map(
      (item) => item.id
    ),
  ])
    .map((id) => (safeTemplate.evidenceItems || []).find((item) => item.id === id))
    .filter(Boolean);
  const supportingEvidence = findSupportingEvidenceForClaims({
    matchedEvidence,
    partyClaims,
    playerSide,
  });
  const remainingFacts = (safeTemplate.canonicalFacts || []).filter(
    (fact) => !factSheet.discoveredFactIds.includes(fact.factId)
  );
  const leadQuestion = buildOpenQuestions(
    safeTemplate,
    playerSide,
    factSheet.discoveredFactIds,
    factSheet.discoveredEvidenceIds
  )[0];
  const evidenceResponse = supportingEvidence
    .slice(0, 1)
    .map((item) => buildEvidenceResponseSegment(item, playerSide))
    .join(" ");
  const responseCorpus = uniqueList([
    ...partyClaims.map((item) => humanizeClaimText(item.playerClaim.claimedDetail)),
    ...matchedEvidence.flatMap((item) => [item.label, item.detail]),
  ]).join(" ");

  const primaryClaim = partyClaims[0] || null;
  const secondaryClaim = partyClaims[1] || null;

  let partyResponse =
    primaryClaim
      ? [
          buildMemoryStyleClaimText(
            primaryClaim.playerClaim,
            primaryClaim.fact,
            partyProfile,
            question
          ),
          secondaryClaim &&
          countSharedTokens(
            primaryClaim.playerClaim.claimedDetail,
            secondaryClaim.playerClaim.claimedDetail
          ) > 1
            ? `I also remember that ${toSpokenSentence(
                secondaryClaim.playerClaim.claimedDetail
              )}`
            : "",
          evidenceResponse,
        ]
          .filter(Boolean)
          .join(" ")
      : evidenceResponse
      ? evidenceResponse
      : remainingFacts.length === 0
      ? "I do not know anything more specific about that right now."
      : leadQuestion
      ? `I do not know that detail right now. The next thing we should pin down is: ${leadQuestion}`
      : "I do not know that detail right now.";
  const specificDetailFallback = buildSpecificDetailFallback({
    lowerQuestion,
    corpus: responseCorpus,
    bestKnownDetail: partyClaims[0]?.playerClaim?.claimedDetail || "",
    matchedEvidence,
    supportingEvidence,
    leadQuestion,
    playerSide,
  });

  const repeatedFallbackReply = recentPartyResponses.includes(partyResponse.trim());
  const holderQuestion =
    /\b(who|which)\b/.test(lowerQuestion) &&
    (lowerQuestion.includes("third party") ||
      lowerQuestion.includes("has it") ||
      lowerQuestion.includes("holds it") ||
      lowerQuestion.includes("who has"));
  const proofQuestion =
    lowerQuestion.includes("concrete") ||
    lowerQuestion.includes("specific") ||
    lowerQuestion.includes("proof") ||
    lowerQuestion.includes("evidence") ||
    lowerQuestion.includes("record");
  const thirdPartyEvidence = matchedEvidence.find(
    (item) => item.holderSide === "third-party"
  );

  if (specificDetailFallback) {
    partyResponse = specificDetailFallback;
  } else if (repeatedFallbackReply && holderQuestion && thirdPartyEvidence) {
    partyResponse = buildEvidenceHolderResponseSegment(thirdPartyEvidence);
  } else if (repeatedFallbackReply && proofQuestion && supportingEvidence[0]) {
    partyResponse = `The most concrete thing I can tell you right now is this: ${buildEvidenceResponseSegment(
      supportingEvidence[0],
      playerSide
    )}`;
  } else if (repeatedFallbackReply && leadQuestion) {
    partyResponse = `I do not know anything more specific about that right now. The next thing we should pin down is: ${leadQuestion}`;
  } else if (repeatedFallbackReply) {
    partyResponse = "I do not know anything more specific about that right now.";
  }

  const patch = {
    summary: factSheet.summary || "",
    timeline: partyClaims
      .filter((item) => item.fact.kind === "timeline")
      .slice(0, 1)
      .map((item) => humanizeClaimText(item.playerClaim.claimedDetail)),
    supportingFacts: partyClaims
      .filter((item) => item.fact.kind === "supporting")
      .slice(0, 1)
      .map((item) => humanizeClaimText(item.playerClaim.claimedDetail)),
    risks: partyClaims
      .filter((item) => item.fact.kind === "risk")
      .slice(0, 1)
      .map((item) => humanizeClaimText(item.playerClaim.claimedDetail)),
    theory: factSheet.theory || "",
    desiredRelief: factSheet.desiredRelief || "",
    knownFacts: [],
    knownClaims: partyClaims.map((item) =>
      humanizeClaimText(item.playerClaim.claimedDetail)
    ),
    disputedFacts: partyClaims
      .filter(
        (item) =>
          item.opposingClaim &&
          item.opposingClaim.claimedDetail !== item.playerClaim.claimedDetail
      )
      .slice(0, 1)
      .map((item) => buildInterviewDisputeNote(item)),
    corroboratedFacts: [],
    sourceLinks: [],
    missingEvidence: buildRelevantMissingEvidenceNotes({
      safeTemplate,
      playerSide,
      partyClaims,
      matchedEvidence,
    }),
    openQuestions: buildOpenQuestions(
      safeTemplate,
      playerSide,
      uniqueList([
        ...factSheet.discoveredFactIds,
        ...partyClaims.map((item) => item.fact.factId),
      ]),
      uniqueList([
        ...factSheet.discoveredEvidenceIds,
        ...matchedEvidence.map((item) => item.id),
      ])
    ).slice(0, 2),
    discoveredFactIds: partyClaims.map((item) => item.fact.factId),
    discoveredClaimIds: partyClaims.map((item) =>
      getClaimId(item.fact.factId, playerSide)
    ),
    discoveredEvidenceIds: matchedEvidence.map((item) => item.id),
  };

  const normalizedPatch = normalizeFactSheetPatch(patch);
  const nextFactSheet = mergeFactSheet(factSheet, normalizedPatch, safeTemplate);

  return {
    partyResponse,
    patch: normalizedPatch,
    nextFactSheet,
    relatedFactIds: uniqueList([
      ...partyClaims.map((item) => item.fact.factId),
      ...matchedEvidence.flatMap((item) => item.linkedFactIds || []),
    ]),
    discoveredClaimIds: normalizedPatch.discoveredClaimIds,
  };
};

const normalizeInterviewResult = ({ aiResult, fallback, template, question }) => {
  const safeTemplate = ensureTemplate(template);
  if (!aiResult || typeof aiResult !== "object") {
    return fallback;
  }

  const patch = normalizeFactSheetPatch({
    summary: fallback.patch.summary,
    timeline: fallback.patch.timeline,
    supportingFacts: fallback.patch.supportingFacts,
    risks: fallback.patch.risks,
    theory: fallback.patch.theory,
    desiredRelief: fallback.patch.desiredRelief,
    knownFacts: fallback.patch.knownFacts,
    knownClaims: fallback.patch.knownClaims,
    disputedFacts: fallback.patch.disputedFacts,
    corroboratedFacts: fallback.patch.corroboratedFacts,
    sourceLinks: fallback.patch.sourceLinks,
    missingEvidence: fallback.patch.missingEvidence,
    openQuestions: fallback.patch.openQuestions,
    discoveredFactIds: fallback.patch.discoveredFactIds,
    discoveredClaimIds: fallback.patch.discoveredClaimIds,
    discoveredEvidenceIds: fallback.patch.discoveredEvidenceIds,
  });

  return {
    partyResponse:
      aiResult.partyResponse &&
      !isMetaResponse(aiResult.partyResponse) &&
      isResponsiveInterviewAnswer(question, aiResult.partyResponse)
        ? humanizeClaimText(aiResult.partyResponse)
        : fallback.partyResponse,
    patch,
    nextFactSheet: mergeFactSheet(fallback.nextFactSheet, patch, safeTemplate),
    relatedFactIds:
      Array.isArray(aiResult.relatedFactIds) && aiResult.relatedFactIds.length > 0
        ? aiResult.relatedFactIds
        : fallback.relatedFactIds,
    discoveredClaimIds:
      Array.isArray(aiResult.discoveredClaimIds) &&
      aiResult.discoveredClaimIds.length > 0
        ? aiResult.discoveredClaimIds
        : fallback.discoveredClaimIds,
  };
};

const pickFactMentions = (argument, factSheet) => {
  const lowerArgument = argument.toLowerCase();

  return uniqueList(
    [
      ...(factSheet.supportingFacts || []),
      ...(factSheet.timeline || []),
      ...(factSheet.corroboratedFacts || []),
      ...(factSheet.knownFacts || []),
    ].filter((fact) => {
      const tokens = fact
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, " ")
        .split(/\s+/)
        .filter((token) => token.length > 4);

      return tokens.some((token) => lowerArgument.includes(token));
    })
  ).slice(0, 4);
};

const pickRuleMentions = (argument, rules) => {
  const lowerArgument = argument.toLowerCase();

  return rules
    .filter((rule) => {
      const titleTokens = rule.title
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, " ")
        .split(/\s+/)
        .filter((token) => token.length > 4);

      return (
        titleTokens.some((token) => lowerArgument.includes(token)) ||
        lowerArgument.includes(rule.id.replace(/-/g, " "))
      );
    })
    .map((rule) => rule.id)
    .slice(0, 3);
};

const pickClaimMentions = (argument, factSheet) => {
  const lowerArgument = argument.toLowerCase();

  return uniqueList(
    (factSheet.knownClaims || []).filter((claim) => {
      const tokens = claim
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, " ")
        .split(/\s+/)
        .filter((token) => token.length > 4);

      return tokens.some((token) => lowerArgument.includes(token));
    })
  ).slice(0, 3);
};

const buildCourtroomFallback = ({ caseSession, argument, rules, template }) => {
  const safeTemplate = ensureTemplate(template);
  const playerSide = getPlayerSide(caseSession);
  const opponentSide = getOpposingSide(playerSide);
  const citedFacts = pickFactMentions(argument, caseSession.factSheet);
  const citedRules = pickRuleMentions(argument, rules);
  const citedClaims = pickClaimMentions(argument, caseSession.factSheet);
  const lowerArgument = argument.toLowerCase();

  const addressesRisk = (caseSession.factSheet.risks || []).some((risk) =>
    risk
      .toLowerCase()
      .split(/\s+/)
      .filter((token) => token.length > 4)
      .some((token) => lowerArgument.includes(token))
  );

  const addressesDispute = (caseSession.factSheet.disputedFacts || []).some((dispute) =>
    dispute
      .toLowerCase()
      .split(/\s+/)
      .filter((token) => token.length > 4)
      .some((token) => lowerArgument.includes(token))
  );

  const corroboratedHits = (caseSession.factSheet.corroboratedFacts || []).filter(
    (fact) => citedFacts.includes(fact)
  ).length;

  const playerDelta = clamp(
    4 +
      corroboratedHits * 4 +
      (citedFacts.length - corroboratedHits) * 2 +
      citedRules.length * 4 +
      citedClaims.length * 1 +
      (addressesRisk ? 2 : 0) +
      (addressesDispute ? 3 : 0) +
      (argument.length > 240 ? 2 : 0),
    4,
    20
  );

  const unresolvedDisputes = clamp(
    (caseSession.factSheet.disputedFacts || []).length - (addressesDispute ? 1 : 0),
    0,
    3
  );
  const unresolvedRisks = clamp(
    (caseSession.factSheet.risks || []).length - (addressesRisk ? 1 : 0),
    0,
    3
  );
  const opponentDelta = clamp(
    5 +
      unresolvedDisputes * 3 +
      unresolvedRisks * 2 +
      (citedRules.length === 0 ? 2 : 0),
    4,
    18
  );

  const templateFacts = safeTemplate.canonicalFacts || [];
  const pressureFact =
    templateFacts[caseSession.score.roundsCompleted % templateFacts.length] || null;
  const opponentClaim = pressureFact ? getClaimForParty(pressureFact, opponentSide) : null;
  const opponentPartyName = getPartyName(safeTemplate, opponentSide);

  const opponentResponse = opponentClaim
    ? `Counsel for ${opponentPartyName} argues that ${opponentClaim.claimedDetail.charAt(0).toLowerCase()}${opponentClaim.claimedDetail.slice(
        1
      )}. They say the player's presentation leans too heavily on its own version instead of settled proof.`
    : `Counsel for ${opponentPartyName} argues that the player's record is too thin and the disputed facts cut against relief.`;

  const strengths = uniqueList([
    corroboratedHits > 0
      ? `You leaned on corroborated proof, not only unsupported narrative.`
      : "",
    citedFacts[0] ? `You grounded the argument in a concrete fact: ${citedFacts[0]}` : "",
    citedRules[0] ? `You tied the argument to ${citedRules[0]}.` : "",
    addressesDispute ? "You directly confronted the opposing side's framing." : "",
  ]).slice(0, 3);

  const weaknesses = uniqueList([
    citedRules.length === 0 ? "The argument did not clearly anchor itself to a lawbook rule." : "",
    !addressesRisk && caseSession.factSheet.risks[0]
      ? `A visible weakness remains unaddressed: ${caseSession.factSheet.risks[0]}`
      : "",
    !addressesDispute && caseSession.factSheet.disputedFacts[0]
      ? `You did not directly answer a live dispute: ${caseSession.factSheet.disputedFacts[0]}`
      : "",
    citedFacts.length === 0 ? "The bench still needs a more specific fact from the case file." : "",
  ]).slice(0, 3);

  const benchSignal =
    playerDelta >= opponentDelta
      ? "The judge seems to trust arguments more when they rest on corroborated facts rather than raw party statements."
      : "The judge appears concerned that the opposing side still has room to reframe the disputed record.";

  return {
    opponentResponse,
    playerDelta,
    opponentDelta,
    citedFacts,
    citedRules,
    citedClaimIds: citedClaims.slice(0, 3),
    strengths,
    weaknesses,
    benchSignal,
  };
};

const buildVerdictFallback = ({ updatedScore, rules, factSheet, template, playerSide }) => {
  const safeTemplate = ensureTemplate(template);
  const opponentSide = getOpposingSide(playerSide);
  const playerPartyName = getPartyName(safeTemplate, playerSide);
  const opponentPartyName = getPartyName(safeTemplate, opponentSide);
  const winner =
    updatedScore.player === updatedScore.opponent
      ? "draw"
      : updatedScore.player > updatedScore.opponent
      ? "player"
      : "opponent";

  const ruleLabel = rules[0]?.title || "the lawbook";
  const summary =
    winner === "player"
      ? `The court finds for ${playerPartyName}, concluding that the stronger corroborated record and better handling of disputed facts carried the day.`
      : winner === "opponent"
      ? `The court finds for ${opponentPartyName}, concluding that the player's showing relied too heavily on unresolved side-specific claims.`
      : "The court finds the record too closely balanced and declines to separate the parties decisively.";

  return {
    winner,
    summary,
    highlights: uniqueList([
      factSheet.corroboratedFacts[0] || factSheet.supportingFacts[0] || "",
      `The court relied heavily on ${ruleLabel}.`,
      updatedScore.highlights?.[0] || "",
    ]).slice(0, 3),
    concerns: uniqueList([
      factSheet.risks[0] || "",
      factSheet.disputedFacts[0] || "",
      updatedScore.weaknesses?.[0] || "",
    ]).slice(0, 3),
  };
};

const normalizeCourtResult = ({
  aiResult,
  fallback,
  shouldReturnVerdict,
  caseSession,
  rules,
  template,
}) => {
  const fallbackVerdict = shouldReturnVerdict
      ? buildVerdictFallback({
        updatedScore: {
          player: caseSession.score.player + fallback.playerDelta,
          opponent: caseSession.score.opponent + fallback.opponentDelta,
          highlights: fallback.strengths,
          weaknesses: fallback.weaknesses,
        },
        rules,
        factSheet: caseSession.factSheet,
        template,
        playerSide: getPlayerSide(caseSession),
      })
    : null;

  if (!aiResult || typeof aiResult !== "object") {
    return {
      ...fallback,
      verdict: fallbackVerdict,
    };
  }

  const normalized = {
    opponentResponse: aiResult.opponentResponse || fallback.opponentResponse,
    playerDelta:
      typeof aiResult.playerDelta === "number"
        ? clamp(aiResult.playerDelta, 1, 20)
        : fallback.playerDelta,
    opponentDelta:
      typeof aiResult.opponentDelta === "number"
        ? clamp(aiResult.opponentDelta, 1, 20)
        : fallback.opponentDelta,
    citedFacts: Array.isArray(aiResult.citedFacts)
      ? aiResult.citedFacts
      : fallback.citedFacts,
    citedRules: Array.isArray(aiResult.citedRules)
      ? aiResult.citedRules
      : fallback.citedRules,
    citedClaimIds: Array.isArray(aiResult.citedClaimIds)
      ? aiResult.citedClaimIds
      : fallback.citedClaimIds,
    strengths: Array.isArray(aiResult.strengths)
      ? aiResult.strengths
      : fallback.strengths,
    weaknesses: Array.isArray(aiResult.weaknesses)
      ? aiResult.weaknesses
      : fallback.weaknesses,
    benchSignal: aiResult.benchSignal || fallback.benchSignal,
  };

  if (!shouldReturnVerdict) {
    return {
      ...normalized,
      verdict: null,
    };
  }

  return {
    ...normalized,
    verdict:
      aiResult.verdict && typeof aiResult.verdict === "object"
        ? {
            winner: aiResult.verdict.winner || fallbackVerdict?.winner || "draw",
            summary: aiResult.verdict.summary || fallbackVerdict?.summary || "",
            highlights: Array.isArray(aiResult.verdict.highlights)
              ? aiResult.verdict.highlights
              : fallbackVerdict?.highlights || [],
            concerns: Array.isArray(aiResult.verdict.concerns)
              ? aiResult.verdict.concerns
              : fallbackVerdict?.concerns || [],
          }
        : fallbackVerdict,
  };
};

export const continueInterview = async ({ caseSession, question, userId }) => {
  const template = ensureTemplate(getTemplate(caseSession));
  const playerSide = getPlayerSide(caseSession);
  const playerPartyName = getPartyName(template, playerSide);
  const opposingPartyName = getPartyName(template, getOpposingSide(playerSide));
  const fallback = buildInterviewFallback({
    caseSession,
    template,
    question,
    factSheet: caseSession.factSheet,
  });

  const aiResult = await requestStructuredCompletion({
    userId,
    temperature: 0.4,
    maxTokens: 1100,
    retryAttempts: 1,
    systemPrompt:
      "You are roleplaying a legal-game party speaking to the player's lawyer during intake. Speak like a normal person in first person, not like a lawyer in court. Do not say 'Your Honor', 'Your Honour', 'may it please the court', 'counsel', or use courtroom advocacy language. Stay grounded in the provided claim layer, canonical fact layer, and evidence availability layer. Never invent unsupported facts or pretend uncertain evidence is confirmed. If a record is only mentioned, missing, or unknown, say so plainly. Output only valid JSON. Keep the fact sheet aligned to the represented side's perspective: supporting facts, risks, summary, theory, and relief should be framed for that side, while disputed facts should be phrased as what the other side is likely to argue.",
    userPrompt: JSON.stringify({
      task: `Answer the lawyer's latest question as ${playerPartyName}, the represented ${playerSide} side, using only the ${playerSide}-side claims that are modeled for the case, then update the structured knowledge sheet.`,
      caseTemplate: {
        title: template.title,
        clientName: template.clientName,
        opponentName: template.opponentName,
        representedPartyName: playerPartyName,
        opposingPartyName,
        representedSide: playerSide,
        representedPartyProfile: getPartyProfileForSide(template, playerSide),
        overview: buildOverviewForSide(template, playerSide),
        desiredRelief: buildDesiredReliefForSide(template, playerSide),
        interviewBlueprint: template.interviewBlueprint,
        partyProfiles: template.partyProfiles,
        canonicalFacts: template.canonicalFacts,
        evidenceItems: template.evidenceItems,
      },
      currentFactSheet: caseSession.factSheet,
      recentTranscript: caseSession.interviewTranscript.slice(-6),
      latestQuestion: question,
      outputSchema: {
        partyResponse: "string",
        summary: "string",
        timeline: ["string"],
        supportingFacts: ["string"],
        risks: ["string"],
        theory: "string",
        desiredRelief: "string",
        knownFacts: ["string"],
        knownClaims: ["string"],
        disputedFacts: ["string"],
        corroboratedFacts: ["string"],
        sourceLinks: ["string"],
        missingEvidence: ["string"],
        openQuestions: ["string"],
        discoveredFactIds: ["string"],
        discoveredClaimIds: ["string"],
        discoveredEvidenceIds: ["string"],
        relatedFactIds: ["string"],
      },
    }),
  });

  return normalizeInterviewResult({ aiResult, fallback, template, question });
};

export const runCourtroomRound = async ({ caseSession, argument, userId }) => {
  const template = ensureTemplate(getTemplate(caseSession));
  const rules = getLawbookRules(template.legalTags);
  const playerSide = getPlayerSide(caseSession);
  const opponentSide = getOpposingSide(playerSide);
  const shouldReturnVerdict =
    caseSession.score.roundsCompleted + 1 >= caseSession.maxCourtRounds;

  const fallback = buildCourtroomFallback({
    caseSession,
    argument,
    rules,
    template,
  });

  const aiResult = await requestStructuredCompletion({
    userId,
    temperature: 0.5,
    maxTokens: 1200,
    retryAttempts: 1,
    systemPrompt:
      "You are running a courtroom game turn. Produce JSON only. Keep the opposing lawyer grounded in the modeled claim layer for the side opposite the player, while scoring the player's use of corroborated facts, dispute handling, and lawbook support.",
    userPrompt: JSON.stringify({
      task: shouldReturnVerdict
        ? "Generate the opponent lawyer response, hidden bench scoring, and a final verdict."
        : "Generate the opponent lawyer response and hidden bench scoring for this round.",
      caseTemplate: {
        ...template,
        representedSide: opponentSide,
        representedPartyName: getPartyName(template, opponentSide),
        opposingSide: playerSide,
        opposingPartyName: getPartyName(template, playerSide),
        desiredRelief: buildDesiredReliefForSide(template, opponentSide),
        playerSide,
        playerPartyName: getPartyName(template, playerSide),
      },
      lawbookRules: rules,
      factSheet: caseSession.factSheet,
      score: caseSession.score,
      courtroomTranscript: caseSession.courtroomTranscript.slice(-6),
      latestPlayerArgument: argument,
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
    }),
  });

  return normalizeCourtResult({
    aiResult,
    fallback,
    shouldReturnVerdict,
    caseSession,
    rules,
    template,
  });
};

export const finalizeFactSheetInput = ({ factSheet, caseTemplate }) => {
  const template = ensureTemplate(
    caseTemplate?.toJSON ? caseTemplate.toJSON() : caseTemplate
  );
  const normalized = mergeFactSheet(
    {
      summary: "",
      timeline: [],
      supportingFacts: [],
      risks: [],
      theory: "",
      desiredRelief: "",
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

  const missing = [];

  if (!normalized.summary) {
    missing.push("summary");
  }
  if (!normalized.theory) {
    missing.push("case theory");
  }
  if (!normalized.timeline.length) {
    missing.push("at least one timeline point");
  }
  if (
    normalized.supportingFacts.length < 2 &&
    normalized.corroboratedFacts.length < 1
  ) {
    missing.push("at least two supporting facts or one corroborated fact");
  }
  if (!normalized.desiredRelief) {
    missing.push("requested relief");
  }
  if (
    (normalized.risks.length === 0 && normalized.disputedFacts.length === 0) &&
    (template?.canonicalFacts || []).some((fact) => fact.kind === "risk" || fact.kind === "dispute")
  ) {
    missing.push("at least one identified dispute or risk");
  }

  return {
    factSheet: {
      ...normalized,
      ready: missing.length === 0,
    },
    missing,
  };
};
