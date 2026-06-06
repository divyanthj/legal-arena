import "server-only";

import connectMongo from "@/libs/mongoose";
import User from "@/models/User";
import { LEGAL_CASE_CATEGORIES } from "./categories";
import { calculateUnderdogBonus } from "./caseAssessment";
import {
  ensureStoredDashboardEncouragementNote,
  getDefaultDashboardEncouragementNote,
  getDefaultLawyerProfileSummary,
} from "./profileSummary";

const DEFAULT_RATING = 1000;

const uniqueList = (items = []) => [...new Set(items.filter(Boolean))];
const toPlain = (value) => (value?.toObject ? value.toObject() : value);

export const getDefaultCategoryProgress = (categorySlug) => ({
  categorySlug,
  xp: 0,
  rating: DEFAULT_RATING,
  completedCases: 0,
  wins: 0,
  losses: 0,
  draws: 0,
  unlockedComplexity: 1,
  recentPerformance: [],
});

export const getDefaultProgression = () => ({
  overallXp: 0,
  overallRating: DEFAULT_RATING,
  completedCases: 0,
  wins: 0,
  losses: 0,
  draws: 0,
  categoryStats: LEGAL_CASE_CATEGORIES.map((category) =>
    getDefaultCategoryProgress(category.slug)
  ),
  pvp: {
    completedChallenges: 0,
    wins: 0,
    losses: 0,
    draws: 0,
    categoryStats: LEGAL_CASE_CATEGORIES.map((category) => ({
      categorySlug: category.slug,
      completedChallenges: 0,
      wins: 0,
      losses: 0,
      draws: 0,
    })),
  },
});

const getDefaultPvpCategoryProgress = (categorySlug) => ({
  categorySlug,
  completedChallenges: 0,
  wins: 0,
  losses: 0,
  draws: 0,
});

export const normalizePvpProgression = (rawPvp) => {
  const source = toPlain(rawPvp) || {};
  const existingStats = Array.isArray(source.categoryStats)
    ? source.categoryStats.map((item) => toPlain(item))
    : [];
  const existingMap = new Map(
    existingStats.map((item) => [item.categorySlug, item])
  );

  return {
    completedChallenges: source.completedChallenges || 0,
    wins: source.wins || 0,
    losses: source.losses || 0,
    draws: source.draws || 0,
    categoryStats: LEGAL_CASE_CATEGORIES.map((category) => ({
      ...getDefaultPvpCategoryProgress(category.slug),
      ...(existingMap.get(category.slug) || {}),
    })),
  };
};

export const normalizeProgression = (rawProgression) => {
  const source = toPlain(rawProgression) || {};
  const defaultProgression = getDefaultProgression();
  const existingStats = Array.isArray(source.categoryStats)
    ? source.categoryStats.map((item) => toPlain(item))
    : [];
  const existingMap = new Map(
    existingStats.map((item) => [item.categorySlug, item])
  );

  return {
    ...defaultProgression,
    ...source,
    pvp: normalizePvpProgression(source.pvp),
    categoryStats: LEGAL_CASE_CATEGORIES.map((category) => ({
      ...getDefaultCategoryProgress(category.slug),
      ...(existingMap.get(category.slug) || {}),
    })),
  };
};

export const applyChallengeVerdictToPvpProgression = async ({
  userId,
  userProfile = null,
  primaryCategory,
  outcome,
}) => {
  const user = await ensureUserProfile(userId, userProfile);
  if (!user) {
    return null;
  }

  const progression = normalizeProgression(user.progression);
  const pvp = normalizePvpProgression(progression.pvp);
  const didWin = outcome === "win";
  const didDraw = outcome === "draw";
  const didLoss = outcome === "loss";
  const categoryStats = pvp.categoryStats.map((item) => ({ ...item }));
  const categoryIndex = categoryStats.findIndex(
    (item) => item.categorySlug === primaryCategory
  );
  const categoryStat =
    categoryIndex >= 0
      ? categoryStats[categoryIndex]
      : getDefaultPvpCategoryProgress(primaryCategory);

  pvp.completedChallenges += 1;
  pvp.wins += didWin ? 1 : 0;
  pvp.losses += didLoss ? 1 : 0;
  pvp.draws += didDraw ? 1 : 0;

  categoryStat.completedChallenges += 1;
  categoryStat.wins += didWin ? 1 : 0;
  categoryStat.losses += didLoss ? 1 : 0;
  categoryStat.draws += didDraw ? 1 : 0;

  if (categoryIndex >= 0) {
    categoryStats[categoryIndex] = categoryStat;
  } else {
    categoryStats.push(categoryStat);
  }

  pvp.categoryStats = categoryStats;
  progression.pvp = pvp;
  user.progression = progression;
  await user.save();

  return progression;
};

export const ensureUserProfile = async (userId, profile = null) => {
  await connectMongo();

  let user = await User.findById(userId);
  if (!user) {
    const email = String(profile?.email || "")
      .trim()
      .toLowerCase();

    if (!email) {
      throw new Error("Cannot create a user profile without an email address.");
    }

    user = await User.create({
      _id: userId,
      email,
      name: profile?.name?.trim?.() || undefined,
      emailVerified:
        profile?.emailVerified === undefined ? null : profile.emailVerified,
      lawyerProfileSummary: getDefaultLawyerProfileSummary(
        profile?.name?.trim?.() || email.split("@")[0] || "This lawyer"
      ),
      lawyerProfileSummarySource: "default",
      dashboardEncouragementNote: getDefaultDashboardEncouragementNote(
        profile?.name?.trim?.() || email.split("@")[0] || "Counsel"
      ),
      dashboardEncouragementNoteSource: "default",
      dashboardEncouragementNoteUpdatedAt: new Date(),
      progression: getDefaultProgression(),
    });
  }

  let shouldSave = false;

  if (profile?.email) {
    const normalizedEmail = String(profile.email).trim().toLowerCase();

    if (normalizedEmail && user.email !== normalizedEmail) {
      user.email = normalizedEmail;
      shouldSave = true;
    }
  }

  if (profile?.name?.trim?.() && user.name !== profile.name.trim()) {
    user.name = profile.name.trim();
    shouldSave = true;
  }

  if (!String(user.lawyerProfileSummary || "").trim()) {
    user.lawyerProfileSummary = getDefaultLawyerProfileSummary(
      user.name || user.email?.split("@")[0] || "This lawyer"
    );
    user.lawyerProfileSummarySource = "default";
    shouldSave = true;
  }

  if (profile?.emailVerified !== undefined && user.emailVerified !== profile.emailVerified) {
    user.emailVerified = profile.emailVerified;
    shouldSave = true;
  }

  const nextProgression = normalizeProgression(user.progression);
  if (JSON.stringify(nextProgression) !== JSON.stringify(user.progression)) {
    user.progression = nextProgression;
    shouldSave = true;
  }

  if (shouldSave) {
    user.progression = nextProgression;
    await user.save();
  }

  return user;
};

export const getEligibleComplexityForCategory = (progression, categorySlug) => {
  const categoryStat = (progression?.categoryStats || []).find(
    (item) => item.categorySlug === categorySlug
  );

  return Math.max(1, categoryStat?.unlockedComplexity || 1);
};

export const applyVerdictToProgression = async ({
  userId,
  userProfile = null,
  primaryCategory,
  complexity,
  verdictWinner,
  highlights = [],
  lockedCourtEntryChance = null,
  caseTitle = "",
  verdictSummary = "",
}) => {
  const user = await ensureUserProfile(userId, userProfile);
  if (!user) {
    return null;
  }

  const progression = normalizeProgression(user.progression);

  const categoryStats = progression.categoryStats.map((item) => ({ ...item }));
  const categoryIndex = categoryStats.findIndex(
    (item) => item.categorySlug === primaryCategory
  );

  const categoryStat =
    categoryIndex >= 0
      ? categoryStats[categoryIndex]
      : getDefaultCategoryProgress(primaryCategory);

  const didWin = verdictWinner === "player";
  const didDraw = verdictWinner === "draw";
  const xpEarned = 25 + complexity * 10 + (didWin ? 20 : didDraw ? 10 : 0);
  const ratingDelta = didWin ? 18 : didDraw ? 6 : -8;
  const underdogBonus = calculateUnderdogBonus(
    lockedCourtEntryChance,
    verdictWinner
  );
  const totalXpEarned = xpEarned + underdogBonus.bonusXp;
  const totalRatingDelta = ratingDelta + underdogBonus.bonusRating;

  progression.overallXp += totalXpEarned;
  progression.overallRating = Math.max(
    800,
    progression.overallRating + totalRatingDelta
  );
  progression.completedCases += 1;
  progression.wins += didWin ? 1 : 0;
  progression.losses += !didWin && !didDraw ? 1 : 0;
  progression.draws += didDraw ? 1 : 0;

  categoryStat.xp += totalXpEarned;
  categoryStat.rating = Math.max(800, categoryStat.rating + totalRatingDelta);
  categoryStat.completedCases += 1;
  categoryStat.wins += didWin ? 1 : 0;
  categoryStat.losses += !didWin && !didDraw ? 1 : 0;
  categoryStat.draws += didDraw ? 1 : 0;
  categoryStat.unlockedComplexity = Math.min(
    5,
    Math.max(
      categoryStat.unlockedComplexity,
      1 + Math.floor(categoryStat.completedCases / 2)
    )
  );
  categoryStat.recentPerformance = uniqueList([
    `${didWin ? "Won" : didDraw ? "Drew" : "Lost"} a level ${complexity} matter`,
    underdogBonus.note,
    ...categoryStat.recentPerformance,
    ...highlights,
  ]).slice(0, 5);

  if (categoryIndex >= 0) {
    categoryStats[categoryIndex] = categoryStat;
  } else {
    categoryStats.push(categoryStat);
  }

  progression.categoryStats = categoryStats;
  user.progression = progression;
  await user.save();

  await ensureStoredDashboardEncouragementNote({
    user,
    forceRefresh: true,
    latestVerdict: {
      title: caseTitle,
      category: primaryCategory,
      complexity,
      outcome: verdictWinner,
      summary: verdictSummary,
      highlights: highlights.slice(0, 2),
    },
  });

  return progression;
};

export const buildPublicLeaderboardEntry = (user, categorySlug) => {
  const progression = normalizeProgression(user.progression);
  const pvp = normalizePvpProgression(progression.pvp);
  const categoryStat = categorySlug
    ? progression.categoryStats.find((item) => item.categorySlug === categorySlug)
    : null;
  const pvpCategoryStat = categorySlug
    ? pvp.categoryStats.find((item) => item.categorySlug === categorySlug)
    : null;
  const combinedCompletedCases =
    (progression.completedCases || 0) + (pvp.completedChallenges || 0);
  const combinedWins = (progression.wins || 0) + (pvp.wins || 0);
  const combinedLosses = (progression.losses || 0) + (pvp.losses || 0);
  const combinedDraws = (progression.draws || 0) + (pvp.draws || 0);

  return {
    id: user.id,
    name: user.name || user.email?.split("@")[0] || "Counsel",
    image: user.image || "",
    overallRating: progression.overallRating,
    overallXp: progression.overallXp,
    completedCases: combinedCompletedCases,
    wins: combinedWins,
    losses: combinedLosses,
    draws: combinedDraws,
    category: categoryStat
      ? {
          slug: categoryStat.categorySlug,
          rating: categoryStat.rating,
          xp: categoryStat.xp,
          completedCases:
            (categoryStat.completedCases || 0) +
            (pvpCategoryStat?.completedChallenges || 0),
          unlockedComplexity: categoryStat.unlockedComplexity,
          wins: (categoryStat.wins || 0) + (pvpCategoryStat?.wins || 0),
          losses: (categoryStat.losses || 0) + (pvpCategoryStat?.losses || 0),
          draws: (categoryStat.draws || 0) + (pvpCategoryStat?.draws || 0),
      }
      : null,
    pvp,
  };
};

const normalizeLeaderboardSearch = (value = "") =>
  String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");

const fuzzyLeaderboardNameMatch = (name = "", query = "") => {
  const normalizedName = normalizeLeaderboardSearch(name);
  const normalizedQuery = normalizeLeaderboardSearch(query);

  if (!normalizedQuery) {
    return true;
  }

  if (normalizedName.includes(normalizedQuery)) {
    return true;
  }

  let queryIndex = 0;
  for (const character of normalizedName) {
    if (character === normalizedQuery[queryIndex]) {
      queryIndex += 1;
    }
    if (queryIndex === normalizedQuery.length) {
      return true;
    }
  }

  return false;
};

export const listOverallLeaderboard = async ({ search = "", limit = null } = {}) => {
  await connectMongo();

  const refreshedUsers = await User.find({}).sort({
    "progression.overallRating": -1,
    "progression.completedCases": -1,
    updatedAt: -1,
  });

  const rankedEntries = refreshedUsers
    .map((user) => buildPublicLeaderboardEntry(user))
    .sort((left, right) => {
      if ((right.overallRating || 0) !== (left.overallRating || 0)) {
        return (right.overallRating || 0) - (left.overallRating || 0);
      }
      if ((right.completedCases || 0) !== (left.completedCases || 0)) {
        return (right.completedCases || 0) - (left.completedCases || 0);
      }
      return (right.overallXp || 0) - (left.overallXp || 0);
    })
    .map((entry, index) => ({
      rank: index + 1,
      ...entry,
    }));
  const searchedEntries = search
    ? rankedEntries.filter((entry) => fuzzyLeaderboardNameMatch(entry.name, search))
    : rankedEntries;

  return limit ? searchedEntries.slice(0, limit) : searchedEntries;
};

export const listPlayerDirectory = async ({ search = "", limit = null } = {}) =>
  listOverallLeaderboard({ search, limit });

export const listCategoryLeaderboard = async (categorySlug) => {
  await connectMongo();

  return (await User.find({}))
    .map((user) => buildPublicLeaderboardEntry(user, categorySlug))
    .sort((left, right) => {
      const leftCategory = left.category || {};
      const rightCategory = right.category || {};

      if ((rightCategory.rating || 0) !== (leftCategory.rating || 0)) {
        return (rightCategory.rating || 0) - (leftCategory.rating || 0);
      }
      if (
        (rightCategory.completedCases || 0) !== (leftCategory.completedCases || 0)
      ) {
        return (rightCategory.completedCases || 0) - (leftCategory.completedCases || 0);
      }

      return (rightCategory.xp || 0) - (leftCategory.xp || 0);
    })
    .map((entry, index) => ({
      rank: index + 1,
      ...entry,
    }));
};
