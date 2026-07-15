import { NextResponse } from "next/server";
import { getRequestSession } from "@/libs/api-auth";
import AwardEvaluation from "@/models/AwardEvaluation";

export async function GET(req, { params }) {
  const { session, error } = await getRequestSession(req);
  if (error) return error;
  if (!session?.user?.id) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const evaluation = await AwardEvaluation.findOne({ playerId: session.user.id, sourceType: params.sourceType, sourceId: params.sourceId }).sort({ createdAt: -1 }).lean();
  if (!evaluation) return NextResponse.json({ status: "not_started", changes: [] });
  return NextResponse.json({ status: evaluation.status, changes: evaluation.awardChanges || [], completedAt: evaluation.completedAt || null });
}

