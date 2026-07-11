import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/libs/next-auth";
import { isAdminEmail } from "@/libs/admin";
import connectMongo from "@/libs/mongoose";
import EmailSuppression from "@/models/EmailSuppression";

const normalizeEmail = (value = "") => String(value || "").trim().toLowerCase();
const validEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
const requireAdmin = async () => {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return { error: NextResponse.json({ error: "Not signed in" }, { status: 401 }) };
  if (!isAdminEmail(session.user.email)) return { error: NextResponse.json({ error: "Admin access required" }, { status: 403 }) };
  return { session };
};
const serialize = (entry) => ({ id: String(entry._id || entry.id), email: entry.email, reason: entry.reason || "", suppressedBy: entry.suppressedBy || "", createdAt: entry.createdAt });

export async function GET() {
  const { error } = await requireAdmin(); if (error) return error;
  await connectMongo();
  const entries = await EmailSuppression.find({}).sort({ createdAt: -1 }).lean();
  return NextResponse.json({ suppressions: entries.map(serialize), total: entries.length });
}

export async function POST(req) {
  const { session, error } = await requireAdmin(); if (error) return error;
  const body = await req.json(); const email = normalizeEmail(body.email);
  if (!validEmail(email)) return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  await connectMongo();
  const entry = await EmailSuppression.findOneAndUpdate(
    { email },
    { $set: { email, reason: String(body.reason || "Removed by admin").trim().slice(0, 240), suppressedBy: normalizeEmail(session.user.email) } },
    { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
  );
  return NextResponse.json({ suppression: serialize(entry) }, { status: 201 });
}

export async function DELETE(req) {
  const { error } = await requireAdmin(); if (error) return error;
  const body = await req.json(); const email = normalizeEmail(body.email);
  if (!validEmail(email)) return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  await connectMongo();
  const removed = await EmailSuppression.findOneAndDelete({ email });
  if (!removed) return NextResponse.json({ error: "Address is not on the suppression list." }, { status: 404 });
  return NextResponse.json({ removed: serialize(removed) });
}
