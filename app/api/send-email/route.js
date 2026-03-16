import { NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import connectMongo from "@/libs/mongoose";
import { sendCustomEmail } from "@/libs/emailSender";

export async function POST(req) {
  const admins = JSON.parse(process.env.ADMINS || "[]");

  try {
    await connectMongo();
  } catch (error) {
    console.error("Failed to connect to MongoDB:", error);
    return NextResponse.json(
      { error: "Database connection failed" },
      { status: 500 }
    );
  }

  const token = await getToken({ req });

  if (!token || !admins.includes(token.email || token.sub)) {
    return NextResponse.json({ error: "Access denied" }, { status: 403 });
  }

  try {
    const { userId, subject, content, type } = await req.json();

    if (!subject || !content) {
      return NextResponse.json(
        { error: "Subject and content are required." },
        { status: 400 }
      );
    }

    const result = await sendCustomEmail({ userId, subject, content, type });
    return NextResponse.json(result);
  } catch (error) {
    console.error("Error sending email:", error);
    return NextResponse.json(
      { success: false, message: error.message },
      { status: 500 }
    );
  }
}
