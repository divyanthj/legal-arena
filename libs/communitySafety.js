import "server-only";
import mongoose from "mongoose";
import connectMongo from "@/libs/mongoose";
import User from "@/models/User";
import PlayerBlock from "@/models/PlayerBlock";

export const COMMUNITY_TERMS_VERSION = "2026-07-28";

export const getCommunityTermsStatus = async (userId) => {
  await connectMongo();
  const user = await User.findById(userId)
    .select("+communityTermsVersion +communityTermsAcceptedAt")
    .lean();

  return {
    version: COMMUNITY_TERMS_VERSION,
    accepted: Boolean(
      user?.communityTermsVersion === COMMUNITY_TERMS_VERSION &&
        user?.communityTermsAcceptedAt
    ),
    acceptedAt: user?.communityTermsAcceptedAt || null,
  };
};

export const acceptCommunityTerms = async (userId) => {
  await connectMongo();
  const acceptedAt = new Date();
  const user = await User.findByIdAndUpdate(
    userId,
    {
      $set: {
        communityTermsVersion: COMMUNITY_TERMS_VERSION,
        communityTermsAcceptedAt: acceptedAt,
      },
    },
    { new: true }
  ).select("_id");

  if (!user) throw new Error("Account not found.");
  return { version: COMMUNITY_TERMS_VERSION, accepted: true, acceptedAt };
};

export const ensureCommunityTermsAccepted = async (userId) => {
  const status = await getCommunityTermsStatus(userId);
  if (status.accepted) return status;

  const error = new Error("Accept the Community Rules before using PVP.");
  error.code = "COMMUNITY_TERMS_REQUIRED";
  error.status = 428;
  throw error;
};

export const arePlayersBlocked = async (leftId, rightId) => {
  if (
    !mongoose.Types.ObjectId.isValid(leftId) ||
    !mongoose.Types.ObjectId.isValid(rightId)
  ) {
    return false;
  }

  await connectMongo();
  return Boolean(
    await PlayerBlock.exists({
      $or: [
        { blockerId: leftId, blockedId: rightId },
        { blockerId: rightId, blockedId: leftId },
      ],
    })
  );
};

