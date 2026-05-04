import mongoose from "mongoose";
import toJSON from "./plugins/toJSON";

const adminOpsConfigSchema = mongoose.Schema(
  {
    scope: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      default: "global",
    },
    retention: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    digest: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
  }
);

adminOpsConfigSchema.plugin(toJSON);

export default mongoose.models.AdminOpsConfig ||
  mongoose.model("AdminOpsConfig", adminOpsConfigSchema);
