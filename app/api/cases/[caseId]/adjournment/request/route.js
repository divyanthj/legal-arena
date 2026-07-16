import { NextResponse } from "next/server";
import { getRequestSession } from "@/libs/api-auth";
import { getSoloGameplayAccessForSession } from "@/libs/admin";
import { evaluateCourtAdjournment } from "@/libs/game/engine";
import {
  getAdjournmentRound,
  hasAdjournmentRequestForRound,
  recordAdjournmentDecision,
} from "@/libs/game/adjournment";
import {
  buildCasePayload,
  getCaseSessionDocumentForUser,
} from "@/libs/game/store";
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
    const reason = String(body?.reason || "").trim();
    if (!reason) {
      return NextResponse.json(
        { error: "Explain why an adjournment is needed." },
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
    if (caseSession.status !== "courtroom" || caseSession.adjournment?.active) {
      return NextResponse.json(
        { error: "An adjournment may only be requested while court is in session." },
        { status: 400 }
      );
    }

    const courtroomRound = getAdjournmentRound(caseSession);
    if (
      hasAdjournmentRequestForRound({
        adjournment: caseSession.adjournment,
        round: courtroomRound,
        requestedByUserId: session.user.id,
      })
    ) {
      return NextResponse.json(
        { error: "You already requested an adjournment this round." },
        { status: 409 }
      );
    }

    const ruling = await evaluateCourtAdjournment({
      caseSession,
      userId: session.user.id,
      reason,
      requested: true,
    });
    recordAdjournmentDecision({
      source: caseSession,
      trigger: "player_request",
      requestedByUserId: session.user.id,
      courtroomRound,
      reason,
      ruling: ruling.ruling,
      granted: ruling.granted,
    });
    appendUsageEntriesToCaseSession(caseSession, ruling.usageEntries);

    if (ruling.granted) {
      caseSession.status = "interview";
      caseSession.factSheet.ready = false;
      caseSession.caseAssessment.lockedCourtEntryChance = null;
      caseSession.caseAssessment.lockedReasons = [];
      caseSession.caseAssessment.lockedAt = null;
      caseSession.maxCourtRounds += 1;
    }

    await caseSession.save();
    return NextResponse.json({
      caseSession: buildCasePayload(caseSession),
      adjournmentRuling: {
        granted: ruling.granted,
        ruling: ruling.ruling,
        curableGap: ruling.curableGap,
      },
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: error.message },
      { status: error.status || 500 }
    );
  }
}
