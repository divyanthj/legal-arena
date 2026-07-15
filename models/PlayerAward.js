import mongoose from "mongoose";
import toJSON from "./plugins/toJSON";

const schema = mongoose.Schema({
  playerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  awardDefinitionId: { type: mongoose.Schema.Types.ObjectId, ref: "AwardDefinition", required: true, index: true },
  progress: { type: Number, default: 0 },
  occurrenceCount: { type: Number, default: 0 },
  highestTier: { type: String, enum: ["bronze", "silver", "gold", "diamond", null], default: null, index: true },
  firstUnlockedAt: { type: Date, default: null },
  lastEarnedAt: { type: Date, default: null, index: true },
  lastCaseId: { type: String, default: null },
}, { timestamps: true, toJSON: { virtuals: true } });

schema.index({ playerId: 1, awardDefinitionId: 1 }, { unique: true });
schema.index({ playerId: 1, lastEarnedAt: -1 });
schema.plugin(toJSON);
export default mongoose.models.PlayerAward || mongoose.model("PlayerAward", schema);

