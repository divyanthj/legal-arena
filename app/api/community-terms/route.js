import { NextResponse } from "next/server";
import { getRequestSession } from "@/libs/api-auth";
import {
  acceptCommunityTerms,
  getCommunityTermsStatus,
} from "@/libs/communitySafety";

export async function GET(req) {
  const { session, error: authError } = await getRequestSession(req);
  if (authError) return authError;
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }
  return NextResponse.json(await getCommunityTermsStatus(session.user.id), {
    headers: { "Cache-Control": "no-store, max-age=0" },
  });
}

export async function POST(req) {
  const { session, error: authError } = await getRequestSession(req);
  if (authError) return authError;
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  if (body?.accepted !== true) {
    return NextResponse.json(
      { error: "You must explicitly accept the Community Rules." },
      { status: 400 }
    );
  }

  return NextResponse.json(await acceptCommunityTerms(session.user.id));
}
