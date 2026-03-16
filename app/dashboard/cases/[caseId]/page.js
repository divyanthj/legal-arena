import { notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/libs/next-auth";
import CaseWorkspace from "@/components/legal-arena/CaseWorkspace";
import DevelopmentAccessGate from "@/components/legal-arena/DevelopmentAccessGate";
import { getCaseSessionForUser } from "@/libs/game/store";
import { hasGameAccess } from "@/libs/admin";

export const dynamic = "force-dynamic";

export default async function CasePage({ params }) {
  const session = await getServerSession(authOptions);

  if (!hasGameAccess(session.user?.email)) {
    return <DevelopmentAccessGate email={session.user?.email || ""} />;
  }

  const caseSession = await getCaseSessionForUser({
    userId: session.user.id,
    caseId: params.caseId,
  });

  if (!caseSession) {
    notFound();
  }

  return <CaseWorkspace initialCase={caseSession} />;
}
