import mongoose from "mongoose";
import toJSON from "./plugins/toJSON";

const apiCredentialSchema = mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: 100 },
    keyId: { type: String, required: true, unique: true, index: true },
    secretHash: { type: String, required: true, select: false },
    createdBy: { type: String, required: true, trim: true, lowercase: true },
    expiresAt: { type: Date, default: null },
    revokedAt: { type: Date, default: null },
    lastUsedAt: { type: Date, default: null },
    rateLimitWindowStartedAt: { type: Date, default: null, select: false },
    rateLimitCount: { type: Number, default: 0, select: false },
  },
  { timestamps: true, toJSON: { virtuals: true } }
);

apiCredentialSchema.index({ userId: 1, createdAt: -1 });
apiCredentialSchema.plugin(toJSON);

export default mongoose.models.ApiCredential ||
  mongoose.model("ApiCredential", apiCredentialSchema);
