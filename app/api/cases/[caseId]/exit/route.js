import { NextResponse } from "next/server";
import { getRequestSession } from "@/libs/api-auth";
import { buildCasePayload, exitCaseSessionForUser } from "@/libs/game/store";
import {
  getSoloGameplayAccessForSession,
  resolveEvergreenSoloTrial,
} from "@/libs/admin";

export async function POST(req, { params }) {
  const { session, error: authError } = await getRequestSession(req);
  if (authError) return authError;

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }
  const access = await getSoloGameplayAccessForSession({
    session,
    caseId: params.caseId,
    action: "play",
  });
  if (!access.allowed) {
    return NextResponse.json(
      { error: access.message },
      { status: access.status || 403 }
    );
  }

  try {
    const caseSession = await exitCaseSessionForUser({
      userId: session.user.id,
      caseId: params.caseId,
    });

    if (!caseSession) {
      return NextResponse.json({ error: "Case not found" }, { status: 404 });
    }

    await resolveEvergreenSoloTrial({
      userId: session.user.id,
      caseSessionId: caseSession._id,
      resolution: caseSession.status === "verdict" ? "forfeit" : "exited",
      resolvedAt: caseSession.completedAt || caseSession.exitedAt || new Date(),
    });

    return NextResponse.json({
      success: true,
      caseSession: buildCasePayload(caseSession),
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
