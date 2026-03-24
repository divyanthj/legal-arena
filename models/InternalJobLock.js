import mongoose from "mongoose";
import toJSON from "./plugins/toJSON";

const internalJobLockSchema = mongoose.Schema(
  {
    key: {
      type: String,
      required: true,
      trim: true,
      unique: true,
    },
    owner: {
      type: String,
      required: true,
      trim: true,
    },
    lockedAt: {
      type: Date,
      default: Date.now,
    },
    lockedUntil: {
      type: Date,
      required: true,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
  }
);

internalJobLockSchema.plugin(toJSON);

export default mongoose.models.InternalJobLock ||
  mongoose.model("InternalJobLock", internalJobLockSchema);
