import { NextResponse } from "next/server";
import { getRequestSession } from "@/libs/api-auth";
import {
  assessCaseSuccessChance,
  finalizeFactSheetInput,
  lockAssessmentForCourt,
} from "@/libs/game/engine";
import { ensurePlaintiffCourtOpening } from "@/libs/game/courtroomOpening";
import {
  buildCasePayload,
  getCaseSessionDocumentForUser,
} from "@/libs/game/store";
import {
  appendUsageEntriesToCaseSession,
  createUsageCollector,
} from "@/libs/game/sessionUsage";
import { getSoloGameplayAccessForSession } from "@/libs/admin";
import { resolveActiveAdjournment } from "@/libs/game/adjournment";
import { ensureCaseWitnesses } from "@/libs/game/witnesses";

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

    if (caseSession.status !== "interview") {
      return NextResponse.json(
        { error: "This case is already in court." },
        { status: 400 }
      );
    }

    const finalized = finalizeFactSheetInput({
      factSheet: body?.factSheet || caseSession.factSheet,
      caseTemplate: caseSession.caseTemplateId || caseSession.templateSnapshot,
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
    const usageCollector = createUsageCollector("courtroom");

    if (assessmentToLock?.currentSuccessChance === null || assessmentToLock?.currentSuccessChance === undefined) {
      assessmentToLock = await assessCaseSuccessChance({
        userId: session.user.id,
        caseSession,
        factSheet: finalized.factSheet,
        previousAssessment: caseSession.caseAssessment,
        usageLabel: "courtroom.assessment",
        onUsage: usageCollector.record,
      });
    }

    const lockedAssessment = lockAssessmentForCourt(assessmentToLock);
    if (lockedAssessment) {
      caseSession.caseAssessment = lockedAssessment;
    }
    caseSession.status = "courtroom";
    resolveActiveAdjournment(caseSession);

    const openingResult = await ensurePlaintiffCourtOpening({
      caseSession,
      userId: session.user.id,
    });
    openingResult.usageEntries.forEach(usageCollector.record);

    const witnessResult = await ensureCaseWitnesses({
      caseSession,
      userId: session.user.id,
    });
    witnessResult.usageEntries.forEach(usageCollector.record);

    appendUsageEntriesToCaseSession(caseSession, usageCollector.entries);

    await caseSession.save();

    return NextResponse.json({
      caseSession: buildCasePayload(caseSession),
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
