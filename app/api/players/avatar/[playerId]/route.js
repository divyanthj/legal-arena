import { NextResponse } from "next/server";
import { get } from "@vercel/blob";

export const runtime = "nodejs";

export async function GET(request, { params }) {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return NextResponse.json({ error: "Blob storage is not configured." }, { status: 404 });
  }

  const playerId = String(params?.playerId || "").trim();

  if (!/^[a-f\d]{24}$/i.test(playerId)) {
    return NextResponse.json({ error: "Invalid player image." }, { status: 400 });
  }

  try {
    const blob = await get(`lawyer-headshots/${playerId}.webp`, {
      access: "private",
      useCache: false,
    });

    if (!blob || blob.statusCode === 304 || !blob.stream) {
      return new NextResponse(null, { status: blob?.statusCode || 404 });
    }

    return new NextResponse(blob.stream, {
      status: 200,
      headers: {
        "Content-Type": blob.blob.contentType || "image/webp",
        "Cache-Control": "private, no-store, max-age=0",
        ETag: blob.blob.etag,
      },
    });
  } catch (error) {
    console.error("Avatar image proxy failed:", error);
    return NextResponse.json({ error: "Could not load profile image." }, { status: 404 });
  }
}
