export const CURRENT_EVENT_DISCLAIMER =
  "Inspired by recent reporting. Every party name and identifying case detail was fictionalized; this simulation does not determine or imply the truth of allegations involving real people.";

export const cleanCurrentEventText = (value = "", limit = 2000) =>
  String(value || "").replace(/\s+/g, " ").trim().slice(0, limit);

const normalizeForComparison = (value = "") =>
  cleanCurrentEventText(value, 10000)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const normalizeSource = (source = {}) => {
  const url = cleanCurrentEventText(source?.url || source?.uri, 2000);
  if (!/^https?:\/\//i.test(url)) return null;
  let publisher = cleanCurrentEventText(
    source?.publisher || source?.publication,
    160
  );
  if (!publisher) {
    try {
      publisher = new URL(url).hostname.replace(/^www\./, "");
    } catch {
      publisher = "";
    }
  }
  return {
    title: cleanCurrentEventText(source?.title, 300),
    publisher,
    url,
    publishedAt: cleanCurrentEventText(
      source?.publishedAt || source?.published_at || source?.date,
      80
    ),
  };
};

export const normalizeCurrentEventSources = (...sourceLists) => {
  const byUrl = new Map();
  sourceLists
    .flat()
    .map(normalizeSource)
    .filter(Boolean)
    .forEach((source) => {
      const existing = byUrl.get(source.url) || {};
      byUrl.set(source.url, {
        ...source,
        title: source.title || existing.title || "",
        publisher: source.publisher || existing.publisher || "",
        publishedAt: source.publishedAt || existing.publishedAt || "",
      });
    });
  return [...byUrl.values()].slice(0, 8);
};

const clampHotButtonSignal = (value) =>
  Math.max(1, Math.min(5, Math.round(Number(value) || 1)));

const getHotButtonRecencyScore = (eventDate, now) => {
  const timestamp = Date.parse(eventDate);
  const currentTimestamp =
    now instanceof Date ? now.getTime() : Date.parse(now || "");
  if (!Number.isFinite(timestamp) || !Number.isFinite(currentTimestamp)) return 0;
  const ageDays = Math.max(
    0,
    Math.floor((currentTimestamp - timestamp) / (24 * 60 * 60 * 1000))
  );
  if (ageDays <= 2) return 12;
  if (ageDays <= 4) return 9;
  if (ageDays <= 7) return 6;
  if (ageDays <= 14) return 3;
  return 0;
};

export const rankCurrentEventCandidates = (
  candidates = [],
  { now = new Date() } = {}
) =>
  (Array.isArray(candidates) ? candidates : [])
    .map((candidate, index) => {
      const sources = normalizeCurrentEventSources(candidate?.sources);
      const geographicReach = ["national", "regional", "local"].includes(
        cleanCurrentEventText(candidate?.geographicReach, 20).toLowerCase()
      )
        ? cleanCurrentEventText(candidate.geographicReach, 20).toLowerCase()
        : "local";
      const publicAttention = clampHotButtonSignal(candidate?.publicAttention);
      const recentMomentum = clampHotButtonSignal(candidate?.recentMomentum);
      const legalSignificance = clampHotButtonSignal(candidate?.legalSignificance);
      const publicControversy = clampHotButtonSignal(candidate?.publicControversy);
      const reachScore =
        geographicReach === "national" ? 10 : geographicReach === "regional" ? 5 : 0;
      const corroborationScore = Math.min(5, sources.length) * 2;
      const score =
        publicAttention * 5 +
        recentMomentum * 5 +
        legalSignificance * 3 +
        publicControversy * 2 +
        reachScore +
        (candidate?.ongoing ? 8 : 0) +
        getHotButtonRecencyScore(candidate?.eventDate, now) +
        corroborationScore -
        (candidate?.routineRegulatoryAction ? 12 : 0);

      return {
        key: cleanCurrentEventText(candidate?.key, 120) || `candidate-${index + 1}`,
        headline: cleanCurrentEventText(candidate?.headline, 300),
        summary: cleanCurrentEventText(candidate?.summary, 1000),
        eventDate: cleanCurrentEventText(candidate?.eventDate, 80),
        ongoing: Boolean(candidate?.ongoing),
        geographicReach,
        publicAttention,
        recentMomentum,
        legalSignificance,
        publicControversy,
        routineRegulatoryAction: Boolean(candidate?.routineRegulatoryAction),
        sources,
        score,
      };
    })
    .filter(
      (candidate) =>
        candidate.headline.length >= 8 &&
        candidate.summary.length >= 40 &&
        candidate.sources.length >= 2
    )
    .sort((left, right) => right.score - left.score);

export const collectCurrentEventProtectedTerms = (brief = {}) =>
  [...(brief.namedEntities || []), ...(brief.identifyingDetails || [])]
    .map((item) => cleanCurrentEventText(item, 300))
    .filter((item) => {
      const normalized = normalizeForComparison(item);
      const countryName = normalizeForComparison(brief.country?.name);
      const countryCode = normalizeForComparison(brief.country?.code);
      return (
        normalized.length >= 3 &&
        normalized !== countryName &&
        normalized !== countryCode &&
        !/^\d{1,2}$/.test(normalized)
      );
    });

export const hasPlayableCurrentEventCaseShape = (generatedCase = {}) =>
  [
    generatedCase.title,
    generatedCase.plaintiffName,
    generatedCase.defendantName,
    generatedCase.coreDispute,
    generatedCase.plaintiffStory,
    generatedCase.defendantStory,
    generatedCase.plaintiffOpeningStatement,
    generatedCase.defendantOpeningStatement,
  ].every((value) => cleanCurrentEventText(value, 4000).length >= 3) &&
  Array.isArray(generatedCase.evidencePool) &&
  generatedCase.evidencePool.length >= 2;

const unwrapCurrentEventRepair = (repair = {}) => {
  if (!repair || typeof repair !== "object" || Array.isArray(repair)) return {};
  for (const key of [
    "correctedCase",
    "repairedCase",
    "generatedCase",
    "case",
    "result",
    "data",
  ]) {
    const candidate = repair[key];
    if (candidate && typeof candidate === "object" && !Array.isArray(candidate)) {
      return candidate;
    }
  }
  return repair;
};

const mergeCurrentEventRepairValue = (original, repair) => {
  if (repair === undefined || repair === null) return original;

  if (Array.isArray(original)) {
    if (!Array.isArray(repair)) return original;
    return original.map((item, index) =>
      index < repair.length
        ? mergeCurrentEventRepairValue(item, repair[index])
        : item
    );
  }

  if (
    original &&
    typeof original === "object" &&
    !Array.isArray(original)
  ) {
    if (!repair || typeof repair !== "object" || Array.isArray(repair)) {
      return original;
    }
    return Object.fromEntries(
      Object.entries(original).map(([key, value]) => [
        key,
        Object.prototype.hasOwnProperty.call(repair, key)
          ? mergeCurrentEventRepairValue(value, repair[key])
          : value,
      ])
    );
  }

  if (
    typeof original === "string" &&
    original.trim() &&
    typeof repair === "string" &&
    !repair.trim()
  ) {
    return original;
  }

  return repair;
};

export const applyCurrentEventAnonymizationRepair = (
  originalCase = {},
  repair = {}
) =>
  mergeCurrentEventRepairValue(
    originalCase,
    unwrapCurrentEventRepair(repair)
  );

export const findCurrentEventLeaks = (generatedCase = {}, brief = {}) => {
  const corpus = normalizeForComparison(JSON.stringify(generatedCase));
  return collectCurrentEventProtectedTerms(brief).filter((term) => {
    const normalized = normalizeForComparison(term);
    return normalized && corpus.includes(normalized);
  });
};

export const buildPublicCurrentEventInspiration = (provenance = {}) => {
  if (!provenance || typeof provenance !== "object") return null;
  return {
    eventDate: cleanCurrentEventText(provenance.eventDate, 80),
    retrievedAt: cleanCurrentEventText(provenance.retrievedAt, 80),
    country: provenance.country
      ? {
          code: cleanCurrentEventText(provenance.country.code, 8),
          name: cleanCurrentEventText(provenance.country.name, 120),
        }
      : null,
    sources: normalizeCurrentEventSources(provenance.sources).map((source) => ({
      title: source.title || source.publisher || "Source report",
      publisher: source.publisher,
      url: source.url,
      publishedAt: source.publishedAt,
    })),
    disclaimer: CURRENT_EVENT_DISCLAIMER,
  };
};
