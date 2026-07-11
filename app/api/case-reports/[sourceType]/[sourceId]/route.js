import { NextResponse } from "next/server";
import { getRequestSession } from "@/libs/api-auth";
import { getCaseReportStatus, publishCaseReport, unpublishCaseReport } from "@/libs/caseReports";

export const runtime = "nodejs";
export const maxDuration = 300;

const validType = (value) => ["caseSession", "challenge"].includes(value);
const auth = async (req) => {
  const result = await getRequestSession(req);
  if (result.error) return result;
  if (!result.session?.user?.id) return { error: NextResponse.json({ error: "Not signed in" }, { status: 401 }) };
  return result;
};
const respondError = (error) => NextResponse.json({ error: error?.message || "Could not update the case report." }, { status: error?.status || 500 });

export async function GET(req, { params }) {
  const { session, error } = await auth(req); if (error) return error;
  if (!validType(params.sourceType)) return NextResponse.json({ error: "Invalid report source." }, { status: 400 });
  try { return NextResponse.json({ report: await getCaseReportStatus({ sourceType: params.sourceType, sourceId: params.sourceId, viewerId: session.user.id }) }); } catch (cause) { return respondError(cause); }
}

export async function POST(req, { params }) {
  const { session, error } = await auth(req); if (error) return error;
  if (!validType(params.sourceType)) return NextResponse.json({ error: "Invalid report source." }, { status: 400 });
  try { return NextResponse.json({ report: await publishCaseReport({ sourceType: params.sourceType, sourceId: params.sourceId, userId: session.user.id }) }); } catch (cause) { console.error("Case report publication failed:", cause); return respondError(cause); }
}

export async function DELETE(req, { params }) {
  const { session, error } = await auth(req); if (error) return error;
  if (!validType(params.sourceType)) return NextResponse.json({ error: "Invalid report source." }, { status: 400 });
  try { return NextResponse.json({ report: await unpublishCaseReport({ sourceType: params.sourceType, sourceId: params.sourceId, userId: session.user.id }) }); } catch (cause) { return respondError(cause); }
}
