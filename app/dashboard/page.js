import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/libs/next-auth";
import DashboardHub from "@/components/legal-arena/DashboardHub";
import { listDashboardDataForUser } from "@/libs/game/store";
import { listChallengesForUser } from "@/libs/game/challenges";
import {
  listCategoryLeaderboard,
  listOverallLeaderboard,
} from "@/libs/game/progression";
import { LEGAL_CASE_CATEGORIES } from "@/libs/game/categories";
import { isAdminEmail, userCanAccessArena } from "@/libs/admin";
import { toClientJSON } from "@/libs/serialize";

export const dynamic = "force-dynamic";

const DASHBOARD_OPTIONAL_TIMEOUT_MS = 3500;

const withOptionalTimeout = async (promise, fallback, label) => {
  let timeoutId;

  try {
    return await Promise.race([
      promise,
      new Promise((resolve) => {
        timeoutId = setTimeout(() => {
          console.warn(`dashboard optional data timed out: ${label}`);
          resolve(fallback);
        }, DASHBOARD_OPTIONAL_TIMEOUT_MS);
      }),
    ]);
  } catch (error) {
    console.error(`dashboard optional data failed: ${label}`, error);
    return fallback;
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
};

export default async function Dashboard() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    redirect("/");
  }

  const hasArenaAccess = await userCanAccessArena(session);

  const [dashboardData, challenges, overallLeaderboard, categoryLeaderboards] = await Promise.all([
    listDashboardDataForUser(session.user.id, session.user),
    withOptionalTimeout(listChallengesForUser(session.user.id), [], "challenges"),
    withOptionalTimeout(listOverallLeaderboard({ limit: 8 }), [], "overall leaderboard"),
    withOptionalTimeout(
      Promise.all(
        LEGAL_CASE_CATEGORIES.map(async (category) => [
          category.slug,
          await listCategoryLeaderboard(category.slug),
        ])
      ),
      [],
      "category leaderboards"
    ),
  ]);

  return (
    <DashboardHub
      initialCases={toClientJSON(dashboardData.cases)}
      templates={toClientJSON(dashboardData.templates)}
      categories={toClientJSON(dashboardData.categories)}
      onboarding={toClientJSON(dashboardData.onboarding)}
      progression={toClientJSON(dashboardData.progression)}
      dashboardEncouragementNote={dashboardData.dashboardEncouragementNote}
      challenges={toClientJSON(challenges)}
      overallLeaderboard={toClientJSON(overallLeaderboard)}
      categoryLeaderboards={toClientJSON(Object.fromEntries(categoryLeaderboards))}
      isAdmin={isAdminEmail(session.user?.email)}
      userId={session.user?.id || ""}
      userName={session.user?.name || session.user?.email}
      userImage={session.user?.image || ""}
      userEmail={session.user?.email || ""}
      hasArenaAccess={hasArenaAccess}
    />
  );
}
