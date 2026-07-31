import { NextResponse } from "next/server";
import { getRequestSession } from "@/libs/api-auth";
import {
  getPlayerLawSourcePreference,
  setPlayerLawSourcePreference,
} from "@/libs/game/lawSourcePreference";
import { normalizeLawSource } from "@/libs/game/lawSource";

export async function GET(req) {
  const { session, error } = await getRequestSession(req);
  if (error) return error;
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }
  return NextResponse.json({
    lawSource: await getPlayerLawSourcePreference(session.user.id),
  });
}

export async function PATCH(req) {
  const { session, error } = await getRequestSession(req);
  if (error) return error;
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }
  const body = await req.json();
  const lawSource = normalizeLawSource(body?.lawSource);
  if (!lawSource) {
    return NextResponse.json({ error: "Choose a valid law source." }, { status: 400 });
  }
  return NextResponse.json({
    lawSource: await setPlayerLawSourcePreference({
      userId: session.user.id,
      lawSource,
    }),
  });
}

