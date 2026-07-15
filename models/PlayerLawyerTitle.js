import mongoose from "mongoose";
import toJSON from "./plugins/toJSON";

const schema = mongoose.Schema({
  playerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  lawyerTitleId: { type: mongoose.Schema.Types.ObjectId, ref: "LawyerTitle", required: true, index: true },
  unlockedAt: { type: Date, default: Date.now },
}, { timestamps: true, toJSON: { virtuals: true } });

schema.index({ playerId: 1, lawyerTitleId: 1 }, { unique: true });
schema.plugin(toJSON);
export default mongoose.models.PlayerLawyerTitle || mongoose.model("PlayerLawyerTitle", schema);

