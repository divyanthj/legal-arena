import { NextResponse } from "next/server";
import { getRequestSession } from "@/libs/api-auth";
import { previewChallengeSettlementDraft } from "@/libs/game/challenges";

export async function POST(req, { params }) {
  const { session, error: authError } = await getRequestSession(req);
  if (authError) return authError;

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
      clientInstruction: body?.clientInstruction || "",
      mode: body?.mode || "manual",
    });

    if (!result) {
      return NextResponse.json(
        { error: "Challenge not found for your account." },
        { status: 404 }
      );
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
