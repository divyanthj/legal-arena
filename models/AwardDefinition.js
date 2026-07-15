import mongoose from "mongoose";
import toJSON from "./plugins/toJSON";

const schema = mongoose.Schema({
  code: { type: String, required: true, unique: true, trim: true, index: true },
  name: { type: String, required: true, trim: true },
  emoji: { type: String, required: true, trim: true },
  description: { type: String, required: true, trim: true },
  category: { type: String, required: true, index: true },
  kind: { type: String, enum: ["honour", "badge", "distinction"], required: true },
  evaluationType: { type: String, enum: ["objective", "ai", "hybrid"], required: true },
  repeatable: { type: Boolean, default: false },
  hiddenUntilUnlocked: { type: Boolean, default: false },
  enabled: { type: Boolean, default: true, index: true },
  sortOrder: { type: Number, default: 0, index: true },
  tierThresholds: { type: mongoose.Schema.Types.Mixed, default: null },
  metadata: { type: mongoose.Schema.Types.Mixed, default: () => ({}) },
  catalogueVersion: { type: String, required: true },
}, { timestamps: true, toJSON: { virtuals: true } });

schema.index({ enabled: 1, category: 1, sortOrder: 1 });
schema.plugin(toJSON);
export default mongoose.models.AwardDefinition || mongoose.model("AwardDefinition", schema);

