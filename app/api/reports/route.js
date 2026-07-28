import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { getRequestSession } from "@/libs/api-auth";
import connectMongo from "@/libs/mongoose";
import CaseSession from "@/models/CaseSession";
import Challenge from "@/models/Challenge";
import ContentReport from "@/models/ContentReport";

const categories = new Set([
  "offensive",
  "harassment",
  "sexual",
  "violence",
  "self_harm",
  "child_safety",
  "deception",
  "privacy",
  "spam",
  "other",
]);
const reportTypes = new Set(["ai_content", "player_content", "player_conduct"]);

export async function POST(req) {
  const { session, error: authError } = await getRequestSession(req);
  if (authError) return authError;
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const sourceType = body?.sourceType === "challenge" ? "challenge" : "case";
  const sourceRef = String(body?.sourceId || "").trim();
  const reportType = String(body?.reportType || "");
  const category = String(body?.category || "");

  if (!sourceRef || !reportTypes.has(reportType) || !categories.has(category)) {
    return NextResponse.json({ error: "Complete the report fields." }, { status: 400 });
  }

  await connectMongo();

  let source;
  if (sourceType === "challenge") {
    const selectors = [{ slug: sourceRef }];
    if (mongoose.Types.ObjectId.isValid(sourceRef)) selectors.push({ _id: sourceRef });
    source = await Challenge.findOne({
      $and: [
        { $or: selectors },
        { "participants.userId": session.user.id },
      ],
    })
      .select("_id participants.userId")
      .lean();
  } else {
    if (!mongoose.Types.ObjectId.isValid(sourceRef)) {
      return NextResponse.json({ error: "Case not found." }, { status: 404 });
    }
    source = await CaseSession.findOne({
      _id: sourceRef,
      userId: session.user.id,
    })
      .select("_id userId")
      .lean();
  }

  if (!source) {
    return NextResponse.json({ error: "Matter not found for this account." }, { status: 404 });
  }

  let reportedUserId = null;
  if (sourceType === "challenge" && body?.reportedPlayerId) {
    const candidateId = String(body.reportedPlayerId);
    const isParticipant = (source.participants || []).some(
      (participant) => String(participant.userId) === candidateId
    );
    if (isParticipant && candidateId !== String(session.user.id)) {
      reportedUserId = candidateId;
    }
  }

  const report = await ContentReport.create({
    reporterUserId: session.user.id,
    reportedUserId,
    sourceType,
    sourceId: source._id,
    reportType,
    category,
    contextLabel: String(body?.contextLabel || "").trim().slice(0, 120),
    contentExcerpt: String(body?.contentExcerpt || "").trim().slice(0, 2000),
    details: String(body?.details || "").trim().slice(0, 2000),
  });

  return NextResponse.json(
    { reported: true, reportId: String(report._id) },
    { status: 201 }
  );
}
