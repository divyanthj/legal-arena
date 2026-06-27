import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import sharp from "sharp";
import { get, put } from "@vercel/blob";
import { authOptions } from "@/libs/next-auth";
import { getSoloGameplayAccessForSession } from "@/libs/admin";
import {
  buildCasePayload,
  getCaseSessionDocumentForUser,
} from "@/libs/game/store";

export const runtime = "nodejs";
export const maxDuration = 60;

const OPENAI_IMAGE_GENERATION_URL = "https://api.openai.com/v1/images/generations";
const IMAGE_MODEL = process.env.OPENAI_IMAGE_MODEL?.trim() || "gpt-image-1.5";
const PORTRAIT_PROMPT_VERSION = 3;
const PORTRAIT_WIDTH = 640;
const PORTRAIT_HEIGHT = 720;

const organizationPattern =
  /\b(llc|inc|corp|corporation|company|co\.|ltd|limited|partners|partnership|group|holdings|apartments|properties|renovations|services|studio|agency|association|school|university|department|city|county|state)\b/i;

const masculineGivenNameCues = new Set([
  "ben",
  "caleb",
  "chris",
  "daniel",
  "david",
  "elliot",
  "elliott",
  "evan",
  "james",
  "john",
  "joseph",
  "michael",
  "nathan",
  "paul",
  "ryan",
  "samuel",
  "thomas",
  "william",
]);

const feminineGivenNameCues = new Set([
  "anna",
  "emily",
  "emma",
  "jessica",
  "laura",
  "maya",
  "olivia",
  "rachel",
  "rebecca",
  "sarah",
  "sophia",
  "susan",
]);

const countPatternMatches = (text, pattern) => {
  const matches = String(text || "").match(pattern);
  return matches ? matches.length : 0;
};

const stringifyCueSource = (value) => {
  if (!value) {
    return "";
  }

  if (typeof value === "string") {
    return value;
  }

  try {
    return JSON.stringify(value);
  } catch {
    return "";
  }
};

const getPortraitTarget = (request) => {
  const url = new URL(request.url);
  return url.searchParams.get("target") === "opponent" ? "opponent" : "client";
};

const getPortraitField = (target) =>
  target === "opponent" ? "opponentPortrait" : "clientPortrait";

const getPortraitBlobPath = (caseSession, target) => {
  const caseId = getCaseObjectId(caseSession);
  return target === "opponent"
    ? `opponent-portraits/${caseId}.webp`
    : `client-portraits/${caseId}.webp`;
};

const getPortraitImageUrl = (caseSession, target) => {
  const caseId = getCaseObjectId(caseSession);
  const baseUrl = `/api/cases/${caseSession.slug || caseId}/client-portrait`;
  const version = Date.now();

  return target === "opponent"
    ? `${baseUrl}?target=opponent&v=${version}`
    : `${baseUrl}?v=${version}`;
};

const getPortraitSubject = (caseSession, target = "client") => {
  const targetSide =
    target === "opponent"
      ? caseSession.opponentSide || (caseSession.playerSide === "opponent" ? "client" : "opponent")
      : caseSession.playerSide;
  const subjectName =
    targetSide === "opponent"
      ? caseSession.premise?.opponentName
      : caseSession.premise?.clientName;
  const fallbackName =
    targetSide === "opponent"
      ? caseSession.opponentPartyName
      : caseSession.playerPartyName;
  const name = String(subjectName || fallbackName || "client").trim();
  const isOrganization = organizationPattern.test(name);

  return { name, isOrganization };
};

const getGivenNameCue = (name) =>
  String(name || "")
    .trim()
    .split(/\s+/)[0]
    ?.toLowerCase()
    .replace(/[^a-z-]/g, "");

const buildGenderPresentationGuidance = ({ caseSession, subjectName, isOrganization }) => {
  const cueText = [
    caseSession.premise?.overview,
    caseSession.premise?.openingStatement,
    caseSession.premise?.desiredRelief,
    caseSession.clientMemoryExcerpt,
    ...(caseSession.interviewTranscript || []).map((entry) => entry.text),
    stringifyCueSource(caseSession.canonicalStory),
    stringifyCueSource(caseSession.templateSnapshot),
  ]
    .filter(Boolean)
    .join(" ")
    .slice(0, 12000);

  const feminineScore =
    countPatternMatches(
      cueText,
      /\b(she|her|hers|herself|woman|female|mother|wife|daughter|sister|landlady|businesswoman|madam|ms\.|mrs\.)\b/gi
    ) + countPatternMatches(cueText, /\b(client|tenant|owner|plaintiff|defendant)\s+(is|was|says|said|claims|claimed|told|asked)\s+she\b/gi);

  const masculineScore =
    countPatternMatches(
      cueText,
      /\b(he|him|his|himself|man|male|father|husband|son|brother|landlord|businessman|sir|mr\.)\b/gi
    ) + countPatternMatches(cueText, /\b(client|tenant|owner|plaintiff|defendant)\s+(is|was|says|said|claims|claimed|told|asked)\s+he\b/gi);

  const nonBinaryScore =
    countPatternMatches(cueText, /\b(nonbinary|non-binary|gender-neutral|gender neutral)\b/gi) +
    countPatternMatches(cueText, /\b(they|them|their|theirs|themself|themselves)\b/gi);

  if (nonBinaryScore >= 2 && nonBinaryScore > feminineScore && nonBinaryScore > masculineScore) {
    return "Case text suggests they/them or non-binary cues; depict a gender-neutral or non-binary adult presentation.";
  }

  if (feminineScore >= 2 && feminineScore > masculineScore) {
    return isOrganization
      ? "Case text suggests feminine cues for the representative; depict a female-presenting adult representative."
      : "Case text suggests feminine cues for the client; depict a female-presenting adult client.";
  }

  if (masculineScore >= 2 && masculineScore > feminineScore) {
    return isOrganization
      ? "Case text suggests masculine cues for the representative; depict a male-presenting adult representative."
      : "Case text suggests masculine cues for the client; depict a male-presenting adult client.";
  }

  const givenNameCue = getGivenNameCue(subjectName);
  if (masculineGivenNameCues.has(givenNameCue)) {
    return isOrganization
      ? `The representative name "${subjectName}" is conventionally masculine in this context, and the case text does not contradict that; depict a male-presenting adult representative.`
      : `The client name "${subjectName}" is conventionally masculine in this context, and the case text does not contradict that; depict a male-presenting adult client.`;
  }

  if (feminineGivenNameCues.has(givenNameCue)) {
    return isOrganization
      ? `The representative name "${subjectName}" is conventionally feminine in this context, and the case text does not contradict that; depict a female-presenting adult representative.`
      : `The client name "${subjectName}" is conventionally feminine in this context, and the case text does not contradict that; depict a female-presenting adult client.`;
  }

  return "Gender presentation is not clearly specified. Choose a plausible adult presentation without treating the name as definitive or relying on stereotypes; ambiguous names such as Alex Morgan may be woman, man, or androgynous if the case text does not specify.";
};

const buildClientPortraitPrompt = (caseSession, target = "client") => {
  const { name, isOrganization } = getPortraitSubject(caseSession, target);
  const genderGuidance = buildGenderPresentationGuidance({
    caseSession,
    subjectName: name,
    isOrganization,
  });
  const context = [
    caseSession.practiceArea,
    caseSession.primaryCategory,
    caseSession.premise?.overview,
    caseSession.clientMemoryExcerpt,
  ]
    .filter(Boolean)
    .join(" | ");

  return [
    `Create a photorealistic portrait for a fictional legal game ${target === "opponent" ? "opposing party" : "client"} seated across a table from their lawyer in a quiet lawyer's office.`,
    `Subject identity cue: ${name}.`,
    `Case context: ${context || "civil legal dispute"}.`,
    genderGuidance,
    isOrganization
      ? "The client is an organization, so show a realistic representative or owner in business attire such as a suit jacket, dress shirt, or suit and tie."
      : "The client is a person, so show normal everyday clothing that fits an ordinary client, not a lawyer headshot and not overly formal.",
    "Use the same visual family as a polished legal dashboard portrait: realistic face, natural expression, soft office lighting, lawyer-office background, client seated at a consultation table, shoulders and upper torso visible.",
    "Compose this as a vertical rectangular case-card portrait, not a circular avatar. Do not place the person inside a circle, white badge, round mask, profile bubble, or sticker frame.",
    "Frame the subject as if the viewer is the lawyer sitting across from them: slight conversational distance, natural seated posture, full head, face, neck, and upper shoulders visible with enough office background for a clean rectangular crop.",
    "Avoid text, logos, badges, robes, gavels, courtroom props, caricature, illustration, celebrity resemblance, and dramatic fashion styling.",
  ].join(" ");
};

const createClientPortrait = async (prompt) => {
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
    console.error("OpenAI client portrait generation failed:", response.status, errorBody);
    throw new Error("Could not generate the client portrait.");
  }

  const payload = await response.json();
  const b64 = payload?.data?.[0]?.b64_json;

  if (!b64) {
    throw new Error("OpenAI did not return a generated image.");
  }

  return Buffer.from(b64, "base64");
};

const resizeClientPortrait = async (imageBuffer) =>
  sharp(imageBuffer)
    .rotate()
    .resize(PORTRAIT_WIDTH, PORTRAIT_HEIGHT, {
      fit: "cover",
      position: "attention",
    })
    .webp({ quality: 82 })
    .toBuffer();

const getCaseObjectId = (caseSession) =>
  String(caseSession?._id || caseSession?.id || "").trim();

const storeClientPortrait = async ({ buffer, caseSession, target = "client" }) => {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return `data:image/webp;base64,${buffer.toString("base64")}`;
  }

  const pathname = getPortraitBlobPath(caseSession, target);
  await put(pathname, buffer, {
    access: "private",
    contentType: "image/webp",
    addRandomSuffix: false,
    allowOverwrite: true,
  });

  return getPortraitImageUrl(caseSession, target);
};

const authorize = async ({ session, caseId, action = "read" }) => {
  if (!session?.user?.id) {
    return { allowed: false, status: 401, message: "Not signed in" };
  }

  return getSoloGameplayAccessForSession({
    session,
    caseId,
    action,
  });
};

export async function GET(request, { params }) {
  const target = getPortraitTarget(request);
  const session = await getServerSession(authOptions);
  const access = await authorize({ session, caseId: params.caseId, action: "read" });

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

    if (!caseSession) {
      return NextResponse.json({ error: "Case not found" }, { status: 404 });
    }

    const blob = await get(getPortraitBlobPath(caseSession, target), {
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
    console.error("Client portrait proxy failed:", error);
    return NextResponse.json({ error: "Could not load client portrait." }, { status: 404 });
  }
}

export async function POST(request, { params }) {
  const target = getPortraitTarget(request);
  const portraitField = getPortraitField(target);
  const session = await getServerSession(authOptions);
  const access = await authorize({ session, caseId: params.caseId, action: "read" });

  if (!access.allowed) {
    return NextResponse.json({ error: access.message }, { status: access.status || 403 });
  }

  try {
    const caseSession = await getCaseSessionDocumentForUser({
      userId: session.user.id,
      caseId: params.caseId,
    });

    if (!caseSession) {
      return NextResponse.json({ error: "Case not found" }, { status: 404 });
    }

    const existingPortrait = caseSession[portraitField];

    if (existingPortrait?.image && existingPortrait?.promptVersion >= PORTRAIT_PROMPT_VERSION) {
      return NextResponse.json({
        ok: true,
        caseSession: buildCasePayload(caseSession),
        image: existingPortrait.image,
        reused: true,
      });
    }

    const prompt = buildClientPortraitPrompt(caseSession, target);
    const generatedImage = await createClientPortrait(prompt);
    const resizedPortrait = await resizeClientPortrait(generatedImage);
    const image = await storeClientPortrait({
      buffer: resizedPortrait,
      caseSession,
      target,
    });

    caseSession[portraitField] = {
      image,
      generatedAt: new Date(),
      prompt,
      promptVersion: PORTRAIT_PROMPT_VERSION,
    };
    caseSession.markModified?.(portraitField);
    await caseSession.save();

    return NextResponse.json({
      ok: true,
      caseSession: buildCasePayload(caseSession),
      image,
      width: PORTRAIT_WIDTH,
      height: PORTRAIT_HEIGHT,
      contentType: "image/webp",
      storage: process.env.BLOB_READ_WRITE_TOKEN ? "private-vercel-blob" : "inline-data-url",
    });
  } catch (error) {
    console.error("Client portrait generation failed:", error);
    return NextResponse.json(
      { error: error?.message || "Could not generate the client portrait." },
      { status: 500 }
    );
  }
}
