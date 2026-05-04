import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/libs/next-auth";
import { isAdminEmail } from "@/libs/admin";
import { getAdminOpsConfig } from "@/libs/adminOps";
import { sendBroadcastEmail } from "@/libs/emailSender";

export async function POST(req) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id || !isAdminEmail(session.user.email)) {
    return NextResponse.json({ error: "Access denied" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const config = await getAdminOpsConfig();

    if (!config.digest.enabled) {
      return NextResponse.json(
        { error: "News digests are disabled in admin ops settings." },
        { status: 400 }
      );
    }

    const subject = String(body?.subject || "").trim();
    const content = String(body?.content || "").trim();
    const audience = String(
      body?.audience || config.digest.defaultAudience || "all_users"
    ).trim();
    const prefix = String(config.digest.subjectPrefix || "").trim();
    const footerNote = String(
      body?.footerNote ?? config.digest.footerNote ?? ""
    ).trim();

    if (!subject || !content) {
      return NextResponse.json(
        { error: "Subject and content are required." },
        { status: 400 }
      );
    }

    const result = await sendBroadcastEmail({
      audience,
      subject: prefix ? `${prefix} ${subject}` : subject,
      content,
      type: "digest",
      footerNote,
    });

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error.message || "Failed to send digest." },
      { status: 500 }
    );
  }
}
