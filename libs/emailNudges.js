import "server-only";

import connectMongo from "@/libs/mongoose";
import config from "@/config";
import { getAdminOpsConfig } from "@/libs/adminOps";
import { emailTemplate } from "@/libs/emailTemplate";
import { sendEmail } from "@/libs/resend";
import {
  buildCandidate,
  determineRetentionNudge,
  getCategoryUnlockLevel,
  makeNudgeDedupeKey,
  NUDGE_TYPES,
  normalizeRetentionRuntimeSettings,
  parseNudgeRunOptions,
  selectRecommendedTemplate,
} from "@/libs/emailNudgesCore";
import {
  LEGAL_CASE_CATEGORIES,
  getCategoryTitle,
} from "@/libs/game/categories";
import { listCategoryLeaderboard } from "@/libs/game/progression";
import { listScenarioOptions } from "@/libs/game/store";
import { normalizeProgression } from "@/libs/game/progression";
import CaseSession from "@/models/CaseSession";
import EmailNudgeLog from "@/models/EmailNudgeLog";
import User from "@/models/User";

const buildAppUrl = (path = "/") =>
  `https://${config.domainName}${path.startsWith("/") ? path : `/${path}`}`;

const joinLines = (lines = []) => lines.filter(Boolean).join("\n");
const DAY_MS = 24 * 60 * 60 * 1000;
const WEEK_MS = 7 * DAY_MS;
const FORTNIGHT_MS = 14 * DAY_MS;
const THIRTY_DAYS_MS = 30 * DAY_MS;
const toMillis = (value) => new Date(value).getTime();

const getUserDisplayName = (user) =>
  user?.name || user?.email?.split("@")[0] || "Counsel";

const getTemplateIdentity = (value) =>
  String(value?._id || value?.id || value || "");

const getMostRecentLog = ({ logs = [], nudgeType, predicate = null } = {}) =>
  logs
    .filter(
      (log) =>
        log.nudgeType === nudgeType && (!predicate || predicate(log))
    )
    .sort((left, right) => toMillis(right.sentAt) - toMillis(left.sentAt))[0] ||
  null;

const getBestCategoryStat = (progression) =>
  (progression?.categoryStats || [])
    .filter((item) => (item.completedCases || 0) > 0)
    .slice()
    .sort((left, right) => {
      if ((right.completedCases || 0) !== (left.completedCases || 0)) {
        return (right.completedCases || 0) - (left.completedCases || 0);
      }

      return (right.rating || 0) - (left.rating || 0);
    })[0] || null;

const pickRecommendedTemplate = ({
  templates = [],
  preferredCategory = "",
  preferredComplexity = null,
} = {}) => {
  const unlockedTemplates = templates.filter((template) => template.unlocked);

  if (!unlockedTemplates.length) {
    return null;
  }

  const exactComplexity = unlockedTemplates.filter(
    (template) =>
      template.primaryCategory === preferredCategory &&
      template.complexity === preferredComplexity
  );

  if (exactComplexity.length > 0) {
    return exactComplexity
      .slice()
      .sort((left, right) => toMillis(right.createdAt) - toMillis(left.createdAt))[0];
  }

  return selectRecommendedTemplate({
    templates: unlockedTemplates,
    preferredCategory,
  });
};

const getLatestActivityAt = ({ user, caseSessions = [] } = {}) => {
  const timestamps = [user?.updatedAt]
    .concat(caseSessions.map((caseSession) => caseSession.updatedAt))
    .filter(Boolean)
    .map((value) => toMillis(value));

  return timestamps.length > 0 ? Math.max(...timestamps) : 0;
};

const buildLeaderboardLookup = (entries = []) =>
  new Map(entries.map((entry) => [String(entry.id), entry]));

const selectLeaderboardCandidate = ({
  user,
  logs,
  progression,
  leaderboardContext,
}) => {
  const categoryStats = (progression?.categoryStats || []).filter(
    (item) => (item.completedCases || 0) > 0
  );

  if (!categoryStats.length) {
    return null;
  }

  const milestones = [
    { key: "top_1", threshold: 1, label: "took the top spot" },
    { key: "top_3", threshold: 3, label: "cracked the top 3" },
    { key: "top_10", threshold: 10, label: "entered the top 10" },
  ];

  const rankedStats = categoryStats
    .map((stat) => {
      const leaderboard = leaderboardContext?.[stat.categorySlug] || new Map();
      const entry = leaderboard.get(String(user._id || user.id));

      return entry ? { stat, entry } : null;
    })
    .filter(Boolean)
    .sort((left, right) => left.entry.rank - right.entry.rank);

  for (const { stat, entry } of rankedStats) {
    for (const milestone of milestones) {
      if (entry.rank <= milestone.threshold) {
        const dedupeKey = `leaderboard_milestone:${stat.categorySlug}:${milestone.key}`;

        if (
          !logs.some(
            (log) =>
              log.nudgeType === NUDGE_TYPES.LEADERBOARD_MILESTONE &&
              log.dedupeKey === dedupeKey
          )
        ) {
          return buildCandidate({
            type: NUDGE_TYPES.LEADERBOARD_MILESTONE,
            dedupeKey,
            reason: milestone.label,
            meta: {
              categorySlug: stat.categorySlug,
              categoryTitle: getCategoryTitle(stat.categorySlug),
              rank: entry.rank,
              milestone: milestone.key,
            },
          });
        }
      }
    }
  }

  for (const { stat, entry } of rankedStats) {
    const priorMilestone = [
      { key: "top_1", threshold: 1, label: "lost the top spot" },
      { key: "top_3", threshold: 3, label: "slipped outside the top 3" },
      { key: "top_10", threshold: 10, label: "slipped outside the top 10" },
    ].find((milestone) => {
      const reachedEarlier = logs.some(
        (log) =>
          log.nudgeType === NUDGE_TYPES.LEADERBOARD_MILESTONE &&
          log.meta?.categorySlug === stat.categorySlug &&
          log.meta?.milestone === milestone.key
      );

      return reachedEarlier && entry.rank > milestone.threshold;
    });

    if (priorMilestone) {
      const dedupeKey = `leaderboard_milestone:${stat.categorySlug}:slipped:${priorMilestone.key}`;

      if (
        !logs.some(
          (log) =>
            log.nudgeType === NUDGE_TYPES.LEADERBOARD_MILESTONE &&
            log.dedupeKey === dedupeKey
        )
      ) {
        return buildCandidate({
          type: NUDGE_TYPES.LEADERBOARD_MILESTONE,
          dedupeKey,
          reason: priorMilestone.label,
          meta: {
            categorySlug: stat.categorySlug,
            categoryTitle: getCategoryTitle(stat.categorySlug),
            rank: entry.rank,
            milestone: `slipped_${priorMilestone.key}`,
          },
        });
      }
    }
  }

  for (const { stat, entry } of rankedStats) {
    if (entry.rank !== 11) {
      continue;
    }

    const categoryLeaderboard = leaderboardContext?.[stat.categorySlug];
    const tenthPlace = categoryLeaderboard?.get("__rank__10") || null;
    const ratingGap = Math.max(
      0,
      (tenthPlace?.category?.rating || 0) - (entry.category?.rating || 0)
    );
    const completedGap = Math.max(
      0,
      (tenthPlace?.category?.completedCases || 0) -
        (entry.category?.completedCases || 0)
    );

    if (ratingGap <= 20 || completedGap <= 1) {
      const dedupeKey = `leaderboard_milestone:${stat.categorySlug}:near_top_10`;

      if (
        !logs.some(
          (log) =>
            log.nudgeType === NUDGE_TYPES.LEADERBOARD_MILESTONE &&
            log.dedupeKey === dedupeKey
        )
      ) {
        return buildCandidate({
          type: NUDGE_TYPES.LEADERBOARD_MILESTONE,
          dedupeKey,
          reason: "one strong result away from the top 10",
          meta: {
            categorySlug: stat.categorySlug,
            categoryTitle: getCategoryTitle(stat.categorySlug),
            rank: entry.rank,
            milestone: "near_top_10",
            ratingGap,
            completedGap,
          },
        });
      }
    }
  }

  return null;
};

const buildLifecycleCandidates = ({
  user,
  caseSessions,
  logs,
  progression,
  templates,
  leaderboardContext,
  now,
  settings,
}) => {
  const runtimeSettings = normalizeRetentionRuntimeSettings(settings);
  const candidates = [];
  const latestVerdict = caseSessions
    .filter(
      (caseSession) =>
        caseSession.status === "verdict" &&
        toMillis(caseSession.updatedAt) >=
          now.getTime() -
            runtimeSettings.thresholds.postVerdictWindowDays * DAY_MS
    )
    .sort((left, right) => toMillis(right.updatedAt) - toMillis(left.updatedAt))[0];

  if (runtimeSettings.nudgeTypes[NUDGE_TYPES.NEW_UNLOCK] && latestVerdict) {
    const categorySlug = latestVerdict.primaryCategory;
    const unlockedComplexity = getCategoryUnlockLevel({
      progression,
      categorySlug,
    });
    const lastUnlockLog = getMostRecentLog({
      logs,
      nudgeType: NUDGE_TYPES.NEW_UNLOCK,
      predicate: (log) => log.meta?.categorySlug === categorySlug,
    });
    const lastUnlockLevel = lastUnlockLog?.meta?.unlockedComplexity || 0;

    if (unlockedComplexity > Math.max(lastUnlockLevel, latestVerdict.complexity || 0)) {
      candidates.push(
        buildCandidate({
          type: NUDGE_TYPES.NEW_UNLOCK,
          dedupeKey: `new_unlock:${categorySlug}:${unlockedComplexity}`,
          caseSession: latestVerdict,
          reason: `unlocked ${getCategoryTitle(categorySlug)} complexity ${unlockedComplexity}`,
          meta: {
            categorySlug,
            categoryTitle: getCategoryTitle(categorySlug),
            unlockedComplexity,
          },
        })
      );
    }
  }

  const leaderboardCandidate = selectLeaderboardCandidate({
    user,
    logs,
    progression,
    leaderboardContext,
  });

  if (
    runtimeSettings.nudgeTypes[NUDGE_TYPES.LEADERBOARD_MILESTONE] &&
    leaderboardCandidate
  ) {
    candidates.push(leaderboardCandidate);
  }

  const bestCategory = getBestCategoryStat(progression);
  const latestNewContentLog = getMostRecentLog({
    logs,
    nudgeType: NUDGE_TYPES.NEW_CONTENT_RELEVANT,
  });
  const newContentTemplate = templates
    .filter((template) => template.unlocked)
    .filter(
      (template) =>
        toMillis(template.createdAt) >=
        now.getTime() - runtimeSettings.thresholds.newContentWindowDays * DAY_MS
    )
    .filter((template) =>
      latestNewContentLog ? toMillis(template.createdAt) > toMillis(latestNewContentLog.sentAt) : true
    )
    .sort((left, right) => {
      const leftPreferred = left.primaryCategory === bestCategory?.categorySlug ? 1 : 0;
      const rightPreferred = right.primaryCategory === bestCategory?.categorySlug ? 1 : 0;

      if (rightPreferred !== leftPreferred) {
        return rightPreferred - leftPreferred;
      }

      return toMillis(right.createdAt) - toMillis(left.createdAt);
    })[0];

  if (
    runtimeSettings.nudgeTypes[NUDGE_TYPES.NEW_CONTENT_RELEVANT] &&
    newContentTemplate
  ) {
    candidates.push(
      buildCandidate({
        type: NUDGE_TYPES.NEW_CONTENT_RELEVANT,
        dedupeKey: `new_content_relevant:${newContentTemplate.id}`,
        reason: "a newly available matter matches the player's specialization",
        meta: {
          templateId: newContentTemplate.id,
          templateTitle: newContentTemplate.title,
          categorySlug: newContentTemplate.primaryCategory,
          categoryTitle: getCategoryTitle(newContentTemplate.primaryCategory),
          complexity: newContentTemplate.complexity,
        },
      })
    );
  }

  const hasActiveCase = caseSessions.some((caseSession) =>
    ["interview", "courtroom"].includes(caseSession.status)
  );
  const latestActivityAt = getLatestActivityAt({ user, caseSessions });
  const inactiveForMs = latestActivityAt ? now.getTime() - latestActivityAt : 0;

  if (
    runtimeSettings.nudgeTypes[NUDGE_TYPES.DORMANT_WINBACK] &&
    !hasActiveCase &&
    latestActivityAt &&
    inactiveForMs >= runtimeSettings.thresholds.dormantWinbackDays * DAY_MS
  ) {
    const inactivityBucket = Math.floor(
      (inactiveForMs - runtimeSettings.thresholds.dormantWinbackDays * DAY_MS) /
        THIRTY_DAYS_MS
    );

    candidates.push(
      buildCandidate({
        type: NUDGE_TYPES.DORMANT_WINBACK,
        dedupeKey: `dormant_winback:${bestCategory?.categorySlug || "general"}:${inactivityBucket}`,
        reason: "player has been inactive without an active matter",
        meta: {
          inactiveDays: Math.floor(inactiveForMs / DAY_MS),
          categorySlug: bestCategory?.categorySlug || "",
          categoryTitle: getCategoryTitle(bestCategory?.categorySlug || ""),
        },
      })
    );
  }

  return candidates;
};

const createRetentionEmailContent = ({
  nudgeType,
  user,
  candidate = null,
  caseSession,
  progression,
  recommendedTemplate = null,
}) => {
  const name = getUserDisplayName(user);
  const caseId = caseSession?.slug || caseSession?.id || caseSession?._id || "";
  const caseUrl = caseId ? buildAppUrl(`/dashboard/cases/${caseId}`) : buildAppUrl("/dashboard");
  const dashboardUrl = buildAppUrl("/dashboard");
  const categoryUnlockLevel = getCategoryUnlockLevel({
    progression,
    categorySlug: caseSession?.primaryCategory || candidate?.meta?.categorySlug,
  });

  if (nudgeType === "resume_interview") {
    const openQuestions =
      caseSession.factSheet?.openQuestions?.slice(0, 3).filter(Boolean) || [];
    const questionLines = openQuestions.length
      ? `Questions still worth locking down:\n${openQuestions
          .map((question) => `- ${question}`)
          .join("\n")}`
      : "Open the matter and tighten the facts before you head into court.";
    const content = joinLines([
      `Hello ${name},`,
      "",
      `${caseSession.premise?.clientName || "Your client"} is still waiting on a sharper intake in "${caseSession.title}".`,
      "A few focused questions now will make the courtroom round cleaner later.",
      "",
      questionLines,
      "",
      "Finish the intake, clean up the fact sheet, and move this file toward court.",
    ]);

    return {
      subject: "Your client file is still open",
      text: content,
      html: emailTemplate({
        title: "Your client file is still open",
        subtitle: `${caseSession.title} is ready for your next question.`,
        content,
        ctaLabel: "Resume intake",
        ctaUrl: caseUrl,
      }),
      ctaUrl: caseUrl,
    };
  }

  if (nudgeType === "resume_courtroom") {
    const content = joinLines([
      `Hello ${name},`,
      "",
      `Court is still waiting on your next argument in "${caseSession.title}".`,
      `You are ${caseSession.score?.roundsCompleted || 0} round(s) in, and the latest bench signal was:`,
      `"${caseSession.score?.lastBenchSignal || "The bench is listening. Build the record carefully."}"`,
      "",
      "Coaching note: come back with the cleanest version of your theory and anchor it to your strongest facts.",
      `Competitive note: finishing this matter keeps your ${caseSession.primaryCategory} track moving toward complexity ${categoryUnlockLevel}.`,
    ]);

    return {
      subject: "Court is waiting on your next argument",
      text: content,
      html: emailTemplate({
        title: "Court is waiting on your next argument",
        subtitle: `${caseSession.title} is paused mid-hearing.`,
        content,
        ctaLabel: "Return to court",
        ctaUrl: caseUrl,
      }),
      ctaUrl: caseUrl,
    };
  }

  if (nudgeType === "post_verdict_next_case") {
    const didWin = caseSession.verdict?.winner === "player";
    const subject = didWin
      ? "You won. Ready for a tougher matter?"
      : "Run it back with a stronger case";
    const highlightLine =
      caseSession.verdict?.highlights?.slice(0, 2).filter(Boolean).join("; ") || "";
    const recommendedLine = recommendedTemplate
      ? `Recommended next matter: "${recommendedTemplate.title}" in ${recommendedTemplate.primaryCategory}, complexity ${recommendedTemplate.complexity}.`
      : "There is at least one unlocked matter waiting on your dashboard.";
    const content = joinLines([
      `Hello ${name},`,
      "",
      caseSession.verdict?.summary || `You finished "${caseSession.title}".`,
      highlightLine ? `What landed: ${highlightLine}` : "",
      `Your ${caseSession.primaryCategory} lane is currently unlocked through complexity ${categoryUnlockLevel}.`,
      recommendedLine,
      "",
      didWin
        ? "Turn that momentum into the next matter while the playbook is fresh."
        : "Take what you learned, pick the next matter, and come back sharper.",
    ]);

    return {
      subject,
      text: content,
      html: emailTemplate({
        title: subject,
        subtitle: `${caseSession.title} is complete. Your next matter is ready.`,
        content,
        ctaLabel: "Choose your next case",
        ctaUrl: dashboardUrl,
      }),
      ctaUrl: dashboardUrl,
    };
  }

  if (nudgeType === NUDGE_TYPES.NEW_UNLOCK) {
    const unlockedComplexity = candidate?.meta?.unlockedComplexity || 1;
    const categoryTitle =
      candidate?.meta?.categoryTitle || getCategoryTitle(caseSession.primaryCategory);
    const recommendedLine = recommendedTemplate
      ? `Recommended next matter: "${recommendedTemplate.title}" in ${categoryTitle}, complexity ${recommendedTemplate.complexity}.`
      : `Your ${categoryTitle} board now includes tougher matters up to complexity ${unlockedComplexity}.`;
    const content = joinLines([
      `Hello ${name},`,
      "",
      `You just unlocked ${categoryTitle} complexity ${unlockedComplexity}.`,
      `Finishing "${caseSession.title}" opened a tougher tier in that specialty.`,
      recommendedLine,
      "",
      "Momentum matters here. Step into the harder file while your theory-building instincts are warm.",
    ]);

    return {
      subject: `New ${categoryTitle} tier unlocked`,
      text: content,
      html: emailTemplate({
        title: `New ${categoryTitle} tier unlocked`,
        subtitle: `A tougher matter is now available in ${categoryTitle}.`,
        content,
        ctaLabel: "Pick your next challenge",
        ctaUrl: dashboardUrl,
      }),
      ctaUrl: dashboardUrl,
    };
  }

  if (nudgeType === NUDGE_TYPES.LEADERBOARD_MILESTONE) {
    const milestone = candidate?.meta?.milestone || "";
    const categoryTitle = candidate?.meta?.categoryTitle || "your specialty";
    const rankLine =
      typeof candidate?.meta?.rank === "number"
        ? `You are currently ranked #${candidate.meta.rank} in ${categoryTitle}.`
        : "";
    let subject = "Your ranking just got interesting";
    let bodyLine =
      "You are within striking distance of a visible jump on the board.";

    if (milestone === "top_1") {
      subject = `You lead the ${categoryTitle} board`;
      bodyLine = `You took the top spot in ${categoryTitle}.`;
    } else if (milestone === "top_3") {
      subject = `You cracked the top 3 in ${categoryTitle}`;
      bodyLine = `You are now inside the top 3 in ${categoryTitle}.`;
    } else if (milestone === "top_10") {
      subject = `You entered the top 10 in ${categoryTitle}`;
      bodyLine = `You just broke into the top 10 in ${categoryTitle}.`;
    } else if (milestone === "slipped_top_1") {
      subject = `The top spot in ${categoryTitle} is in play again`;
      bodyLine = `You slipped off #1 in ${categoryTitle}, but the board is still within reach.`;
    } else if (milestone === "slipped_top_3") {
      subject = `You are just outside the top 3 in ${categoryTitle}`;
      bodyLine = `You slipped outside the top 3 in ${categoryTitle}.`;
    } else if (milestone === "slipped_top_10") {
      subject = `You are just outside the top 10 in ${categoryTitle}`;
      bodyLine = `You slipped outside the top 10 in ${categoryTitle}.`;
    } else if (milestone === "near_top_10") {
      subject = `One more strong result could put you in the top 10`;
      bodyLine = `You are one strong matter away from a visible jump in ${categoryTitle}.`;
    }

    const content = joinLines([
      `Hello ${name},`,
      "",
      bodyLine,
      rankLine,
      "If you want the next jump, the cleanest path is another sharp finish in your best category.",
    ]);

    return {
      subject,
      text: content,
      html: emailTemplate({
        title: subject,
        subtitle: `${categoryTitle} standings are moving.`,
        content,
        ctaLabel: "Open the leaderboard",
        ctaUrl: dashboardUrl,
      }),
      ctaUrl: dashboardUrl,
    };
  }

  if (nudgeType === NUDGE_TYPES.NEW_CONTENT_RELEVANT) {
    const categoryTitle =
      candidate?.meta?.categoryTitle ||
      getCategoryTitle(candidate?.meta?.categorySlug || "");
    const templateTitle =
      candidate?.meta?.templateTitle ||
      recommendedTemplate?.title ||
      "A new matter";
    const complexity =
      candidate?.meta?.complexity || recommendedTemplate?.complexity || 1;
    const content = joinLines([
      `Hello ${name},`,
      "",
      `"${templateTitle}" is now available on your board.`,
      `It fits your current ${categoryTitle} range at complexity ${complexity}.`,
      "If you were waiting for a fresh file to jump back in, this is a good moment.",
    ]);

    return {
      subject: "A new playable matter is ready",
      text: content,
      html: emailTemplate({
        title: "A new playable matter is ready",
        subtitle: `${templateTitle} is now available on your dashboard.`,
        content,
        ctaLabel: "See the new case",
        ctaUrl: dashboardUrl,
      }),
      ctaUrl: dashboardUrl,
    };
  }

  if (nudgeType === NUDGE_TYPES.DORMANT_WINBACK) {
    const inactiveDays = candidate?.meta?.inactiveDays || 14;
    const categoryTitle =
      candidate?.meta?.categoryTitle ||
      getCategoryTitle(candidate?.meta?.categorySlug || "");
    const recommendedLine = recommendedTemplate
      ? `Recommended restart: "${recommendedTemplate.title}" in ${recommendedTemplate.primaryCategory}, complexity ${recommendedTemplate.complexity}.`
      : "There is at least one unlocked matter waiting on your dashboard.";
    const content = joinLines([
      `Hello ${name},`,
      "",
      `It has been about ${inactiveDays} day(s) since your last matter.`,
      categoryTitle && categoryTitle !== "General"
        ? `Your strongest lane lately has been ${categoryTitle}.`
        : "",
      recommendedLine,
      "",
      "Come back for one focused round. The fastest way to rebuild momentum is to put a fresh record on the board.",
    ]);

    return {
      subject: "Your next matter is still waiting",
      text: content,
      html: emailTemplate({
        title: "Your next matter is still waiting",
        subtitle: "A quick return can get your momentum moving again.",
        content,
        ctaLabel: "Return to Legal Arena",
        ctaUrl: dashboardUrl,
      }),
      ctaUrl: dashboardUrl,
    };
  }

  const cooldownTime = caseSession.exitedAt
    ? new Date(new Date(caseSession.exitedAt).getTime() + 24 * 60 * 60 * 1000)
    : null;
  const content = joinLines([
    `Hello ${name},`,
    "",
    `The cooldown on "${caseSession.title}" has ended.`,
    cooldownTime
      ? `That matter became available again on ${cooldownTime.toLocaleString("en-US", {
          month: "short",
          day: "numeric",
          hour: "numeric",
          minute: "2-digit",
        })}.`
      : "You can reopen it now or choose another unlocked matter.",
    "Pick it back up when you are ready, or use the momentum to start a different case.",
  ]);

  return {
    subject: "That matter is available again",
    text: content,
    html: emailTemplate({
      title: "That matter is available again",
      subtitle: `${caseSession.title} is back on the board.`,
      content,
      ctaLabel: "Open dashboard",
      ctaUrl: dashboardUrl,
    }),
    ctaUrl: dashboardUrl,
  };
};

const evaluateUserNudge = async ({
  user,
  leaderboardContext = {},
  now = new Date(),
  settings = {},
}) => {
  const [caseSessions, logs] = await Promise.all([
    CaseSession.find({ userId: user._id }).sort({ updatedAt: -1 }).lean(),
    EmailNudgeLog.find({ userId: user._id }).sort({ sentAt: -1 }).lean(),
  ]);
  const progression = normalizeProgression(user.progression);
  const templates = await listScenarioOptions(user._id);
  const lifecycleCandidates = buildLifecycleCandidates({
    user,
    caseSessions,
    logs,
    progression,
    templates,
    leaderboardContext,
    now,
    settings,
  });

  const { candidate, skipReason } = determineRetentionNudge({
    caseSessions,
    logs,
    lifecycleCandidates,
    now,
    settings,
  });

  if (!candidate) {
    return { candidate: null, skipReason };
  }

  let recommendedTemplate =
    candidate.meta?.templateId
      ? templates.find(
          (template) => getTemplateIdentity(template) === candidate.meta.templateId
        ) || null
      : null;

  if (!recommendedTemplate) {
    if (candidate.type === NUDGE_TYPES.POST_VERDICT_NEXT_CASE) {
      recommendedTemplate = selectRecommendedTemplate({
        templates,
        preferredCategory: candidate.caseSession.primaryCategory,
      });
    } else if (candidate.type === NUDGE_TYPES.NEW_UNLOCK) {
      recommendedTemplate = pickRecommendedTemplate({
        templates,
        preferredCategory: candidate.meta?.categorySlug,
        preferredComplexity: candidate.meta?.unlockedComplexity,
      });
    } else if (candidate.type === NUDGE_TYPES.NEW_CONTENT_RELEVANT) {
      recommendedTemplate = pickRecommendedTemplate({
        templates,
        preferredCategory: candidate.meta?.categorySlug,
        preferredComplexity: candidate.meta?.complexity,
      });
    } else if (candidate.type === NUDGE_TYPES.DORMANT_WINBACK) {
      recommendedTemplate = pickRecommendedTemplate({
        templates,
        preferredCategory:
          candidate.meta?.categorySlug || getBestCategoryStat(progression)?.categorySlug,
      });
    }
  }

  return {
    candidate,
    skipReason: null,
    progression,
    recommendedTemplate,
    caseSessions,
    logs,
    templates,
  };
};

const recordSentNudge = async ({
  user,
  candidate,
  emailContent,
  recommendedTemplate,
}) =>
  EmailNudgeLog.create({
    userId: user._id,
    caseSessionId: candidate.caseSessionId,
    nudgeType: candidate.type,
    dedupeKey:
      candidate.dedupeKey ||
      makeNudgeDedupeKey({
        nudgeType: candidate.type,
        caseSessionId: candidate.caseSessionId,
      }),
    sentAt: new Date(),
    meta: {
      reason: candidate.reason,
      subject: emailContent.subject,
      ctaUrl: emailContent.ctaUrl,
      templateRecommendationId: recommendedTemplate?.id || null,
      ...candidate.meta,
    },
  });

const buildLeaderboardContext = async () => {
  const entries = await Promise.all(
    LEGAL_CASE_CATEGORIES.map(async (category) => [
      category.slug,
      await listCategoryLeaderboard(category.slug),
    ])
  );

  return Object.fromEntries(
    entries.map(([categorySlug, leaderboard]) => {
      const lookup = buildLeaderboardLookup(leaderboard);
      const tenthPlace = leaderboard[9] || null;

      if (tenthPlace) {
        lookup.set("__rank__10", tenthPlace);
      }

      return [categorySlug, lookup];
    })
  );
};

export const runRetentionEmailNudges = async ({
  dryRun = false,
  limit = null,
  now = new Date(),
  settingsOverride = null,
  ignoreAutomationState = false,
} = {}) => {
  await connectMongo();
  const adminOpsConfig = await getAdminOpsConfig();
  const settings = normalizeRetentionRuntimeSettings(
    settingsOverride || adminOpsConfig.retention
  );

  if (!settings.automationEnabled && !ignoreAutomationState) {
    return {
      dryRun,
      limit,
      automationEnabled: false,
      scannedUsers: 0,
      eligibleByType: {
        resume_interview: 0,
        resume_courtroom: 0,
        post_verdict_next_case: 0,
        cooldown_return: 0,
        new_unlock: 0,
        leaderboard_milestone: 0,
        new_content_relevant: 0,
        dormant_winback: 0,
      },
      sentCount: 0,
      skipped: {
        automation_disabled: 1,
      },
      candidates: [],
    };
  }

  const [users, leaderboardContext] = await Promise.all([
    User.find({
      email: { $exists: true, $ne: null },
    })
      .sort({ updatedAt: -1 })
      .limit(limit || 0)
      .lean(),
    buildLeaderboardContext(),
  ]);

  const summary = {
    dryRun,
    limit,
    automationEnabled: settings.automationEnabled,
    scannedUsers: users.length,
    eligibleByType: {
      resume_interview: 0,
      resume_courtroom: 0,
      post_verdict_next_case: 0,
      cooldown_return: 0,
      new_unlock: 0,
      leaderboard_milestone: 0,
      new_content_relevant: 0,
      dormant_winback: 0,
    },
    sentCount: 0,
    skipped: {
      global_cap: 0,
      no_eligible_nudge: 0,
      no_email: 0,
    },
    candidates: [],
  };

  for (const user of users) {
    if (!user.email) {
      summary.skipped.no_email += 1;
      continue;
    }

    const result = await evaluateUserNudge({
      user,
      leaderboardContext,
      now,
      settings,
    });

    if (!result.candidate) {
      summary.skipped[result.skipReason] =
        (summary.skipped[result.skipReason] || 0) + 1;
      continue;
    }

    summary.eligibleByType[result.candidate.type] += 1;

    const emailContent = createRetentionEmailContent({
      nudgeType: result.candidate.type,
      user,
      candidate: result.candidate,
      caseSession: result.candidate.caseSession,
      progression: result.progression,
      recommendedTemplate: result.recommendedTemplate,
    });

    const candidateSummary = {
      userId: String(user._id),
      email: user.email,
      nudgeType: result.candidate.type,
      caseSessionId: result.candidate.caseSessionId,
      reason: result.candidate.reason,
      subject: emailContent.subject,
    };

    summary.candidates.push(candidateSummary);

    if (dryRun) {
      continue;
    }

    await sendEmail({
      to: user.email,
      subject: emailContent.subject,
      text: emailContent.text,
      html: emailContent.html,
    });

    await recordSentNudge({
      user,
      candidate: result.candidate,
      emailContent,
      recommendedTemplate: result.recommendedTemplate,
    });

    summary.sentCount += 1;
  }

  console.info(
    JSON.stringify({
      event: "retention_email_nudges_run",
      ...summary,
    })
  );

  return summary;
};

export { parseNudgeRunOptions };
