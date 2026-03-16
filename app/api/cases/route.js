import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/libs/next-auth";
import {
  createCaseSession,
  listDashboardDataForUser,
} from "@/libs/game/store";
import { hasGameAccess } from "@/libs/admin";

export async function GET() {
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
    const dashboardData = await listDashboardDataForUser(session.user.id);

    return NextResponse.json({
      cases: dashboardData.cases,
      templates: dashboardData.templates,
      categories: dashboardData.categories,
      progression: dashboardData.progression,
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
  if (!hasGameAccess(session.user?.email)) {
    return NextResponse.json(
      { error: "Legal Arena is still in development. Access is currently limited." },
      { status: 403 }
    );
  }

  try {
    const body = await req.json();
    const caseSession = await createCaseSession({
      userId: session.user.id,
      caseTemplateId: body?.caseTemplateId,
    });

    return NextResponse.json({ caseSession });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
