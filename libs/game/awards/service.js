import "server-only";

import connectMongo from "@/libs/mongoose";
import { requestStructuredCompletion } from "@/libs/gpt";
import AwardDefinition from "@/models/AwardDefinition";
import AwardEvaluation from "@/models/AwardEvaluation";
import AwardOccurrence from "@/models/AwardOccurrence";
import AwardRaritySnapshot from "@/models/AwardRaritySnapshot";
import LawyerTitle from "@/models/LawyerTitle";
import PlayerAward from "@/models/PlayerAward";
import PlayerCareerStats from "@/models/PlayerCareerStats";
import PlayerLawyerTitle from "@/models/PlayerLawyerTitle";
import User from "@/models/User";
import {
  AI_AWARD_EVALUATOR_VERSION,
  buildAwardChange,
  compareTiers,
  determineTier,
  evaluateTitleRequirements,
  getNextTierProgress,
  OBJECTIVE_AWARD_EVALUATOR_VERSION,
  rarityBandForPercentage,
  validateAiAwardEvaluation,
} from "./core.mjs";
import {
  AI_ELIGIBLE_AWARD_CODES,
  AWARD_CATALOGUE_VERSION,
  AWARD_DEFINITIONS,
} from "./catalogue.mjs";
import { LAWYER_TITLE_CATALOGUE_VERSION, LAWYER_TITLES } from "./titles.mjs";
import { buildChallengeAwardContexts, buildSoloAwardContext } from "./context";
import { buildObjectiveAwardMatches, objectivePrerequisiteSatisfied } from "./rules.mjs";
import {
  applyChallengeVerdictToPvpProgression,
  applySettlementToProgression,
  applyVerdictToProgression,
} from "@/libs/game/progression";

let cataloguePromise;
export const ensureAwardCatalogue = async () => {
  await connectMongo();
  if (!cataloguePromise) {
    cataloguePromise = Promise.all([
      AwardDefinition.bulkWrite(AWARD_DEFINITIONS.map((definition) => ({
        updateOne: {
          filter: { code: definition.code },
          update: { $set: { ...definition, catalogueVersion: AWARD_CATALOGUE_VERSION } },
          upsert: true,
        },
      })), { ordered: false }),
      LawyerTitle.bulkWrite(LAWYER_TITLES.map((title) => ({
        updateOne: {
          filter: { code: title.code },
          update: { $set: { ...title, catalogueVersion: LAWYER_TITLE_CATALOGUE_VERSION } },
          upsert: true,
        },
      })), { ordered: false }),
    ]).catch((error) => {
      cataloguePromise = null;
      throw error;
    });
  }
  await cataloguePromise;
};

const mapObject = (value) => value instanceof Map ? Object.fromEntries(value) : { ...(value || {}) };
const incrementKey = (value, key, amount = 1) => {
  const next = mapObject(value);
  if (key) next[key] = (Number(next[key]) || 0) + amount;
  return next;
};
const plain = (value) => value?.toObject ? value.toObject() : value;

const updateCareerStats = async (context) => {
  const stats = await PlayerCareerStats.findOneAndUpdate(
    { playerId: context.playerId },
    { $setOnInsert: { playerId: context.playerId } },
    { new: true, upsert: true }
  );
  const won = context.outcome === "win";
  stats.totalCompletedCases += 1;
  stats.totalWins += won ? 1 : 0;
  stats.totalLosses += context.outcome === "loss" ? 1 : 0;
  stats.totalDraws += context.outcome === "draw" ? 1 : 0;
  stats.totalSettlements += context.outcome === "settled" ? 1 : 0;
  stats.currentWinStreak = won ? stats.currentWinStreak + 1 : 0;
  stats.longestWinStreak = Math.max(stats.longestWinStreak, stats.currentWinStreak);
  if (won) {
    stats.winsBySide = incrementKey(stats.winsBySide, context.side);
    stats.winsByDifficulty = incrementKey(stats.winsByDifficulty, String(context.difficulty || 1));
    stats.winsByLegalCategory = incrementKey(stats.winsByLegalCategory, context.legalCategory);
    stats.winsByJurisdiction = incrementKey(stats.winsByJurisdiction, context.jurisdiction);
    if (context.intakeQuestionCount != null) {
      stats.wonIntakeQuestionTotal += Number(context.intakeQuestionCount) || 0;
      stats.wonIntakeCaseCount += 1;
    }
    if (context.argumentCount != null) {
      stats.wonArgumentTotal += Number(context.argumentCount) || 0;
      stats.wonArgumentCaseCount += 1;
    }
  }
  stats.totalDecisiveFactsDiscovered += Number(context.decisiveFactsDiscovered) || 0;
  stats.totalSuccessfulSettlements += context.outcome === "settled" ? 1 : 0;
  if (context.amountClaimed != null && context.amountAwarded != null && context.amountAwarded >= context.amountClaimed) stats.totalFullRecoveries += 1;
  if (won && context.side === "defendant" && ["dismissed", "all_claims_denied"].includes(context.disposition)) stats.totalCompleteDefences += 1;
  stats.legalRulesApplied = [...new Set([...(stats.legalRulesApplied || []), ...(context.legalRuleIds || [])])];
  stats.lastCompletedAt = new Date();
  await stats.save();
  return plain(stats);
};

const occurrenceKeyFor = ({ context, code, version }) =>
  `${context.playerId}:${context.sourceType}:${context.caseId}:${code}:${version}`;

const applyAwardMatch = async ({ context, definition, match, source, version }) => {
  const existing = await PlayerAward.findOne({ playerId: context.playerId, awardDefinitionId: definition._id });
  if (!definition.repeatable && existing?.firstUnlockedAt) return null;
  const occurrenceKey = occurrenceKeyFor({ context, code: definition.code, version });
  let occurrence;
  try {
    occurrence = await AwardOccurrence.create({
      occurrenceKey,
      playerId: context.playerId,
      awardDefinitionId: definition._id,
      caseId: context.caseId,
      sourceType: context.sourceType,
      evaluationSource: source,
      evaluationVersion: version,
      confidence: match.confidence ?? null,
      evidenceText: String(match.evidence || definition.description).slice(0, 600),
      metadata: match.metadata || null,
      earnedAt: new Date(),
    });
  } catch (error) {
    if (error?.code === 11000) return null;
    throw error;
  }

  const previous = existing ? plain(existing) : null;
  const progress = definition.repeatable
    ? Math.max(Number(existing?.progress) || 0, Number(match.progress) || 0, (Number(existing?.occurrenceCount) || 0) + 1)
    : 1;
  const calculatedTier = definition.tierThresholds ? determineTier(progress, definition.tierThresholds) : null;
  const highestTier = existing?.highestTier && calculatedTier && compareTiers(existing.highestTier, calculatedTier) > 0
    ? existing.highestTier : calculatedTier || existing?.highestTier || null;
  const now = new Date();
  const current = await PlayerAward.findOneAndUpdate(
    { playerId: context.playerId, awardDefinitionId: definition._id },
    {
      $setOnInsert: { playerId: context.playerId, awardDefinitionId: definition._id, firstUnlockedAt: now },
      $set: { progress, highestTier, lastEarnedAt: now, lastCaseId: context.caseId },
      $inc: { occurrenceCount: 1 },
    },
    { upsert: true, new: true }
  );
  occurrence.tierAtTime = current.highestTier;
  await occurrence.save();
  return buildAwardChange({ definition: plain(definition), previous, current: plain(current), occurrence: plain(occurrence) });
};

export const evaluateAndUnlockTitles = async (playerId) => {
  const [definitions, playerAwards, titles] = await Promise.all([
    AwardDefinition.find({ enabled: true }).lean(),
    PlayerAward.find({ playerId, firstUnlockedAt: { $ne: null } }).lean(),
    LawyerTitle.find({ enabled: true }).sort({ sortOrder: 1 }).lean(),
  ]);
  const definitionById = new Map(definitions.map((item) => [String(item._id), item]));
  const awards = playerAwards.map((award) => {
    const definition = definitionById.get(String(award.awardDefinitionId));
    return { ...award, code: definition?.code, category: definition?.category, unlocked: true };
  });
  const unlocked = [];
  for (const title of titles) {
    if (!evaluateTitleRequirements({ requirements: title.requirements, awards })) continue;
    const result = await PlayerLawyerTitle.updateOne(
      { playerId, lawyerTitleId: title._id },
      { $setOnInsert: { playerId, lawyerTitleId: title._id, unlockedAt: new Date() } },
      { upsert: true }
    );
    if (result.upsertedCount) unlocked.push({ code: title.code, name: title.name, emoji: title.emoji });
  }
  return unlocked;
};

const applyProgressionOnce = async ({ evaluation, context, userProfile }) => {
  if (evaluation.progressionAppliedAt) return;
  if (context.sourceType === "case") {
    if (context.outcome === "settled") {
      await applySettlementToProgression({ userId: context.playerId, userProfile, primaryCategory: context.legalCategory, complexity: context.difficulty, finalMoods: Object.fromEntries((context.settlement?.finalMoodScores || []).map((value, index) => [index ? "opponent" : "player", value])) });
    } else if (["win", "loss", "draw"].includes(context.outcome)) {
      await applyVerdictToProgression({ userId: context.playerId, userProfile, primaryCategory: context.legalCategory, complexity: context.difficulty, verdictWinner: context.outcome === "win" ? "player" : context.outcome === "loss" ? "opponent" : "draw", lockedCourtEntryChance: context.initialSuccessChance });
    }
  } else if (["win", "loss", "draw"].includes(context.outcome)) {
    await applyChallengeVerdictToPvpProgression({ userId: context.playerId, primaryCategory: context.legalCategory, outcome: context.outcome });
  }
  evaluation.progressionAppliedAt = new Date();
};

export const evaluateAwardContext = async ({ context, userProfile = null, skipProgression = false, evaluationSource = "objective" }) => {
  await ensureAwardCatalogue();
  const evaluationKey = `${context.playerId}:${context.sourceType}:${context.caseId}:${OBJECTIVE_AWARD_EVALUATOR_VERSION}`;
  let evaluation = await AwardEvaluation.findOne({ evaluationKey });
  if (evaluation?.objectiveCompletedAt) return plain(evaluation);
  if (!evaluation) {
    try {
      evaluation = await AwardEvaluation.create({ evaluationKey, playerId: context.playerId, sourceType: context.sourceType, sourceId: context.caseId, status: "pending", objectiveVersion: OBJECTIVE_AWARD_EVALUATOR_VERSION, aiVersion: AI_AWARD_EVALUATOR_VERSION, context });
    } catch (error) {
      if (error?.code !== 11000) throw error;
      evaluation = await AwardEvaluation.findOne({ evaluationKey });
    }
  }
  if (!skipProgression) await applyProgressionOnce({ evaluation, context, userProfile });
  const career = await updateCareerStats(context);
  const user = await User.findById(context.playerId).select("progression.overallRating").lean();
  context.overallRating = user?.progression?.overallRating || 0;
  const definitions = await AwardDefinition.find({ enabled: true }).lean();
  const matches = buildObjectiveAwardMatches({ context, career, definitions });
  const definitionByCode = new Map(definitions.map((item) => [item.code, item]));
  const changes = [];
  for (const match of matches) {
    const change = await applyAwardMatch({ context, definition: definitionByCode.get(match.code), match, source: evaluationSource, version: OBJECTIVE_AWARD_EVALUATOR_VERSION });
    if (change) changes.push(change);
  }
  const titleChanges = await evaluateAndUnlockTitles(context.playerId);
  evaluation.context = context;
  evaluation.objectiveMatched = matches;
  evaluation.awardChanges = [...(evaluation.awardChanges || []), ...changes];
  evaluation.objectiveCompletedAt = new Date();
  evaluation.status = evaluationSource === "backfill"
    ? "completed"
    : AI_ELIGIBLE_AWARD_CODES.size ? "pending" : "completed";
  if (evaluationSource === "backfill") evaluation.completedAt = new Date();
  await evaluation.save();
  return { ...plain(evaluation), immediateChanges: changes, titleChanges };
};

export const evaluateCompletedCase = async ({ caseSession, userProfile = null, skipProgression = false, evaluationSource = "objective" }) => {
  const context = buildSoloAwardContext(caseSession);
  caseSession.awardMetrics = context;
  if (caseSession.isModified?.()) await caseSession.save();
  return evaluateAwardContext({ context, userProfile, skipProgression, evaluationSource });
};

export const evaluateCompletedChallenge = async ({ challenge, skipProgression = true, evaluationSource = "objective" }) => {
  const contexts = buildChallengeAwardContexts(challenge);
  return Promise.all(contexts.map((context) => evaluateAwardContext({ context, skipProgression, evaluationSource })));
};

const compactAiContext = (context = {}) => ({
  outcome: context.outcome, side: context.side, difficulty: context.difficulty,
  initialSuccessChance: context.initialSuccessChance, legalCategory: context.legalCategory,
  jurisdiction: context.jurisdiction, intake: context.intakeSummary,
  discoveredFacts: context.discoveredFacts, submittedEvidenceIds: context.submittedEvidenceIds,
  playerArguments: context.playerArguments, opposingArguments: context.opposingArguments,
  verdict: { summary: context.verdict?.summary, highlights: context.verdict?.highlights, concerns: context.verdict?.concerns },
  settlement: context.settlement,
});

export const processAwardEvaluation = async (evaluation) => {
  const document = evaluation?.save ? evaluation : await AwardEvaluation.findById(evaluation).select("+context +aiProposed +rejected +errorMessage");
  if (!document || document.status === "completed") return document;
  document.status = "running";
  document.attempts += 1;
  document.leaseExpiresAt = new Date(Date.now() + 5 * 60 * 1000);
  await document.save();
  try {
    const eligible = AWARD_DEFINITIONS.filter((item) => item.evaluationType !== "objective").map((item) => ({ code: item.code, description: item.description, evaluationType: item.evaluationType }));
    const response = await requestStructuredCompletion({
      userId: String(document.playerId), usageLabel: "award-semantic-evaluation", maxTokens: 2200, retryAttempts: 1,
      systemPrompt: "You are a conservative post-case legal-game achievement evaluator. Evaluate only the supplied award catalogue. Do not invent missing facts. Return JSON only.",
      userPrompt: JSON.stringify({ instruction: "Return {version, awards:[{awardCode,earned,confidence,evidence,score?}]}. Award only clearly demonstrated conduct. Keep evidence under 300 characters. Contradictory styles should not both be earned.", version: AI_AWARD_EVALUATOR_VERSION, eligibleAwards: eligible, case: compactAiContext(document.context) }),
    });
    const validated = validateAiAwardEvaluation({ ...response, version: response?.version || AI_AWARD_EVALUATOR_VERSION });
    const definitions = await AwardDefinition.find({ code: { $in: validated.candidates.map((item) => item.awardCode) } }).lean();
    const byCode = new Map(definitions.map((item) => [item.code, item]));
    const changes = [];
    const rejected = [...validated.rejected];
    for (const candidate of validated.candidates) {
      if (!objectivePrerequisiteSatisfied(candidate.awardCode, document.context)) {
        rejected.push({ ...candidate, rejectionReason: "Objective prerequisite was not satisfied." });
        continue;
      }
      const change = await applyAwardMatch({ context: document.context, definition: byCode.get(candidate.awardCode), match: { ...candidate, evidence: candidate.evidence, progress: 1 }, source: byCode.get(candidate.awardCode)?.evaluationType === "hybrid" ? "hybrid" : "ai", version: AI_AWARD_EVALUATOR_VERSION });
      if (change) changes.push(change);
    }
    const titleChanges = await evaluateAndUnlockTitles(document.playerId);
    document.aiProposed = validated.awards;
    document.rejected = rejected;
    document.awardChanges = [...(document.awardChanges || []), ...changes];
    document.status = rejected.length && changes.length ? "partially_completed" : "completed";
    document.completedAt = new Date();
    document.leaseExpiresAt = null;
    document.nextRetryAt = null;
    await document.save();
    return { ...plain(document), semanticChanges: changes, titleChanges };
  } catch (error) {
    document.status = document.objectiveCompletedAt ? "partially_completed" : "failed";
    document.errorCode = error?.name || "AWARD_AI_ERROR";
    document.errorMessage = String(error?.message || "Award evaluation failed").slice(0, 500);
    document.leaseExpiresAt = null;
    document.nextRetryAt = new Date(Date.now() + Math.min(60, 2 ** document.attempts) * 60 * 1000);
    await document.save();
    throw error;
  }
};

export const runPendingAwardEvaluations = async ({ limit = 10 } = {}) => {
  await ensureAwardCatalogue();
  const now = new Date();
  const evaluations = await AwardEvaluation.find({
    objectiveCompletedAt: { $ne: null },
    $or: [
      { status: "pending" },
      { status: "failed", nextRetryAt: { $lte: now } },
      { status: "partially_completed", completedAt: null, nextRetryAt: { $lte: now } },
      { status: "running", leaseExpiresAt: { $lte: now } },
    ],
  }).select("+context +aiProposed +rejected +errorMessage").sort({ createdAt: 1 }).limit(Math.max(1, Math.min(50, Number(limit) || 10)));
  const summary = { processed: 0, completed: 0, failed: 0, errors: [] };
  for (const evaluation of evaluations) {
    summary.processed += 1;
    try { await processAwardEvaluation(evaluation); summary.completed += 1; }
    catch (error) { summary.failed += 1; summary.errors.push({ id: String(evaluation._id), error: error.message }); }
  }
  return summary;
};

export const computeAwardRarity = async ({ minimumSample = 25 } = {}) => {
  await ensureAwardCatalogue();
  const eligiblePlayerCount = await PlayerCareerStats.countDocuments({ totalCompletedCases: { $gt: 0 } });
  const definitions = await AwardDefinition.find({ enabled: true }).lean();
  for (const definition of definitions) {
    const unlockedPlayerCount = await PlayerAward.countDocuments({ awardDefinitionId: definition._id, firstUnlockedAt: { $ne: null } });
    const percentage = eligiblePlayerCount >= minimumSample ? Number(((unlockedPlayerCount / eligiblePlayerCount) * 100).toFixed(2)) : null;
    await AwardRaritySnapshot.updateOne({ awardDefinitionId: definition._id }, { $set: { eligiblePlayerCount, unlockedPlayerCount, percentage, band: rarityBandForPercentage(percentage), computedAt: new Date() } }, { upsert: true });
  }
  return { eligiblePlayerCount, awards: definitions.length, enoughData: eligiblePlayerCount >= minimumSample };
};

export const getPlayerAwardsProfile = async (playerId, { owner = false } = {}) => {
  await ensureAwardCatalogue();
  const [definitions, awards, occurrences, rarity, stats, titleUnlocks, user] = await Promise.all([
    AwardDefinition.find({ enabled: true }).sort({ sortOrder: 1 }).lean(),
    PlayerAward.find({ playerId }).lean(),
    AwardOccurrence.find({ playerId }).sort({ earnedAt: -1 }).limit(100).lean(),
    AwardRaritySnapshot.find({}).lean(),
    PlayerCareerStats.findOne({ playerId }).lean(),
    PlayerLawyerTitle.find({ playerId }).populate("lawyerTitleId").lean(),
    User.findById(playerId).select("selectedLawyerTitleId").lean(),
  ]);
  const awardByDefinition = new Map(awards.map((item) => [String(item.awardDefinitionId), item]));
  const rarityByDefinition = new Map(rarity.map((item) => [String(item.awardDefinitionId), item]));
  const occurrenceCounts = new Map();
  for (const occurrence of occurrences) occurrenceCounts.set(String(occurrence.awardDefinitionId), (occurrenceCounts.get(String(occurrence.awardDefinitionId)) || 0) + 1);
  const items = definitions.map((definition) => {
    const playerAward = awardByDefinition.get(String(definition._id));
    const unlocked = Boolean(playerAward?.firstUnlockedAt);
    const hidden = definition.hiddenUntilUnlocked && !unlocked;
    return {
      code: hidden ? null : definition.code,
      name: hidden ? "Secret Award" : definition.name,
      emoji: hidden ? "❓" : definition.emoji,
      description: hidden ? "Complete an unusual legal feat to reveal this award." : definition.description,
      category: definition.category, kind: definition.kind, evaluationType: owner ? definition.evaluationType : undefined,
      repeatable: definition.repeatable, hidden, unlocked,
      progress: playerAward?.progress || 0, occurrenceCount: playerAward?.occurrenceCount || 0,
      highestTier: playerAward?.highestTier || null, firstUnlockedAt: playerAward?.firstUnlockedAt || null,
      lastEarnedAt: playerAward?.lastEarnedAt || null, tierThresholds: hidden ? null : definition.tierThresholds,
      nextTier: hidden ? null : getNextTierProgress(playerAward?.progress || 0, definition.tierThresholds || {}),
      rarity: rarityByDefinition.get(String(definition._id)) || null,
    };
  });
  const unlockedItems = items.filter((item) => item.unlocked);
  const selectedUnlock = titleUnlocks.find((item) => String(item.lawyerTitleId?._id) === String(user?.selectedLawyerTitleId));
  return {
    summary: {
      uniqueAwards: unlockedItems.length,
      totalOccurrences: awards.reduce((total, item) => total + (item.occurrenceCount || 0), 0),
      highestTierAwards: unlockedItems.filter((item) => ["gold", "diamond"].includes(item.highestTier)).length,
      currentWinStreak: stats?.currentWinStreak || 0,
      longestWinStreak: stats?.longestWinStreak || 0,
      selectedTitle: selectedUnlock?.lawyerTitleId || null,
      recentAwards: [...unlockedItems].sort((a, b) => new Date(b.lastEarnedAt || 0) - new Date(a.lastEarnedAt || 0)).slice(0, 5),
      rarestAwards: unlockedItems.filter((item) => item.rarity?.percentage != null).sort((a, b) => a.rarity.percentage - b.rarity.percentage).slice(0, 3),
      mostEarned: [...unlockedItems].sort((a, b) => b.occurrenceCount - a.occurrenceCount).slice(0, 5),
      strongestPracticeArea: Object.entries(mapObject(stats?.winsByLegalCategory)).sort((a, b) => b[1] - a[1])[0]?.[0] || null,
    },
    awards: items,
    titles: titleUnlocks.map((item) => ({ ...item.lawyerTitleId, unlockedAt: item.unlockedAt, selected: String(item.lawyerTitleId?._id) === String(user?.selectedLawyerTitleId) })),
  };
};
