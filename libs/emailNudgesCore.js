export const NUDGE_TYPES = {
  RESUME_INTERVIEW: "resume_interview",
  RESUME_COURTROOM: "resume_courtroom",
  POST_VERDICT_NEXT_CASE: "post_verdict_next_case",
  COOLDOWN_RETURN: "cooldown_return",
};

export const NUDGE_PRIORITY = [
  NUDGE_TYPES.POST_VERDICT_NEXT_CASE,
  NUDGE_TYPES.COOLDOWN_RETURN,
  NUDGE_TYPES.RESUME_COURTROOM,
  NUDGE_TYPES.RESUME_INTERVIEW,
];

const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;
const toMillis = (value) => new Date(value).getTime();

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
} = {}) => {
  const dedupeKey = makeNudgeDedupeKey({ nudgeType, caseSessionId });

  return logs.some(
    (log) =>
      log.dedupeKey === dedupeKey ||
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

const buildCandidate = (type, caseSession, reason) => ({
  type,
  caseSessionId: String(caseSession.id || caseSession._id),
  dedupeKey: makeNudgeDedupeKey({
    nudgeType: type,
    caseSessionId: String(caseSession.id || caseSession._id),
  }),
  caseSession,
  reason,
});

export const determineRetentionNudge = ({
  caseSessions = [],
  logs = [],
  now = new Date(),
} = {}) => {
  if (hasRecentRetentionEmail({ logs, now })) {
    return {
      candidate: null,
      skipReason: "global_cap",
    };
  }

  const latestCase = findLatestCase(caseSessions);
  const latestNonExitedCase = findLatestCase(
    caseSessions,
    (caseSession) => caseSession.status !== "exited"
  );

  if (
    latestCase &&
    latestCase.status === "verdict" &&
    toMillis(latestCase.updatedAt) <= now.getTime() - 18 * HOUR_MS &&
    toMillis(latestCase.updatedAt) >= now.getTime() - 7 * DAY_MS &&
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
        candidate: buildCandidate(
          NUDGE_TYPES.POST_VERDICT_NEXT_CASE,
          latestCase,
          "completed case without a newer active matter"
        ),
        skipReason: null,
      };
    }
  }

  const eligibleExitedCase = sortByUpdatedAtDesc(caseSessions).find(
    (caseSession) =>
      caseSession.status === "exited" &&
      caseSession.exitedAt &&
      toMillis(caseSession.exitedAt) <= now.getTime() - DAY_MS &&
      !caseSessions.some(
        (otherCase) =>
          String(otherCase.caseTemplateId) === String(caseSession.caseTemplateId) &&
          toMillis(otherCase.updatedAt) > toMillis(caseSession.updatedAt)
      )
  );

  if (eligibleExitedCase) {
    if (
      !hasSentNudge({
        logs,
        nudgeType: NUDGE_TYPES.COOLDOWN_RETURN,
        caseSessionId: eligibleExitedCase.id || eligibleExitedCase._id,
      })
    ) {
      return {
        candidate: buildCandidate(
          NUDGE_TYPES.COOLDOWN_RETURN,
          eligibleExitedCase,
          "exited case cooldown finished"
        ),
        skipReason: null,
      };
    }
  }

  if (
    latestCase &&
    latestCase.status === "courtroom" &&
    toMillis(latestCase.updatedAt) <= now.getTime() - 3 * HOUR_MS &&
    toMillis(latestCase.updatedAt) >= now.getTime() - 72 * HOUR_MS
  ) {
    if (
      !hasSentNudge({
        logs,
        nudgeType: NUDGE_TYPES.RESUME_COURTROOM,
        caseSessionId: latestCase.id || latestCase._id,
      })
    ) {
      return {
        candidate: buildCandidate(
          NUDGE_TYPES.RESUME_COURTROOM,
          latestCase,
          "courtroom matter has gone idle"
        ),
        skipReason: null,
      };
    }
  }

  if (
    latestNonExitedCase &&
    latestNonExitedCase.status === "interview" &&
    toMillis(latestNonExitedCase.updatedAt) <= now.getTime() - 6 * HOUR_MS &&
    toMillis(latestNonExitedCase.createdAt) >= now.getTime() - 72 * HOUR_MS
  ) {
    if (
      !hasSentNudge({
        logs,
        nudgeType: NUDGE_TYPES.RESUME_INTERVIEW,
        caseSessionId: latestNonExitedCase.id || latestNonExitedCase._id,
      })
    ) {
      return {
        candidate: buildCandidate(
          NUDGE_TYPES.RESUME_INTERVIEW,
          latestNonExitedCase,
          "intake has gone idle"
        ),
        skipReason: null,
      };
    }
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
