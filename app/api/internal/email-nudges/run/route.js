import { NextResponse } from "next/server";
import {
  hasValidNudgeSecret,
  parseNudgeRunOptions,
} from "@/libs/emailNudgesCore";
import { runRetentionEmailNudges } from "@/libs/emailNudges";

const safeJson = async (req) => {
  try {
    return await req.json();
  } catch {
    return {};
  }
};

export async function POST(req) {
  const body = await safeJson(req);
  const { searchParams } = new URL(req.url);
  const query = Object.fromEntries(searchParams.entries());
  const headers = Object.fromEntries(req.headers.entries());
  const hasEmailNudgeSecret = hasValidNudgeSecret({
    headers,
    query,
    body,
    secret: process.env.EMAIL_NUDGE_SECRET,
  });
  const hasCronSecret = hasValidNudgeSecret({
    headers,
    query,
    body,
    secret: process.env.CRON_SECRET,
  });

  if (!hasEmailNudgeSecret && !hasCronSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const options = parseNudgeRunOptions({ query, body });
    const summary = await runRetentionEmailNudges(options);

    return NextResponse.json(summary);
  } catch (error) {
    console.error("Retention email nudge run failed:", error);

    return NextResponse.json(
      { error: error.message || "Failed to run retention email nudges." },
      { status: 500 }
    );
  }
}
