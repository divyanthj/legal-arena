import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/libs/next-auth";
import { getSoloGameplayAccessForSession } from "@/libs/admin";
import { getCaseSessionDocumentForUser } from "@/libs/game/store";
import { previewSettlementDraftForClient } from "@/libs/game/settlement";
import { appendUsageEntriesToCaseSession } from "@/libs/game/sessionUsage";

export async function POST(req, { params }) {
  const session = await getServerSession(authOptions);

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
      draftTerms: body?.terms || {},
      message: body?.message || "",
      clientInstruction: body?.clientInstruction || "",
      userId: session.user.id,
    });

    appendUsageEntriesToCaseSession(caseSession, result.usageEntries);
    await caseSession.save();

    return NextResponse.json({ preview: result.preview });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
