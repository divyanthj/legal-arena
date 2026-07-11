import crypto from "crypto";

const getSecret = () => {
  const secret = process.env.EMAIL_UNSUBSCRIBE_SECRET || process.env.NEXTAUTH_SECRET;
  if (!secret) throw new Error("EMAIL_UNSUBSCRIBE_SECRET or NEXTAUTH_SECRET is required.");
  return secret;
};

const normalizeEmail = (value = "") => String(value || "").trim().toLowerCase();

export const createUnsubscribeToken = (email) => {
  const normalized = normalizeEmail(email);
  if (!normalized) throw new Error("Email is required for an unsubscribe link.");
  const payload = Buffer.from(normalized, "utf8").toString("base64url");
  const signature = crypto.createHmac("sha256", getSecret()).update(payload).digest("base64url");
  return `${payload}.${signature}`;
};

export const verifyUnsubscribeToken = (token = "") => {
  const [payload, signature, extra] = String(token || "").split(".");
  if (!payload || !signature || extra) return null;
  const expected = crypto.createHmac("sha256", getSecret()).update(payload).digest();
  let supplied;
  try { supplied = Buffer.from(signature, "base64url"); } catch (error) { return null; }
  if (supplied.length !== expected.length || !crypto.timingSafeEqual(supplied, expected)) return null;
  let email;
  try { email = normalizeEmail(Buffer.from(payload, "base64url").toString("utf8")); } catch (error) { return null; }
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null;
};
