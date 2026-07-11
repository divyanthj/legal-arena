import crypto from "node:crypto";

export const API_KEY_PREFIX = "la_live";

export const hashApiSecret = (secret) =>
  crypto.createHash("sha256").update(secret).digest("hex");

export const generateApiCredential = () => {
  const keyId = crypto.randomBytes(9).toString("base64url");
  const secret = crypto.randomBytes(32).toString("base64url");
  return { keyId, secret, apiKey: `${API_KEY_PREFIX}_${keyId}_${secret}` };
};

export const parseApiKey = (value = "") => {
  const match = String(value).match(/^la_live_([A-Za-z0-9_-]{12})_([A-Za-z0-9_-]{43})$/);
  return match ? { keyId: match[1], secret: match[2] } : null;
};
