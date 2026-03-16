import "server-only";

import connectMongo from "@/libs/mongoose";
import config from "@/config";
import { emailTemplate } from "@/libs/emailTemplate";
import { sendEmail } from "@/libs/resend";
import {
  determineRetentionNudge,
  getCategoryUnlockLevel,
  makeNudgeDedupeKey,
  parseNudgeRunOptions,
  selectRecommendedTemplate,
} from "@/libs/emailNudgesCore";
import { listScenarioOptions } from "@/libs/game/store";
import { normalizeProgression } from "@/libs/game/progression";
import CaseSession from "@/models/CaseSession";
import EmailNudgeLog from "@/models/EmailNudgeLog";
import User from "@/models/User";

const buildAppUrl = (path = "/") =>
  `https://${config.domainName}${path.startsWith("/") ? path : `/${path}`}`;

const joinLines = (lines = []) => lines.filter(Boolean).join("\n");

const getUserDisplayName = (user) =>
  user?.name || user?.email?.split("@")[0] || "Counsel";

const getTemplateIdentity = (value) =>
  String(value?._id || value?.id || value || "");

const createRetentionEmailContent = ({
  nudgeType,
  user,
  caseSession,
  progression,
  recommendedTemplate = null,
}) => {
  const name = getUserDisplayName(user);
  const caseUrl = buildAppUrl(`/dashboard/cases/${caseSession.id || caseSession._id}`);
  const dashboardUrl = buildAppUrl("/dashboard");
  const categoryUnlockLevel = getCategoryUnlockLevel({
    progression,
    categorySlug: caseSession.primaryCategory,
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

const evaluateUserNudge = async ({ user, now = new Date() }) => {
  const [caseSessions, logs] = await Promise.all([
    CaseSession.find({ userId: user._id }).sort({ updatedAt: -1 }).lean(),
    EmailNudgeLog.find({ userId: user._id }).sort({ sentAt: -1 }).lean(),
  ]);

  const { candidate, skipReason } = determineRetentionNudge({
    caseSessions,
    logs,
    now,
  });

  if (!candidate) {
    return { candidate: null, skipReason };
  }

  const progression = normalizeProgression(user.progression);
  let recommendedTemplate = null;

  if (candidate.type === "post_verdict_next_case") {
    const templates = await listScenarioOptions(user._id);
    recommendedTemplate = selectRecommendedTemplate({
      templates,
      preferredCategory: candidate.caseSession.primaryCategory,
    });
  }

  return {
    candidate,
    skipReason: null,
    progression,
    recommendedTemplate,
    caseSessions,
    logs,
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
    },
  });

export const runRetentionEmailNudges = async ({
  dryRun = false,
  limit = null,
  now = new Date(),
} = {}) => {
  await connectMongo();

  const users = await User.find({
    email: { $exists: true, $ne: null },
  })
    .sort({ updatedAt: -1 })
    .limit(limit || 0)
    .lean();

  const summary = {
    dryRun,
    limit,
    scannedUsers: users.length,
    eligibleByType: {
      resume_interview: 0,
      resume_courtroom: 0,
      post_verdict_next_case: 0,
      cooldown_return: 0,
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

    const result = await evaluateUserNudge({ user, now });

    if (!result.candidate) {
      summary.skipped[result.skipReason] =
        (summary.skipped[result.skipReason] || 0) + 1;
      continue;
    }

    summary.eligibleByType[result.candidate.type] += 1;

    const emailContent = createRetentionEmailContent({
      nudgeType: result.candidate.type,
      user,
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
