import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/libs/next-auth";
import { continueInterview } from "@/libs/game/engine";
import {
  buildCasePayload,
  getCaseSessionDocumentForUser,
} from "@/libs/game/store";

export async function POST(req, { params }) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const question = body?.question?.trim();

    if (!question) {
      return NextResponse.json(
        { error: "A client question is required." },
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
        { error: "This case has already moved beyond the client interview." },
        { status: 400 }
      );
    }

    const result = await continueInterview({
      caseSession,
      question,
      userId: session.user.id,
    });

    caseSession.interviewTranscript.push({
      role: "player",
      speaker: "You",
      text: question,
    });
    caseSession.interviewTranscript.push({
      role: "client",
      speaker: caseSession.premise.clientName,
      text: result.clientResponse,
    });
    caseSession.factSheet = result.nextFactSheet;

    await caseSession.save();

    return NextResponse.json({
      caseSession: buildCasePayload(caseSession),
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
