import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/libs/next-auth";
import { isAdminEmail } from "@/libs/admin";
import connectMongo from "@/libs/mongoose";
import { sendCustomEmail } from "@/libs/emailSender";

export async function POST(req) {
  try {
    await connectMongo();
  } catch (error) {
    console.error("Failed to connect to MongoDB:", error);
    return NextResponse.json(
      { error: "Database connection failed" },
      { status: 500 }
    );
  }

  const session = await getServerSession(authOptions);

  if (!session?.user?.id || !isAdminEmail(session.user.email)) {
    return NextResponse.json({ error: "Access denied" }, { status: 403 });
  }

  try {
    const { audience, email, subject, content, type } = await req.json();
    const targetAudience = audience === "single" ? "single_user" : "all_users";

    if (!subject || !content) {
      return NextResponse.json(
        { error: "Subject and content are required." },
        { status: 400 }
      );
    }

    const result = await sendCustomEmail({
      audience: targetAudience,
      email,
      subject,
      content,
      type,
    });
    return NextResponse.json(result);
  } catch (error) {
    console.error("Error sending email:", error);
    return NextResponse.json(
      { success: false, message: error.message },
      { status: 500 }
    );
  }
}
