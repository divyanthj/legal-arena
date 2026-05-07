import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/libs/next-auth";
import {
  assessCaseSuccessChance,
  finalizeFactSheetInput,
  lockAssessmentForCourt,
} from "@/libs/game/engine";
import {
  buildPlaintiffCourtOpeningStatement,
  buildCasePayload,
  getCaseSessionDocumentForUser,
} from "@/libs/game/store";
import { userCanAccessArena } from "@/libs/admin";

export async function POST(req, { params }) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }
  if (!(await userCanAccessArena(session))) {
    return NextResponse.json(
      { error: "Legal Arena is still in development. Access is currently limited." },
      { status: 403 }
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

    if (caseSession.status !== "interview") {
      return NextResponse.json(
        { error: "This case is already in court." },
        { status: 400 }
      );
    }

    const finalized = finalizeFactSheetInput({
      factSheet: body?.factSheet || caseSession.factSheet,
      caseTemplate: caseSession.caseTemplateId,
    });

    if (finalized.missing.length) {
      return NextResponse.json(
        {
          error: `The fact sheet is not ready yet. Add ${finalized.missing.join(
            ", "
          )}.`,
        },
        { status: 400 }
      );
    }

    caseSession.factSheet = finalized.factSheet;
    let assessmentToLock = caseSession.caseAssessment;

    if (assessmentToLock?.currentSuccessChance === null || assessmentToLock?.currentSuccessChance === undefined) {
      assessmentToLock = await assessCaseSuccessChance({
        userId: session.user.id,
        caseSession,
        factSheet: finalized.factSheet,
        previousAssessment: caseSession.caseAssessment,
      });
    }

    const lockedAssessment = lockAssessmentForCourt(assessmentToLock);
    if (lockedAssessment) {
      caseSession.caseAssessment = lockedAssessment;
    }
    caseSession.status = "courtroom";

    if (
      caseSession.playerSide === "opponent" &&
      !caseSession.courtroomTranscript?.length
    ) {
      caseSession.courtroomTranscript.push({
        round: 1,
        speaker: "opponent",
        text: buildPlaintiffCourtOpeningStatement(caseSession.caseTemplateId),
        citedFacts: [],
        citedClaimIds: [],
        citedRules: [],
        judgeNotes: {
          playerDelta: 0,
          opponentDelta: 0,
          strengths: [],
          weaknesses: [],
          benchSignal: "",
        },
      });
    }

    await caseSession.save();

    return NextResponse.json({
      caseSession: buildCasePayload(caseSession),
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
