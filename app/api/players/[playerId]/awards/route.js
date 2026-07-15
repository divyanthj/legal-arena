import { NextResponse } from "next/server";
import { getRequestSession } from "@/libs/api-auth";
import User from "@/models/User";
import { getPlayerAwardsProfile } from "@/libs/game/awards/service";

export async function GET(req, { params }) {
  const { session, error } = await getRequestSession(req);
  if (error) return error;
  try {
    if (!(await User.exists({ _id: params.playerId }))) return NextResponse.json({ error: "Player not found" }, { status: 404 });
    const owner = String(session?.user?.id || "") === String(params.playerId);
    return NextResponse.json(await getPlayerAwardsProfile(params.playerId, { owner }));
  } catch (caught) {
    console.error(caught);
    return NextResponse.json({ error: caught.message }, { status: 500 });
  }
}

