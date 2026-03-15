import "server-only";

import connectMongo from "@/libs/mongoose";
import User from "@/models/User";
import { LEGAL_CASE_CATEGORIES } from "./categories";

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
});

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
    categoryStats: LEGAL_CASE_CATEGORIES.map((category) => ({
      ...getDefaultCategoryProgress(category.slug),
      ...(existingMap.get(category.slug) || {}),
    })),
  };
};

export const ensureUserProfile = async (userId) => {
  await connectMongo();

  const user = await User.findById(userId);
  if (!user) {
    return null;
  }

  const nextProgression = normalizeProgression(user.progression);
  user.progression = nextProgression;
  await user.save();

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
  primaryCategory,
  complexity,
  verdictWinner,
  highlights = [],
}) => {
  const user = await ensureUserProfile(userId);
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

  progression.overallXp += xpEarned;
  progression.overallRating = Math.max(
    800,
    progression.overallRating + ratingDelta
  );
  progression.completedCases += 1;
  progression.wins += didWin ? 1 : 0;
  progression.losses += !didWin && !didDraw ? 1 : 0;
  progression.draws += didDraw ? 1 : 0;

  categoryStat.xp += xpEarned;
  categoryStat.rating = Math.max(800, categoryStat.rating + ratingDelta);
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

  return progression;
};

export const buildPublicLeaderboardEntry = (user, categorySlug) => {
  const progression = normalizeProgression(user.progression);
  const categoryStat = categorySlug
    ? progression.categoryStats.find((item) => item.categorySlug === categorySlug)
    : null;

  return {
    id: user.id,
    name: user.name || user.email?.split("@")[0] || "Counsel",
    image: user.image || "",
    overallRating: progression.overallRating,
    overallXp: progression.overallXp,
    completedCases: progression.completedCases,
    wins: progression.wins,
    losses: progression.losses,
    draws: progression.draws,
    category: categoryStat
      ? {
          slug: categoryStat.categorySlug,
          rating: categoryStat.rating,
          xp: categoryStat.xp,
          completedCases: categoryStat.completedCases,
          unlockedComplexity: categoryStat.unlockedComplexity,
          wins: categoryStat.wins,
          losses: categoryStat.losses,
          draws: categoryStat.draws,
        }
      : null,
  };
};

export const listOverallLeaderboard = async () => {
  await connectMongo();

  const users = await User.find({});
  await Promise.all(users.map((user) => ensureUserProfile(user._id)));

  const refreshedUsers = await User.find({}).sort({
    "progression.overallRating": -1,
    "progression.completedCases": -1,
    updatedAt: -1,
  });

  return refreshedUsers.map((user, index) => ({
    rank: index + 1,
    ...buildPublicLeaderboardEntry(user),
  }));
};

export const listCategoryLeaderboard = async (categorySlug) => {
  await connectMongo();

  const users = await User.find({});
  await Promise.all(users.map((user) => ensureUserProfile(user._id)));

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
