const TOKEN_FIELDS = [
  "inputTokens",
  "outputTokens",
  "totalTokens",
  "cachedInputTokens",
  "reasoningTokens",
];

const emptyUsageTotals = () =>
  TOKEN_FIELDS.reduce((totals, field) => {
    totals[field] = 0;
    return totals;
  }, {});

const normalizeUsageNumber = (value) => Math.max(0, Number(value || 0));

export const normalizeUsageEntry = (payload = {}, phase = "intake") => ({
  label: String(payload.label || "").trim(),
  phase,
  model: String(payload.model || "").trim(),
  api: String(payload.api || "").trim(),
  attempt: Number(payload.attempt || 0),
  maxTokens: Number(payload.maxTokens || 0),
  finishReason: String(payload.finishReason || "").trim(),
  parsed: Boolean(payload.parsed),
  inputTokens: normalizeUsageNumber(payload.inputTokens),
  outputTokens: normalizeUsageNumber(payload.outputTokens),
  totalTokens: normalizeUsageNumber(payload.totalTokens),
  cachedInputTokens: normalizeUsageNumber(payload.cachedInputTokens),
  reasoningTokens: normalizeUsageNumber(payload.reasoningTokens),
  createdAt: payload.createdAt ? new Date(payload.createdAt) : new Date(),
});

export const createUsageCollector = (phase = "intake") => {
  const entries = [];

  return {
    record(payload = {}) {
      entries.push(normalizeUsageEntry(payload, phase));
    },
    entries,
  };
};

const normalizeBucket = (bucket = {}) => ({
  ...emptyUsageTotals(),
  ...TOKEN_FIELDS.reduce((totals, field) => {
    totals[field] = normalizeUsageNumber(bucket?.[field]);
    return totals;
  }, {}),
  entries: Array.isArray(bucket?.entries) ? [...bucket.entries] : [],
});

const addEntryToBucket = (bucket, entry) => {
  TOKEN_FIELDS.forEach((field) => {
    bucket[field] += normalizeUsageNumber(entry[field]);
  });
  bucket.entries.push(entry);
};

export const buildUsageTotals = (usage = {}) => ({
  intake: normalizeBucket(usage?.intake),
  courtroom: normalizeBucket(usage?.courtroom),
  total: normalizeBucket(usage?.total),
});

export const appendUsageEntriesToCaseSession = (caseSession, entries = []) => {
  const validEntries = (entries || []).filter(Boolean).map((entry) =>
    normalizeUsageEntry(entry, entry.phase || "intake")
  );

  if (!caseSession || !validEntries.length) {
    return;
  }

  const usage = buildUsageTotals(caseSession.usage || {});

  validEntries.forEach((entry) => {
    const phase = entry.phase === "courtroom" ? "courtroom" : "intake";
    addEntryToBucket(usage[phase], entry);
    addEntryToBucket(usage.total, entry);
  });

  caseSession.usage = usage;
  caseSession.markModified?.("usage");
};
