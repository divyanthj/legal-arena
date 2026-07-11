import { NextResponse } from "next/server";
import { getRequestSession } from "@/libs/api-auth";
import { exitChallengeSettlement } from "@/libs/game/challenges";

export async function POST(req, { params }) {
  const { session, error: authError } = await getRequestSession(req);
  if (authError) return authError;

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  try {
    const challenge = await exitChallengeSettlement({
      userId: session.user.id,
      challengeId: params.challengeId,
    });

    if (!challenge) {
      return NextResponse.json(
        { error: "Challenge not found for your account." },
        { status: 404 }
      );
    }

    return NextResponse.json({ challenge });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
