import mongoose from "mongoose";
import toJSON from "./plugins/toJSON";

const schema = mongoose.Schema({
  code: { type: String, required: true, unique: true, trim: true, index: true },
  name: { type: String, required: true, trim: true },
  emoji: { type: String, default: "" },
  description: { type: String, required: true },
  requirements: { type: mongoose.Schema.Types.Mixed, required: true },
  enabled: { type: Boolean, default: true, index: true },
  sortOrder: { type: Number, default: 0 },
  catalogueVersion: { type: String, required: true },
}, { timestamps: true, toJSON: { virtuals: true } });

schema.index({ enabled: 1, sortOrder: 1 });
schema.plugin(toJSON);
export default mongoose.models.LawyerTitle || mongoose.model("LawyerTitle", schema);

