import { notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/libs/next-auth";
import CaseWorkspace from "@/components/legal-arena/CaseWorkspace";
import DevelopmentAccessGate from "@/components/legal-arena/DevelopmentAccessGate";
import {
  buildCasePayload,
  getCaseSessionDocumentForUser,
} from "@/libs/game/store";
import { ensurePlaintiffCourtOpening } from "@/libs/game/courtroomOpening";
import { appendUsageEntriesToCaseSession } from "@/libs/game/sessionUsage";
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

  const caseDocument = await getCaseSessionDocumentForUser({
    userId: session.user.id,
    caseId: params.caseId,
  });

  if (!caseDocument) {
    notFound();
  }

  const openingResult = await ensurePlaintiffCourtOpening({
    caseSession: caseDocument,
    userId: session.user.id,
  });
  if (openingResult.created) {
    appendUsageEntriesToCaseSession(caseDocument, openingResult.usageEntries);
    await caseDocument.save();
  }
  const caseSession = buildCasePayload(caseDocument);

  return (
    <CaseWorkspace
      initialCase={toClientJSON(caseSession)}
      apiConfig={{ playerId: session.user.id }}
    />
  );
}
