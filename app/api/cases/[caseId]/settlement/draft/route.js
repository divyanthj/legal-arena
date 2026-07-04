import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/libs/next-auth";
import { getSoloGameplayAccessForSession } from "@/libs/admin";
import { getCaseSessionDocumentForUser } from "@/libs/game/store";
import { generateOpeningSettlementMessage } from "@/libs/game/settlement";
import { hasClientSettlementAuthority } from "@/libs/game/settlementAuthority";
import { appendUsageEntriesToCaseSession } from "@/libs/game/sessionUsage";

export async function POST(req, { params }) {
  const session = await getServerSession(authOptions);

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
    const caseSession = await getCaseSessionDocumentForUser({
      userId: session.user.id,
      caseId: params.caseId,
    });

    if (!caseSession) {
      return NextResponse.json({ error: "Case not found" }, { status: 404 });
    }

    if (caseSession.primaryCategory === "criminal") {
      return NextResponse.json(
        { error: "Criminal cases cannot be settled." },
        { status: 400 }
      );
    }

    if (caseSession.status !== "interview") {
      return NextResponse.json(
        { error: "Settlement drafts can only be prepared during intake." },
        { status: 400 }
      );
    }

    if (!hasClientSettlementAuthority(caseSession.interviewTranscript)) {
      return NextResponse.json(
        {
          error:
            "Ask your client if they are willing to settle this out of court before drafting settlement terms.",
        },
        { status: 400 }
      );
    }

    const result = await generateOpeningSettlementMessage({
      caseSession,
      userId: session.user.id,
    });

    appendUsageEntriesToCaseSession(caseSession, result.usageEntries);
    await caseSession.save();

    return NextResponse.json({ message: result.message });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
