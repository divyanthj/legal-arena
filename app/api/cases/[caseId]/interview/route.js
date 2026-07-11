import { NextResponse } from "next/server";
import { getRequestSession } from "@/libs/api-auth";
import { continueInterview } from "@/libs/game/engine";
import {
  applyClientMemoryOpeningToCaseSession,
  buildCasePayload,
  getCaseSessionDocumentForUser,
} from "@/libs/game/store";
import { appendUsageEntriesToCaseSession } from "@/libs/game/sessionUsage";
import { getSoloGameplayAccessForSession } from "@/libs/admin";

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
    const question = body?.question?.trim();

    if (!question) {
      return NextResponse.json(
        { error: "A party question is required." },
        { status: 400 }
      );
    }

    const caseSession = await getCaseSessionDocumentForUser({
      userId: session.user.id,
      caseId: params.caseId,
    });

    if (!caseSession) {
      return NextResponse.json({ error: "Case not found" }, { status: 404 });
    }

    if (caseSession.status !== "interview") {
      return NextResponse.json(
        { error: "This case has already moved beyond the interview stage." },
        { status: 400 }
      );
    }

    const result = await continueInterview({
      caseSession,
      question,
      userId: session.user.id,
    });

    if (result.clientMemory) {
      caseSession.clientMemory = result.clientMemory;
      caseSession.markModified?.("clientMemory");
    }
    if (result.clientMemoryExcerpt) {
      caseSession.clientMemoryExcerpt = result.clientMemoryExcerpt;
      applyClientMemoryOpeningToCaseSession(
        caseSession,
        result.clientMemory || caseSession.clientMemory,
        result.clientMemoryExcerpt
      );
    }

    caseSession.interviewTranscript.push({
      role: "player",
      speaker: "You",
      text: question,
      sourceType: "question",
      relatedFactIds: [],
    });
    caseSession.interviewTranscript.push({
      role: "party",
      speaker:
        result.interviewSubjectName ||
        (caseSession.playerSide === "opponent"
          ? caseSession.premise.opponentName
          : caseSession.premise.clientName),
      text: result.partyResponse,
      sourceType: "claim",
      relatedFactIds: result.relatedFactIds || [],
    });
    caseSession.factSheet = result.nextFactSheet;
    if (result.caseAssessment) {
      caseSession.caseAssessment = result.caseAssessment;
    }
    appendUsageEntriesToCaseSession(caseSession, result.usageEntries);

    await caseSession.save();

    return NextResponse.json({
      caseSession: buildCasePayload(caseSession),
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
