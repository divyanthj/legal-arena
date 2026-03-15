import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/libs/next-auth";
import { runCourtroomRound } from "@/libs/game/engine";
import { applyVerdictToProgression } from "@/libs/game/progression";
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
      caseSession.verdict = {
        winner: result.verdict.winner,
        summary: result.verdict.summary,
        highlights: result.verdict.highlights,
        concerns: result.verdict.concerns,
        finalScore: {
          player: caseSession.score.player,
          opponent: caseSession.score.opponent,
        },
      };

      await applyVerdictToProgression({
        userId: session.user.id,
        primaryCategory: caseSession.primaryCategory,
        complexity: caseSession.complexity,
        verdictWinner: result.verdict.winner,
        highlights: result.verdict.highlights,
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
