import mongoose from "mongoose";
import toJSON from "./plugins/toJSON";

const playerBlockSchema = mongoose.Schema(
  {
    blockerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    blockedId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    reason: {
      type: String,
      trim: true,
      maxlength: 500,
      default: "",
    },
  },
  { timestamps: true, toJSON: { virtuals: true } }
);

playerBlockSchema.index({ blockerId: 1, blockedId: 1 }, { unique: true });
playerBlockSchema.plugin(toJSON);

export default mongoose.models.PlayerBlock ||
  mongoose.model("PlayerBlock", playerBlockSchema);

