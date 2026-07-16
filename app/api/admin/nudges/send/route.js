import { NextResponse } from "next/server";
import { requireAdminSession } from "@/libs/admin-auth";
import { sendAdminNudge } from "@/libs/adminNudges";

export async function POST(req) {
  const { session, error } = await requireAdminSession();
  if (error) return error;

  try {
    const body = await req.json();
    if (!body.playerId) {
      return NextResponse.json({ error: "Player ID is required." }, { status: 400 });
    }
    const result = await sendAdminNudge({
      playerId: body.playerId,
      admin: { id: session.user.id, email: session.user.email },
      conceptKey: body.conceptKey,
      rationale: body.rationale,
      subject: body.subject,
      message: body.message,
      overrideWarnings: body.overrideWarnings === true,
    });
    return NextResponse.json(result);
  } catch (sendError) {
    const status = sendError.code === "OVERRIDE_REQUIRED" ? 409 : 400;
    return NextResponse.json(
      {
        error: sendError.message || "Could not send the nudge.",
        code: sendError.code || "",
        warnings: sendError.warnings || [],
      },
      { status }
    );
  }
}
