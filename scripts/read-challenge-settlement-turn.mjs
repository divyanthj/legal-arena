import fs from "node:fs";
import { MongoClient, ObjectId } from "mongodb";

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

const uri = process.env.MONGODB_URI;
if (!uri) {
  console.error("MONGODB_URI is required.");
  process.exit(1);
}

const challengeId = process.argv[2] || "6a4a60a54209e91297d69177";
const client = new MongoClient(uri, { serverSelectionTimeoutMS: 15000 });

try {
  await client.connect();
  const db = client.db();
  const challenge = await db
    .collection("challenges")
    .findOne({ _id: new ObjectId(challengeId) });

  if (!challenge) {
    console.error(`Challenge not found: ${challengeId}`);
    process.exitCode = 1;
  } else {
    const participantIds = (challenge.participants || []).map((participant) =>
      String(participant.userId || "")
    );
    const users = await db
      .collection("users")
      .find({
        _id: {
          $in: participantIds
            .filter(Boolean)
            .map((participantId) => new ObjectId(participantId)),
        },
      })
      .project({ name: 1, email: 1, image: 1 })
      .toArray();
    const usersById = new Map(users.map((user) => [String(user._id), user]));
    const settlement = challenge.settlement || {};
    const turnUserId = String(settlement.negotiationTurnUserId || "");
    const waitingUserId = String(settlement.awaitingNegotiationResponseUserId || "");

    console.log({
      challengeId,
      challengeStatus: challenge.status,
      settlementStatus: settlement.status,
      participants: (challenge.participants || []).map((participant) => ({
        userId: String(participant.userId || ""),
        name: usersById.get(String(participant.userId || ""))?.name || "",
        email: usersById.get(String(participant.userId || ""))?.email || "",
        side: participant.side,
        isWaiting: String(participant.userId || "") === waitingUserId,
        canRespond: String(participant.userId || "") === turnUserId,
      })),
      latestNegotiationMessageUserId: String(
        settlement.latestNegotiationMessageUserId || ""
      ),
      awaitingNegotiationResponseUserId: waitingUserId,
      negotiationTurnUserId: turnUserId,
      latestPlayerMessages: (settlement.transcript || [])
        .filter((entry) => entry?.role === "player")
        .slice(-5)
        .map((entry) => ({
          userId: String(entry.userId || ""),
          side: entry.side,
          text: String(entry.text || "").slice(0, 180),
          createdAt: entry.createdAt,
        })),
      participantIds,
    });
  }
} finally {
  await client.close();
}
