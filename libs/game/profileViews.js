import "server-only";

import mongoose from "mongoose";
import connectMongo from "@/libs/mongoose";
import ProfileView from "@/models/ProfileView";

const PROFILE_VIEW_RETENTION_DAYS = 90;

const validDistinctUserIds = (profileUserId, viewerUserId) => {
  const profileId = String(profileUserId || "");
  const viewerId = String(viewerUserId || "");

  return (
    profileId &&
    viewerId &&
    profileId !== viewerId &&
    mongoose.isValidObjectId(profileId) &&
    mongoose.isValidObjectId(viewerId)
  );
};

export const recordProfileView = async ({ profileUserId, viewerUserId }) => {
  if (!validDistinctUserIds(profileUserId, viewerUserId)) return false;

  await connectMongo();
  const viewedAt = new Date();
  const expiresAt = new Date(
    viewedAt.getTime() + PROFILE_VIEW_RETENTION_DAYS * 24 * 60 * 60 * 1000
  );

  await ProfileView.updateOne(
    { profileUserId, viewerUserId },
    { $set: { viewedAt, expiresAt } },
    { upsert: true }
  );

  return true;
};

export const listRecentProfileViews = async (profileUserId, { limit = 6 } = {}) => {
  if (!mongoose.isValidObjectId(String(profileUserId || ""))) return [];

  await connectMongo();
  const safeLimit = Math.max(1, Math.min(12, Number(limit) || 6));
  const views = await ProfileView.find({ profileUserId, expiresAt: { $gt: new Date() } })
    .sort({ viewedAt: -1 })
    .limit(safeLimit)
    .select("viewerUserId viewedAt")
    .lean();

  return views.map((view) => ({
    viewerUserId: String(view.viewerUserId),
    viewedAt: view.viewedAt,
  }));
};
