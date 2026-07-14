import { NextResponse } from "next/server";
import { getRequestSession } from "@/libs/api-auth";
import sharp from "sharp";
import { get, put } from "@vercel/blob";
import { getChallengeDocumentForUser, buildChallengePayload } from "@/libs/game/challenges";
import { buildPortraitWardrobeGuidance } from "@/libs/game/portraitWardrobe";

export const runtime = "nodejs";
export const maxDuration = 60;

const OPENAI_IMAGE_GENERATION_URL = "https://api.openai.com/v1/images/generations";
const IMAGE_MODEL = process.env.OPENAI_IMAGE_MODEL?.trim() || "gpt-image-1.5";
const PORTRAIT_PROMPT_VERSION = 7;
const PORTRAIT_WIDTH = 640;
const PORTRAIT_HEIGHT = 720;

const organizationPattern =
  /\b(llc|inc|corp|corporation|company|co\.|ltd|limited|partners|partnership|group|holdings|apartments|properties|renovations|services|studio|agency|association|school|university|department|city|county|state)\b/i;

const masculineGivenNameCues = new Set([
  "ben",
  "caleb",
  "chris",
  "daniel",
  "darren",
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

const toId = (value) => String(value?._id || value?.id || value || "");

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

const getGivenNameCue = (name) =>
  String(name || "")
    .trim()
    .split(/\s+/)[0]
    ?.toLowerCase()
    .replace(/[^a-z-]/g, "");

const buildGenderPresentationGuidance = ({ challenge, participant, subjectName, isOrganization }) => {
  const sideKey = participant?.side === "opponent" ? "defendant" : "plaintiff";
  const cueText = [
    challenge.premise?.overview,
    challenge.premise?.openingStatement,
    challenge.premise?.desiredRelief,
    participant?.clientMemoryExcerpt,
    stringifyCueSource(challenge.canonicalStory?.partyMentalStates?.[sideKey]),
    stringifyCueSource(challenge.templateSnapshot?.partyProfiles?.[sideKey]),
    stringifyCueSource(challenge.templateSnapshot?.interviewBlueprint?.[sideKey]),
  ]
    .filter(Boolean)
    .join(" ")
    .slice(0, 12000);

  const feminineScore =
    countPatternMatches(
      cueText,
      /\b(she|her|hers|herself|woman|female|mother|wife|daughter|sister|landlady|businesswoman|madam|ms\.|mrs\.)\b/gi
    ) +
    countPatternMatches(
      cueText,
      /\b(client|tenant|owner|plaintiff|defendant|party)\s+(is|was|says|said|claims|claimed|told|asked)\s+she\b/gi
    );

  const masculineScore =
    countPatternMatches(
      cueText,
      /\b(he|him|his|himself|man|male|father|husband|son|brother|landlord|businessman|sir|mr\.)\b/gi
    ) +
    countPatternMatches(
      cueText,
      /\b(client|tenant|owner|plaintiff|defendant|party)\s+(is|was|says|said|claims|claimed|told|asked)\s+he\b/gi
    );

  const nonBinaryScore =
    countPatternMatches(cueText, /\b(nonbinary|non-binary|gender-neutral|gender neutral)\b/gi) +
    countPatternMatches(cueText, /\b(they|them|their|theirs|themself|themselves)\b/gi);

  if (nonBinaryScore >= 2 && nonBinaryScore > feminineScore && nonBinaryScore > masculineScore) {
    return "Case text suggests they/them or non-binary cues; depict a gender-neutral or non-binary adult presentation.";
  }

  if (feminineScore >= 2 && feminineScore > masculineScore) {
    return isOrganization
      ? "Case text suggests feminine cues for the representative; depict a female-presenting adult representative."
      : "Case text suggests feminine cues for the party; depict a female-presenting adult party.";
  }

  if (masculineScore >= 2 && masculineScore > feminineScore) {
    return isOrganization
      ? "Case text suggests masculine cues for the representative; depict a male-presenting adult representative."
      : "Case text suggests masculine cues for the party; depict a male-presenting adult party.";
  }

  const givenNameCue = getGivenNameCue(subjectName);
  if (masculineGivenNameCues.has(givenNameCue)) {
    return isOrganization
      ? `The representative name "${subjectName}" is conventionally masculine in this context, and the case text does not contradict that; depict a male-presenting adult representative.`
      : `The party name "${subjectName}" is conventionally masculine in this context, and the case text does not contradict that; depict a male-presenting adult party.`;
  }

  if (feminineGivenNameCues.has(givenNameCue)) {
    return isOrganization
      ? `The representative name "${subjectName}" is conventionally feminine in this context, and the case text does not contradict that; depict a female-presenting adult representative.`
      : `The party name "${subjectName}" is conventionally feminine in this context, and the case text does not contradict that; depict a female-presenting adult party.`;
  }

  return "Gender presentation is not clearly specified. Choose a plausible adult presentation without treating the name as definitive or relying on stereotypes; ambiguous names such as Alex Morgan may be woman, man, or androgynous if the case text does not specify.";
};

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
  const genderGuidance = buildGenderPresentationGuidance({
    challenge,
    participant,
    subjectName: name,
    isOrganization,
  });
  const context = [
    challenge.caseCountry?.name
      ? `Country setting: ${challenge.caseCountry.name}`
      : "",
    challenge.practiceArea,
    challenge.primaryCategory,
    challenge.premise?.overview,
    participant?.clientMemoryExcerpt,
  ]
    .filter(Boolean)
    .join(" | ");
  const wardrobeGuidance = buildPortraitWardrobeGuidance({
    seed: [
      getChallengeId(challenge),
      toId(participant?.userId),
      participant?.side,
      target,
      name,
      challenge.practiceArea,
    ]
      .filter(Boolean)
      .join(":"),
    role: isOrganization ? "organization" : "everyday",
  });

  return [
    `Create a photorealistic portrait for a fictional legal game ${target === "opponent" ? "opposing party" : "client"} seated across a table from their lawyer in a quiet lawyer's office.`,
    `Subject identity cue: ${name}.`,
    `Case context: ${context || "civil legal dispute"}.`,
    genderGuidance,
    challenge.caseCountry?.name
      ? `Make the person, everyday clothing, office, and environmental details plausible for ${challenge.caseCountry.name}. Reflect real diversity; do not turn nationality into a costume or assume one ethnicity, religion, class, or traditional style.`
      : "",
    isOrganization
      ? "The party is an organization, so show a realistic representative or owner in credible business attire."
      : "The party is a person, so show believable everyday clothing appropriate for an ordinary client, not a lawyer headshot and not overly formal.",
    wardrobeGuidance,
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
  const { session, error: authError } = await getRequestSession(request);
  if (authError) return authError;

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
  const { session, error: authError } = await getRequestSession(request);
  if (authError) return authError;

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
