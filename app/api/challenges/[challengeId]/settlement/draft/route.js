import { NextResponse } from "next/server";
import { getRequestSession } from "@/libs/api-auth";
import { draftChallengeSettlementMessage } from "@/libs/game/challenges";

export async function POST(req, { params }) {
  const { session, error: authError } = await getRequestSession(req);
  if (authError) return authError;

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  try {
    const result = await draftChallengeSettlementMessage({
      userId: session.user.id,
      challengeId: params.challengeId,
    });

    if (!result) {
      return NextResponse.json(
        { error: "Challenge not found for your account." },
        { status: 404 }
      );
    }

    return NextResponse.json({ message: result.message });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: error.message },
      { status: error.status || 500 }
    );
  }
}
