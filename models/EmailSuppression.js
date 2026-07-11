import mongoose from "mongoose";
import toJSON from "./plugins/toJSON";

const emailSuppressionSchema = mongoose.Schema(
  {
    email: { type: String, required: true, trim: true, lowercase: true, unique: true, index: true },
    reason: { type: String, trim: true, default: "Removed by admin" },
    suppressedBy: { type: String, trim: true, lowercase: true, default: "" },
  },
  { timestamps: true, toJSON: { virtuals: true } }
);

emailSuppressionSchema.plugin(toJSON);

export default mongoose.models.EmailSuppression || mongoose.model("EmailSuppression", emailSuppressionSchema);
