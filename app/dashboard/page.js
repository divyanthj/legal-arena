import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/libs/next-auth";
import DashboardHub from "@/components/legal-arena/DashboardHub";
import { listDashboardDataForUser } from "@/libs/game/store";
import {
  listCategoryLeaderboard,
  listOverallLeaderboard,
} from "@/libs/game/progression";
import { LEGAL_CASE_CATEGORIES } from "@/libs/game/categories";
import { isAdminEmail, userCanAccessArena } from "@/libs/admin";
import { toClientJSON } from "@/libs/serialize";

export const dynamic = "force-dynamic";

export default async function Dashboard() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    redirect("/");
  }

  const hasArenaAccess = await userCanAccessArena(session);

  const [dashboardData, overallLeaderboard, categoryLeaderboards] = await Promise.all([
    listDashboardDataForUser(session.user.id, session.user),
    listOverallLeaderboard(),
    Promise.all(
      LEGAL_CASE_CATEGORIES.map(async (category) => [
        category.slug,
        await listCategoryLeaderboard(category.slug),
      ])
    ),
  ]);

  return (
    <DashboardHub
      initialCases={toClientJSON(dashboardData.cases)}
      templates={toClientJSON(dashboardData.templates)}
      categories={toClientJSON(dashboardData.categories)}
      progression={toClientJSON(dashboardData.progression)}
      overallLeaderboard={toClientJSON(overallLeaderboard)}
      categoryLeaderboards={toClientJSON(Object.fromEntries(categoryLeaderboards))}
      isAdmin={isAdminEmail(session.user?.email)}
      userId={session.user?.id || ""}
      userName={session.user?.name || session.user?.email}
      userEmail={session.user?.email || ""}
      hasArenaAccess={hasArenaAccess}
    />
  );
}
