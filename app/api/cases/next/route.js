import { NextResponse } from "next/server";
import { getRequestSession } from "@/libs/api-auth";
import { getFullArenaAccessForSession } from "@/libs/admin";
import CaseSession from "@/models/CaseSession";
import {
  createCaseSession,
  getCaseSessionDocumentForUser,
} from "@/libs/game/store";

const isResolvedCase = (caseSession) =>
  ["verdict", "settled"].includes(caseSession?.status);

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
    if (!sourceCaseId) {
      return NextResponse.json({ error: "Source case is required." }, { status: 400 });
    }

    const sourceCase = await getCaseSessionDocumentForUser({
      userId: session.user.id,
      caseId: sourceCaseId,
    });
    if (!sourceCase) {
      return NextResponse.json({ error: "Case not found." }, { status: 404 });
    }
    if (!isResolvedCase(sourceCase)) {
      return NextResponse.json(
        { error: "Finish this case before starting a similar matter." },
        { status: 409 }
      );
    }

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

    try {
      const caseSession = await createCaseSession({
        userId: session.user.id,
        userProfile: session.user,
        categorySlug: sourceCase.primaryCategory,
        complexity: Math.min(5, (Number(sourceCase.complexity) || 1) + 1),
        countryCode: sourceCase.caseCountry?.code || "US",
        continuationOfCaseId: sourceCase._id,
      });
      return NextResponse.json({ caseSession, reused: false });
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
