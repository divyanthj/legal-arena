import mongoose from "mongoose";
import toJSON from "./plugins/toJSON";

const generationArtifactSchema = mongoose.Schema(
  {
    status: {
      type: String,
      enum: ["running", "failed", "completed"],
      default: "running",
    },
    categorySlug: {
      type: String,
      required: true,
      trim: true,
    },
    complexity: {
      type: Number,
      min: 1,
      max: 5,
      required: true,
    },
    prompt: {
      type: String,
      default: "",
      trim: true,
    },
    model: {
      type: String,
      default: "",
      trim: true,
    },
    canonicalStoryPacket: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    plaintiffStoryDraft: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    defendantStoryDraft: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    plaintiffDetailedStory: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    defendantDetailedStory: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    plaintiffPlausibilityReview: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    defendantPlausibilityReview: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    templateDraft: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    templateRepairIssues: {
      type: [String],
      default: [],
    },
    usageLog: {
      type: [mongoose.Schema.Types.Mixed],
      default: [],
    },
    usageTotals: {
      type: mongoose.Schema.Types.Mixed,
      default: {
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
        cachedInputTokens: 0,
        reasoningTokens: 0,
      },
    },
    finalTemplateId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "CaseTemplate",
      default: null,
    },
    failureStage: {
      type: String,
      default: "",
      trim: true,
    },
    failureReason: {
      type: String,
      default: "",
      trim: true,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
  }
);

generationArtifactSchema.plugin(toJSON);

export default mongoose.models.GenerationArtifact ||
  mongoose.model("GenerationArtifact", generationArtifactSchema);
