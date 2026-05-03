import "server-only";

import {
  getEvidenceItemsForFact,
  getInterviewBlueprintForSide,
} from "../../templateInterview";
import {
  uniqueList,
  clamp,
  lowerFirst,
  tokenize,
  countSharedTokens,
  humanizeClaimText,
  toSpokenSentence,
  getClaimId,
  getTemplatePartyForSessionSide,
  getOtherTemplateParty,
  getClaimForParty,
  getPlayerSide,
  getOpposingSide,
  getPartyName,
  getPartyProfileForSide,
  buildMemoryStyleClaimText,
  buildInterviewDisputeNote,
  sortClaimsByRecallPriority,
  ensureTemplate,
  normalizeFactSheetPatch,
  getInterviewQuestionHistory,
  resolveFactSheetOpenQuestions,
  mergeFactSheet,
  coerceString,
  coerceStringList,
  sanitizeIdList,
  isMetaResponse,
} from "../shared";

export const scoreFactForQuestion = (fact, question, playerSide, template) => {
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

export const pickRelevantFacts = (template, question, playerSide, discoveredFactIds = []) => {
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

export const scoreEvidenceForQuestion = (item, question, template, playerSide) => {
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

export const pickRelevantEvidence = (
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

export const buildEvidenceResponseSegment = (item, side) => {
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

export const buildEvidencePossessionResponse = (item, side) => {
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
        ? `I may have ${lowerLabel}, but I cannot say for sure without checking my records.`
        : `No, I do not have ${lowerLabel} right now.`;
    case "contested":
      return holderIsSelf
        ? `Yes, I have ${lowerLabel}, but there may be a fight about what it really shows.`
        : `There is ${lowerLabel}, but there may be a fight about what it really shows.`;
    default:
      return `No, I do not have ${lowerLabel} right now.`;
  }
};

export const buildEvidenceProductionResponse = (item, side) => {
  const label = String(item.label || item.detail || "that record").trim();
  const lowerLabel = lowerFirst(label);
  const templateSide = getTemplatePartyForSessionSide(side);
  const holderIsSelf = item.holderSide === templateSide || item.holderSide === "shared";
  const holderIsOtherParty =
    (side === "client" && item.holderSide === "defendant") ||
    (side === "opponent" && item.holderSide === "plaintiff");

  if (holderIsOtherParty) {
    return `No, I cannot send you ${lowerLabel}. The other side should be the one with it.`;
  }

  if (item.holderSide === "third-party") {
    return `No, I cannot send you ${lowerLabel}. A third party is more likely to have it.`;
  }

  switch (item.availabilityStatus) {
    case "confirmed":
      return holderIsSelf
        ? `Yes, I have ${lowerLabel}, and I can send it over.`
        : `Yes, ${lowerLabel} should be available, and we should be able to get it.`;
    case "mentioned":
    case "unknown":
      return holderIsSelf
        ? `I may be able to produce ${lowerLabel}, but I would need to check my records first.`
        : `I cannot send you ${lowerLabel} right now. I would need to confirm where it is first.`;
    case "missing":
      return `No, I cannot send you ${lowerLabel} because I do not have it.`;
    case "contested":
      return holderIsSelf
        ? `I can send you ${lowerLabel}, but there may be a fight about what it really shows.`
        : `There is ${lowerLabel}, but I cannot promise I am the one who can produce it directly.`;
    default:
      return `I cannot tell you yet whether I can send you ${lowerLabel}. I need to check whether I still have it.`;
  }
};

export const evidenceCanBeProducedBySide = (item, side) => {
  const templateSide = getTemplatePartyForSessionSide(side);
  const holderIsSelf = item.holderSide === templateSide || item.holderSide === "shared";

  return holderIsSelf && ["confirmed", "contested"].includes(item.availabilityStatus);
};

export const buildEvidenceProductionSummary = (items = [], side) => {
  const seenIds = new Set();
  const relevantItems = items
    .filter((item) => {
      const key = item.id || item.label || item.detail;
      if (!key || seenIds.has(key)) {
        return false;
      }
      seenIds.add(key);
      return true;
    })
    .slice(0, 5);
  const producible = relevantItems.filter((item) => evidenceCanBeProducedBySide(item, side));
  const unavailable = relevantItems.filter((item) => !evidenceCanBeProducedBySide(item, side));

  if (producible.length === 0 && unavailable.length === 0) {
    return "";
  }

  const producedText = producible
    .map((item) => {
      const label = lowerFirst(String(item.label || item.detail || "that record").trim());
      const detail = String(item.detail || "").trim();

      return detail ? `${label} (${detail})` : label;
    })
    .join("; ");
  const unavailableText = unavailable
    .map((item) => {
      const label = lowerFirst(String(item.label || item.detail || "that record").trim());

      if (evidenceIsHeldByOtherParty(item, side)) {
        return `${label} appears to be held by the other side`;
      }

      if (item.holderSide === "third-party") {
        return `${label} appears to be held by a third party`;
      }

      if (item.availabilityStatus === "missing") {
        return `${label} is not in hand`;
      }

      return `${label} has not been confirmed in the file`;
    })
    .join("; ");

  if (producedText && unavailableText) {
    return `Yes. I can provide ${producedText}. I cannot provide ${unavailableText} right now.`;
  }

  if (producedText) {
    return `Yes. I can provide ${producedText}.`;
  }

  return `No. I cannot provide ${unavailableText} right now.`;
};

export const evidenceIsHeldByOtherParty = (item, side) =>
  (side === "client" && item.holderSide === "defendant") ||
  (side === "opponent" && item.holderSide === "plaintiff");

export const findSupportingEvidenceForClaims = ({
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

export const buildEvidenceHolderResponseSegment = (item) => {
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
