const RESOLVED_CASE_STATUSES = new Set(["verdict", "settled"]);

const getCaseId = (caseSession = {}) =>
  String(
    caseSession?.slug ||
      caseSession?.id ||
      caseSession?._id ||
      ""
  );

const getCaseTimestamp = (caseSession = {}) => {
  const value =
    caseSession.completedAt ||
    caseSession.updatedAt ||
    caseSession.createdAt ||
    0;
  const timestamp = new Date(value).getTime();

  return Number.isFinite(timestamp) ? timestamp : 0;
};

const getCategoryTitle = (categories = [], categorySlug = "") =>
  categories.find((category) => category.slug === categorySlug)?.title ||
  String(categorySlug || "General")
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());

const stableWeight = (value = "") =>
  String(value)
    .split("")
    .reduce(
      (total, character, index) =>
        (total + character.charCodeAt(0) * (index + 1)) % 2147483647,
      0
    );

export const getPlayerLevelFromProgression = (progression = {}) =>
  Math.max(1, Math.floor((Number(progression.overallXp) || 0) / 250) + 1);

export const getDynamicComplexityCapForPlayerLevel = (playerLevel = 1) => {
  const level = Math.max(1, Number(playerLevel) || 1);

  if (level <= 2) return 1;
  if (level <= 5) return 2;
  if (level <= 8) return 3;
  if (level <= 12) return 4;
  return 5;
};

export const getDynamicDifficultyLimits = ({
  progression = {},
  categorySlug = "",
} = {}) => {
  const categoryStat = (progression.categoryStats || []).find(
    (item) => item.categorySlug === categorySlug
  );
  const eligibleComplexity = Math.max(
    1,
    Number(categoryStat?.unlockedComplexity) || 1
  );
  const playerLevel = getPlayerLevelFromProgression(progression);
  const playerLevelCap = getDynamicComplexityCapForPlayerLevel(playerLevel);
  const capableComplexity = Math.min(eligibleComplexity, playerLevelCap);

  return {
    eligibleComplexity,
    playerLevel,
    playerLevelCap,
    capableComplexity,
    challengeComplexityCap: Math.min(5, capableComplexity + 1),
  };
};

export const listResolvedCasesForRecommendation = (cases = []) =>
  (Array.isArray(cases) ? cases : [])
    .filter((caseSession) => RESOLVED_CASE_STATUSES.has(caseSession?.status))
    .sort((left, right) => getCaseTimestamp(right) - getCaseTimestamp(left));

const buildRecommendation = ({
  kind,
  categorySlug,
  complexity,
  reasonCode,
  reason,
  categories,
  progression,
  latestCase,
  recentRepeatCount,
}) => {
  const limits = getDynamicDifficultyLimits({ progression, categorySlug });

  return {
    kind,
    categorySlug,
    categoryTitle: getCategoryTitle(categories, categorySlug),
    complexity,
    reasonCode,
    reason,
    recentRepeatCount,
    habitCategorySlug: latestCase?.primaryCategory || "",
    habitComplexity: Math.max(1, Number(latestCase?.complexity) || 1),
    sourceCaseId: getCaseId(latestCase),
    isStretch: complexity > limits.capableComplexity,
  };
};

const getBreadthCategory = ({
  categories,
  progression,
  resolvedCases,
  latestCategorySlug,
  playerId,
}) => {
  const categoryStats = new Map(
    (progression.categoryStats || []).map((stat) => [stat.categorySlug, stat])
  );
  const recentCategorySlugs = new Set(
    resolvedCases.slice(0, 2).map((caseSession) => caseSession.primaryCategory)
  );
  const candidates = categories.filter(
    (category) => category?.slug && category.slug !== latestCategorySlug
  );

  return (
    [...candidates].sort((left, right) => {
      const leftRecentlyPlayed = recentCategorySlugs.has(left.slug) ? 1 : 0;
      const rightRecentlyPlayed = recentCategorySlugs.has(right.slug) ? 1 : 0;
      if (leftRecentlyPlayed !== rightRecentlyPlayed) {
        return leftRecentlyPlayed - rightRecentlyPlayed;
      }

      const leftCompleted =
        Number(categoryStats.get(left.slug)?.completedCases) || 0;
      const rightCompleted =
        Number(categoryStats.get(right.slug)?.completedCases) || 0;
      if (leftCompleted !== rightCompleted) {
        return leftCompleted - rightCompleted;
      }

      return (
        stableWeight(`${playerId}:${left.slug}`) -
        stableWeight(`${playerId}:${right.slug}`)
      );
    })[0] || null
  );
};

export const buildNextCaseRecommendation = ({
  cases = [],
  progression = {},
  categories = [],
  playerId = "",
  defaultCategorySlug = "contract-violation",
} = {}) => {
  const resolvedCases = listResolvedCasesForRecommendation(cases);
  const categoryOptions = (Array.isArray(categories) ? categories : []).filter(
    (category) => category?.slug
  );
  const starterCategory =
    categoryOptions.find((category) => category.slug === defaultCategorySlug) ||
    categoryOptions[0] ||
    { slug: defaultCategorySlug };

  if (resolvedCases.length === 0) {
    return buildRecommendation({
      kind: "starter",
      categorySlug: starterCategory.slug,
      complexity: 1,
      reasonCode: "start_first_practice",
      reason: `Build your first arena record with a Level 1 ${getCategoryTitle(
        categoryOptions,
        starterCategory.slug
      )} matter.`,
      categories: categoryOptions,
      progression,
      latestCase: null,
      recentRepeatCount: 0,
    });
  }

  const latestCase = resolvedCases[0];
  const latestCategorySlug = latestCase.primaryCategory || starterCategory.slug;
  const latestComplexity = Math.max(
    1,
    Math.min(5, Number(latestCase.complexity) || 1)
  );
  const recentRepeatCount = resolvedCases.reduce((count, caseSession, index) => {
    if (index !== count) return count;

    const samePair =
      caseSession.primaryCategory === latestCategorySlug &&
      Math.max(1, Number(caseSession.complexity) || 1) === latestComplexity;

    return samePair ? count + 1 : count;
  }, 0);
  const latestCategoryStat = (progression.categoryStats || []).find(
    (item) => item.categorySlug === latestCategorySlug
  );
  const latestLimits = getDynamicDifficultyLimits({
    progression,
    categorySlug: latestCategorySlug,
  });
  const nextMasteryComplexity = latestComplexity + 1;
  const canLevelUp =
    nextMasteryComplexity <= 5 &&
    nextMasteryComplexity <= latestLimits.challengeComplexityCap;
  const firstCompletionInCategory =
    (Number(latestCategoryStat?.completedCases) || 0) === 1;

  if (
    canLevelUp &&
    (recentRepeatCount >= 2 || firstCompletionInCategory)
  ) {
    const categoryTitle = getCategoryTitle(
      categoryOptions,
      latestCategorySlug
    );
    const repeatedPair = recentRepeatCount >= 2;

    return buildRecommendation({
      kind: "level_up",
      categorySlug: latestCategorySlug,
      complexity: nextMasteryComplexity,
      reasonCode: repeatedPair
        ? "repeat_pair_step_up"
        : "new_category_deepen",
      reason: repeatedPair
        ? `You have completed ${recentRepeatCount} straight ${categoryTitle} matters at Level ${latestComplexity}. Step up to Level ${nextMasteryComplexity}.`
        : `You opened a new ${categoryTitle} track. Take it one level deeper while the skills are fresh.`,
      categories: categoryOptions,
      progression,
      latestCase,
      recentRepeatCount,
    });
  }

  const breadthCategory = getBreadthCategory({
    categories: categoryOptions,
    progression,
    resolvedCases,
    latestCategorySlug,
    playerId,
  });

  if (breadthCategory) {
    const breadthLimits = getDynamicDifficultyLimits({
      progression,
      categorySlug: breadthCategory.slug,
    });
    const breadthComplexity = Math.max(
      1,
      Math.min(5, breadthLimits.capableComplexity)
    );
    const categoryTitle = getCategoryTitle(
      categoryOptions,
      breadthCategory.slug
    );

    return buildRecommendation({
      kind: "broaden",
      categorySlug: breadthCategory.slug,
      complexity: breadthComplexity,
      reasonCode: canLevelUp
        ? "rotate_practice_area"
        : "mastery_cap_reached",
      reason: canLevelUp
        ? `Broaden your record with a ${categoryTitle} matter before returning to familiar ground.`
        : `You have reached the next available step in ${getCategoryTitle(
            categoryOptions,
            latestCategorySlug
          )}. Build range with ${categoryTitle}.`,
      categories: categoryOptions,
      progression,
      latestCase,
      recentRepeatCount,
    });
  }

  return buildRecommendation({
    kind: "level_up",
    categorySlug: latestCategorySlug,
    complexity: Math.min(
      latestComplexity,
      latestLimits.challengeComplexityCap
    ),
    reasonCode: "continue_only_available_track",
    reason: `Keep building your ${getCategoryTitle(
      categoryOptions,
      latestCategorySlug
    )} record at the strongest available level.`,
    categories: categoryOptions,
    progression,
    latestCase,
    recentRepeatCount,
  });
};
