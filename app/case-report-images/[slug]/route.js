import { NextResponse } from "next/server";
import { get } from "@vercel/blob";
import connectMongo from "@/libs/mongoose";
import BlogPost from "@/models/BlogPost";

export const runtime = "nodejs";

export async function GET(request, { params }) {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return NextResponse.json({ error: "Blob storage is not configured." }, { status: 404 });
  }

  const slug = String(params?.slug || "").trim().toLowerCase();
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.length > 140) {
    return NextResponse.json({ error: "Invalid case report image." }, { status: 400 });
  }

  try {
    await connectMongo();
    const published = await BlogPost.exists({ slug, status: "published" });
    if (!published) {
      return NextResponse.json({ error: "Case report image not found." }, { status: 404 });
    }

    const blob = await get(`case-reports/${slug}.webp`, {
      access: "private",
      useCache: true,
    });

    if (!blob || blob.statusCode === 304 || !blob.stream) {
      return new NextResponse(null, { status: blob?.statusCode || 404 });
    }

    return new NextResponse(blob.stream, {
      status: 200,
      headers: {
        "Content-Type": blob.blob.contentType || "image/webp",
        "Cache-Control": "public, max-age=86400, s-maxage=604800, stale-while-revalidate=2592000",
        ETag: blob.blob.etag,
      },
    });
  } catch (error) {
    console.error("Case report image proxy failed:", error);
    return NextResponse.json({ error: "Could not load case report image." }, { status: 404 });
  }
}
