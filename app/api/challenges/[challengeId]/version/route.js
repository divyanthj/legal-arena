import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/libs/next-auth";
import { getChallengeRealtimeVersionForUser } from "@/libs/game/challenges";

export async function GET(req, { params }) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  try {
    const version = await getChallengeRealtimeVersionForUser({
      userId: session.user.id,
      challengeId: params.challengeId,
    });

    if (!version) {
      return NextResponse.json(
        {
          error:
            "Challenge not found for your account. It may have expired, been declined, or belong to another player.",
        },
        { status: 404 }
      );
    }

    return NextResponse.json({ version });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
