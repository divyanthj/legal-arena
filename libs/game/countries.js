import { CASE_COUNTRIES } from "./countryCatalogue.mjs";

export { CASE_COUNTRIES } from "./countryCatalogue.mjs";

export const DEFAULT_COUNTRY_CODE = "US";
export const COUNTRY_STORAGE_KEY = "legal-arena:case-country";

const COUNTRY_BY_CODE = new Map(CASE_COUNTRIES.map((country) => [country.code, country]));

export const normalizeCountryCode = (value = "") => {
  const code = String(value || "").trim().toUpperCase();
  return COUNTRY_BY_CODE.has(code) ? code : "";
};

export const isValidCountryCode = (value = "") => Boolean(normalizeCountryCode(value));

export const getCountryByCode = (value = "") =>
  COUNTRY_BY_CODE.get(normalizeCountryCode(value)) || null;

export const buildCaseCountry = (value = "", { fallback = false } = {}) => {
  const normalized = normalizeCountryCode(value);
  const country = getCountryByCode(normalized || (fallback ? DEFAULT_COUNTRY_CODE : ""));
  return country ? { code: country.code, name: country.name } : null;
};

export const detectCountryCodeFromHeaders = (requestHeaders) =>
  normalizeCountryCode(requestHeaders?.get?.("x-vercel-ip-country")) || DEFAULT_COUNTRY_CODE;

export const resolveCountryDetectionFromHeaders = (requestHeaders) => {
  const detectedCode = normalizeCountryCode(requestHeaders?.get?.("x-vercel-ip-country"));
  return {
    countryCode: detectedCode || DEFAULT_COUNTRY_CODE,
    source: detectedCode ? "detected" : "default",
  };
};

export const resolveInitialCountryCode = ({ profileCode, storedCode, detectedCode } = {}) =>
  normalizeCountryCode(profileCode) ||
  normalizeCountryCode(storedCode) ||
  normalizeCountryCode(detectedCode) ||
  DEFAULT_COUNTRY_CODE;

export const getCountryFlavorGuidance = (caseCountry, categorySlug = "") => {
  const country = buildCaseCountry(caseCountry?.code || caseCountry, { fallback: true });
  const common = [
    `Set the entire matter in ${country.name}.`,
    "Use culturally plausible contemporary names, organizations, occupations, locations, court naming, currency, records, communication channels, social context, and everyday institutions.",
    "Country changes the story flavor, not the requested category, complexity, evidence budget, or game rules.",
    "Write in English; a locally familiar term may appear only when its meaning is clear from context.",
    "Use broad real-world-inspired legal themes without inventing statute numbers, quoting nonexistent provisions, or claiming exact legal accuracy.",
    "Avoid caricature, ridicule, costume-like exoticism, and the assumption that everyone in a country shares one ethnicity, religion, class, or lifestyle.",
  ];

  if (country.code === "IN") {
    common.push(
      "For India, favor recognizable modern contexts when they fit the category: marriage or relationship representations and family expectations, rental deposits and informal documentation, workplace hierarchy, small-business payment chains, consumer services, licensing, local messaging and payment records, or administrative friction.",
      "A marital or criminal matter may involve an alleged false promise to marry when appropriate, but handle intimate facts tastefully and give both sides a credible, contestable account.",
      "Use Indian names from varied regions and communities rather than repeatedly defaulting to one city, religion, surname pattern, or social class."
    );
  } else if (country.code === "US") {
    common.push(
      "For the United States, favor recognizable modern contexts when they fit the category: leases and security deposits, at-will workplace conflict, consumer subscriptions, small-business contracts, local agencies, insurance records, property access, and state-or-local enforcement settings.",
      "A criminal or property matter may involve firearm possession, storage, transport, ownership, or access when appropriate, but do not cite a specific state statute and keep the proof dispute playable."
    );
  } else {
    common.push(
      `Use contemporary details genuinely plausible for ${country.name}; do not merely rename an otherwise American case or force a famous stereotype into the dispute.`
    );
  }

  if (categorySlug) {
    common.push(`Keep the central dispute inside the selected ${categorySlug} category.`);
  }

  return common;
};
