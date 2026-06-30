import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/libs/next-auth";
import { submitChallengeCourtroomArgument } from "@/libs/game/challenges";

export async function POST(req, { params }) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const argument = String(body?.argument || "").trim();

    if (!argument) {
      return NextResponse.json(
        { error: "A courtroom argument is required." },
        { status: 400 }
      );
    }

    const challenge = await submitChallengeCourtroomArgument({
      userId: session.user.id,
      challengeId: params.challengeId,
      argument,
    });

    if (!challenge) {
      return NextResponse.json(
        {
          error:
            "Challenge not found for your account. It may have expired, been declined, or belong to another player.",
        },
        { status: 404 }
      );
    }

    return NextResponse.json({ challenge });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
