import { getServerSession } from "next-auth";
import { authOptions } from "@/libs/next-auth";
import DashboardHub from "@/components/legal-arena/DashboardHub";
import {
  listCaseSessionsForUser,
  listScenarioOptions,
} from "@/libs/game/store";

export const dynamic = "force-dynamic";

export default async function Dashboard() {
  const session = await getServerSession(authOptions);
  const [cases, scenarios] = await Promise.all([
    listCaseSessionsForUser(session.user.id),
    Promise.resolve(listScenarioOptions()),
  ]);

  return (
    <DashboardHub
      initialCases={cases}
      scenarios={scenarios}
      userName={session.user?.name || session.user?.email}
    />
  );
}
