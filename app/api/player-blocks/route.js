import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { getRequestSession } from "@/libs/api-auth";
import connectMongo from "@/libs/mongoose";
import PlayerBlock from "@/models/PlayerBlock";
import User from "@/models/User";

export async function POST(req) {
  const { session, error: authError } = await getRequestSession(req);
  if (authError) return authError;
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const blockedId = String(body?.blockedPlayerId || "");

  if (
    !mongoose.Types.ObjectId.isValid(blockedId) ||
    blockedId === String(session.user.id)
  ) {
    return NextResponse.json({ error: "Choose a valid player to block." }, { status: 400 });
  }

  await connectMongo();
  const target = await User.findOne({
    _id: blockedId,
    accountType: "human",
    deletedAt: null,
  })
    .select("_id")
    .lean();
  if (!target) {
    return NextResponse.json({ error: "Player not found." }, { status: 404 });
  }

  const block = await PlayerBlock.findOneAndUpdate(
    { blockerId: session.user.id, blockedId },
    {
      $set: {
        reason: String(body?.reason || "").trim().slice(0, 500),
      },
      $setOnInsert: {
        blockerId: session.user.id,
        blockedId,
      },
    },
    { upsert: true, new: true }
  );

  return NextResponse.json({ blocked: true, blockId: String(block._id) });
}

export async function DELETE(req) {
  const { session, error: authError } = await getRequestSession(req);
  if (authError) return authError;
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const blockedId = String(body?.blockedPlayerId || "");
  if (!mongoose.Types.ObjectId.isValid(blockedId)) {
    return NextResponse.json({ error: "Choose a valid player." }, { status: 400 });
  }

  await connectMongo();
  await PlayerBlock.deleteOne({ blockerId: session.user.id, blockedId });
  return NextResponse.json({ blocked: false });
}
