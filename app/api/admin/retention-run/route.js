import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/libs/next-auth";
import { isAdminEmail } from "@/libs/admin";
import { getAdminOpsConfig } from "@/libs/adminOps";
import { runRetentionEmailNudges } from "@/libs/emailNudges";

export async function POST(req) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id || !isAdminEmail(session.user.email)) {
    return NextResponse.json({ error: "Access denied" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const config = await getAdminOpsConfig();
    const summary = await runRetentionEmailNudges({
      dryRun: Boolean(body?.dryRun),
      limit: body?.limit ? Number(body.limit) : null,
      settingsOverride: config.retention,
      ignoreAutomationState: Boolean(body?.ignoreAutomationState),
    });

    return NextResponse.json({ summary });
  } catch (error) {
    return NextResponse.json(
      { error: error.message || "Failed to run retention ops." },
      { status: 500 }
    );
  }
}
