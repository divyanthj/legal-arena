import { notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/libs/next-auth";
import CaseWorkspace from "@/components/legal-arena/CaseWorkspace";
import { getCaseSessionForUser } from "@/libs/game/store";

export const dynamic = "force-dynamic";

export default async function CasePage({ params }) {
  const session = await getServerSession(authOptions);
  const caseSession = await getCaseSessionForUser({
    userId: session.user.id,
    caseId: params.caseId,
  });

  if (!caseSession) {
    notFound();
  }

  return <CaseWorkspace initialCase={caseSession} />;
}
