import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/libs/next-auth";
import { continueChallengeSettlement } from "@/libs/game/challenges";

export async function POST(req, { params }) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const message = String(body?.message || "").trim();

    if (!message) {
      return NextResponse.json(
        { error: "A settlement message is required." },
        { status: 400 }
      );
    }

    const challenge = await continueChallengeSettlement({
      userId: session.user.id,
      challengeId: params.challengeId,
      message,
      terms: body?.terms || {},
      acceptTerms: body?.acceptTerms === true,
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
    return NextResponse.json(
      { error: error.message },
      { status: Number(error?.status) || 500 }
    );
  }
}
