import { notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/libs/next-auth";
import CaseWorkspace from "@/components/legal-arena/CaseWorkspace";
import DevelopmentAccessGate from "@/components/legal-arena/DevelopmentAccessGate";
import { getCaseSessionForUser } from "@/libs/game/store";
import { getSoloGameplayAccessForSession } from "@/libs/admin";
import { toClientJSON } from "@/libs/serialize";

export const dynamic = "force-dynamic";

export default async function CasePage({ params }) {
  const session = await getServerSession(authOptions);

  const access = await getSoloGameplayAccessForSession({
    session,
    caseId: params.caseId,
    action: "read",
  });
  if (!access.allowed) {
    return <DevelopmentAccessGate email={session.user?.email || ""} />;
  }

  const caseSession = await getCaseSessionForUser({
    userId: session.user.id,
    caseId: params.caseId,
  });

  if (!caseSession) {
    notFound();
  }

  return <CaseWorkspace initialCase={toClientJSON(caseSession)} />;
}
