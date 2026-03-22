import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/libs/next-auth";
import connectMongo from "@/libs/mongoose";
import User from "@/models/User";

export async function GET() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ authenticated: false, active: false });
  }

  await connectMongo();

  const user = await User.findById(session.user.id).select("_id");

  return NextResponse.json({
    authenticated: true,
    active: Boolean(user),
  });
}
