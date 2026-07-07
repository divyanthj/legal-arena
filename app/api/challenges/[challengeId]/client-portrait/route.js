import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import sharp from "sharp";
import { get, put } from "@vercel/blob";
import { authOptions } from "@/libs/next-auth";
import { getChallengeDocumentForUser, buildChallengePayload } from "@/libs/game/challenges";

export const runtime = "nodejs";
export const maxDuration = 60;

const OPENAI_IMAGE_GENERATION_URL = "https://api.openai.com/v1/images/generations";
const IMAGE_MODEL = process.env.OPENAI_IMAGE_MODEL?.trim() || "gpt-image-1.5";
const PORTRAIT_PROMPT_VERSION = 3;
const PORTRAIT_WIDTH = 640;
const PORTRAIT_HEIGHT = 720;

const organizationPattern =
  /\b(llc|inc|corp|corporation|company|co\.|ltd|limited|partners|partnership|group|holdings|apartments|properties|renovations|services|studio|agency|association|school|university|department|city|county|state)\b/i;

const toId = (value) => String(value?._id || value?.id || value || "");

const getPortraitTarget = (request) => {
  const url = new URL(request.url);
  return url.searchParams.get("target") === "opponent" ? "opponent" : "client";
};

const getPortraitParticipantId = (request) => {
  const url = new URL(request.url);
  return String(url.searchParams.get("participantId") || "").trim();
};

const getParticipantForTarget = (challenge, userId, target) => {
  const participants = challenge.participants || [];
  return target === "opponent"
    ? participants.find((participant) => toId(participant.userId) !== toId(userId))
    : participants.find((participant) => toId(participant.userId) === toId(userId));
};

const getParticipantForRequest = (challenge, userId, request, target) => {
  const participantId = getPortraitParticipantId(request);
  const participants = challenge.participants || [];

  if (participantId) {
    return participants.find((participant) => toId(participant.userId) === participantId);
  }

  return getParticipantForTarget(challenge, userId, target);
};

const getPartyName = (challenge, participant) =>
  participant?.side === "opponent"
    ? challenge.premise?.opponentName || challenge.templateSnapshot?.opponentName || "Opponent"
    : challenge.premise?.clientName || challenge.templateSnapshot?.clientName || "Client";

const getChallengeId = (challenge) => toId(challenge._id || challenge.id);

const getPortraitBlobPath = (challenge, participant) =>
  `challenge-party-portraits/${getChallengeId(challenge)}-${toId(participant.userId)}.webp`;

const getPortraitImageUrl = (challenge, participant) => {
  const baseUrl = `/api/challenges/${challenge.slug || getChallengeId(challenge)}/client-portrait`;
  const version = Date.now();
  return `${baseUrl}?participantId=${toId(participant.userId)}&v=${version}`;
};

const buildPortraitPrompt = (challenge, participant, target) => {
  const name = getPartyName(challenge, participant);
  const isOrganization = organizationPattern.test(name);
  const context = [
    challenge.practiceArea,
    challenge.primaryCategory,
    challenge.premise?.overview,
    participant?.clientMemoryExcerpt,
  ]
    .filter(Boolean)
    .join(" | ");

  return [
    `Create a photorealistic portrait for a fictional legal game ${target === "opponent" ? "opposing party" : "client"} seated across a table from their lawyer in a quiet lawyer's office.`,
    `Subject identity cue: ${name}.`,
    `Case context: ${context || "civil legal dispute"}.`,
    isOrganization
      ? "The party is an organization, so show a realistic representative or owner in business attire such as a suit jacket, dress shirt, or suit and tie."
      : "The party is a person, so show normal everyday clothing that fits an ordinary client, not a lawyer headshot and not overly formal.",
    "Use a realistic face, natural expression, soft office lighting, lawyer-office background, client seated at a consultation table, shoulders and upper torso visible.",
    "Compose this as a vertical rectangular case-card portrait, not a circular avatar. Do not place the person inside a circle, white badge, round mask, profile bubble, or sticker frame.",
    "Avoid text, logos, badges, robes, gavels, courtroom props, caricature, illustration, celebrity resemblance, and dramatic fashion styling.",
  ].join(" ");
};

const createPortrait = async (prompt) => {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is not configured.");
  }

  const response = await fetch(OPENAI_IMAGE_GENERATION_URL, {
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
    const errorBody = await response.text();
    console.error("OpenAI challenge portrait generation failed:", response.status, errorBody);
    throw new Error("Could not generate the challenge portrait.");
  }

  const payload = await response.json();
  const b64 = payload?.data?.[0]?.b64_json;

  if (!b64) {
    throw new Error("OpenAI did not return a generated image.");
  }

  return Buffer.from(b64, "base64");
};

const resizePortrait = async (imageBuffer) =>
  sharp(imageBuffer)
    .rotate()
    .resize(PORTRAIT_WIDTH, PORTRAIT_HEIGHT, {
      fit: "cover",
      position: "attention",
    })
    .webp({ quality: 82 })
    .toBuffer();

const storePortrait = async ({ buffer, challenge, participant }) => {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return `data:image/webp;base64,${buffer.toString("base64")}`;
  }

  await put(getPortraitBlobPath(challenge, participant), buffer, {
    access: "private",
    contentType: "image/webp",
    addRandomSuffix: false,
    allowOverwrite: true,
  });

  return getPortraitImageUrl(challenge, participant);
};

export async function GET(request, { params }) {
  const target = getPortraitTarget(request);
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return NextResponse.json({ error: "Blob storage is not configured." }, { status: 404 });
  }

  try {
    const challenge = await getChallengeDocumentForUser({
      userId: session.user.id,
      challengeId: params.challengeId,
    });
    const participant = challenge
      ? getParticipantForRequest(challenge, session.user.id, request, target)
      : null;

    if (!challenge || !participant) {
      return NextResponse.json({ error: "Challenge not found" }, { status: 404 });
    }

    const blob = await get(getPortraitBlobPath(challenge, participant), {
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
    console.error("Challenge portrait proxy failed:", error);
    return NextResponse.json({ error: "Could not load challenge portrait." }, { status: 404 });
  }
}

export async function POST(request, { params }) {
  const target = getPortraitTarget(request);
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  try {
    const challenge = await getChallengeDocumentForUser({
      userId: session.user.id,
      challengeId: params.challengeId,
    });
    const participant = challenge
      ? getParticipantForRequest(challenge, session.user.id, request, target)
      : null;

    if (!challenge || !participant) {
      return NextResponse.json({ error: "Challenge not found" }, { status: 404 });
    }

    if (
      participant.clientPortrait?.image &&
      participant.clientPortrait?.promptVersion >= PORTRAIT_PROMPT_VERSION
    ) {
      return NextResponse.json({
        ok: true,
        challenge: await buildChallengePayload({ challenge, viewerUserId: session.user.id }),
        image: participant.clientPortrait.image,
        reused: true,
      });
    }

    const prompt = buildPortraitPrompt(challenge, participant, target);
    const generatedImage = await createPortrait(prompt);
    const resizedPortrait = await resizePortrait(generatedImage);
    const image = await storePortrait({
      buffer: resizedPortrait,
      challenge,
      participant,
    });

    participant.clientPortrait = {
      image,
      generatedAt: new Date(),
      prompt,
      promptVersion: PORTRAIT_PROMPT_VERSION,
    };
    challenge.markModified?.("participants");
    await challenge.save();

    return NextResponse.json({
      ok: true,
      challenge: await buildChallengePayload({ challenge, viewerUserId: session.user.id }),
      image,
      width: PORTRAIT_WIDTH,
      height: PORTRAIT_HEIGHT,
      contentType: "image/webp",
      storage: process.env.BLOB_READ_WRITE_TOKEN ? "private-vercel-blob" : "inline-data-url",
    });
  } catch (error) {
    console.error("Challenge portrait generation failed:", error);
    return NextResponse.json(
      { error: error?.message || "Could not generate the challenge portrait." },
      { status: 500 }
    );
  }
}
