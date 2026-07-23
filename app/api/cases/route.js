import { NextResponse } from "next/server";
import mongoose from "mongoose";
import CaseSession from "@/models/CaseSession";
import { getRequestSession } from "@/libs/api-auth";
import {
  createCaseSession,
  listDashboardDataForUser,
} from "@/libs/game/store";
import {
  claimEvergreenSoloTrial,
  getSoloGameplayAccessForSession,
  releaseEvergreenSoloTrialClaim,
} from "@/libs/admin";
import {
  detectCountryCodeFromHeaders,
  isValidCountryCode,
  normalizeCountryCode,
} from "@/libs/game/countries";
import {
  getPlayerCaseCountryPreference,
  setPlayerCaseCountryPreference,
} from "@/libs/game/countryPreference";

export const maxDuration = 300;

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
      {
        error: access.message,
        code: access.upgradeRequired ? "upgrade_required" : "access_denied",
        trialState: access.trialState,
        trialCaseId: access.trialCaseId || "",
      },
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
      {
        error: access.message,
        code: access.upgradeRequired ? "upgrade_required" : "access_denied",
        trialState: access.trialState,
        trialCaseId: access.trialCaseId || "",
      },
      { status: access.status || 403 }
    );
  }

  let claimedTrialCaseId = null;
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
    if (access.requiresTrialClaim) {
      claimedTrialCaseId = new mongoose.Types.ObjectId();
      const claim = await claimEvergreenSoloTrial({
        userId: session.user.id,
        caseSessionId: claimedTrialCaseId,
      });
      if (!claim) {
        return NextResponse.json(
          {
            error: "Your free case has already been claimed.",
            code: "upgrade_required",
            trialState: "active",
          },
          { status: 409 }
        );
      }
    }

    const caseSession = await createCaseSession({
      userId: session.user.id,
      userProfile: session.user,
      caseSessionId: claimedTrialCaseId,
      caseTemplateId: body?.caseTemplateId,
      categorySlug: body?.categorySlug,
      complexity: access.requiresTrialClaim ? 1 : body?.complexity,
      countryCode,
      freeGameplayCampaignAccess: access.freeGameplayCampaignAccess,
      newcomerAssist: Boolean(access.requiresTrialClaim),
    });

    return NextResponse.json({
      caseSession,
      trialState: access.requiresTrialClaim ? "active" : access.trialState,
      isFreeTrialCase: Boolean(access.requiresTrialClaim),
    });
  } catch (error) {
    if (claimedTrialCaseId) {
      const savedTrialCase = await CaseSession.exists({
        _id: claimedTrialCaseId,
        userId: session.user.id,
      });
      if (!savedTrialCase) {
        await releaseEvergreenSoloTrialClaim({
          userId: session.user.id,
          caseSessionId: claimedTrialCaseId,
        });
      }
    }
    console.error(error);
    return NextResponse.json(
      { error: error.message, code: error.code || "" },
      { status: error.status || 500 }
    );
  }
}
