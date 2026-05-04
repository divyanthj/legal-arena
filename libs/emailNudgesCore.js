export const NUDGE_TYPES = {
  RESUME_INTERVIEW: "resume_interview",
  RESUME_COURTROOM: "resume_courtroom",
  POST_VERDICT_NEXT_CASE: "post_verdict_next_case",
  COOLDOWN_RETURN: "cooldown_return",
  NEW_UNLOCK: "new_unlock",
  LEADERBOARD_MILESTONE: "leaderboard_milestone",
  NEW_CONTENT_RELEVANT: "new_content_relevant",
  DORMANT_WINBACK: "dormant_winback",
};

export const NUDGE_PRIORITY = [
  NUDGE_TYPES.NEW_UNLOCK,
  NUDGE_TYPES.POST_VERDICT_NEXT_CASE,
  NUDGE_TYPES.RESUME_COURTROOM,
  NUDGE_TYPES.RESUME_INTERVIEW,
  NUDGE_TYPES.COOLDOWN_RETURN,
  NUDGE_TYPES.LEADERBOARD_MILESTONE,
  NUDGE_TYPES.NEW_CONTENT_RELEVANT,
  NUDGE_TYPES.DORMANT_WINBACK,
];

const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;
const toMillis = (value) => new Date(value).getTime();

export const DEFAULT_RETENTION_RUNTIME_SETTINGS = {
  automationEnabled: true,
  perUserCooldownHours: 24,
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

export const normalizeRetentionRuntimeSettings = (settings = {}) => ({
  ...DEFAULT_RETENTION_RUNTIME_SETTINGS,
  ...settings,
  nudgeTypes: {
    ...DEFAULT_RETENTION_RUNTIME_SETTINGS.nudgeTypes,
    ...(settings.nudgeTypes || {}),
  },
  thresholds: {
    ...DEFAULT_RETENTION_RUNTIME_SETTINGS.thresholds,
    ...(settings.thresholds || {}),
  },
});

export const makeNudgeDedupeKey = ({ nudgeType, caseSessionId = null }) =>
  `${nudgeType}:${caseSessionId || "user"}`;

export const normalizeBoolean = (value, fallback = false) => {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();

    if (["1", "true", "yes", "y", "on"].includes(normalized)) {
      return true;
    }
    if (["0", "false", "no", "n", "off"].includes(normalized)) {
      return false;
    }
  }

  return fallback;
};

export const normalizeInteger = (value, fallback = null) => {
  if (value === undefined || value === null || value === "") {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);

  if (Number.isNaN(parsed) || parsed <= 0) {
    return fallback;
  }

  return parsed;
};

export const parseNudgeRunOptions = ({ query = {}, body = {} } = {}) => ({
  dryRun: normalizeBoolean(body.dryRun ?? query.dryRun, false),
  limit: normalizeInteger(body.limit ?? query.limit, null),
});

export const hasValidNudgeSecret = ({
  headers = {},
  secret = "",
  query = {},
  body = {},
} = {}) => {
  if (!secret) {
    return false;
  }

  const authorization =
    headers.authorization || headers.Authorization || "";
  const bearerToken = authorization.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length).trim()
    : "";
  const headerToken =
    headers["x-email-nudge-secret"] || headers["X-Email-Nudge-Secret"] || "";
  const queryToken = query.secret || "";
  const bodyToken = body.secret || "";

  return [bearerToken, headerToken, queryToken, bodyToken].includes(secret);
};

export const hasRecentRetentionEmail = ({ logs = [], now = new Date() } = {}) =>
  logs.some((log) => toMillis(log.sentAt) >= now.getTime() - DAY_MS);

export const hasSentNudge = ({
  logs = [],
  nudgeType,
  caseSessionId = null,
  dedupeKey = null,
} = {}) => {
  const resolvedDedupeKey =
    dedupeKey || makeNudgeDedupeKey({ nudgeType, caseSessionId });

  return logs.some(
    (log) =>
      log.dedupeKey === resolvedDedupeKey ||
      (log.nudgeType === nudgeType &&
        String(log.caseSessionId || "") === String(caseSessionId || ""))
  );
};

const sortByUpdatedAtDesc = (caseSessions = []) =>
  caseSessions
    .slice()
    .sort((left, right) => toMillis(right.updatedAt) - toMillis(left.updatedAt));

const findLatestCase = (caseSessions = [], predicate = () => true) =>
  sortByUpdatedAtDesc(caseSessions).find(predicate) || null;

export const buildCandidate = ({
  type,
  reason,
  caseSession = null,
  caseSessionId = null,
  dedupeKey = null,
  meta = {},
}) => ({
  type,
  caseSessionId:
    caseSessionId ||
    (caseSession ? String(caseSession.id || caseSession._id) : null),
  dedupeKey:
    dedupeKey ||
    makeNudgeDedupeKey({
      nudgeType: type,
      caseSessionId:
        caseSessionId ||
        (caseSession ? String(caseSession.id || caseSession._id) : null),
    }),
  caseSession,
  reason,
  meta,
});

const pickLifecycleCandidate = ({ lifecycleCandidates = [], logs = [] } = {}) => {
  for (const type of NUDGE_PRIORITY) {
    const candidate = lifecycleCandidates.find((item) => item.type === type);

    if (!candidate) {
      continue;
    }

    if (
      hasSentNudge({
        logs,
        nudgeType: candidate.type,
        caseSessionId: candidate.caseSessionId,
        dedupeKey: candidate.dedupeKey,
      })
    ) {
      continue;
    }

    return candidate;
  }

  return null;
};

export const determineRetentionNudge = ({
  caseSessions = [],
  logs = [],
  lifecycleCandidates = [],
  now = new Date(),
  settings = {},
} = {}) => {
  const runtimeSettings = normalizeRetentionRuntimeSettings(settings);
  const cooldownWindowMs =
    Math.max(1, Number(runtimeSettings.perUserCooldownHours) || 24) * HOUR_MS;

  if (
    logs.some((log) => toMillis(log.sentAt) >= now.getTime() - cooldownWindowMs)
  ) {
    return {
      candidate: null,
      skipReason: "global_cap",
    };
  }

  const {
    postVerdictDelayHours,
    postVerdictWindowDays,
    cooldownReturnHours,
    resumeCourtroomIdleHours,
    resumeCourtroomWindowHours,
    resumeInterviewIdleHours,
    resumeInterviewWindowHours,
  } = runtimeSettings.thresholds;

  const latestCase = findLatestCase(caseSessions);
  const latestNonExitedCase = findLatestCase(
    caseSessions,
    (caseSession) => caseSession.status !== "exited"
  );

  if (
    runtimeSettings.nudgeTypes[NUDGE_TYPES.POST_VERDICT_NEXT_CASE] &&
    latestCase &&
    latestCase.status === "verdict" &&
    toMillis(latestCase.updatedAt) <=
      now.getTime() - postVerdictDelayHours * HOUR_MS &&
    toMillis(latestCase.updatedAt) >=
      now.getTime() - postVerdictWindowDays * DAY_MS &&
    !caseSessions.some(
      (caseSession) =>
        ["interview", "courtroom"].includes(caseSession.status) &&
        toMillis(caseSession.updatedAt) > toMillis(latestCase.updatedAt)
    )
  ) {
    if (
      !hasSentNudge({
        logs,
        nudgeType: NUDGE_TYPES.POST_VERDICT_NEXT_CASE,
        caseSessionId: latestCase.id || latestCase._id,
      })
    ) {
      return {
        candidate: buildCandidate({
          type: NUDGE_TYPES.POST_VERDICT_NEXT_CASE,
          caseSession: latestCase,
          reason: "completed case without a newer active matter",
        }),
        skipReason: null,
      };
    }
  }

  const eligibleExitedCase = sortByUpdatedAtDesc(caseSessions).find(
    (caseSession) =>
      caseSession.status === "exited" &&
      caseSession.exitedAt &&
      toMillis(caseSession.exitedAt) <=
        now.getTime() - cooldownReturnHours * HOUR_MS &&
      !caseSessions.some(
        (otherCase) =>
          String(otherCase.caseTemplateId) === String(caseSession.caseTemplateId) &&
          toMillis(otherCase.updatedAt) > toMillis(caseSession.updatedAt)
      )
  );

  if (runtimeSettings.nudgeTypes[NUDGE_TYPES.COOLDOWN_RETURN] && eligibleExitedCase) {
    if (
      !hasSentNudge({
        logs,
        nudgeType: NUDGE_TYPES.COOLDOWN_RETURN,
        caseSessionId: eligibleExitedCase.id || eligibleExitedCase._id,
      })
    ) {
      return {
        candidate: buildCandidate({
          type: NUDGE_TYPES.COOLDOWN_RETURN,
          caseSession: eligibleExitedCase,
          reason: "exited case cooldown finished",
        }),
        skipReason: null,
      };
    }
  }

  if (
    runtimeSettings.nudgeTypes[NUDGE_TYPES.RESUME_COURTROOM] &&
    latestCase &&
    latestCase.status === "courtroom" &&
    toMillis(latestCase.updatedAt) <=
      now.getTime() - resumeCourtroomIdleHours * HOUR_MS &&
    toMillis(latestCase.updatedAt) >=
      now.getTime() - resumeCourtroomWindowHours * HOUR_MS
  ) {
    if (
      !hasSentNudge({
        logs,
        nudgeType: NUDGE_TYPES.RESUME_COURTROOM,
        caseSessionId: latestCase.id || latestCase._id,
      })
    ) {
      return {
        candidate: buildCandidate({
          type: NUDGE_TYPES.RESUME_COURTROOM,
          caseSession: latestCase,
          reason: "courtroom matter has gone idle",
        }),
        skipReason: null,
      };
    }
  }

  if (
    runtimeSettings.nudgeTypes[NUDGE_TYPES.RESUME_INTERVIEW] &&
    latestNonExitedCase &&
    latestNonExitedCase.status === "interview" &&
    toMillis(latestNonExitedCase.updatedAt) <=
      now.getTime() - resumeInterviewIdleHours * HOUR_MS &&
    toMillis(latestNonExitedCase.createdAt) >=
      now.getTime() - resumeInterviewWindowHours * HOUR_MS
  ) {
    if (
      !hasSentNudge({
        logs,
        nudgeType: NUDGE_TYPES.RESUME_INTERVIEW,
        caseSessionId: latestNonExitedCase.id || latestNonExitedCase._id,
      })
    ) {
      return {
        candidate: buildCandidate({
          type: NUDGE_TYPES.RESUME_INTERVIEW,
          caseSession: latestNonExitedCase,
          reason: "intake has gone idle",
        }),
        skipReason: null,
      };
    }
  }

  const lifecycleCandidate = pickLifecycleCandidate({ lifecycleCandidates, logs });

  if (lifecycleCandidate) {
    return {
      candidate: lifecycleCandidate,
      skipReason: null,
    };
  }

  return {
    candidate: null,
    skipReason: "no_eligible_nudge",
  };
};

export const selectRecommendedTemplate = ({
  templates = [],
  preferredCategory = "",
} = {}) => {
  const unlockedTemplates = templates.filter((template) => template.unlocked);

  if (!unlockedTemplates.length) {
    return null;
  }

  const sortTemplates = (items) =>
    items
      .slice()
      .sort((left, right) => {
        if ((right.complexity || 0) !== (left.complexity || 0)) {
          return (right.complexity || 0) - (left.complexity || 0);
        }

        return String(left.title || "").localeCompare(String(right.title || ""));
      });

  const sameCategory = sortTemplates(
    unlockedTemplates.filter(
      (template) => template.primaryCategory === preferredCategory
    )
  );

  return sameCategory[0] || sortTemplates(unlockedTemplates)[0] || null;
};

export const getCategoryUnlockLevel = ({
  progression,
  categorySlug,
} = {}) => {
  const category = (progression?.categoryStats || []).find(
    (item) => item.categorySlug === categorySlug
  );

  return category?.unlockedComplexity || 1;
};
