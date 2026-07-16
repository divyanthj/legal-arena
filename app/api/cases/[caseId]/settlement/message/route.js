import { NextResponse } from "next/server";
import { getRequestSession } from "@/libs/api-auth";
import { getSoloGameplayAccessForSession } from "@/libs/admin";
import {
  buildCasePayload,
  getCaseSessionDocumentForUser,
} from "@/libs/game/store";
import {
  acceptLatestSoloSettlementOffer,
  runSettlementExchange,
} from "@/libs/game/settlement";
import { appendUsageEntriesToCaseSession } from "@/libs/game/sessionUsage";
import { evaluateCompletedCase } from "@/libs/game/awards/service";

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

    if (caseSession.status !== "settlement") {
      return NextResponse.json(
        { error: "This case is not in settlement negotiations." },
        { status: 400 }
      );
    }

    const result = body?.acceptTerms === true
      ? acceptLatestSoloSettlementOffer({
          caseSession,
          message,
          userId: session.user.id,
        })
      : await runSettlementExchange({
          caseSession,
          message,
          userId: session.user.id,
          terms: body?.terms || {},
        });

    caseSession.settlement = result.settlement;
    caseSession.markModified?.("settlement");
    appendUsageEntriesToCaseSession(caseSession, result.usageEntries);

    if (result.settled) {
      caseSession.status = "settled";
      caseSession.completedAt = caseSession.completedAt || new Date();
    } else if (result.failed) {
      caseSession.status = "interview";
    }

    await caseSession.save();
    let awardEvaluation = null;
    if (result.settled) {
      try {
        awardEvaluation = await evaluateCompletedCase({ caseSession, userProfile: session.user });
      } catch (awardError) {
        console.error("Post-settlement award evaluation failed", awardError);
      }
    }

    return NextResponse.json({
      caseSession: buildCasePayload(caseSession),
      awardEvaluation: awardEvaluation
        ? { status: awardEvaluation.status, changes: awardEvaluation.immediateChanges || [] }
        : null,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: error.message },
      { status: Number(error?.status) || 500 }
    );
  }
}
