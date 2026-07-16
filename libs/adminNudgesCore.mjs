export const ADMIN_NUDGE_TYPE = "manual_admin";

export const ADMIN_NUDGE_CONCEPTS = [
  "resume_intake",
  "resume_courtroom",
  "continue_settlement",
  "next_case",
  "new_unlock",
  "leaderboard_progress",
  "pvp_challenge",
  "award_progress",
  "return_to_arena",
  "complete_onboarding",
];

export const SUBJECT_MAX_LENGTH = 160;
export const MESSAGE_MAX_LENGTH = 3000;
export const RATIONALE_MAX_LENGTH = 500;
export const RECENT_NUDGE_WINDOW_MS = 24 * 60 * 60 * 1000;
export const DUPLICATE_CONCEPT_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;

const cleanText = (value = "", maxLength = 500) =>
  String(value || "")
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .trim()
    .slice(0, maxLength)
    .trim();

const stripTemplateFraming = (value = "") => {
  let text = cleanText(value, MESSAGE_MAX_LENGTH + 200);
  text = text.replace(/^(?:hi|hello|hey|dear)\b[^\n,]*(?:,|\n)\s*/i, "");
  text = text.replace(
    /\s*(?:regards|best(?: regards)?|sincerely|thanks|thank you),?\s*(?:\n[^\n]+)?\s*$/i,
    ""
  );
  return cleanText(text, MESSAGE_MAX_LENGTH);
};

export const hasTemplateFraming = (value = "") => {
  const text = String(value || "").trim();
  return (
    /^(?:hi|hello|hey|dear)\b[^\n,]*(?:,|\n)/i.test(text) ||
    /(?:^|\n)\s*(?:regards|best(?: regards)?|sincerely|thanks|thank you),?\s*(?:\n[^\n]+)?\s*$/i.test(text)
  );
};

export const normalizeNudgeSuggestions = (value, { ctaByConcept = {} } = {}) => {
  const rawSuggestions = Array.isArray(value)
    ? value
    : Array.isArray(value?.suggestions)
      ? value.suggestions
      : [];
  const seenConcepts = new Set();
  const normalized = [];

  for (const item of rawSuggestions) {
    const conceptKey = cleanText(item?.conceptKey, 80).toLowerCase();
    const cta = ctaByConcept[conceptKey];
    if (
      !ADMIN_NUDGE_CONCEPTS.includes(conceptKey) ||
      !cta ||
      seenConcepts.has(conceptKey)
    ) {
      continue;
    }

    const title = cleanText(item?.title, 100);
    const rationale = cleanText(item?.rationale, RATIONALE_MAX_LENGTH);
    const subject = cleanText(item?.subject, SUBJECT_MAX_LENGTH);
    const message = stripTemplateFraming(item?.message);
    if (!title || !rationale || !subject || !message) continue;

    seenConcepts.add(conceptKey);
    normalized.push({
      id: `${conceptKey}-${normalized.length + 1}`,
      conceptKey,
      title,
      rationale,
      subject,
      message,
      ctaLabel: cta.label,
      ctaPath: cta.path,
    });
    if (normalized.length === 6) break;
  }

  return normalized;
};

const toMillis = (value) => {
  const millis = new Date(value || 0).getTime();
  return Number.isFinite(millis) ? millis : 0;
};

export const getNudgeWarnings = ({ logs = [], conceptKey = "", now = new Date() } = {}) => {
  const nowMs = now.getTime();
  const recent = logs.find(
    (log) => toMillis(log.sentAt) >= nowMs - RECENT_NUDGE_WINDOW_MS
  );
  const duplicate = conceptKey
    ? logs.find(
        (log) =>
          String(log?.meta?.conceptKey || "") === conceptKey &&
          toMillis(log.sentAt) >= nowMs - DUPLICATE_CONCEPT_WINDOW_MS
      )
    : null;
  const warnings = [];

  if (recent) {
    warnings.push({
      code: "recent_nudge",
      message: "This lawyer received a nudge within the last 24 hours.",
      sentAt: recent.sentAt,
    });
  }
  if (duplicate) {
    warnings.push({
      code: "duplicate_concept",
      message: "This nudge concept was sent to this lawyer within the last 30 days.",
      sentAt: duplicate.sentAt,
    });
  }

  return warnings;
};

export const validateManualNudgeDraft = ({ conceptKey, subject, message } = {}) => {
  const normalizedConcept = cleanText(conceptKey, 80).toLowerCase();
  const normalizedSubject = cleanText(subject, SUBJECT_MAX_LENGTH + 1);
  const normalizedMessage = cleanText(message, MESSAGE_MAX_LENGTH + 1);

  if (!ADMIN_NUDGE_CONCEPTS.includes(normalizedConcept)) {
    throw new Error("Choose a valid nudge option.");
  }
  if (!normalizedSubject || normalizedSubject.length > SUBJECT_MAX_LENGTH) {
    throw new Error(`Subject is required and must be ${SUBJECT_MAX_LENGTH} characters or fewer.`);
  }
  if (!normalizedMessage || normalizedMessage.length > MESSAGE_MAX_LENGTH) {
    throw new Error(`Message is required and must be ${MESSAGE_MAX_LENGTH} characters or fewer.`);
  }
  if (hasTemplateFraming(normalizedMessage)) {
    throw new Error("Remove the greeting or sign-off; the email template adds them automatically.");
  }

  return {
    conceptKey: normalizedConcept,
    subject: normalizedSubject,
    message: normalizedMessage,
  };
};
