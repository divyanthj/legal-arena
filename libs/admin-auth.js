import "server-only";
import { getServerSession } from "next-auth/next";
import { NextResponse } from "next/server";
import { authOptions } from "@/libs/next-auth";
import { isAdminEmail } from "@/libs/admin";

export const requireAdminSession = async () => {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return { error: NextResponse.json({ error: "Not signed in" }, { status: 401 }) };
  }
  if (!isAdminEmail(session.user.email)) {
    return {
      error: NextResponse.json({ error: "Admin access required" }, { status: 403 }),
    };
  }
  return { session };
};
