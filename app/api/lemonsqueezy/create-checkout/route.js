import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/libs/next-auth";
import connectMongo from "@/libs/mongoose";
import User from "@/models/User";
import config from "@/config";
import { createLemonSqueezyCheckout } from "@/libs/lemonsqueezy";

export async function POST(req) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Not signed in" }, { status: 401 });
    }

    const body = await req.json();
    const redirectUrl = body.redirectUrl;
    const variantId = body.variantId || config.lemonsqueezy.earlyAccessVariantId;

    if (!redirectUrl) {
      return NextResponse.json(
        { error: "Redirect URL is required" },
        { status: 400 }
      );
    }

    if (!variantId) {
      return NextResponse.json(
        { error: "Lemon Squeezy variant ID is required" },
        { status: 400 }
      );
    }

    await connectMongo();

    const user = await User.findById(session.user.id).select("email name");
    const sessionEmail = String(session.user.email || "").trim().toLowerCase();
    const persistedEmail = String(user?.email || "").trim().toLowerCase();
    const checkoutEmail = persistedEmail || sessionEmail;

    if (!checkoutEmail) {
      return NextResponse.json(
        { error: "No email address found for the signed-in account" },
        { status: 400 }
      );
    }

    // Keep the user record in sync so checkout and webhook matching stay reliable.
    if (user && !persistedEmail && sessionEmail) {
      user.email = sessionEmail;
      await user.save();
    }

    const url = await createLemonSqueezyCheckout({
      variantId,
      redirectUrl,
      email: checkoutEmail,
      name: user?.name || session.user.name || "",
      userId: session.user.id,
    });

    return NextResponse.json({ url });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: error?.message || "Failed to create checkout" },
      { status: 500 }
    );
  }
}
