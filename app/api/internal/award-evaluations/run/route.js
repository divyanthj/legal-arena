import { NextResponse } from "next/server";
import { acquireInternalJobLock, releaseInternalJobLock } from "@/libs/caseTemplateRebalancer";
import { hasValidNudgeSecret } from "@/libs/emailNudgesCore";
import { runPendingAwardEvaluations } from "@/libs/game/awards/service";

const handle = async (req) => {
  const body = await req.json().catch(() => ({}));
  const query = Object.fromEntries(new URL(req.url).searchParams.entries());
  if (!hasValidNudgeSecret({ headers: Object.fromEntries(req.headers.entries()), query, body, secret: process.env.CRON_SECRET })) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const owner = `award-evaluations-${Date.now()}`;
  const lock = await acquireInternalJobLock({ key: "award-evaluations", owner, ttlMs: 20 * 60 * 1000 });
  if (!lock) return NextResponse.json({ skipped: true });
  try { return NextResponse.json(await runPendingAwardEvaluations({ limit: body.limit || query.limit })); }
  catch (error) { console.error(error); return NextResponse.json({ error: error.message }, { status: 500 }); }
  finally { await releaseInternalJobLock({ key: "award-evaluations", owner }); }
};
export const GET = handle;
export const POST = handle;

