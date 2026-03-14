import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/libs/next-auth";
import {
  createCaseSession,
  listCaseSessionsForUser,
  listScenarioOptions,
} from "@/libs/game/store";

export async function GET() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  try {
    const cases = await listCaseSessionsForUser(session.user.id);

    return NextResponse.json({
      cases,
      scenarios: listScenarioOptions(),
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const caseSession = await createCaseSession({
      userId: session.user.id,
      scenarioId: body?.scenarioId,
    });

    return NextResponse.json({ caseSession });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
