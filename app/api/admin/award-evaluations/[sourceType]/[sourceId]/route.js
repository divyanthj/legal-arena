import { NextResponse } from "next/server";
import { requireAdminSession } from "@/libs/admin-auth";
import AwardEvaluation from "@/models/AwardEvaluation";
import CaseSession from "@/models/CaseSession";
import Challenge from "@/models/Challenge";
import { evaluateCompletedCase, evaluateCompletedChallenge, processAwardEvaluation } from "@/libs/game/awards/service";

export async function GET(req, { params }) {
  const { error } = await requireAdminSession();
  if (error) return error;
  const evaluations = await AwardEvaluation.find({ sourceType: params.sourceType, sourceId: params.sourceId })
    .select("+objectiveMatched +aiProposed +rejected +errorMessage")
    .sort({ createdAt: -1 }).lean();
  return NextResponse.json({ evaluations });
}

export async function POST(req, { params }) {
  const { error } = await requireAdminSession();
  if (error) return error;
  try {
    await AwardEvaluation.updateMany({ sourceType: params.sourceType, sourceId: params.sourceId }, { $set: { status: "pending", completedAt: null, nextRetryAt: new Date(), errorCode: "", errorMessage: "" } });
    if (params.sourceType === "case") {
      const source = await CaseSession.findById(params.sourceId).populate("caseTemplateId");
      if (!source) return NextResponse.json({ error: "Case not found" }, { status: 404 });
      await evaluateCompletedCase({ caseSession: source, skipProgression: true });
    } else if (params.sourceType === "challenge") {
      const source = await Challenge.findById(params.sourceId);
      if (!source) return NextResponse.json({ error: "Challenge not found" }, { status: 404 });
      await evaluateCompletedChallenge({ challenge: source, skipProgression: true });
    } else return NextResponse.json({ error: "Invalid source type" }, { status: 400 });
    const evaluations = await AwardEvaluation.find({ sourceType: params.sourceType, sourceId: params.sourceId }).select("+context");
    const results = [];
    for (const evaluation of evaluations) results.push(await processAwardEvaluation(evaluation));
    return NextResponse.json({ results });
  } catch (caught) {
    console.error(caught);
    return NextResponse.json({ error: caught.message }, { status: 500 });
  }
}

