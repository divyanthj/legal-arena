import mongoose from "mongoose";
import toJSON from "./plugins/toJSON";

const schema = mongoose.Schema({
  evaluationKey: { type: String, required: true, unique: true, index: true },
  playerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  sourceType: { type: String, enum: ["case", "challenge"], required: true },
  sourceId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
  status: { type: String, enum: ["pending", "running", "completed", "partially_completed", "failed"], default: "pending", index: true },
  objectiveVersion: { type: String, required: true },
  aiVersion: { type: String, required: true },
  context: { type: mongoose.Schema.Types.Mixed, required: true, select: false },
  objectiveMatched: { type: [mongoose.Schema.Types.Mixed], default: [], select: false },
  aiProposed: { type: [mongoose.Schema.Types.Mixed], default: [], select: false },
  rejected: { type: [mongoose.Schema.Types.Mixed], default: [], select: false },
  awardChanges: { type: [mongoose.Schema.Types.Mixed], default: [] },
  progressionAppliedAt: { type: Date, default: null },
  objectiveCompletedAt: { type: Date, default: null },
  completedAt: { type: Date, default: null },
  attempts: { type: Number, default: 0 },
  leaseExpiresAt: { type: Date, default: null, index: true },
  nextRetryAt: { type: Date, default: null, index: true },
  errorCode: { type: String, default: "" },
  errorMessage: { type: String, maxlength: 500, default: "", select: false },
}, { timestamps: true, toJSON: { virtuals: true } });

schema.index({ status: 1, nextRetryAt: 1, createdAt: 1 });
schema.index({ playerId: 1, sourceType: 1, sourceId: 1 });
schema.plugin(toJSON);
export default mongoose.models.AwardEvaluation || mongoose.model("AwardEvaluation", schema);

