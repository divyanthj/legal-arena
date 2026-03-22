import crypto from "crypto";
import { NextResponse } from "next/server";
import connectMongo from "@/libs/mongoose";
import User from "@/models/User";
import config from "@/config";

const getSignatureDigest = (secret, payload) =>
  crypto.createHmac("sha256", secret).update(payload).digest("hex");

export async function POST(req) {
  try {
    const signingSecret = process.env.LEMONSQUEEZY_SIGNING_SECRET?.trim();

    if (!signingSecret) {
      console.error("Missing LEMONSQUEEZY_SIGNING_SECRET");
      return NextResponse.json(
        { error: "LEMONSQUEEZY_SIGNING_SECRET is required" },
        { status: 400 }
      );
    }

    const body = await req.text();
    const signature = req.headers.get("x-signature");

    if (!signature) {
      return NextResponse.json({ error: "Missing signature" }, { status: 400 });
    }

    const digest = getSignatureDigest(signingSecret, body);
    const isValid =
      signature.length === digest.length &&
      crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(digest));

    if (!isValid) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
    }

    const payload = JSON.parse(body);
    const eventName = payload?.meta?.event_name;
    const attributes = payload?.data?.attributes || {};
    const customData = payload?.meta?.custom_data || {};
    const variantId =
      attributes?.first_order_item?.variant_id?.toString() ||
      attributes?.variant_id?.toString() ||
      "";
    const configuredVariantId = String(
      config.lemonsqueezy.earlyAccessVariantId || ""
    );

    await connectMongo();

    switch (eventName) {
      case "order_created": {
        if (!configuredVariantId || variantId !== configuredVariantId) {
          break;
        }

        const customerId = attributes?.customer_id?.toString() || "";
        const email = attributes?.user_email?.trim().toLowerCase() || "";
        const name = attributes?.user_name?.trim() || "";
        const userId =
          customData?.userId || customData?.user_id || customData?.userID || "";

        let user = null;

        if (userId) {
          user = await User.findById(userId);
        }

        if (!user && customerId) {
          user = await User.findOne({ customerId });
        }

        if (!user && email) {
          user = await User.findOne({ email });
        }

        if (!user && email) {
          user = await User.create({
            email,
            name,
          });
        }

        if (!user) {
          throw new Error("Unable to resolve user from Lemon Squeezy webhook");
        }

        user.customerId = customerId || user.customerId;
        user.variantId = variantId;
        user.billingProvider = "lemonsqueezy";
        user.hasAccess = true;
        if (!user.name && name) {
          user.name = name;
        }

        await user.save();
        break;
      }

      default:
        break;
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Lemon Squeezy webhook error:", error);
    return NextResponse.json(
      { error: error?.message || "Webhook processing error" },
      { status: 500 }
    );
  }
}
