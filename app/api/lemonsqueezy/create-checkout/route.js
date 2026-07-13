import { createLemonSqueezyCheckout } from "@/libs/lemonsqueezy";
import config from "@/config";
import { getActiveIndependenceDayDiscountCode } from "@/libs/independenceDayPromo";
import connectMongo from "@/libs/mongoose";
import { authOptions } from "@/libs/next-auth";
import User from "@/models/User";
import { cookies } from "next/headers";
import { getServerSession } from "next-auth/next";
import { NextResponse } from "next/server";

export async function POST(req) {
  const body = await req.json();

  const variantId = body.variantId || config.lemonsqueezy.earlyAccessVariantId;

  if (!variantId) {
    return NextResponse.json(
      { error: "Variant ID is required" },
      { status: 400 }
    );
  } else if (!body.redirectUrl) {
    return NextResponse.json(
      { error: "Redirect URL is required" },
      { status: 400 }
    );
  }

  try {
    const session = await getServerSession(authOptions);

    await connectMongo();

    const user = await User.findById(session?.user?.id);
    const { redirectUrl } = body;
    const cookieStore = cookies();
    const datafastVisitorId = cookieStore.get("datafast_visitor_id")?.value;
    const datafastSessionId = cookieStore.get("datafast_session_id")?.value;
    const datafastAttributionReady = Boolean(datafastVisitorId && datafastSessionId);

    if (!datafastAttributionReady) {
      console.warn("Creating Lemon Squeezy checkout without complete DataFast attribution cookies");
    }

    const checkoutURL = await createLemonSqueezyCheckout({
      variantId,
      redirectUrl,
      userId: session?.user?.id,
      email: user?.email,
      discountCode: getActiveIndependenceDayDiscountCode() || undefined,
      datafastVisitorId,
      datafastSessionId,
    });

    return NextResponse.json({ url: checkoutURL, datafastAttributionReady });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: e?.message }, { status: 500 });
  }
}
