import { NextResponse } from "next/server";
import { getRequestSession } from "@/libs/api-auth";
import connectMongo from "@/libs/mongoose";
import CaseSession from "@/models/CaseSession";
import EmailNudgeLog from "@/models/EmailNudgeLog";
import User from "@/models/User";
import Challenge from "@/models/Challenge";
import AwardEvaluation from "@/models/AwardEvaluation";
import AwardOccurrence from "@/models/AwardOccurrence";
import PlayerAward from "@/models/PlayerAward";
import PlayerCareerStats from "@/models/PlayerCareerStats";
import PlayerLawyerTitle from "@/models/PlayerLawyerTitle";
import { evaluateCompletedChallenge } from "@/libs/game/awards/service";
import { userCanAccessArena } from "@/libs/admin";
import {
  getDefaultProgression,
  normalizeProgression,
} from "@/libs/game/progression";
import {
  getDefaultDashboardEncouragementNote,
  getDefaultLawyerProfileSummary,
} from "@/libs/game/profileSummary";

const RESET_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000;

export async function POST(req) {
  const { session, error: authError } = await getRequestSession(req);
  if (authError) return authError;

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
    await connectMongo();

    const user = await User.findById(session.user.id);

    if (!user) {
      return NextResponse.json({ error: "Player profile not found." }, { status: 404 });
    }

    const lastResetAt = user.lastGameplayResetAt
      ? new Date(user.lastGameplayResetAt)
      : null;
    const resetAvailableAt =
      lastResetAt && Number.isFinite(lastResetAt.getTime())
        ? new Date(lastResetAt.getTime() + RESET_COOLDOWN_MS)
        : null;

    if (resetAvailableAt && resetAvailableAt > new Date()) {
      return NextResponse.json(
        {
          error: "Fresh Start is resting. Try again after the cooldown.",
          resetAvailableAt: resetAvailableAt.toISOString(),
        },
        { status: 429 }
      );
    }

    const [caseResult, nudgeResult] = await Promise.all([
      CaseSession.deleteMany({ userId: session.user.id }),
      EmailNudgeLog.deleteMany({ userId: session.user.id }),
      AwardEvaluation.deleteMany({ playerId: session.user.id }),
      AwardOccurrence.deleteMany({ playerId: session.user.id }),
      PlayerAward.deleteMany({ playerId: session.user.id }),
      PlayerCareerStats.deleteMany({ playerId: session.user.id }),
      PlayerLawyerTitle.deleteMany({ playerId: session.user.id }),
    ]);

    user.progression = normalizeProgression(getDefaultProgression());
    user.lawyerProfileSummary = getDefaultLawyerProfileSummary(
      user.name || user.email?.split("@")[0] || "This lawyer"
    );
    user.lawyerProfileSummarySource = "default";
    user.dashboardEncouragementNote = getDefaultDashboardEncouragementNote(
      user.name || user.email?.split("@")[0] || "Counsel"
    );
    user.dashboardEncouragementNoteSource = "default";
    user.dashboardEncouragementNoteUpdatedAt = new Date();
    user.lastGameplayResetAt = new Date();
    user.selectedLawyerTitleId = null;
    await user.save();

    const retainedChallenges = await Challenge.find({
      "participants.userId": session.user.id,
      status: { $in: ["verdict", "settled"] },
    }).sort({ completedAt: 1 });
    for (const challenge of retainedChallenges) {
      try {
        const contexts = await evaluateCompletedChallenge({
          challenge,
          skipProgression: true,
          evaluationSource: "backfill",
        });
        void contexts;
      } catch (awardError) {
        console.error("Fresh Start PVP award rebuild failed", {
          challengeId: String(challenge._id),
          error: awardError.message,
        });
      }
    }

    return NextResponse.json({
      ok: true,
      deletedCases: caseResult.deletedCount || 0,
      deletedNudges: nudgeResult.deletedCount || 0,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
