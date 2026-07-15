import { z } from "zod";
import {
  AI_ELIGIBLE_AWARD_CODES,
  AWARD_DEFINITION_BY_CODE,
  CONTRADICTORY_AWARD_GROUPS,
} from "./catalogue.mjs";

export const AWARD_TIERS = Object.freeze(["bronze", "silver", "gold", "diamond"]);
export const AI_AWARD_EVALUATOR_VERSION = "award-ai-2026.07.1";
export const OBJECTIVE_AWARD_EVALUATOR_VERSION = "award-objective-2026.07.1";
export const DEFAULT_AI_AWARD_CONFIDENCE = 0.8;

export const determineTier = (progress = 0, thresholds = {}) => {
  const value = Number(progress) || 0;
  return [...AWARD_TIERS].reverse().find((tier) => {
    const threshold = Number(thresholds?.[tier]);
    return Number.isFinite(threshold) && value >= threshold;
  }) || null;
};

export const compareTiers = (left, right) =>
  AWARD_TIERS.indexOf(left) - AWARD_TIERS.indexOf(right);

export const getNextTierProgress = (progress = 0, thresholds = {}) => {
  const currentTier = determineTier(progress, thresholds);
  const nextTier = AWARD_TIERS.find((tier) => Number(thresholds?.[tier]) > Number(progress || 0));
  return {
    currentTier,
    nextTier: nextTier || null,
    nextThreshold: nextTier ? Number(thresholds[nextTier]) : null,
    remaining: nextTier ? Math.max(0, Number(thresholds[nextTier]) - Number(progress || 0)) : 0,
  };
};

const aiAwardItemSchema = z.object({
  awardCode: z.string().trim().min(1).max(64),
  earned: z.boolean(),
  confidence: z.coerce.number().transform((value) => Math.max(0, Math.min(1, value))),
  evidence: z.string().trim().max(600).default(""),
  score: z.coerce.number().finite().optional(),
});

const aiAwardEvaluationSchema = z.object({
  version: z.string().trim().min(1).max(80),
  awards: z.array(aiAwardItemSchema).max(100),
});

export const validateAiAwardEvaluation = (
  value,
  { confidenceThreshold = DEFAULT_AI_AWARD_CONFIDENCE } = {}
) => {
  const parsed = aiAwardEvaluationSchema.parse(value);
  const unknownCodes = parsed.awards
    .map((item) => item.awardCode)
    .filter((code) => !AI_ELIGIBLE_AWARD_CODES.has(code));
  if (unknownCodes.length) {
    throw new Error(`Unknown or ineligible award codes: ${[...new Set(unknownCodes)].join(", ")}`);
  }

  const candidates = parsed.awards.filter(
    (item) => item.earned && item.confidence >= confidenceThreshold
  );
  const rejected = parsed.awards.filter(
    (item) => item.earned && item.confidence < confidenceThreshold
  );

  for (const group of CONTRADICTORY_AWARD_GROUPS) {
    const conflicts = candidates.filter((item) => group.includes(item.awardCode));
    if (conflicts.length > 1) {
      conflicts.sort((left, right) => right.confidence - left.confidence);
      const keep = conflicts[0];
      for (const conflict of conflicts.slice(1)) {
        const index = candidates.indexOf(conflict);
        if (index >= 0) candidates.splice(index, 1);
        rejected.push({ ...conflict, rejectionReason: `Conflicts with ${keep.awardCode}` });
      }
    }
  }

  return { ...parsed, candidates, rejected };
};

export const rarityBandForPercentage = (percentage) => {
  const value = Number(percentage);
  if (!Number.isFinite(value)) return null;
  if (value >= 40) return "Common";
  if (value >= 15) return "Uncommon";
  if (value >= 5) return "Rare";
  if (value >= 1) return "Epic";
  return "Legendary";
};

export const evaluateTitleRequirements = ({ requirements = {}, awards = [] } = {}) => {
  const unlocked = new Map(awards.map((award) => [award.code, award]));
  const has = (code) => Boolean(unlocked.get(code)?.unlocked);
  if ((requirements.all || []).some((code) => !has(code))) return false;
  const any = requirements.any || [];
  const anyMatches = any.filter(has).length;
  if (any.length && anyMatches < Number(requirements.anyCount || 1)) return false;
  for (const [code, requiredTier] of Object.entries(requirements.tiers || {})) {
    const actualTier = unlocked.get(code)?.highestTier;
    if (!actualTier || compareTiers(actualTier, requiredTier) < 0) return false;
  }
  if (requirements.category) {
    const categoryMatches = awards.filter(
      (award) => award.unlocked && award.category === requirements.category
    ).length;
    if (categoryMatches < Number(requirements.categoryCount || 1)) return false;
  }
  return true;
};

export const buildAwardChange = ({ definition, previous = null, current, occurrence = null }) => {
  const wasUnlocked = Boolean(previous?.firstUnlockedAt);
  const upgraded = previous?.highestTier && current?.highestTier &&
    compareTiers(current.highestTier, previous.highestTier) > 0;
  return {
    code: definition.code,
    name: definition.name,
    emoji: definition.emoji,
    description: definition.description,
    category: definition.category,
    tier: current?.highestTier || null,
    type: !wasUnlocked ? "unlocked" : upgraded ? "tier_upgraded" : "occurrence",
    explanation: occurrence?.evidenceText || definition.description,
  };
};

export const getAwardDefinition = (code) => AWARD_DEFINITION_BY_CODE.get(code) || null;

