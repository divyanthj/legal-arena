import { NextResponse } from "next/server";
import { requireAdminSession } from "@/libs/admin-auth";
import { disableTimedSoloCampaign } from "@/libs/adminOps";

export async function DELETE() {
  const { error } = await requireAdminSession();
  if (error) return error;

  try {
    const timedSoloCampaign = await disableTimedSoloCampaign();
    return NextResponse.json({ timedSoloCampaign });
  } catch (error) {
    console.error("Failed to disable timed solo campaign:", error);
    return NextResponse.json(
      { error: error.message || "Failed to disable timed solo campaign." },
      { status: 500 }
    );
  }
}
