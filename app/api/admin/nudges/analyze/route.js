import { NextResponse } from "next/server";
import { requireAdminSession } from "@/libs/admin-auth";
import { analyzeAdminNudges } from "@/libs/adminNudges";

export async function POST(req) {
  const { session, error } = await requireAdminSession();
  if (error) return error;

  try {
    const { playerId } = await req.json();
    if (!playerId) {
      return NextResponse.json({ error: "Player ID is required." }, { status: 400 });
    }
    const analysis = await analyzeAdminNudges({
      playerId,
      adminUserId: session.user.id,
    });
    return NextResponse.json(analysis);
  } catch (analysisError) {
    return NextResponse.json(
      { error: analysisError.message || "Could not analyze nudge opportunities." },
      { status: 400 }
    );
  }
}
