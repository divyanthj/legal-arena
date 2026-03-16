import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/libs/next-auth";
import { exitCaseSessionForUser } from "@/libs/game/store";
import { hasGameAccess } from "@/libs/admin";

export async function POST(req, { params }) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }
  if (!hasGameAccess(session.user?.email)) {
    return NextResponse.json(
      { error: "Legal Arena is still in development. Access is currently limited." },
      { status: 403 }
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

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
