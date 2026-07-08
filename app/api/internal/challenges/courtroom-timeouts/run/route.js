import { NextResponse } from "next/server";
import {
  acquireInternalJobLock,
  releaseInternalJobLock,
} from "@/libs/caseTemplateRebalancer";
import { hasValidNudgeSecret } from "@/libs/emailNudgesCore";
import { runChallengeCourtroomTimeouts } from "@/libs/game/challenges";

const LOCK_KEY = "challenge-courtroom-timeouts";
const LOCK_TTL_MS = 20 * 60 * 1000;

const safeJson = async (req) => {
  try {
    return await req.json();
  } catch {
    return {};
  }
};

const handleRun = async (req) => {
  const body = await safeJson(req);
  const { searchParams } = new URL(req.url);
  const query = Object.fromEntries(searchParams.entries());
  const headers = Object.fromEntries(req.headers.entries());

  if (
    !hasValidNudgeSecret({
      headers,
      query,
      body,
      secret: process.env.CRON_SECRET,
    })
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const owner = `challenge-timeouts-${Date.now()}`;
  const lock = await acquireInternalJobLock({
    key: LOCK_KEY,
    owner,
    ttlMs: LOCK_TTL_MS,
  });

  if (!lock) {
    return NextResponse.json({
      skipped: true,
      reason: "Another challenge timeout run is already active.",
    });
  }

  try {
    const summary = await runChallengeCourtroomTimeouts({
      limit: body.limit ?? query.limit,
    });

    return NextResponse.json(summary);
  } catch (error) {
    console.error("Challenge courtroom timeout run failed:", error);
    return NextResponse.json(
      { error: error.message || "Failed to run challenge courtroom timeouts." },
      { status: 500 }
    );
  } finally {
    await releaseInternalJobLock({ key: LOCK_KEY, owner });
  }
};

export async function GET(req) {
  return handleRun(req);
}

export async function POST(req) {
  return handleRun(req);
}
