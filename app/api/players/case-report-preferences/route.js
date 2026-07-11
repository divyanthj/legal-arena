import { NextResponse } from "next/server";
import { getRequestSession } from "@/libs/api-auth";
import connectMongo from "@/libs/mongoose";
import User from "@/models/User";

const payload = (user) => ({
  autoPublishCaseReports: Boolean(user?.autoPublishCaseReports),
  allowPortraitInCaseReports: Boolean(user?.allowPortraitInCaseReports),
});

export async function GET(req) {
  const { session, error } = await getRequestSession(req);
  if (error) return error;
  if (!session?.user?.id) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  await connectMongo();
  const user = await User.findById(session.user.id).select("autoPublishCaseReports allowPortraitInCaseReports").lean();
  if (!user) return NextResponse.json({ error: "Player profile not found." }, { status: 404 });
  return NextResponse.json({ preferences: payload(user) });
}

export async function PATCH(req) {
  const { session, error } = await getRequestSession(req);
  if (error) return error;
  if (!session?.user?.id) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const body = await req.json();
  const update = {};
  if (typeof body.autoPublishCaseReports === "boolean") update.autoPublishCaseReports = body.autoPublishCaseReports;
  if (typeof body.allowPortraitInCaseReports === "boolean") update.allowPortraitInCaseReports = body.allowPortraitInCaseReports;
  if (!Object.keys(update).length) return NextResponse.json({ error: "No valid preferences supplied." }, { status: 400 });
  await connectMongo();
  const user = await User.findByIdAndUpdate(session.user.id, { $set: update }, { new: true, runValidators: true }).select("autoPublishCaseReports allowPortraitInCaseReports").lean();
  if (!user) return NextResponse.json({ error: "Player profile not found." }, { status: 404 });
  return NextResponse.json({ preferences: payload(user) });
}
