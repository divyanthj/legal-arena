import { NextResponse } from "next/server";
import crypto from "crypto";
import connectMongo from "@/libs/mongoose";
import { requireAdminSession } from "@/libs/admin-auth";
import {
  generateApiCredential,
  hashApiSecret,
} from "@/libs/api-auth";
import ApiCredential from "@/models/ApiCredential";
import User from "@/models/User";

const serializeCredential = (credential) => ({
  id: credential._id.toString(),
  name: credential.name,
  keyId: credential.keyId,
  user: credential.userId
    ? {
        id: credential.userId._id?.toString?.() || credential.userId.toString(),
        email: credential.userId.email || "",
        name: credential.userId.name || "",
      }
    : null,
  createdBy: credential.createdBy,
  createdAt: credential.createdAt,
  expiresAt: credential.expiresAt || null,
  revokedAt: credential.revokedAt || null,
  lastUsedAt: credential.lastUsedAt || null,
});

export async function GET(req) {
  const { error } = await requireAdminSession();
  if (error) return error;

  await connectMongo();
  const query = String(req.nextUrl.searchParams.get("q") || "").trim();
  let userIds = null;
  if (query) {
    const matcher = new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    const users = await User.find({ $or: [{ email: matcher }, { name: matcher }] })
      .select("_id")
      .limit(50);
    userIds = users.map((user) => user._id);
  }

  const credentials = await ApiCredential.find(
    userIds ? { userId: { $in: userIds } } : {}
  )
    .populate("userId", "email name")
    .sort({ createdAt: -1 })
    .limit(100);

  return NextResponse.json({ credentials: credentials.map(serializeCredential) });
}

export async function POST(req) {
  const { session, error } = await requireAdminSession();
  if (error) return error;

  const body = await req.json();
  const name = String(body?.name || "").trim();
  const playerName = String(body?.playerName || "").trim();
  if (!name || !playerName) {
    return NextResponse.json(
      { error: "Credential name and player display name are required." },
      { status: 400 }
    );
  }
  if (name.length > 100 || playerName.length > 100) {
    return NextResponse.json({ error: "Names must be 100 characters or fewer." }, { status: 400 });
  }

  const expiresAt = body?.expiresAt ? new Date(body.expiresAt) : null;
  if (expiresAt && (Number.isNaN(expiresAt.getTime()) || expiresAt <= new Date())) {
    return NextResponse.json({ error: "Expiry must be in the future." }, { status: 400 });
  }

  await connectMongo();
  const generated = generateApiCredential();
  const internalEmail = `player-${crypto.randomUUID()}@ai.legalarena.invalid`;
  const user = await User.create({
    name: playerName,
    email: internalEmail,
    emailVerified: new Date(),
    accountType: "ai",
    aiManagedBy: session.user.email,
    freeAccessGranted: true,
    freeAccessGrantedAt: new Date(),
    freeAccessGrantedBy: session.user.email,
  });

  let credential;
  try {
    credential = await ApiCredential.create({
      userId: user._id,
      name,
      keyId: generated.keyId,
      secretHash: hashApiSecret(generated.secret),
      createdBy: session.user.email,
      expiresAt,
    });
  } catch (creationError) {
    await User.deleteOne({ _id: user._id, accountType: "ai" });
    throw creationError;
  }
  return NextResponse.json(
    {
      credential: {
        ...serializeCredential(credential),
        user: {
          id: user._id.toString(),
          email: user.email || "",
          name: user.name || "",
        },
      },
      apiKey: generated.apiKey,
    },
    { status: 201 }
  );
}
