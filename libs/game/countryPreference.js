import "server-only";

import connectMongo from "@/libs/mongoose";
import User from "@/models/User";
import { normalizeCountryCode } from "./countries";

export const getPlayerCaseCountryPreference = async (userId) => {
  if (!userId) return "";

  await connectMongo();
  const user = await User.findById(userId).select("preferredCaseCountryCode").lean();
  return normalizeCountryCode(user?.preferredCaseCountryCode);
};

export const setPlayerCaseCountryPreference = async ({ userId, countryCode }) => {
  const normalized = normalizeCountryCode(countryCode);
  if (!userId || !normalized) return "";

  await connectMongo();
  await User.updateOne(
    { _id: userId },
    { $set: { preferredCaseCountryCode: normalized } }
  );
  return normalized;
};
