import { NextResponse } from "next/server";
import { getRequestSession } from "@/libs/api-auth";
import connectMongo from "@/libs/mongoose";
import User from "@/models/User";
import { getFullArenaAccessForSession } from "@/libs/admin";

export async function POST(req) {
  const { session, error: authError } = await getRequestSession(req);
  if (authError) return authError;

  await connectMongo();

  const user = await User.findById(session.user.id)
    .select("hasAccess freeAccessGranted billingProvider variantId priceId")
    .lean();

  if (!user) {
    return NextResponse.json({ error: "Account not found." }, { status: 404 });
  }

  const hasArenaAccess = await getFullArenaAccessForSession(session);

  return NextResponse.json(
    {
      restored: Boolean(hasArenaAccess),
      hasArenaAccess: Boolean(hasArenaAccess),
      billingProvider: user.billingProvider || "",
      entitlementSource: user.hasAccess
        ? user.billingProvider || "purchase"
        : user.freeAccessGranted
          ? "free_access"
          : hasArenaAccess
            ? "configured_access"
            : "none",
      checkedAt: new Date().toISOString(),
    },
    {
      headers: {
        "Cache-Control": "no-store, max-age=0",
      },
    }
  );
}

