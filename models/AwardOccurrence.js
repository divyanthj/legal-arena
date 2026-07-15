import mongoose from "mongoose";
import toJSON from "./plugins/toJSON";

const schema = mongoose.Schema({
  occurrenceKey: { type: String, required: true, unique: true, index: true },
  playerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  awardDefinitionId: { type: mongoose.Schema.Types.ObjectId, ref: "AwardDefinition", required: true, index: true },
  caseId: { type: String, default: null, index: true },
  sourceType: { type: String, enum: ["case", "challenge", "career"], required: true },
  tierAtTime: { type: String, enum: ["bronze", "silver", "gold", "diamond", null], default: null },
  evaluationSource: { type: String, enum: ["objective", "ai", "hybrid", "backfill"], required: true },
  evaluationVersion: { type: String, required: true },
  confidence: { type: Number, min: 0, max: 1, default: null },
  evidenceText: { type: String, maxlength: 600, default: null },
  metadata: { type: mongoose.Schema.Types.Mixed, default: null },
  earnedAt: { type: Date, default: Date.now, index: true },
}, { timestamps: true, toJSON: { virtuals: true } });

schema.index({ playerId: 1, awardDefinitionId: 1, earnedAt: -1 });
schema.index({ playerId: 1, sourceType: 1, caseId: 1 });
schema.plugin(toJSON);
export default mongoose.models.AwardOccurrence || mongoose.model("AwardOccurrence", schema);

