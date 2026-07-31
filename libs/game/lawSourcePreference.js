import "server-only";

import connectMongo from "@/libs/mongoose";
import User from "@/models/User";
import { resolveLawSource } from "./lawSource";

export const getPlayerLawSourcePreference = async (userId) => {
  if (!userId) return "rulebook";
  await connectMongo();
  const user = await User.findById(userId).select("preferredLawSource").lean();
  return resolveLawSource(user?.preferredLawSource);
};

export const setPlayerLawSourcePreference = async ({ userId, lawSource }) => {
  const normalized = resolveLawSource(lawSource);
  if (!userId) return normalized;
  await connectMongo();
  await User.updateOne({ _id: userId }, { $set: { preferredLawSource: normalized } });
  return normalized;
};

