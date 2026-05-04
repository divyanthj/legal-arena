import "server-only";

import connectMongo from "@/libs/mongoose";
import AdminOpsConfig from "@/models/AdminOpsConfig";

export const DEFAULT_RETENTION_SETTINGS = {
  automationEnabled: true,
  perUserCooldownHours: 24,
  runDefaults: {
    dryRun: true,
    limit: 50,
  },
  nudgeTypes: {
    resume_interview: true,
    resume_courtroom: true,
    post_verdict_next_case: true,
    cooldown_return: true,
    new_unlock: true,
    leaderboard_milestone: true,
    new_content_relevant: true,
    dormant_winback: true,
  },
  thresholds: {
    resumeInterviewIdleHours: 6,
    resumeInterviewWindowHours: 72,
    resumeCourtroomIdleHours: 3,
    resumeCourtroomWindowHours: 72,
    postVerdictDelayHours: 18,
    postVerdictWindowDays: 7,
    cooldownReturnHours: 24,
    dormantWinbackDays: 14,
    newContentWindowDays: 7,
  },
};

export const DEFAULT_DIGEST_SETTINGS = {
  enabled: true,
  defaultAudience: "all_users",
  subjectPrefix: "",
  footerNote: "",
  defaultSubject: "",
  defaultContent: "",
};

const toPositiveInt = (value, fallback) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const sanitizeRetentionSettings = (input = {}) => ({
  automationEnabled:
    typeof input.automationEnabled === "boolean"
      ? input.automationEnabled
      : DEFAULT_RETENTION_SETTINGS.automationEnabled,
  perUserCooldownHours: toPositiveInt(
    input.perUserCooldownHours,
    DEFAULT_RETENTION_SETTINGS.perUserCooldownHours
  ),
  runDefaults: {
    dryRun:
      typeof input.runDefaults?.dryRun === "boolean"
        ? input.runDefaults.dryRun
        : DEFAULT_RETENTION_SETTINGS.runDefaults.dryRun,
    limit: toPositiveInt(
      input.runDefaults?.limit,
      DEFAULT_RETENTION_SETTINGS.runDefaults.limit
    ),
  },
  nudgeTypes: Object.fromEntries(
    Object.keys(DEFAULT_RETENTION_SETTINGS.nudgeTypes).map((key) => [
      key,
      typeof input.nudgeTypes?.[key] === "boolean"
        ? input.nudgeTypes[key]
        : DEFAULT_RETENTION_SETTINGS.nudgeTypes[key],
    ])
  ),
  thresholds: {
    resumeInterviewIdleHours: toPositiveInt(
      input.thresholds?.resumeInterviewIdleHours,
      DEFAULT_RETENTION_SETTINGS.thresholds.resumeInterviewIdleHours
    ),
    resumeInterviewWindowHours: toPositiveInt(
      input.thresholds?.resumeInterviewWindowHours,
      DEFAULT_RETENTION_SETTINGS.thresholds.resumeInterviewWindowHours
    ),
    resumeCourtroomIdleHours: toPositiveInt(
      input.thresholds?.resumeCourtroomIdleHours,
      DEFAULT_RETENTION_SETTINGS.thresholds.resumeCourtroomIdleHours
    ),
    resumeCourtroomWindowHours: toPositiveInt(
      input.thresholds?.resumeCourtroomWindowHours,
      DEFAULT_RETENTION_SETTINGS.thresholds.resumeCourtroomWindowHours
    ),
    postVerdictDelayHours: toPositiveInt(
      input.thresholds?.postVerdictDelayHours,
      DEFAULT_RETENTION_SETTINGS.thresholds.postVerdictDelayHours
    ),
    postVerdictWindowDays: toPositiveInt(
      input.thresholds?.postVerdictWindowDays,
      DEFAULT_RETENTION_SETTINGS.thresholds.postVerdictWindowDays
    ),
    cooldownReturnHours: toPositiveInt(
      input.thresholds?.cooldownReturnHours,
      DEFAULT_RETENTION_SETTINGS.thresholds.cooldownReturnHours
    ),
    dormantWinbackDays: toPositiveInt(
      input.thresholds?.dormantWinbackDays,
      DEFAULT_RETENTION_SETTINGS.thresholds.dormantWinbackDays
    ),
    newContentWindowDays: toPositiveInt(
      input.thresholds?.newContentWindowDays,
      DEFAULT_RETENTION_SETTINGS.thresholds.newContentWindowDays
    ),
  },
});

const sanitizeDigestSettings = (input = {}) => ({
  enabled:
    typeof input.enabled === "boolean"
      ? input.enabled
      : DEFAULT_DIGEST_SETTINGS.enabled,
  defaultAudience:
    typeof input.defaultAudience === "string" && input.defaultAudience.trim()
      ? input.defaultAudience.trim()
      : DEFAULT_DIGEST_SETTINGS.defaultAudience,
  subjectPrefix:
    typeof input.subjectPrefix === "string" ? input.subjectPrefix.trim() : "",
  footerNote: typeof input.footerNote === "string" ? input.footerNote.trim() : "",
  defaultSubject:
    typeof input.defaultSubject === "string" ? input.defaultSubject.trim() : "",
  defaultContent:
    typeof input.defaultContent === "string" ? input.defaultContent.trim() : "",
});

export const normalizeAdminOpsConfig = (config = {}) => ({
  retention: sanitizeRetentionSettings(config.retention || {}),
  digest: sanitizeDigestSettings(config.digest || {}),
});

export const getAdminOpsConfig = async () => {
  await connectMongo();

  const config = await AdminOpsConfig.findOne({ scope: "global" }).lean();
  return normalizeAdminOpsConfig(config || {});
};

export const upsertAdminOpsConfig = async ({ retention, digest } = {}) => {
  await connectMongo();

  const current = await getAdminOpsConfig();
  const nextConfig = {
    retention: retention
      ? sanitizeRetentionSettings({
          ...current.retention,
          ...retention,
          nudgeTypes: {
            ...current.retention.nudgeTypes,
            ...(retention.nudgeTypes || {}),
          },
          thresholds: {
            ...current.retention.thresholds,
            ...(retention.thresholds || {}),
          },
          runDefaults: {
            ...current.retention.runDefaults,
            ...(retention.runDefaults || {}),
          },
        })
      : current.retention,
    digest: digest
      ? sanitizeDigestSettings({
          ...current.digest,
          ...digest,
        })
      : current.digest,
  };

  await AdminOpsConfig.findOneAndUpdate(
    { scope: "global" },
    {
      $set: {
        scope: "global",
        ...nextConfig,
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  return nextConfig;
};
