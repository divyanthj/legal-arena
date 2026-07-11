import { NextResponse } from "next/server";
import { getRequestSession } from "@/libs/api-auth";
import { completeDashboardTutorialForUser } from "@/libs/game/onboarding";

export async function POST(req) {
  const { session, error: authError } = await getRequestSession(req);
  if (authError) return authError;

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  try {
    const onboarding = await completeDashboardTutorialForUser({
      userId: session.user.id,
      email: session.user.email,
    });

    if (!onboarding) {
      return NextResponse.json({ error: "Player profile not found." }, { status: 404 });
    }

    return NextResponse.json({ ok: true, onboarding });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
