import { NextResponse } from "next/server";
import { getRequestSession } from "@/libs/api-auth";
import { getFullArenaAccessForSession } from "@/libs/admin";
import CaseSession from "@/models/CaseSession";
import {
  createCaseSession,
  getCaseSessionDocumentForUser,
} from "@/libs/game/store";
import { getNextCaseRecommendationForUser } from "@/libs/game/nextCaseRecommendationService";
import {
  buildNextCaseTeaser,
  buildTeaserScenarioHint,
} from "@/libs/game/nextCaseTeaser.mjs";

const isResolvedCase = (caseSession) =>
  ["verdict", "settled"].includes(caseSession?.status);

const getResolvedSourceCase = async ({ userId, sourceCaseId }) => {
  if (!sourceCaseId) {
    return {
      error: NextResponse.json(
        { error: "Source case is required." },
        { status: 400 }
      ),
    };
  }

  const sourceCase = await getCaseSessionDocumentForUser({
    userId,
    caseId: sourceCaseId,
  });
  if (!sourceCase) {
    return {
      error: NextResponse.json({ error: "Case not found." }, { status: 404 }),
    };
  }
  if (!isResolvedCase(sourceCase)) {
    return {
      error: NextResponse.json(
        { error: "Finish this case before choosing the next challenge." },
        { status: 409 }
      ),
    };
  }

  return { sourceCase };
};

export async function GET(req) {
  const { session, error: authError } = await getRequestSession(req);
  if (authError) return authError;
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  try {
    const sourceCaseId = String(
      req.nextUrl.searchParams.get("sourceCaseId") || ""
    ).trim();
    const sourceResult = await getResolvedSourceCase({
      userId: session.user.id,
      sourceCaseId,
    });
    if (sourceResult.error) return sourceResult.error;

    const recommendation = await getNextCaseRecommendationForUser({
      userId: session.user.id,
      userProfile: session.user,
    });
    const teaser = buildNextCaseTeaser({
      recommendation,
      sourceCaseId: sourceResult.sourceCase._id,
      playerId: session.user.id,
      countryCode: sourceResult.sourceCase.caseCountry?.code || "US",
    });

    return NextResponse.json({ recommendation, teaser });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: error?.message || "Could not prepare the next challenge." },
      { status: 500 }
    );
  }
}

export async function POST(req) {
  const { session, error: authError } = await getRequestSession(req);
  if (authError) return authError;
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  if (!(await getFullArenaAccessForSession(session))) {
    return NextResponse.json(
      {
        error: "Unlock unlimited cases to continue your docket.",
        code: "upgrade_required",
      },
      { status: 403 }
    );
  }

  try {
    const body = await req.json();
    const sourceCaseId = String(body?.sourceCaseId || "").trim();
    const sourceResult = await getResolvedSourceCase({
      userId: session.user.id,
      sourceCaseId,
    });
    if (sourceResult.error) return sourceResult.error;
    const sourceCase = sourceResult.sourceCase;

    const existing = await CaseSession.findOne({
      userId: session.user.id,
      continuationOfCaseId: sourceCase._id,
    });
    if (existing) {
      return NextResponse.json({
        caseSession: { id: String(existing._id), slug: existing.slug },
        reused: true,
      });
    }

    const recommendation = await getNextCaseRecommendationForUser({
      userId: session.user.id,
      userProfile: session.user,
    });
    const teaser = buildNextCaseTeaser({
      recommendation,
      sourceCaseId: sourceCase._id,
      playerId: session.user.id,
      countryCode: sourceCase.caseCountry?.code || "US",
    });

    try {
      const caseSession = await createCaseSession({
        userId: session.user.id,
        userProfile: session.user,
        categorySlug: recommendation.categorySlug,
        complexity: recommendation.complexity,
        countryCode: sourceCase.caseCountry?.code || "US",
        lawSource: sourceCase.lawSource || "rulebook",
        continuationOfCaseId: sourceCase._id,
        continuationTeaserKey: teaser.key,
        scenarioHint: buildTeaserScenarioHint(teaser),
      });
      return NextResponse.json({
        caseSession,
        recommendation,
        teaser,
        reused: false,
      });
    } catch (error) {
      if (Number(error?.code) === 11000) {
        const continuedCase = await CaseSession.findOne({
          userId: session.user.id,
          continuationOfCaseId: sourceCase._id,
        });
        if (continuedCase) {
          return NextResponse.json({
            caseSession: {
              id: String(continuedCase._id),
              slug: continuedCase.slug,
            },
            reused: true,
          });
        }
      }
      throw error;
    }
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: error?.message || "Could not generate the next case." },
      { status: 500 }
    );
  }
}
