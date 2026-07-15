import { NextResponse } from "next/server";
import { getRequestSession } from "@/libs/api-auth";
import connectMongo from "@/libs/mongoose";
import LawyerTitle from "@/models/LawyerTitle";
import PlayerLawyerTitle from "@/models/PlayerLawyerTitle";
import User from "@/models/User";

export async function PATCH(req) {
  const { session, error } = await getRequestSession(req);
  if (error) return error;
  if (!session?.user?.id) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  try {
    await connectMongo();
    const { titleCode } = await req.json();
    if (!titleCode) {
      await User.updateOne({ _id: session.user.id }, { $set: { selectedLawyerTitleId: null } });
      return NextResponse.json({ selectedTitle: null });
    }
    const title = await LawyerTitle.findOne({ code: String(titleCode), enabled: true });
    if (!title) return NextResponse.json({ error: "Title not found" }, { status: 404 });
    const unlocked = await PlayerLawyerTitle.exists({ playerId: session.user.id, lawyerTitleId: title._id });
    if (!unlocked) return NextResponse.json({ error: "This title is still locked." }, { status: 403 });
    await User.updateOne({ _id: session.user.id }, { $set: { selectedLawyerTitleId: title._id } });
    return NextResponse.json({ selectedTitle: { code: title.code, name: title.name, emoji: title.emoji } });
  } catch (caught) {
    console.error(caught);
    return NextResponse.json({ error: caught.message }, { status: 500 });
  }
}

