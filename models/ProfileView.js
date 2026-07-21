import mongoose from "mongoose";

const profileViewSchema = mongoose.Schema(
  {
    profileUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    viewerUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    viewedAt: {
      type: Date,
      default: Date.now,
      required: true,
    },
    expiresAt: {
      type: Date,
      required: true,
    },
  },
  { timestamps: true }
);

profileViewSchema.index({ profileUserId: 1, viewerUserId: 1 }, { unique: true });
profileViewSchema.index({ profileUserId: 1, viewedAt: -1 });
profileViewSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export default mongoose.models.ProfileView || mongoose.model("ProfileView", profileViewSchema);
