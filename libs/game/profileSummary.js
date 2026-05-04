import "server-only";

import { requestStructuredCompletion } from "@/libs/gpt";
import { LEGAL_CASE_CATEGORIES } from "@/libs/game/categories";

const getCategoryTitle = (slug = "") =>
  LEGAL_CASE_CATEGORIES.find((category) => category.slug === slug)?.title || slug;

export const getDefaultLawyerProfileSummary = (name = "This lawyer") =>
  `${name} is building a public lawyer profile in the arena.`;

const buildFallbackSummary = ({ player, cases = [] }) => {
  const topCategories = [...(player.categoryStats || [])]
    .filter((category) => (category.completedCases || 0) > 0)
    .sort((left, right) => {
      if ((right.completedCases || 0) !== (left.completedCases || 0)) {
        return (right.completedCases || 0) - (left.completedCases || 0);
      }

      return (right.rating || 0) - (left.rating || 0);
    })
    .slice(0, 2)
    .map((category) => getCategoryTitle(category.categorySlug))
    .filter(Boolean);

  if (cases.length === 0) {
    return `${player.name} is building an early record across the arena and has not opened a public matter archive yet.`;
  }

  if (topCategories.length > 0) {
    return `${player.name} is building a public record with strength in ${topCategories.join(
      " and "
    )}, carrying a ${player.wins}-${player.losses}-${player.draws} record across ${
      player.completedCases
    } completed matters.`;
  }

  return `${player.name} has completed ${player.completedCases} public matters and currently holds a ${player.wins}-${player.losses}-${player.draws} record in the arena.`;
};

export const generateLawyerProfileSummary = async ({ player, cases = [] }) => {
  if (!player?.name) {
    return "This lawyer's public record is still taking shape.";
  }

  const topCategories = [...(player.categoryStats || [])]
    .sort((left, right) => {
      if ((right.completedCases || 0) !== (left.completedCases || 0)) {
        return (right.completedCases || 0) - (left.completedCases || 0);
      }

      return (right.rating || 0) - (left.rating || 0);
    })
    .slice(0, 5)
    .map((category) => ({
      category: getCategoryTitle(category.categorySlug),
      completedCases: category.completedCases || 0,
      rating: category.rating || 0,
      record: `${category.wins || 0}-${category.losses || 0}-${category.draws || 0}`,
    }));

  const recentCases = cases.slice(0, 6).map((caseSession) => ({
    title: caseSession.title,
    category: getCategoryTitle(caseSession.primaryCategory),
    status: caseSession.status,
    outcome: caseSession.verdict?.winner || "open",
    complexity: caseSession.complexity || 1,
  }));

  const aiResult = await requestStructuredCompletion({
    userId: String(player.id || player.email || player.name),
    maxTokens: 180,
    retryAttempts: 1,
    usageLabel: "lawyer-profile-summary",
    systemPrompt:
      "You write concise lawyer profile blurbs for a courtroom simulation product. Return JSON only with a single key: summary.",
    userPrompt: JSON.stringify(
      {
        instruction:
          "Write one brief 1-2 sentence profile description in third person. Base it on the lawyer's actual case history and category performance. Keep it grounded, specific, and under 220 characters. Do not mention AI, UI, avatars, dashboards, or placeholders.",
        player: {
          name: player.name,
          overallRating: player.overallRating || 0,
          overallXp: player.overallXp || 0,
          completedCases: player.completedCases || 0,
          record: `${player.wins || 0}-${player.losses || 0}-${player.draws || 0}`,
        },
        topCategories,
        recentCases,
      },
      null,
      2
    ),
  });

  const summary = String(aiResult?.summary || "").trim();

  if (summary) {
    return summary;
  }

  return buildFallbackSummary({ player, cases });
};

export const ensureStoredLawyerProfileSummary = async ({ user, cases = [] }) => {
  if (!user) {
    return getDefaultLawyerProfileSummary();
  }

  const currentSummary = String(user.lawyerProfileSummary || "").trim();
  const currentSource = String(user.lawyerProfileSummarySource || "default").trim();
  const defaultSummary = getDefaultLawyerProfileSummary(
    user.name || user.email?.split("@")[0] || "This lawyer"
  );

  if (!cases.length) {
    if (!currentSummary || currentSource !== "default") {
      user.lawyerProfileSummary = defaultSummary;
      user.lawyerProfileSummarySource = "default";
      await user.save();
    }

    return user.lawyerProfileSummary || defaultSummary;
  }

  if (currentSummary && currentSource === "generated") {
    return currentSummary;
  }

  const summary = await generateLawyerProfileSummary({
    player: {
      id: user.id,
      name: user.name,
      email: user.email,
      overallRating: user.progression?.overallRating || 0,
      overallXp: user.progression?.overallXp || 0,
      completedCases: user.progression?.completedCases || 0,
      wins: user.progression?.wins || 0,
      losses: user.progression?.losses || 0,
      draws: user.progression?.draws || 0,
      categoryStats: user.progression?.categoryStats || [],
    },
    cases,
  });

  user.lawyerProfileSummary = summary || defaultSummary;
  user.lawyerProfileSummarySource = "generated";
  await user.save();

  return user.lawyerProfileSummary;
};
