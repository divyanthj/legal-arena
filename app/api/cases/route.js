import { NextResponse } from "next/server";
import { getRequestSession } from "@/libs/api-auth";
import {
  createCaseSession,
  listDashboardDataForUser,
} from "@/libs/game/store";
import { getSoloGameplayAccessForSession } from "@/libs/admin";
import {
  detectCountryCodeFromHeaders,
  isValidCountryCode,
  normalizeCountryCode,
} from "@/libs/game/countries";
import {
  getPlayerCaseCountryPreference,
  setPlayerCaseCountryPreference,
} from "@/libs/game/countryPreference";

export async function GET(req) {
  const { session, error: authError } = await getRequestSession(req);
  if (authError) return authError;

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }
  const access = await getSoloGameplayAccessForSession({
    session,
    action: "list",
  });
  if (!access.allowed) {
    return NextResponse.json(
      { error: access.message },
      { status: access.status || 403 }
    );
  }

  try {
    const dashboardData = await listDashboardDataForUser(
      session.user.id,
      session.user
    );

    return NextResponse.json({
      cases: dashboardData.cases,
      templates: dashboardData.templates,
      categories: dashboardData.categories,
      onboarding: dashboardData.onboarding,
      progression: dashboardData.progression,
    });
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
  const access = await getSoloGameplayAccessForSession({
    session,
    action: "create",
  });
  if (!access.allowed) {
    return NextResponse.json(
      { error: access.message },
      { status: access.status || 403 }
    );
  }

  try {
    const body = await req.json();
    if (body?.countryCode && !isValidCountryCode(body.countryCode)) {
      return NextResponse.json({ error: "Choose a supported country." }, { status: 400 });
    }
    if (body?.countryCode) {
      await setPlayerCaseCountryPreference({
        userId: session.user.id,
        countryCode: body.countryCode,
      });
    }
    const countryCode =
      normalizeCountryCode(body?.countryCode) ||
      (await getPlayerCaseCountryPreference(session.user.id)) ||
      detectCountryCodeFromHeaders(req.headers);
    const caseSession = await createCaseSession({
      userId: session.user.id,
      userProfile: session.user,
      caseTemplateId: body?.caseTemplateId,
      categorySlug: body?.categorySlug,
      complexity: body?.complexity,
      countryCode,
      freeGameplayCampaignAccess: access.freeGameplayCampaignAccess,
    });

    return NextResponse.json({ caseSession });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
