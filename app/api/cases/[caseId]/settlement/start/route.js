import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/libs/next-auth";
import { getSoloGameplayAccessForSession } from "@/libs/admin";
import {
  buildCasePayload,
  getCaseSessionDocumentForUser,
} from "@/libs/game/store";
import {
  getSettlementCooldownState,
  runSettlementExchange,
} from "@/libs/game/settlement";
import { hasClientSettlementAuthority } from "@/libs/game/settlementAuthority";
import { appendUsageEntriesToCaseSession } from "@/libs/game/sessionUsage";
import { applySettlementToProgression } from "@/libs/game/progression";

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
    const message = String(body?.message || "").trim();

    if (!message) {
      return NextResponse.json(
        { error: "A settlement message is required." },
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

    if (caseSession.primaryCategory === "criminal") {
      return NextResponse.json(
        { error: "Criminal cases cannot be settled." },
        { status: 400 }
      );
    }

    if (caseSession.status !== "interview") {
      return NextResponse.json(
        { error: "Settlements can only be opened during intake." },
        { status: 400 }
      );
    }

    if (!hasClientSettlementAuthority(caseSession.interviewTranscript)) {
      return NextResponse.json(
        {
          error:
            "Ask your client if they are willing to settle this out of court before opening settlement talks.",
        },
        { status: 400 }
      );
    }

    const cooldown = getSettlementCooldownState(caseSession.settlement || {});
    if (cooldown.active) {
      return NextResponse.json(
        {
          error: "Settlement talks are cooling down after the last rejection.",
          cooldownUntil: cooldown.cooldownUntil?.toISOString() || null,
        },
        { status: 429 }
      );
    }

    const result = await runSettlementExchange({
      caseSession,
      message,
      userId: session.user.id,
      initial: true,
    });

    caseSession.settlement = result.settlement;
    caseSession.markModified?.("settlement");
    appendUsageEntriesToCaseSession(caseSession, result.usageEntries);

    if (result.settled) {
      caseSession.status = "settled";
      caseSession.completedAt = caseSession.completedAt || new Date();
      await applySettlementToProgression({
        userId: session.user.id,
        userProfile: session.user,
        primaryCategory: caseSession.primaryCategory,
        complexity: caseSession.complexity,
        finalMoods: result.settlement.moods,
        caseTitle: caseSession.title,
        outcomeSummary: result.settlement.outcomeSummary,
      });
    } else if (!result.rejected && !result.failed) {
      caseSession.status = "settlement";
    }

    await caseSession.save();

    return NextResponse.json({
      caseSession: buildCasePayload(caseSession),
      rejected: result.rejected,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
