import "server-only";

import { normalizeTemplateParty } from "../templateInterview";
import {
  uniqueList,
  normalizeLookupKey,
  normalizeClientIntakeStatement,
  sanitizeClaimText,
  isLowQualityClaimText,
  isCrossCaseContaminatedClaim,
  ensurePartyCoverage,
  normalizeBlueprintPatchSide,
  normalizePartyProfile,
  buildFallbackClaimText,
  inferGeneratedFactKind,
  normalizeClaims,
  scoreClaimMatch,
} from "./shared";

export const claimStanceFromBranch = (value = "", factKind = "") => {
  const normalized = String(value || "").trim().toLowerCase();

  if (normalized === "emphasizes") return "admits";
  if (normalized === "contests") return "denies";
  if (normalized === "omits") return "omits";
  if (normalized === "uncertain") return factKind === "dispute" ? "denies" : "omits";

  return factKind === "dispute" ? "denies" : "admits";
};

export const pickMatchingClaimedFact = (claimedFacts = [], fact = {}) => {
  let best = null;
  let bestScore = 0;

  (Array.isArray(claimedFacts) ? claimedFacts : []).forEach((item) => {
    const score = scoreClaimMatch(item, fact);
    if (score > bestScore) {
      best = item;
      bestScore = score;
    }
  });

  return bestScore >= 4 ? best : null;
};

export const buildClaimFromSideStory = (side, fact, sideStory = {}) => {
  const matched = pickMatchingClaimedFact(sideStory.claimedFacts, fact);
  const factKind = String(fact.kind || "").trim().toLowerCase();
  const directKeywords = Array.isArray(fact.discoverability?.keywords)
    ? fact.discoverability.keywords.slice(0, 5)
    : [];

  if (matched?.detail) {
    const claimText = sanitizeClaimText(matched.detail);
    const shouldFallback =
      !claimText ||
      isLowQualityClaimText(claimText) ||
      isCrossCaseContaminatedClaim({
        claimText,
        fact,
        canonicalStory: sideStory?.narrative || "",
      });

    return {
      party: side,
      claimedDetail:
        !shouldFallback
          ? claimText
          : sanitizeClaimText(
              buildFallbackClaimText({
                party: side,
                canonicalDetail: fact.canonicalDetail,
                kind: factKind,
              })
            ),
      stance: claimStanceFromBranch(matched.stance, factKind),
      confidence: matched.stance === "uncertain" ? 0.72 : 0.86,
      accessLevel: matched.stance === "uncertain" || factKind === "risk" ? "partial" : "direct",
      deceptionProfile:
        side === "plaintiff"
          ? "first-person account with advocacy framing"
          : matched.stance === "uncertain"
            ? "guarded account with selective certainty"
            : "defensive framing tied to the file",
      keywords: directKeywords,
    };
  }

  return {
    party: side,
    claimedDetail: sanitizeClaimText(
      buildFallbackClaimText({
        party: side,
        canonicalDetail: fact.canonicalDetail,
        kind: factKind,
      })
    ),
    stance: factKind === "dispute" && side === "defendant" ? "denies" : "admits",
    confidence: 0.74,
    accessLevel: factKind === "risk" ? "partial" : "direct",
    deceptionProfile: side === "plaintiff" ? "generic plaintiff framing" : "generic defense framing",
    keywords: directKeywords,
  };
};

export const factPriorityScore = (fact = {}) => {
  const kind = String(fact.kind || "").trim().toLowerCase();
  const weights = {
    dispute: 5,
    evidence: 4,
    timeline: 3,
    supporting: 2,
    risk: 1,
  };

  return weights[kind] || 0;
};

export const buildDeterministicInterviewBlueprint = (facts = [], storyContext = {}) => {
  const plaintiffStory = storyContext?.plaintiffDetailedStory || {};
  const defendantStory = storyContext?.defendantDetailedStory || {};
  const sortedFactIds = [...facts]
    .sort((left, right) => factPriorityScore(right) - factPriorityScore(left))
    .map((fact) => fact.factId)
    .filter(Boolean);
  const plaintiffQuestions = uniqueList(
    facts.flatMap((fact) => fact.followUpQuestions || [])
  ).slice(0, 14);
  const defendantQuestions = uniqueList(
    [...facts].reverse().flatMap((fact) => fact.followUpQuestions || [])
  ).slice(0, 14);

  return {
    plaintiff: {
      opening:
        sanitizeClaimText(
          normalizeClientIntakeStatement(
            plaintiffStory.intakeOpening ||
              storyContext?.canonicalStoryPacket?.openingStatement ||
              ""
          )
        ) || "I want to explain why I believe the deductions were not justified.",
      posture:
        "Cooperative and motivated to explain her side; stronger on lived experience than on paperwork precision.",
      priorityFactIds: sortedFactIds.slice(0, 12),
      suggestedQuestions: plaintiffQuestions,
    },
    defendant: {
      opening:
        sanitizeClaimText(
          normalizeClientIntakeStatement(
            defendantStory.intakeOpening ||
              "Management's position is that the deductions were based on the apartment's condition after move-out."
          )
        ) || "Management's position is that the deductions were justified.",
      posture:
        "Measured and guarded; likely to rely on office process and available records rather than broad concessions.",
      priorityFactIds: sortedFactIds.slice(0, 12),
      suggestedQuestions: defendantQuestions,
    },
  };
};

export const buildDeterministicPartyProfiles = (storyContext = {}) => ({
  plaintiff: {
    role: "plaintiff",
    occupation: "Former residential tenant",
    educationOrTraining: "No specialized legal training",
    communicationStyle: "plain",
    intelligence: 0.8,
    memoryDiscipline: 0.75,
    honesty: 0.85,
    emotionalControl: 0.75,
    speechDeterminism: 0.75,
    backgroundNotes: uniqueList([
      "Primary firsthand witness to move-in, move-out, and follow-up communications.",
      ...(storyContext?.plaintiffDetailedStory?.proofGaps || []).slice(0, 2),
      ...(storyContext?.canonicalStoryPacket?.plaintiffPressurePoints || []).slice(0, 2),
    ]),
  },
  defendant: {
    role: "defendant",
    occupation: "Property management company",
    educationOrTraining: "Residential leasing and turnover management experience",
    communicationStyle: "guarded",
    intelligence: 0.8,
    memoryDiscipline: 0.75,
    honesty: 0.75,
    emotionalControl: 0.8,
    speechDeterminism: 0.75,
    backgroundNotes: uniqueList([
      "Likely represented through a manager or staff member rather than an individual tenant.",
      ...(storyContext?.defendantDetailedStory?.proofGaps || []).slice(0, 2),
      ...(storyContext?.canonicalStoryPacket?.defendantPressurePoints || []).slice(0, 2),
    ]),
  },
});
