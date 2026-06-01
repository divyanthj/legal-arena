import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import mongoose from "mongoose";
import { authOptions } from "@/libs/next-auth";
import connectMongo from "@/libs/mongoose";
import User from "@/models/User";

export async function GET() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ authenticated: false, active: false });
  }

  try {
    await connectMongo();

    const selectors = [];

    if (session.user.id && mongoose.Types.ObjectId.isValid(session.user.id)) {
      selectors.push({ _id: session.user.id });
    }

    if (session.user.email) {
      selectors.push({ email: String(session.user.email).trim().toLowerCase() });
    }

    const user = selectors.length
      ? await User.findOne({ $or: selectors }).select("_id")
      : null;

    return NextResponse.json({
      authenticated: true,
      active: Boolean(user),
    });
  } catch (error) {
    console.error("session status lookup failed", error);

    return NextResponse.json({
      authenticated: true,
      active: true,
      verificationSkipped: true,
    });
  }
}
