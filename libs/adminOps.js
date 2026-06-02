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

export const DEFAULT_FREE_GAMEPLAY_CAMPAIGN = {
  enabled: false,
  startsAt: "",
  endsAt: "",
  announcementEnabled: false,
  announcementTitle: "Free solo cases are open",
  announcementBody:
    "Start any solo case and play through your first verdict while this campaign is live.",
  announcementCtaLabel: "Play Free Case",
  announcementCtaHref: "/dashboard",
};

const toPositiveInt = (value, fallback) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const normalizeDateString = (value = "") => {
  const raw = typeof value === "string" ? value.trim() : value ? String(value) : "";
  if (!raw) {
    return "";
  }

  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString();
};

const sanitizeRelativeHref = (value = "", fallback = "/dashboard") => {
  const raw = typeof value === "string" ? value.trim() : "";

  if (!raw) {
    return fallback;
  }

  if (raw.startsWith("/") || raw.startsWith("#")) {
    return raw;
  }

  try {
    const parsed = new URL(raw);
    return ["http:", "https:"].includes(parsed.protocol) ? raw : fallback;
  } catch (error) {
    return fallback;
  }
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

export const sanitizeFreeGameplayCampaign = (input = {}) => ({
  enabled:
    typeof input.enabled === "boolean"
      ? input.enabled
      : DEFAULT_FREE_GAMEPLAY_CAMPAIGN.enabled,
  startsAt: normalizeDateString(input.startsAt),
  endsAt: normalizeDateString(input.endsAt),
  announcementEnabled:
    typeof input.announcementEnabled === "boolean"
      ? input.announcementEnabled
      : DEFAULT_FREE_GAMEPLAY_CAMPAIGN.announcementEnabled,
  announcementTitle:
    typeof input.announcementTitle === "string"
      ? input.announcementTitle.trim().slice(0, 90)
      : DEFAULT_FREE_GAMEPLAY_CAMPAIGN.announcementTitle,
  announcementBody:
    typeof input.announcementBody === "string"
      ? input.announcementBody.trim().slice(0, 220)
      : DEFAULT_FREE_GAMEPLAY_CAMPAIGN.announcementBody,
  announcementCtaLabel:
    typeof input.announcementCtaLabel === "string" &&
    input.announcementCtaLabel.trim()
      ? input.announcementCtaLabel.trim().slice(0, 32)
      : DEFAULT_FREE_GAMEPLAY_CAMPAIGN.announcementCtaLabel,
  announcementCtaHref: sanitizeRelativeHref(
    input.announcementCtaHref,
    DEFAULT_FREE_GAMEPLAY_CAMPAIGN.announcementCtaHref
  ),
});

export const getFreeGameplayCampaignStatus = (
  campaign = {},
  nowInput = new Date()
) => {
  const normalized = sanitizeFreeGameplayCampaign(campaign);
  const now = nowInput instanceof Date ? nowInput : new Date(nowInput);
  const startsAt = normalized.startsAt ? new Date(normalized.startsAt) : null;
  const endsAt = normalized.endsAt ? new Date(normalized.endsAt) : null;
  const hasValidWindow =
    startsAt &&
    endsAt &&
    !Number.isNaN(startsAt.getTime()) &&
    !Number.isNaN(endsAt.getTime()) &&
    startsAt < endsAt;

  if (!normalized.enabled) {
    return { state: "inactive", active: false, campaign: normalized };
  }

  if (!hasValidWindow || Number.isNaN(now.getTime())) {
    return { state: "invalid", active: false, campaign: normalized };
  }

  if (now < startsAt) {
    return { state: "scheduled", active: false, campaign: normalized };
  }

  if (now > endsAt) {
    return { state: "expired", active: false, campaign: normalized };
  }

  return { state: "active", active: true, campaign: normalized };
};

export const getActiveFreeGameplayAnnouncement = (
  campaign = {},
  nowInput = new Date()
) => {
  const status = getFreeGameplayCampaignStatus(campaign, nowInput);
  const normalized = status.campaign;

  if (
    !status.active ||
    !normalized.announcementEnabled
  ) {
    return null;
  }

  return {
    title:
      normalized.announcementTitle ||
      DEFAULT_FREE_GAMEPLAY_CAMPAIGN.announcementTitle,
    body:
      normalized.announcementBody ||
      DEFAULT_FREE_GAMEPLAY_CAMPAIGN.announcementBody,
    ctaLabel: normalized.announcementCtaLabel,
    ctaHref: normalized.announcementCtaHref,
    endsAt: normalized.endsAt,
  };
};

export const normalizeAdminOpsConfig = (config = {}) => ({
  retention: sanitizeRetentionSettings(config.retention || {}),
  digest: sanitizeDigestSettings(config.digest || {}),
  freeGameplayCampaign: sanitizeFreeGameplayCampaign(
    config.freeGameplayCampaign || {}
  ),
});

export const getAdminOpsConfig = async () => {
  await connectMongo();

  const config = await AdminOpsConfig.findOne({ scope: "global" }).lean();
  return normalizeAdminOpsConfig(config || {});
};

export const upsertAdminOpsConfig = async ({
  retention,
  digest,
  freeGameplayCampaign,
} = {}) => {
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
    freeGameplayCampaign: freeGameplayCampaign
      ? sanitizeFreeGameplayCampaign({
          ...current.freeGameplayCampaign,
          ...freeGameplayCampaign,
        })
      : current.freeGameplayCampaign,
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
