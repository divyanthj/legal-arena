import mongoose from "mongoose";
import toJSON from "./plugins/toJSON";

const aiUsageEventSchema = mongoose.Schema(
  {
    userId: {
      type: String,
      required: true,
      trim: true,
      index: true,
      private: true,
    },
    feature: { type: String, trim: true, default: "unlabeled" },
    model: { type: String, trim: true, default: "" },
    api: { type: String, trim: true, default: "" },
    requestedServiceTier: { type: String, trim: true, default: "auto" },
    serviceTier: { type: String, trim: true, default: "unknown", index: true },
    billingClass: { type: String, trim: true, default: "other", index: true },
    isPriority: { type: Boolean, default: false, index: true },
    attempt: { type: Number, default: 0 },
    maxTokens: { type: Number, default: 0 },
    inputTokens: { type: Number, default: 0 },
    outputTokens: { type: Number, default: 0 },
    totalTokens: { type: Number, default: 0 },
    cachedInputTokens: { type: Number, default: 0 },
    reasoningTokens: { type: Number, default: 0 },
    cacheHitRate: { type: Number, default: 0 },
    durationMs: { type: Number, default: 0 },
    finishReason: { type: String, trim: true, default: "" },
    parsed: { type: Boolean, default: false },
    responseId: { type: String, trim: true, default: "" },
    promptCacheKey: { type: String, trim: true, default: "" },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
  }
);

aiUsageEventSchema.index({ userId: 1, createdAt: -1 });
aiUsageEventSchema.index({ userId: 1, billingClass: 1, createdAt: -1 });
aiUsageEventSchema.index({ feature: 1, model: 1, serviceTier: 1, createdAt: -1 });
aiUsageEventSchema.plugin(toJSON);

export default mongoose.models.AIUsageEvent ||
  mongoose.model("AIUsageEvent", aiUsageEventSchema);
