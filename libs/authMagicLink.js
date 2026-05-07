import "server-only";
import { createHash, randomBytes } from "crypto";
import config from "@/config";
import clientPromise from "@/libs/mongo";

const EMAIL_PROVIDER_ID = "email";
const ONE_DAY_IN_SECONDS = 86400;

const isLocalAuthUrl = (value = "") =>
  /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(?::\d+)?(?:\/|$)/i.test(value);

const getAuthBaseUrl = () => {
  const configuredUrl = (process.env.NEXTAUTH_URL || "").trim().replace(/\/$/, "");

  if (
    configuredUrl &&
    (process.env.NODE_ENV === "development" || !isLocalAuthUrl(configuredUrl))
  ) {
    return configuredUrl;
  }

  return `https://${config.domainName}`;
};

const hashVerificationToken = (token) =>
  createHash("sha256")
    .update(`${token}${process.env.NEXTAUTH_SECRET || ""}`)
    .digest("hex");

export const createMagicLoginLink = async ({
  email,
  callbackUrl = "/dashboard",
  maxAgeSeconds = ONE_DAY_IN_SECONDS,
} = {}) => {
  const identifier = String(email || "").trim().toLowerCase();

  if (!identifier) {
    throw new Error("Email is required to create a magic login link.");
  }

  if (!clientPromise) {
    throw new Error("MONGODB_URI is required to create magic login links.");
  }

  const baseUrl = getAuthBaseUrl();
  const resolvedCallbackUrl = callbackUrl.startsWith("http")
    ? callbackUrl
    : `${baseUrl}${callbackUrl.startsWith("/") ? callbackUrl : `/${callbackUrl}`}`;
  const token = randomBytes(32).toString("hex");
  const expires = new Date(Date.now() + maxAgeSeconds * 1000);
  const client = await clientPromise;

  await client.db().collection("verification_tokens").insertOne({
    identifier,
    token: hashVerificationToken(token),
    expires,
  });

  const params = new URLSearchParams({
    callbackUrl: resolvedCallbackUrl,
    token,
    email: identifier,
  });

  return `${baseUrl}/api/auth/callback/${EMAIL_PROVIDER_ID}?${params.toString()}`;
};
