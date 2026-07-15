import mongoose from "mongoose";
import toJSON from "./plugins/toJSON";

const schema = mongoose.Schema({
  awardDefinitionId: { type: mongoose.Schema.Types.ObjectId, ref: "AwardDefinition", required: true, unique: true, index: true },
  eligiblePlayerCount: { type: Number, default: 0 },
  unlockedPlayerCount: { type: Number, default: 0 },
  percentage: { type: Number, default: null },
  band: { type: String, enum: ["Common", "Uncommon", "Rare", "Epic", "Legendary", null], default: null },
  computedAt: { type: Date, required: true, index: true },
}, { timestamps: true, toJSON: { virtuals: true } });

schema.plugin(toJSON);
export default mongoose.models.AwardRaritySnapshot || mongoose.model("AwardRaritySnapshot", schema);

