import { NextResponse } from "next/server";
import { getRequestSession } from "@/libs/api-auth";
import { getSoloGameplayAccessForSession } from "@/libs/admin";
import {
  buildCasePayload,
  getCaseSessionDocumentForUser,
} from "@/libs/game/store";
import {
  applyPrivateClientHuddleMood,
  previewSettlementDraftForClient,
} from "@/libs/game/settlement";
import { appendUsageEntriesToCaseSession } from "@/libs/game/sessionUsage";

export async function POST(req, { params }) {
  const { session, error: authError } = await getRequestSession(req);
  if (authError) return authError;

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const access = await getSoloGameplayAccessForSession({
    session,
    caseId: params.caseId,
    action: "play",
  });
  if (!access.allowed) {
    return NextResponse.json(
      { error: access.message },
      { status: access.status || 403 }
    );
  }

  try {
    const body = await req.json();
    const caseSession = await getCaseSessionDocumentForUser({
      userId: session.user.id,
      caseId: params.caseId,
    });

    if (!caseSession) {
      return NextResponse.json({ error: "Case not found" }, { status: 404 });
    }

    if (caseSession.primaryCategory === "criminal") {
      return NextResponse.json(
        { error: "Criminal cases cannot be settled." },
        { status: 400 }
      );
    }

    if (caseSession.status !== "settlement") {
      return NextResponse.json(
        { error: "This case is not in settlement negotiations." },
        { status: 400 }
      );
    }

    const result = await previewSettlementDraftForClient({
      caseSession,
      offerTerms: body?.terms || {},
      message: body?.message || "",
      clientInstruction: body?.clientInstruction || "",
      userId: session.user.id,
    });
    const huddleResult = applyPrivateClientHuddleMood({
      caseSession,
      preview: result.preview,
    });

    caseSession.settlement = huddleResult.settlement;
    caseSession.markModified?.("settlement");

    appendUsageEntriesToCaseSession(caseSession, result.usageEntries);
    await caseSession.save();

    return NextResponse.json({
      preview: result.preview,
      moodUpdate: huddleResult.moodUpdate,
      caseSession: buildCasePayload(caseSession),
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
