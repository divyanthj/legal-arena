import { NextResponse } from "next/server";
import { getRequestSession } from "@/libs/api-auth";
import {
  buildCasePayload,
  getCaseSessionDocumentForUser,
} from "@/libs/game/store";
import { getSoloGameplayAccessForSession } from "@/libs/admin";
import { ensureCaseWitnesses } from "@/libs/game/witnesses";
import { appendUsageEntriesToCaseSession } from "@/libs/game/sessionUsage";

export async function GET(req, { params }) {
  const { session, error: authError } = await getRequestSession(req);
  if (authError) return authError;

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }
  const access = await getSoloGameplayAccessForSession({
    session,
    caseId: params.caseId,
    action: "read",
  });
  if (!access.allowed) {
    return NextResponse.json(
      { error: access.message },
      { status: access.status || 403 }
    );
  }

  try {
    const caseSession = await getCaseSessionDocumentForUser({
      userId: session.user.id,
      caseId: params.caseId,
    });

    if (!caseSession) {
      return NextResponse.json({ error: "Case not found" }, { status: 404 });
    }

    if (caseSession.status === "courtroom" && !(caseSession.witnesses || []).length) {
      const witnessResult = await ensureCaseWitnesses({
        caseSession,
        userId: session.user.id,
      });
      appendUsageEntriesToCaseSession(caseSession, witnessResult.usageEntries);
      await caseSession.save();
    }

    return NextResponse.json({ caseSession: buildCasePayload(caseSession) });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
