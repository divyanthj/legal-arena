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

export const completeDashboardTutorialForUser = async (userId) => {
  await connectMongo();

  const completedAt = new Date();
  const user = await User.findByIdAndUpdate(
    userId,
    {
      $set: {
        "onboarding.dashboardTutorialCompleted": true,
        "onboarding.dashboardTutorialCompletedAt": completedAt,
      },
    },
    { new: true }
  );

  if (!user) {
    return null;
  }

  return normalizeOnboarding(user.onboarding);
};
