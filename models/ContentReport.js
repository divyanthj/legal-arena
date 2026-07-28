import mongoose from "mongoose";
import toJSON from "./plugins/toJSON";

const contentReportSchema = mongoose.Schema(
  {
    reporterUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
      private: true,
    },
    reportedUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
      private: true,
    },
    sourceType: {
      type: String,
      enum: ["case", "challenge"],
      required: true,
      index: true,
    },
    sourceId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      index: true,
    },
    reportType: {
      type: String,
      enum: ["ai_content", "player_content", "player_conduct"],
      required: true,
      index: true,
    },
    category: {
      type: String,
      enum: [
        "offensive",
        "harassment",
        "sexual",
        "violence",
        "self_harm",
        "child_safety",
        "deception",
        "privacy",
        "spam",
        "other",
      ],
      required: true,
    },
    contextLabel: {
      type: String,
      trim: true,
      maxlength: 120,
      default: "",
    },
    contentExcerpt: {
      type: String,
      trim: true,
      maxlength: 2000,
      default: "",
      private: true,
    },
    details: {
      type: String,
      trim: true,
      maxlength: 2000,
      default: "",
      private: true,
    },
    status: {
      type: String,
      enum: ["new", "reviewing", "actioned", "dismissed"],
      default: "new",
      index: true,
    },
    resolvedAt: {
      type: Date,
      default: null,
    },
    resolutionNote: {
      type: String,
      trim: true,
      maxlength: 1000,
      default: "",
      private: true,
    },
  },
  { timestamps: true, toJSON: { virtuals: true } }
);

contentReportSchema.index({ sourceType: 1, sourceId: 1, createdAt: -1 });
contentReportSchema.index({ status: 1, createdAt: 1 });
contentReportSchema.plugin(toJSON);

export default mongoose.models.ContentReport ||
  mongoose.model("ContentReport", contentReportSchema);

