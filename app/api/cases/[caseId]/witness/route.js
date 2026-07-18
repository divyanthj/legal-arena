import { NextResponse } from "next/server";
import { getRequestSession } from "@/libs/api-auth";
import { getSoloGameplayAccessForSession } from "@/libs/admin";
import {
  buildCasePayload,
  getCaseSessionDocumentForUser,
} from "@/libs/game/store";
import { appendUsageEntriesToCaseSession } from "@/libs/game/sessionUsage";
import {
  askWitnessQuestion,
  endWitnessExamination,
  ensureCaseWitnesses,
  startWitnessExamination,
} from "@/libs/game/witnesses";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request, { params }) {
  const { session, error: authError } = await getRequestSession(request);
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
    const body = await request.json();
    const action = String(body?.action || "").trim().toLowerCase();
    const caseSession = await getCaseSessionDocumentForUser({
      userId: session.user.id,
      caseId: params.caseId,
    });

    if (!caseSession) {
      return NextResponse.json({ error: "Case not found" }, { status: 404 });
    }
    if (caseSession.status !== "courtroom") {
      return NextResponse.json(
        { error: "Witness examination is available only while court is in session." },
        { status: 400 }
      );
    }

    const rosterResult = await ensureCaseWitnesses({
      caseSession,
      userId: session.user.id,
    });
    appendUsageEntriesToCaseSession(caseSession, rosterResult.usageEntries);

    let result;
    if (action === "call") {
      result = await startWitnessExamination({
        caseSession,
        witnessId: body?.witnessId,
        userId: session.user.id,
      });
    } else if (action === "question") {
      result = await askWitnessQuestion({
        caseSession,
        question: body?.question,
        userId: session.user.id,
      });
    } else if (action === "end") {
      result = await endWitnessExamination({
        caseSession,
        userId: session.user.id,
      });
    } else {
      return NextResponse.json(
        { error: "Choose call, question, or end for the witness action." },
        { status: 400 }
      );
    }

    if (result.entries?.length) {
      caseSession.courtroomTranscript.push(...result.entries);
    }
    appendUsageEntriesToCaseSession(caseSession, result.usageEntries);
    await caseSession.save();

    return NextResponse.json({
      ok: true,
      caseSession: buildCasePayload(caseSession),
    });
  } catch (error) {
    console.error("Witness examination failed", error);
    return NextResponse.json(
      { error: error?.message || "Could not continue witness examination." },
      { status: 500 }
    );
  }
}

