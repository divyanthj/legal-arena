import "server-only";

import connectMongo from "@/libs/mongoose";
import User from "@/models/User";

export const getDefaultOnboarding = () => ({
  dashboardTutorialCompleted: false,
  dashboardTutorialCompletedAt: null,
});

export const normalizeOnboarding = (rawOnboarding) => {
  const source = rawOnboarding?.toObject ? rawOnboarding.toObject() : rawOnboarding || {};

  return {
    ...getDefaultOnboarding(),
    ...source,
    dashboardTutorialCompleted: Boolean(source.dashboardTutorialCompleted),
    dashboardTutorialCompletedAt: source.dashboardTutorialCompletedAt || null,
  };
};

export const completeDashboardTutorialForUser = async ({ userId, email = "" }) => {
  await connectMongo();

  const completedAt = new Date();
  const update = {
    $set: {
      "onboarding.dashboardTutorialCompleted": true,
      "onboarding.dashboardTutorialCompletedAt": completedAt,
    },
  };
  const normalizedEmail = String(email || "").trim().toLowerCase();
  let user = userId
    ? await User.findByIdAndUpdate(userId, update, { new: true })
    : null;

  if (!user && normalizedEmail) {
    user = await User.findOneAndUpdate(
      { email: normalizedEmail },
      update,
      { new: true }
    );
  }

  if (!user) {
    return null;
  }

  return normalizeOnboarding(user.onboarding);
};

export const resetDashboardTutorialForEmail = async (email) => {
  await connectMongo();

  const normalizedEmail = String(email || "").trim().toLowerCase();

  if (!normalizedEmail) {
    return null;
  }

  const user = await User.findOneAndUpdate(
    { email: normalizedEmail },
    {
      $set: {
        "onboarding.dashboardTutorialCompleted": false,
        "onboarding.dashboardTutorialCompletedAt": null,
      },
    },
    { new: true }
  );

  if (!user) {
    return null;
  }

  return normalizeOnboarding(user.onboarding);
};
