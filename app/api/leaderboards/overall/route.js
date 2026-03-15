import { NextResponse } from "next/server";
import { listOverallLeaderboard } from "@/libs/game/progression";

export async function GET() {
  try {
    return NextResponse.json({
      leaderboard: await listOverallLeaderboard(),
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
