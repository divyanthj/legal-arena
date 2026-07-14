export const DEFAULT_COUNTRY_CODE = "US";
export const COUNTRY_STORAGE_KEY = "legal-arena:case-country";

const ISO_COUNTRY_CODES = `AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG UM US UY UZ VA VC VE VG VI VN VU WF WS YE YT ZA ZM ZW`.split(
  " "
);

const displayNames =
  typeof Intl !== "undefined" && Intl.DisplayNames
    ? new Intl.DisplayNames(["en"], { type: "region" })
    : null;

const COUNTRY_NAME_OVERRIDES = {
  BO: "Bolivia",
  BN: "Brunei",
  CD: "Democratic Republic of the Congo",
  CG: "Republic of the Congo",
  CI: "Cote d'Ivoire",
  CZ: "Czechia",
  FM: "Micronesia",
  GB: "United Kingdom",
  IR: "Iran",
  KP: "North Korea",
  KR: "South Korea",
  LA: "Laos",
  MD: "Moldova",
  PS: "Palestine",
  RU: "Russia",
  SY: "Syria",
  TW: "Taiwan",
  TZ: "Tanzania",
  US: "United States",
  VA: "Vatican City",
  VE: "Venezuela",
  VN: "Vietnam",
};

export const CASE_COUNTRIES = ISO_COUNTRY_CODES.map((code) => ({
  code,
  name: COUNTRY_NAME_OVERRIDES[code] || displayNames?.of(code) || code,
})).sort((left, right) => left.name.localeCompare(right.name));

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
