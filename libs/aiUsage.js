import "server-only";

import mongoose from "mongoose";
import connectMongo from "@/libs/mongoose";
import AIUsageEvent from "@/models/AIUsageEvent";
import User from "@/models/User";

const number = (value) => Math.max(0, Number(value || 0));
const text = (value, fallback = "") => String(value || fallback).trim();

export const getUsageBillingClass = (serviceTier = "") => {
  const tier = text(serviceTier).toLowerCase();
  if (tier === "priority") return "priority";
  if (tier === "default" || tier === "auto") return "standard";
  if (tier === "flex") return "flex";
  if (tier === "scale") return "scale";
  return "other";
};

export const normalizeAIUsageEvent = ({ userId, ...usage } = {}) => {
  const serviceTier = text(usage.serviceTier, "unknown").toLowerCase();

  return {
    userId: text(userId, "system"),
    feature: text(usage.label, "unlabeled").slice(0, 120),
    model: text(usage.model).slice(0, 120),
    api: text(usage.api).slice(0, 60),
    requestedServiceTier: text(usage.requestedServiceTier, "auto").toLowerCase(),
    serviceTier,
    billingClass: getUsageBillingClass(serviceTier),
    isPriority: serviceTier === "priority",
    attempt: number(usage.attempt),
    maxTokens: number(usage.maxTokens),
    inputTokens: number(usage.inputTokens),
    outputTokens: number(usage.outputTokens),
    totalTokens: number(usage.totalTokens),
    cachedInputTokens: number(usage.cachedInputTokens),
    reasoningTokens: number(usage.reasoningTokens),
    cacheHitRate: number(usage.cacheHitRate),
    durationMs: number(usage.durationMs),
    finishReason: text(usage.finishReason).slice(0, 120),
    parsed: Boolean(usage.parsed),
    responseId: text(usage.responseId).slice(0, 160),
    promptCacheKey: text(usage.promptCacheKey).slice(0, 64),
  };
};

const buildUserUsageIncrement = (entry) => {
  const bucket = entry.billingClass;
  const fields = {
    requests: 1,
    inputTokens: entry.inputTokens,
    outputTokens: entry.outputTokens,
    totalTokens: entry.totalTokens,
    cachedInputTokens: entry.cachedInputTokens,
    reasoningTokens: entry.reasoningTokens,
  };

  return Object.entries(fields).reduce((increments, [field, value]) => {
    increments[`aiUsageTotals.total.${field}`] = value;
    increments[`aiUsageTotals.${bucket}.${field}`] = value;
    return increments;
  }, {});
};

export const recordAIUsageEvent = async ({ userId, ...usage } = {}) => {
  const entry = normalizeAIUsageEvent({ userId, ...usage });
  await connectMongo();

  const writes = [AIUsageEvent.create(entry)];
  if (mongoose.Types.ObjectId.isValid(entry.userId)) {
    writes.push(
      User.updateOne(
        { _id: entry.userId },
        {
          $inc: buildUserUsageIncrement(entry),
          $set: { "aiUsageTotals.lastTrackedAt": new Date() },
        }
      )
    );
  }

  await Promise.all(writes);
  return entry;
};
