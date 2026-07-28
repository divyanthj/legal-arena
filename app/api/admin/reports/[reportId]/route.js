import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { requireAdminSession } from "@/libs/admin-auth";
import connectMongo from "@/libs/mongoose";
import ContentReport from "@/models/ContentReport";

const statuses = new Set(["reviewing", "actioned", "dismissed"]);

export async function PATCH(req, { params }) {
  const { error: authError } = await requireAdminSession();
  if (authError) return authError;

  if (!mongoose.Types.ObjectId.isValid(params.reportId)) {
    return NextResponse.json({ error: "Report not found." }, { status: 404 });
  }

  const body = await req.json().catch(() => ({}));
  const status = String(body?.status || "");
  if (!statuses.has(status)) {
    return NextResponse.json({ error: "Choose a valid review status." }, { status: 400 });
  }

  await connectMongo();
  const report = await ContentReport.findByIdAndUpdate(
    params.reportId,
    {
      $set: {
        status,
        resolutionNote: String(body?.resolutionNote || "").trim().slice(0, 1000),
        resolvedAt: ["actioned", "dismissed"].includes(status) ? new Date() : null,
      },
    },
    { new: true }
  ).select("_id status resolvedAt");

  if (!report) {
    return NextResponse.json({ error: "Report not found." }, { status: 404 });
  }

  return NextResponse.json({ report });
}

