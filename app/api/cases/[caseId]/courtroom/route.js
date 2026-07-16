import { NextResponse } from "next/server";
import { getRequestSession } from "@/libs/api-auth";
import {
  evaluateCourtAdjournment,
  runCourtroomRound,
} from "@/libs/game/engine";
import { evaluateCompletedCase } from "@/libs/game/awards/service";
import {
  buildCasePayload,
  getCaseSessionDocumentForUser,
} from "@/libs/game/store";
import { appendUsageEntriesToCaseSession } from "@/libs/game/sessionUsage";
import { ensurePlaintiffCourtOpening } from "@/libs/game/courtroomOpening";
import { getSoloGameplayAccessForSession } from "@/libs/admin";
import {
  getAdjournmentRemaining,
  recordAdjournmentDecision,
} from "@/libs/game/adjournment";

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
    const argument = body?.argument?.trim();

    if (!argument) {
      return NextResponse.json(
        { error: "A courtroom argument is required." },
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

    if (caseSession.status === "interview") {
      return NextResponse.json(
        { error: "Finalize the fact sheet before entering court." },
        { status: 400 }
      );
    }

    if (caseSession.status === "verdict") {
      return NextResponse.json(
        { error: "This case already has a final verdict." },
        { status: 400 }
      );
    }

    const openingResult = await ensurePlaintiffCourtOpening({
      caseSession,
      userId: session.user.id,
    });
    appendUsageEntriesToCaseSession(caseSession, openingResult.usageEntries);

    const round = caseSession.score.roundsCompleted + 1;
    const result = await runCourtroomRound({
      caseSession,
      argument,
      userId: session.user.id,
    });

    caseSession.courtroomTranscript.push({
      round,
      speaker: "player",
      text: argument,
      citedFacts: result.citedFacts,
      citedClaimIds: result.citedClaimIds,
      citedEvidenceIds: result.citedEvidenceIds,
      citedRules: result.citedRules,
      judgeNotes: {
        playerDelta: result.playerDelta,
        opponentDelta: result.opponentDelta,
        strengths: result.strengths,
        weaknesses: result.weaknesses,
        benchSignal: result.benchSignal,
      },
    });
    caseSession.courtroomTranscript.push({
      round,
      speaker: "opponent",
      text: result.opponentResponse,
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

    caseSession.score.player += result.playerDelta;
    caseSession.score.opponent += result.opponentDelta;
    caseSession.score.roundsCompleted = round;
    caseSession.score.lastBenchSignal = result.benchSignal;
    caseSession.score.highlights = result.strengths;
    caseSession.score.weaknesses = result.weaknesses;

    if (result.verdict) {
      caseSession.status = "verdict";
      caseSession.completedAt = caseSession.completedAt || new Date();
      caseSession.verdict = {
        winner: result.verdict.winner,
        summary: result.verdict.summary,
        highlights: result.verdict.highlights,
        concerns: result.verdict.concerns,
        outcomeMetrics: result.verdict.outcomeMetrics,
        finalScore: {
          player: caseSession.score.player,
          opponent: caseSession.score.opponent,
        },
      };

    }

    appendUsageEntriesToCaseSession(caseSession, result.usageEntries);

    let awardEvaluation = null;
    let automaticAdjournment = null;
    if (
      !result.verdict &&
      getAdjournmentRemaining(caseSession.adjournment, caseSession.complexity) > 0
    ) {
      automaticAdjournment = await evaluateCourtAdjournment({
        caseSession,
        userId: session.user.id,
        requested: false,
      });
      appendUsageEntriesToCaseSession(
        caseSession,
        automaticAdjournment.usageEntries
      );

      if (automaticAdjournment.granted) {
        recordAdjournmentDecision({
          source: caseSession,
          trigger: "judge",
          courtroomRound: round,
          reason: automaticAdjournment.curableGap,
          ruling: automaticAdjournment.ruling,
          granted: true,
        });
        caseSession.status = "interview";
        caseSession.factSheet.ready = false;
        caseSession.caseAssessment.lockedCourtEntryChance = null;
        caseSession.caseAssessment.lockedReasons = [];
        caseSession.caseAssessment.lockedAt = null;
        caseSession.maxCourtRounds += 1;
      }
    }

    if (result.verdict && !automaticAdjournment?.granted) {
      await caseSession.save();
      try {
        awardEvaluation = await evaluateCompletedCase({
          caseSession,
          userProfile: session.user,
        });
      } catch (awardError) {
        console.error("Post-verdict award evaluation failed", awardError);
      }
    } else {
      await caseSession.save();
    }

    return NextResponse.json({
      caseSession: buildCasePayload(caseSession),
      adjournmentRuling: automaticAdjournment?.granted
        ? {
            granted: true,
            ruling: automaticAdjournment.ruling,
            curableGap: automaticAdjournment.curableGap,
          }
        : null,
      awardEvaluation: awardEvaluation
        ? { status: awardEvaluation.status, changes: awardEvaluation.immediateChanges || [] }
        : null,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
