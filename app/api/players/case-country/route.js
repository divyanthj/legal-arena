import { NextResponse } from "next/server";
import { getRequestSession } from "@/libs/api-auth";
import {
  getPlayerCaseCountryPreference,
  setPlayerCaseCountryPreference,
} from "@/libs/game/countryPreference";
import { buildCaseCountry, isValidCountryCode } from "@/libs/game/countries";

export async function GET(req) {
  const { session, error } = await getRequestSession(req);
  if (error) return error;
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const countryCode = await getPlayerCaseCountryPreference(session.user.id);
  return NextResponse.json({ caseCountry: buildCaseCountry(countryCode) });
}

export async function PATCH(req) {
  const { session, error } = await getRequestSession(req);
  if (error) return error;
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const body = await req.json();
  if (!isValidCountryCode(body?.countryCode)) {
    return NextResponse.json({ error: "Choose a supported country." }, { status: 400 });
  }

  const countryCode = await setPlayerCaseCountryPreference({
    userId: session.user.id,
    countryCode: body.countryCode,
  });
  return NextResponse.json({ caseCountry: buildCaseCountry(countryCode) });
}
