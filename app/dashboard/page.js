import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/libs/next-auth";
import DashboardHub from "@/components/legal-arena/DashboardHub";
import { listDashboardDataForUser } from "@/libs/game/store";
import { getSoloGameplayAccessForSession, isAdminEmail } from "@/libs/admin";
import { toClientJSON } from "@/libs/serialize";

export const dynamic = "force-dynamic";

export default async function Dashboard() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    redirect("/");
  }

  const soloCreateAccess = await getSoloGameplayAccessForSession({
    session,
    action: "create",
  });

  const dashboardData = await listDashboardDataForUser(session.user.id, session.user);

  return (
    <DashboardHub
      initialCases={toClientJSON(dashboardData.cases)}
      templates={toClientJSON(dashboardData.templates)}
      categories={toClientJSON(dashboardData.categories)}
      onboarding={toClientJSON(dashboardData.onboarding)}
      progression={toClientJSON(dashboardData.progression)}
      dashboardEncouragementNote={dashboardData.dashboardEncouragementNote}
      isAdmin={isAdminEmail(session.user?.email)}
      userId={session.user?.id || ""}
      userName={session.user?.name || session.user?.email}
      userImage={session.user?.image || ""}
      userEmail={session.user?.email || ""}
      hasArenaAccess={Boolean(soloCreateAccess.hasArenaAccess)}
      canStartSoloCases={soloCreateAccess.allowed}
    />
  );
}
