import "server-only";

const normalizeEmail = (value = "") => value.trim().toLowerCase();

const parseEmailList = (rawValue = "") => {
  const raw = rawValue?.trim();

  if (!raw) {
    return [];
  }

  if (raw.startsWith("[")) {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed.map(normalizeEmail).filter(Boolean) : [];
    } catch (error) {
      return [];
    }
  }

  return raw.split(",").map(normalizeEmail).filter(Boolean);
};

const parseAdmins = () => parseEmailList(process.env.ADMINS);
const parseGrantedAccess = () => parseEmailList(process.env.ACCESS_GRANTED);

export const getAdminEmails = () => parseAdmins();
export const getGrantedAccessEmails = () => parseGrantedAccess();

export const isAdminEmail = (email) =>
  Boolean(email) && parseAdmins().includes(normalizeEmail(email));

export const hasGameAccess = (email) =>
  Boolean(email) &&
  (isAdminEmail(email) || parseGrantedAccess().includes(normalizeEmail(email)));

export const getCaseGeneratorApiKey = () =>
  process.env.CASE_GENERATOR_API_KEY?.trim() || "";

export const hasValidCaseGeneratorApiKey = (req) => {
  const expected = getCaseGeneratorApiKey();
  if (!expected) {
    return false;
  }

  const bearer = req.headers.get("authorization") || "";
  const headerKey = req.headers.get("x-case-generator-key") || "";
  const bearerKey = bearer.startsWith("Bearer ") ? bearer.slice(7).trim() : "";

  return headerKey === expected || bearerKey === expected;
};
