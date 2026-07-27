import { NextResponse } from "next/server";
import { getRequestSession } from "@/libs/api-auth";
import {
  getResultShareData,
  renderResultShareImage,
} from "@/libs/resultShareImage";

export const runtime = "nodejs";

const respondError = (error) =>
  NextResponse.json(
    { error: error?.message || "Could not create the result card." },
    { status: error?.status || 500 }
  );

export async function GET(req, { params }) {
  const { session, error: authError } = await getRequestSession(req);
  if (authError) return authError;
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }
  if (!["caseSession", "challenge"].includes(params.sourceType)) {
    return NextResponse.json({ error: "Invalid result source." }, { status: 400 });
  }

  try {
    const data = await getResultShareData({
      sourceType: params.sourceType,
      sourceId: params.sourceId,
      userId: session.user.id,
    });
    const image = await renderResultShareImage(data);

    return new NextResponse(new Uint8Array(image), {
      status: 200,
      headers: {
        "Content-Type": "image/png",
        "Content-Length": String(image.length),
        "Content-Disposition": `inline; filename="${data.fileName}"`,
        "Cache-Control": "private, no-store, max-age=0",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    if (!error?.status || error.status >= 500) {
      console.error("Result share image generation failed:", error);
    }
    return respondError(error);
  }
}
