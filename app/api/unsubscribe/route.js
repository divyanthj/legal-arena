import { NextResponse } from "next/server";
import connectMongo from "@/libs/mongoose";
import EmailSuppression from "@/models/EmailSuppression";
import { verifyUnsubscribeToken } from "@/libs/emailUnsubscribe";

export async function POST(req) {
  try {
    const { token } = await req.json();
    const email = verifyUnsubscribeToken(token);
    if (!email) return NextResponse.json({ error: "This unsubscribe link is invalid." }, { status: 400 });
    await connectMongo();
    await EmailSuppression.findOneAndUpdate(
      { email },
      { $set: { email, reason: "Self-unsubscribed", suppressedBy: "self-service" } },
      { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true }
    );
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Unsubscribe failed:", error);
    return NextResponse.json({ error: "Could not update your mailing preference." }, { status: 500 });
  }
}
