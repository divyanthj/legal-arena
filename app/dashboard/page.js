import { getServerSession } from "next-auth";
import { authOptions } from "@/libs/next-auth";
import DashboardHub from "@/components/legal-arena/DashboardHub";
import { listDashboardDataForUser } from "@/libs/game/store";
import {
  listCategoryLeaderboard,
  listOverallLeaderboard,
} from "@/libs/game/progression";
import { LEGAL_CASE_CATEGORIES } from "@/libs/game/categories";
import { isAdminEmail } from "@/libs/admin";

export const dynamic = "force-dynamic";

export default async function Dashboard() {
  const session = await getServerSession(authOptions);
  const [dashboardData, overallLeaderboard, categoryLeaderboards] = await Promise.all([
    listDashboardDataForUser(session.user.id),
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
      initialCases={dashboardData.cases}
      templates={dashboardData.templates}
      categories={dashboardData.categories}
      progression={dashboardData.progression}
      overallLeaderboard={overallLeaderboard}
      categoryLeaderboards={Object.fromEntries(categoryLeaderboards)}
      isAdmin={isAdminEmail(session.user?.email)}
      userName={session.user?.name || session.user?.email}
    />
  );
}
