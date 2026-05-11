import { NextResponse } from "next/server";
import { listOverallLeaderboard } from "@/libs/game/progression";

export const dynamic = "force-dynamic";

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("q") || "";
    const parsedLimit = Number.parseInt(searchParams.get("limit") || "", 10);
    const limit = Number.isFinite(parsedLimit) && parsedLimit > 0 ? parsedLimit : null;

    return NextResponse.json({
      leaderboard: await listOverallLeaderboard({ search, limit }),
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
