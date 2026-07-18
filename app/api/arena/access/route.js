import { NextResponse } from "next/server";
import { getRequestSession } from "@/libs/api-auth";
import {
  getFullArenaAccessForSession,
  getSoloGameplayAccessForSession,
} from "@/libs/admin";

export async function GET(req) {
  const { session, error: authError } = await getRequestSession(req);
  if (authError) return authError;
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const [hasArenaAccess, soloAccess] = await Promise.all([
    getFullArenaAccessForSession(session),
    getSoloGameplayAccessForSession({ session, action: "create" }),
  ]);

  return NextResponse.json({
    hasArenaAccess: Boolean(hasArenaAccess),
    canStartSoloCases: Boolean(soloAccess.allowed),
    trialState: soloAccess.trialState || soloAccess.soloTrial?.state || "available",
    trialCaseId: soloAccess.trialCaseId || soloAccess.soloTrial?.caseSessionId || "",
  });
}
