import fs from "node:fs";
import mongoose from "mongoose";

const loadEnvFile = (filePath) => {
  if (!fs.existsSync(filePath)) {
    return;
  }

  for (const line of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) {
      continue;
    }

    const [key, ...valueParts] = trimmed.split("=");
    const value = valueParts.join("=").replace(/^['"]|['"]$/g, "");
    if (key && process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
};

loadEnvFile(".env.local");
loadEnvFile(".env");

const challengeId = process.argv[2] || "6a4a60a54209e91297d69177";
const viewerIds = process.argv.slice(3);

const { default: connectMongo } = await import("../libs/mongoose.js");
const { default: Challenge } = await import("../models/Challenge.js");
const { buildChallengePayload } = await import("../libs/game/challenges.js");

await connectMongo();

const challenge = await Challenge.findById(challengeId);
if (!challenge) {
  console.error(`Challenge not found: ${challengeId}`);
  process.exitCode = 1;
  await mongoose.disconnect();
  process.exit();
}

const participantViewerIds = viewerIds.length
  ? viewerIds
  : (challenge.participants || []).map((participant) => String(participant.userId));

console.log("Stored settlement turn fields:");
console.log({
  challengeStatus: challenge.status,
  settlementStatus: challenge.settlement?.status,
  latestNegotiationMessageUserId: String(
    challenge.settlement?.latestNegotiationMessageUserId || ""
  ),
  awaitingNegotiationResponseUserId: String(
    challenge.settlement?.awaitingNegotiationResponseUserId || ""
  ),
  negotiationTurnUserId: String(challenge.settlement?.negotiationTurnUserId || ""),
  transcript: (challenge.settlement?.transcript || []).map((entry) => ({
    role: entry.role,
    userId: String(entry.userId || ""),
    side: entry.side,
    text: String(entry.text || "").slice(0, 100),
  })),
});

for (const viewerUserId of participantViewerIds) {
  const payload = await buildChallengePayload({ challenge, viewerUserId });
  console.log(`\nPayload for ${viewerUserId}:`);
  console.log({
    viewer: payload.viewer?.name,
    viewerUserId: payload.viewer?.userId,
    viewerSide: payload.viewer?.side,
    displayStatus: payload.displayStatus,
    rawStatus: payload.status,
    settlementStatus: payload.settlement?.status,
    awaitingNegotiationResponse: payload.settlement?.awaitingNegotiationResponse,
    receivedNegotiationMessage: payload.settlement?.receivedNegotiationMessage,
    latestNegotiationMessageByViewer:
      payload.settlement?.latestNegotiationMessageByViewer,
    awaitingNegotiationResponseUserId:
      payload.settlement?.awaitingNegotiationResponseUserId,
    negotiationTurnUserId: payload.settlement?.negotiationTurnUserId,
  });
}

await mongoose.disconnect();
