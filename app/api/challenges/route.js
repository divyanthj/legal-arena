import { NextResponse } from "next/server";
import { getRequestSession } from "@/libs/api-auth";
import { userCanAccessArena } from "@/libs/admin";
import { createChallenge, listChallengesForUser } from "@/libs/game/challenges";

export async function GET(req) {
  const { session, error: authError } = await getRequestSession(req);
  if (authError) return authError;

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  try {
    const challenges = await listChallengesForUser(session.user.id);
    return NextResponse.json({ challenges });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req) {
  const { session, error: authError } = await getRequestSession(req);
  if (authError) return authError;

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }
  if (!(await userCanAccessArena(session))) {
    return NextResponse.json(
      { error: "Only players with arena access can sponsor a challenge." },
      { status: 403 }
    );
  }

  try {
    const body = await req.json();
    const challenge = await createChallenge({
      initiatorId: session.user.id,
      initiatorProfile: session.user,
      challengedId: body?.challengedId,
      caseTemplateId: body?.caseTemplateId,
      categorySlug: body?.categorySlug,
      complexity: body?.complexity,
    });

    return NextResponse.json({ challenge });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
