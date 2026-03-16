import mongoose from "mongoose";
import toJSON from "./plugins/toJSON";

const emailNudgeLogSchema = mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      private: true,
    },
    caseSessionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "CaseSession",
      default: null,
      private: true,
    },
    nudgeType: {
      type: String,
      enum: [
        "resume_interview",
        "resume_courtroom",
        "post_verdict_next_case",
        "cooldown_return",
      ],
      required: true,
      trim: true,
    },
    dedupeKey: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    sentAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    meta: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
  }
);

emailNudgeLogSchema.index({ userId: 1, sentAt: -1 });
emailNudgeLogSchema.index({ userId: 1, nudgeType: 1, caseSessionId: 1 });

emailNudgeLogSchema.plugin(toJSON);

export default mongoose.models.EmailNudgeLog ||
  mongoose.model("EmailNudgeLog", emailNudgeLogSchema);
