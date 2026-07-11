import "server-only";
import crypto from "crypto";
import { getServerSession } from "next-auth/next";
import { NextResponse } from "next/server";
import { authOptions } from "@/libs/next-auth";
import connectMongo from "@/libs/mongoose";
import ApiCredential from "@/models/ApiCredential";
import User from "@/models/User";
import {
  API_KEY_PREFIX,
  generateApiCredential,
  hashApiSecret,
  parseApiKey,
} from "@/libs/apiCredentialsCore.mjs";

export { API_KEY_PREFIX, generateApiCredential, hashApiSecret, parseApiKey };
const DEFAULT_LIMIT = 60;
const DEFAULT_WINDOW_SECONDS = 300;

const positiveInt = (value, fallback) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

export const getApiRateLimitConfig = () => ({
  limit: positiveInt(process.env.AI_API_RATE_LIMIT, DEFAULT_LIMIT),
  windowSeconds: positiveInt(
    process.env.AI_API_RATE_LIMIT_WINDOW_SECONDS,
    DEFAULT_WINDOW_SECONDS
  ),
});

const unauthorized = () =>
  NextResponse.json({ error: "Invalid or expired API credential" }, { status: 401 });

const consumeRateLimit = async (credential, now) => {
  const { limit, windowSeconds } = getApiRateLimitConfig();
  const windowMs = windowSeconds * 1000;
  const windowStart = credential.rateLimitWindowStartedAt
    ? new Date(credential.rateLimitWindowStartedAt)
    : null;

  if (!windowStart || now.getTime() - windowStart.getTime() >= windowMs) {
    credential.rateLimitWindowStartedAt = now;
    credential.rateLimitCount = 1;
  } else {
    credential.rateLimitCount = Number(credential.rateLimitCount || 0) + 1;
  }

  if (credential.rateLimitCount > limit) {
    const retryAfter = Math.max(
      1,
      Math.ceil((windowMs - (now.getTime() - windowStart.getTime())) / 1000)
    );
    return { exceeded: true, retryAfter };
  }

  credential.lastUsedAt = now;
  await credential.save();
  return { exceeded: false };
};

export const getRequestSession = async (req) => {
  const authorization = req?.headers?.get("authorization") || "";

  if (!authorization) {
    return { session: await getServerSession(authOptions), authType: "nextauth" };
  }

  if (!authorization.startsWith("Bearer ")) {
    return { error: unauthorized() };
  }

  const parsed = parseApiKey(authorization.slice(7).trim());
  if (!parsed) return { error: unauthorized() };

  await connectMongo();
  const credential = await ApiCredential.findOne({ keyId: parsed.keyId }).select(
    "+secretHash +rateLimitWindowStartedAt +rateLimitCount"
  );
  const suppliedHash = Buffer.from(hashApiSecret(parsed.secret), "hex");
  const storedHash = credential?.secretHash
    ? Buffer.from(credential.secretHash, "hex")
    : Buffer.alloc(suppliedHash.length);
  const secretMatches =
    suppliedHash.length === storedHash.length &&
    crypto.timingSafeEqual(suppliedHash, storedHash);
  const now = new Date();

  if (
    !credential ||
    !secretMatches ||
    credential.revokedAt ||
    (credential.expiresAt && credential.expiresAt <= now)
  ) {
    return { error: unauthorized() };
  }

  const rateLimit = await consumeRateLimit(credential, now);
  if (rateLimit.exceeded) {
    return {
      error: NextResponse.json(
        { error: "API credential rate limit exceeded" },
        { status: 429, headers: { "Retry-After": String(rateLimit.retryAfter) } }
      ),
    };
  }

  const user = await User.findById(credential.userId).select("_id email name image");
  if (!user) return { error: unauthorized() };

  return {
    session: {
      user: {
        id: user._id.toString(),
        email: user.email || "",
        name: user.name || "",
        image: user.image || "",
      },
    },
    authType: "api-key",
    credentialId: credential._id.toString(),
  };
};
