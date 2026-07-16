import { NextResponse } from "next/server";
import { getRequestSession } from "@/libs/api-auth";
import { requestChallengeAdjournment } from "@/libs/game/challenges";

export async function POST(req, { params }) {
  const { session, error: authError } = await getRequestSession(req);
  if (authError) return authError;
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const reason = String(body?.reason || "").trim();
    if (!reason) {
      return NextResponse.json(
        { error: "Explain why an adjournment is needed." },
        { status: 400 }
      );
    }

    const result = await requestChallengeAdjournment({
      userId: session.user.id,
      challengeId: params.challengeId,
      reason,
    });
    if (!result) {
      return NextResponse.json({ error: "Challenge not found" }, { status: 404 });
    }
    return NextResponse.json(result);
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: error.message },
      { status: error.status || 500 }
    );
  }
}
