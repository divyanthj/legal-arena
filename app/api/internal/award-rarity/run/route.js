import { NextResponse } from "next/server";
import { hasValidNudgeSecret } from "@/libs/emailNudgesCore";
import { computeAwardRarity } from "@/libs/game/awards/service";

const handle = async (req) => {
  const body = await req.json().catch(() => ({}));
  const query = Object.fromEntries(new URL(req.url).searchParams.entries());
  if (!hasValidNudgeSecret({ headers: Object.fromEntries(req.headers.entries()), query, body, secret: process.env.CRON_SECRET })) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try { return NextResponse.json(await computeAwardRarity()); }
  catch (error) { console.error(error); return NextResponse.json({ error: error.message }, { status: 500 }); }
};
export const GET = handle;
export const POST = handle;

