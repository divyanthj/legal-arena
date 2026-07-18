import { NextResponse } from "next/server";
import sharp from "sharp";
import { get, put } from "@vercel/blob";
import { getRequestSession } from "@/libs/api-auth";
import { getSoloGameplayAccessForSession } from "@/libs/admin";
import {
  buildCasePayload,
  getCaseSessionDocumentForUser,
} from "@/libs/game/store";

export const runtime = "nodejs";
export const maxDuration = 60;

const IMAGE_URL = "https://api.openai.com/v1/images/generations";
const IMAGE_MODEL = process.env.OPENAI_IMAGE_MODEL?.trim() || "gpt-image-1.5";
const PROMPT_VERSION = 1;
const WIDTH = 640;
const HEIGHT = 720;

const cleanId = (value = "") =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);

const getCaseId = (caseSession) => String(caseSession?._id || caseSession?.id || "").trim();

const getWitnessId = (request) => {
  const url = new URL(request.url);
  return cleanId(url.searchParams.get("witnessId"));
};

const getBlobPath = (caseSession, witnessId) =>
  `witness-portraits/${getCaseId(caseSession)}/${cleanId(witnessId)}.webp`;

const getImageUrl = (caseSession, witnessId) =>
  `/api/cases/${caseSession.slug || getCaseId(caseSession)}/witness-portrait?witnessId=${encodeURIComponent(
    cleanId(witnessId)
  )}&v=${Date.now()}`;

const getWitness = (caseSession, witnessId) =>
  (caseSession.witnesses || []).find((item) => cleanId(item.id) === cleanId(witnessId));

const authorize = async ({ session, caseId, action = "read" }) => {
  if (!session?.user?.id) {
    return { allowed: false, status: 401, message: "Not signed in" };
  }
  return getSoloGameplayAccessForSession({ session, caseId, action });
};

const buildPrompt = (caseSession, witness) =>
  [
    "Create a photorealistic portrait of a fictional fact witness for a polished legal strategy game.",
    `Witness: ${witness.name}, ${witness.role}.`,
    `Country setting: ${caseSession.caseCountry?.name || "a contemporary civil court"}.`,
    `Stable appearance and wardrobe direction: ${witness.appearance || "ordinary adult in credible courtroom clothing"}.`,
    `Natural expression direction: ${witness.portraitDirection?.expressionCue || "attentive and composed with slight natural tension"}.`,
    `Natural posture direction: ${witness.portraitDirection?.bodyLanguage || "seated upright in the witness box"}.`,
    "The expression must be subtle and psychologically ambiguous: it may suggest composure, nervousness, guardedness, or openness, but must never look like a morality label or a giveaway that the witness is truthful or untruthful.",
    "Use realistic skin texture, natural facial asymmetry, restrained courtroom lighting, and an understated courthouse background with shallow depth of field.",
    "Frame vertically from upper torso through the full head, looking slightly toward examining counsel rather than directly posing for a headshot.",
    "Reflect real human diversity without turning nationality, occupation, gender, age, ethnicity, disability, religion, clothing, or attractiveness into a credibility signal.",
    "No text, logos, badges, robes, gavels, jury, caricature, illustration, celebrity resemblance, melodramatic lighting, sinister styling, halo lighting, or watermark.",
  ].join(" ");

const generatePortrait = async (prompt) => {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is not configured.");
  }
  const response = await fetch(IMAGE_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: IMAGE_MODEL,
      prompt,
      size: "1024x1024",
      quality: "medium",
      output_format: "webp",
      output_compression: 82,
    }),
  });
  if (!response.ok) {
    console.error("Witness portrait generation failed", response.status, await response.text());
    throw new Error("Could not generate the witness portrait.");
  }
  const payload = await response.json();
  const b64 = payload?.data?.[0]?.b64_json;
  if (!b64) throw new Error("OpenAI did not return a witness portrait.");
  return Buffer.from(b64, "base64");
};

const resizePortrait = (buffer) =>
  sharp(buffer)
    .rotate()
    .resize(WIDTH, HEIGHT, { fit: "cover", position: "attention" })
    .webp({ quality: 82 })
    .toBuffer();

export async function GET(request, { params }) {
  const witnessId = getWitnessId(request);
  const { session, error: authError } = await getRequestSession(request);
  if (authError) return authError;
  const access = await authorize({ session, caseId: params.caseId });
  if (!access.allowed) {
    return NextResponse.json({ error: access.message }, { status: access.status || 403 });
  }
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return NextResponse.json({ error: "Blob storage is not configured." }, { status: 404 });
  }
  try {
    const caseSession = await getCaseSessionDocumentForUser({
      userId: session.user.id,
      caseId: params.caseId,
    });
    if (!caseSession || !getWitness(caseSession, witnessId)) {
      return NextResponse.json({ error: "Witness not found" }, { status: 404 });
    }
    const blob = await get(getBlobPath(caseSession, witnessId), {
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
    console.error("Witness portrait proxy failed", error);
    return NextResponse.json({ error: "Could not load witness portrait." }, { status: 404 });
  }
}

export async function POST(request, { params }) {
  const witnessId = getWitnessId(request);
  const { session, error: authError } = await getRequestSession(request);
  if (authError) return authError;
  const access = await authorize({ session, caseId: params.caseId });
  if (!access.allowed) {
    return NextResponse.json({ error: access.message }, { status: access.status || 403 });
  }
  try {
    const caseSession = await getCaseSessionDocumentForUser({
      userId: session.user.id,
      caseId: params.caseId,
    });
    const witness = caseSession && getWitness(caseSession, witnessId);
    if (!witness) {
      return NextResponse.json({ error: "Witness not found" }, { status: 404 });
    }
    if (witness.portrait?.image && witness.portrait?.promptVersion >= PROMPT_VERSION) {
      return NextResponse.json({
        ok: true,
        caseSession: buildCasePayload(caseSession),
        image: witness.portrait.image,
        reused: true,
      });
    }

    const prompt = buildPrompt(caseSession, witness);
    const imageBuffer = await resizePortrait(await generatePortrait(prompt));
    const image = process.env.BLOB_READ_WRITE_TOKEN
      ? getImageUrl(caseSession, witnessId)
      : `data:image/webp;base64,${imageBuffer.toString("base64")}`;

    if (process.env.BLOB_READ_WRITE_TOKEN) {
      await put(getBlobPath(caseSession, witnessId), imageBuffer, {
        access: "private",
        contentType: "image/webp",
        addRandomSuffix: false,
        allowOverwrite: true,
      });
    }

    witness.portrait = {
      image,
      generatedAt: new Date(),
      prompt,
      promptVersion: PROMPT_VERSION,
    };
    caseSession.markModified?.("witnesses");
    await caseSession.save();

    return NextResponse.json({
      ok: true,
      caseSession: buildCasePayload(caseSession),
      image,
      width: WIDTH,
      height: HEIGHT,
    });
  } catch (error) {
    console.error("Witness portrait generation failed", error);
    return NextResponse.json(
      { error: error?.message || "Could not generate the witness portrait." },
      { status: 500 }
    );
  }
}

