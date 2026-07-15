import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { AWARD_DEFINITIONS, COUNTRY_AWARD_DEFINITIONS } from "../libs/game/awards/catalogue.mjs";
import { LAWYER_TITLES } from "../libs/game/awards/titles.mjs";
import {
  determineTier,
  evaluateTitleRequirements,
  getNextTierProgress,
  rarityBandForPercentage,
  validateAiAwardEvaluation,
} from "../libs/game/awards/core.mjs";
import { buildObjectiveAwardMatches, objectivePrerequisiteSatisfied } from "../libs/game/awards/rules.mjs";

assert.equal(AWARD_DEFINITIONS.length - COUNTRY_AWARD_DEFINITIONS.length, 87, "The original catalogue must retain all 87 award families.");
assert.equal(COUNTRY_AWARD_DEFINITIONS.length, 249, "Every supported country must have an award.");
assert.equal(new Set(AWARD_DEFINITIONS.map((item) => item.code)).size, AWARD_DEFINITIONS.length, "Award codes must be unique.");
assert.deepEqual(
  COUNTRY_AWARD_DEFINITIONS.find((item) => item.code === "country_in")?.metadata,
  { countryCode: "IN", countryName: "India" }
);
assert.equal(LAWYER_TITLES.length, 10, "All ten launch titles must be seeded.");
assert.equal(determineTier(2, { bronze: 1, silver: 3, gold: 10, diamond: 25 }), "bronze");
assert.equal(determineTier(10, { bronze: 1, silver: 3, gold: 10, diamond: 25 }), "gold");
assert.equal(determineTier(0, { bronze: 1 }), null);
assert.deepEqual(getNextTierProgress(7, { bronze: 1, silver: 3, gold: 10, diamond: 25 }), { currentTier: "silver", nextTier: "gold", nextThreshold: 10, remaining: 3 });
assert.equal(rarityBandForPercentage(40), "Common");
assert.equal(rarityBandForPercentage(15), "Uncommon");
assert.equal(rarityBandForPercentage(5), "Rare");
assert.equal(rarityBandForPercentage(1), "Epic");
assert.equal(rarityBandForPercentage(0.99), "Legendary");

const validated = validateAiAwardEvaluation({ version: "test", awards: [
  { awardCode: "zen_advocate", earned: true, confidence: 0.91, evidence: "Calm and economical." },
  { awardCode: "scorched_earth", earned: true, confidence: 0.9, evidence: "Aggressive throughout." },
  { awardCode: "right_question", earned: true, confidence: 0.7, evidence: "Below threshold." },
] });
assert.deepEqual(validated.candidates.map((item) => item.awardCode), ["zen_advocate"], "Contradictory styles must not both be granted.");
assert.equal(validated.rejected.length, 2, "Confidence and conflict rejections should be retained.");
assert.throws(() => validateAiAwardEvaluation({ version: "test", awards: [{ awardCode: "unknown_award", earned: true, confidence: 1, evidence: "" }] }), /Unknown or ineligible/);

const definitions = AWARD_DEFINITIONS.map((item) => ({ ...item }));
const career = { totalWins: 10, currentWinStreak: 3, longestWinStreak: 3, winsBySide: { claimant: 6 }, winsByDifficulty: { 5: 1 }, winsByLegalCategory: { property: 4, employment: 1, consumer: 1, "business-dispute": 1, "marital-dispute": 1 }, winsByJurisdiction: { IN: 4, US: 3, GB: 1 }, legalRulesApplied: Array.from({ length: 10 }, (_, index) => `rule-${index}`) };
const context = { outcome: "win", side: "claimant", difficulty: 5, legalCategory: "property", jurisdiction: "IN", intakeQuestionCount: 5, argumentCount: 1, argumentWordCount: 200, legalRulesCorrectlyApplied: 2, submittedEvidenceIds: ["photo"], evidenceSubmittedCount: 1, evidenceTypes: ["photo", "document", "record"], allMaterialFactsDiscovered: true, allMaterialRisksDiscovered: true };
const matched = new Set(buildObjectiveAwardMatches({ context, career, definitions }).map((item) => item.code));
for (const code of ["first_victory", "winning_streak", "career_wins", "giant_killer", "minimal_intake", "complete_picture", "picture_perfect", "paper_trail", "rule_of_law", "complete_advocacy", "light_touch", "travel_light", "concise_counsel", "one_shot", "claimants_champion", "global_counsel", "general_practitioner", "walking_encyclopedia"]) assert.ok(matched.has(code), `${code} should match its objective rule.`);
assert.ok(matched.has("country_in"), "A win in India should earn the India Counsel distinction.");
assert.equal(objectivePrerequisiteSatisfied("against_the_odds", { outcome: "win", initialSuccessChance: 30 }), true);
assert.equal(objectivePrerequisiteSatisfied("against_the_odds", { outcome: "win", initialSuccessChance: 55 }), false);
assert.equal(objectivePrerequisiteSatisfied("full_recovery", { outcome: "win", side: "claimant", amountClaimed: null, amountAwarded: null }), false, "Missing money data must not fabricate recovery eligibility.");

const titleAwards = [
  { code: "chain_of_proof", unlocked: true, category: "evidence", highestTier: "bronze" },
  { code: "smoking_gun", unlocked: true, category: "evidence", highestTier: "bronze" },
];
assert.equal(evaluateTitleRequirements({ requirements: LAWYER_TITLES[0].requirements, awards: titleAwards }), true);
assert.equal(evaluateTitleRequirements({ requirements: LAWYER_TITLES[0].requirements, awards: titleAwards.slice(0, 1) }), false);

const [matrixSource, panelSource, serviceSource] = await Promise.all([
  readFile(new URL("../components/legal-arena/AwardsMatrix.js", import.meta.url), "utf8"),
  readFile(new URL("../components/legal-arena/AwardUnlockPanel.js", import.meta.url), "utf8"),
  readFile(new URL("../libs/game/awards/service.js", import.meta.url), "utf8"),
]);
for (const marker of ["filter\\(\\(award\\) => award.unlocked\\)", "Collapse awards", "View all awards", "compactAwards", "All tiers", "All categories", "Closest upgrade", "role=\"dialog\"", "aria-label=\"Close award details\""]) assert.match(matrixSource, new RegExp(marker), `Award matrix should include ${marker}.`);
assert.doesNotMatch(matrixSource, /<option value=\"locked\">/, "Locked awards must not be exposed in the profile matrix.");
assert.match(panelSource, /award_tier_upgraded/);
assert.match(panelSource, /prefers-reduced-motion|motion-safe/);
assert.match(serviceSource, /occurrenceKey/);
assert.match(serviceSource, /evaluationKey/);
assert.match(serviceSource, /Unknown or ineligible|validateAiAwardEvaluation/);

console.log("Awards tests passed");
