import { NextResponse } from "next/server";
import { getRequestSession } from "@/libs/api-auth";
import AwardDefinition from "@/models/AwardDefinition";
import AwardOccurrence from "@/models/AwardOccurrence";

export async function GET(req, { params }) {
  const { session, error } = await getRequestSession(req);
  if (error) return error;
  try {
    const definition = await AwardDefinition.findOne({ code: params.awardCode }).lean();
    if (!definition) return NextResponse.json({ error: "Award not found" }, { status: 404 });
    const owner = String(session?.user?.id || "") === String(params.playerId);
    const { searchParams } = new URL(req.url);
    const limit = Math.max(1, Math.min(50, Number(searchParams.get("limit")) || 20));
    const cursor = searchParams.get("cursor");
    const query = { playerId: params.playerId, awardDefinitionId: definition._id };
    if (cursor && !Number.isNaN(new Date(cursor).getTime())) query.earnedAt = { $lt: new Date(cursor) };
    const occurrences = await AwardOccurrence.find(query).sort({ earnedAt: -1 }).limit(limit + 1).lean();
    const page = occurrences.slice(0, limit).map((item) => ({ id: String(item._id), caseId: item.caseId, sourceType: item.sourceType, tierAtTime: item.tierAtTime, evaluationSource: item.evaluationSource, confidence: owner ? item.confidence : undefined, evidenceText: owner ? item.evidenceText : definition.description, earnedAt: item.earnedAt }));
    return NextResponse.json({ occurrences: page, nextCursor: occurrences.length > limit ? page.at(-1)?.earnedAt : null });
  } catch (caught) {
    console.error(caught);
    return NextResponse.json({ error: caught.message }, { status: 500 });
  }
}
