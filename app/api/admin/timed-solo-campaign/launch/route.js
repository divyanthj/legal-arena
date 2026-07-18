import { NextResponse } from "next/server";
import { requireAdminSession } from "@/libs/admin-auth";
import { launchTimedSoloCampaign } from "@/libs/adminOps";

export async function POST(req) {
  const { error } = await requireAdminSession();
  if (error) return error;

  try {
    const body = await req.json();
    const durationHours = Number.parseInt(body?.durationHours, 10);

    if (!Number.isFinite(durationHours) || durationHours <= 0) {
      return NextResponse.json(
        { error: "Duration must be a positive number of hours." },
        { status: 400 }
      );
    }

    const timedSoloCampaign = await launchTimedSoloCampaign({ durationHours });
    return NextResponse.json({ timedSoloCampaign }, { status: 201 });
  } catch (error) {
    console.error("Failed to launch timed solo campaign:", error);
    return NextResponse.json(
      { error: error.message || "Failed to launch timed solo campaign." },
      { status: 500 }
    );
  }
}
