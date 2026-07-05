import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/libs/next-auth";
import { previewChallengeSettlementDraft } from "@/libs/game/challenges";

export async function POST(req, { params }) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const result = await previewChallengeSettlementDraft({
      userId: session.user.id,
      challengeId: params.challengeId,
      terms: body?.terms || {},
      message: body?.message || "",
    });

    if (!result) {
      return NextResponse.json(
        { error: "Challenge not found for your account." },
        { status: 404 }
      );
    }

    return NextResponse.json({ preview: result.preview });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
