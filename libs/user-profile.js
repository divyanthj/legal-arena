import "server-only";

import connectMongo from "@/libs/mongoose";
import User from "@/models/User";
import { getDefaultProgression, normalizeProgression } from "@/libs/game/progression";

const normalizeEmail = (value = "") => String(value || "").trim().toLowerCase();

export const syncUserProfileFromAuth = async (user = {}) => {
  const userId = String(user?.id || "").trim();
  const email = normalizeEmail(user?.email);

  if (!userId && !email) {
    return null;
  }

  await connectMongo();

  const update = {
    $setOnInsert: {
      progression: getDefaultProgression(),
      hasAccess: false,
    },
  };

  const setFields = {};

  if (email) {
    setFields.email = email;
  }
  if (typeof user?.name === "string" && user.name.trim()) {
    setFields.name = user.name.trim();
  }
  if (typeof user?.image === "string" && user.image.trim()) {
    setFields.image = user.image.trim();
  }
  if (user?.emailVerified !== undefined) {
    setFields.emailVerified = user.emailVerified;
  }

  if (Object.keys(setFields).length > 0) {
    update.$set = setFields;
  }

  const filter = userId ? { _id: userId } : { email };
  const profile = await User.findOneAndUpdate(filter, update, {
    new: true,
    upsert: true,
    runValidators: true,
    setDefaultsOnInsert: true,
  });

  const nextProgression = normalizeProgression(profile.progression);

  if (JSON.stringify(nextProgression) !== JSON.stringify(profile.progression)) {
    profile.progression = nextProgression;
    await profile.save();
  }

  return profile;
};
