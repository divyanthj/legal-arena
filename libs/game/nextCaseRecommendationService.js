import "server-only";

import connectMongo from "@/libs/mongoose";
import CaseSession from "@/models/CaseSession";
import { DEFAULT_CATEGORY_SLUG, LEGAL_CASE_CATEGORIES } from "./categories";
import { ensureUserProfile, normalizeProgression } from "./progression";
import { buildNextCaseRecommendation } from "./nextCaseRecommendation.mjs";

export const getNextCaseRecommendationForUser = async ({
  userId,
  userProfile = null,
} = {}) => {
  await connectMongo();

  const [user, cases] = await Promise.all([
    ensureUserProfile(userId, userProfile),
    CaseSession.find({
      userId,
      status: { $in: ["verdict", "settled"] },
    })
      .select(
        "_id slug primaryCategory complexity status completedAt updatedAt createdAt"
      )
      .sort({ completedAt: -1, updatedAt: -1 })
      .lean(),
  ]);

  return buildNextCaseRecommendation({
    cases,
    progression: normalizeProgression(user?.progression),
    categories: LEGAL_CASE_CATEGORIES,
    playerId: String(userId || ""),
    defaultCategorySlug: DEFAULT_CATEGORY_SLUG,
  });
};
