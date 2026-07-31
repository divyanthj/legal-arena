export const LAW_SOURCES = Object.freeze(["rulebook", "real"]);
export const DEFAULT_LAW_SOURCE = "rulebook";
export const LAW_SOURCE_STORAGE_KEY = "legal-arena:law-source";

export const normalizeLawSource = (value = "") =>
  LAW_SOURCES.includes(String(value || "").trim().toLowerCase())
    ? String(value).trim().toLowerCase()
    : "";

export const resolveLawSource = (value = "") =>
  normalizeLawSource(value) || DEFAULT_LAW_SOURCE;

