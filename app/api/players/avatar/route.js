import { NextResponse } from "next/server";
import { getRequestSession } from "@/libs/api-auth";
import sharp from "sharp";
import { del, put } from "@vercel/blob";
import connectMongo from "@/libs/mongoose";
import { userCanAccessArena } from "@/libs/admin";
import User from "@/models/User";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_UPLOAD_BYTES = 12 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const OPENAI_IMAGE_EDIT_URL = "https://api.openai.com/v1/images/edits";
const IMAGE_MODEL = process.env.OPENAI_IMAGE_MODEL?.trim() || "gpt-image-1.5";

const HEADSHOT_PROMPT = [
  "Create a photorealistic professional lawyer headshot from the supplied photo.",
  "Preserve the person's facial identity and natural proportions.",
  "Use a consistent legal-professional presentation: polished office-worthy clothing such as a blazer, suit jacket, blouse, dress shirt, formal top, or other courtroom-appropriate business attire, with clean courtroom-ready grooming and a neutral grey studio background that matches a dark legal dashboard.",
  "Do not force a suit and tie, especially for women; use a tie only when it naturally fits the person's presentation.",
  "Compose as a centered upper-chest bust portrait suitable for a circular profile avatar, with the entire face, forehead, chin, ears, and full head clearly inside the frame.",
  "Leave comfortable grey background margin above the head and around both sides so the face is not cropped when shown in a circle.",
  "The pose and expression may vary naturally, but keep the outfit, grooming standard, lighting, and grey background consistent.",
  "Avoid caricature, illustration, glamour styling, badges, text, logos, robes, wigs, gavels, books, and courtroom props.",
].join(" ");

const getUploadedImage = async (request) => {
  const formData = await request.formData();
  const image = formData.get("image");

  if (!image || typeof image.arrayBuffer !== "function") {
    throw new Error("Choose an image to upload.");
  }

  if (!ALLOWED_IMAGE_TYPES.has(image.type)) {
    throw new Error("Upload a JPG, PNG, or WebP image.");
  }

  if (image.size > MAX_UPLOAD_BYTES) {
    throw new Error("Upload an image smaller than 12MB.");
  }

  return image;
};

const createLawyerHeadshot = async (image) => {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is not configured.");
  }

  const sourceBuffer = Buffer.from(await image.arrayBuffer());
  const normalizedInput = await sharp(sourceBuffer)
    .rotate()
    .resize(1024, 1024, {
      fit: "cover",
      position: "attention",
    })
    .png()
    .toBuffer();

  const body = new FormData();
  body.append("model", IMAGE_MODEL);
  body.append("image", new Blob([normalizedInput], { type: "image/png" }), "source.png");
  body.append("prompt", HEADSHOT_PROMPT);
  body.append("size", "1024x1024");
  body.append("quality", "medium");
  body.append("output_format", "webp");
  body.append("output_compression", "82");

  const response = await fetch(OPENAI_IMAGE_EDIT_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body,
  });

  if (!response.ok) {
    const errorBody = await response.text();
    console.error("OpenAI headshot generation failed:", response.status, errorBody);
    throw new Error("Could not generate the lawyer headshot.");
  }

  const payload = await response.json();
  const b64 = payload?.data?.[0]?.b64_json;

  if (!b64) {
    throw new Error("OpenAI did not return a generated image.");
  }

  return Buffer.from(b64, "base64");
};

const resizeHeadshot = async (imageBuffer) =>
  sharp(imageBuffer)
    .rotate()
    .resize(500, 500, {
      fit: "contain",
      position: "attention",
      background: { r: 111, g: 113, b: 118, alpha: 1 },
    })
    .webp({ quality: 82 })
    .toBuffer();

const storeHeadshot = async ({ buffer, userId }) => {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return `data:image/webp;base64,${buffer.toString("base64")}`;
  }

  const pathname = `lawyer-headshots/${userId}.webp`;
  const blob = await put(pathname, buffer, {
    access: "private",
    contentType: "image/webp",
    addRandomSuffix: false,
    allowOverwrite: true,
  });

  return {
    imageUrl: `/api/players/avatar/${userId}`,
    blobUrl: blob.url,
    pathname: blob.pathname,
  };
};

export async function POST(request) {
  const { session, error: authError } = await getRequestSession(request);
  if (authError) return authError;

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  if (!(await userCanAccessArena(session))) {
    return NextResponse.json(
      { error: "Legal Arena is still in development. Access is currently limited." },
      { status: 403 }
    );
  }

  try {
    const uploadedImage = await getUploadedImage(request);
    const generatedImage = await createLawyerHeadshot(uploadedImage);
    const resizedHeadshot = await resizeHeadshot(generatedImage);
    const storedHeadshot = await storeHeadshot({
      buffer: resizedHeadshot,
      userId: session.user.id,
    });

    await connectMongo();
    const user = await User.findById(session.user.id);

    if (!user) {
      return NextResponse.json({ error: "Player profile not found." }, { status: 404 });
    }

    user.image =
      typeof storedHeadshot === "string"
        ? storedHeadshot
        : `${storedHeadshot.imageUrl}?v=${Date.now()}`;
    await user.save();

    return NextResponse.json({
      ok: true,
      image: user.image,
      width: 500,
      height: 500,
      contentType: "image/webp",
      storage: process.env.BLOB_READ_WRITE_TOKEN ? "private-vercel-blob" : "inline-data-url",
    });
  } catch (error) {
    console.error("Avatar upload failed:", error);
    return NextResponse.json(
      { error: error?.message || "Could not update the profile image." },
      { status: 500 }
    );
  }
}

export async function DELETE(request) {
  const { session, error: authError } = await getRequestSession(request);
  if (authError) return authError;

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  if (!(await userCanAccessArena(session))) {
    return NextResponse.json(
      { error: "Legal Arena is still in development. Access is currently limited." },
      { status: 403 }
    );
  }

  try {
    await connectMongo();
    const user = await User.findById(session.user.id);

    if (!user) {
      return NextResponse.json({ error: "Player profile not found." }, { status: 404 });
    }

    if (
      process.env.BLOB_READ_WRITE_TOKEN &&
      String(user.image || "").startsWith("/api/players/avatar/")
    ) {
      await del(`lawyer-headshots/${session.user.id}.webp`);
    }

    user.image = "";
    await user.save();

    return NextResponse.json({ ok: true, image: "" });
  } catch (error) {
    console.error("Avatar delete failed:", error);
    return NextResponse.json(
      { error: error?.message || "Could not delete the profile image." },
      { status: 500 }
    );
  }
}
