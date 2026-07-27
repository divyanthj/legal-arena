import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import sharp from "sharp";
import {
  RESULT_SHARE_IMAGE_HEIGHT,
  RESULT_SHARE_IMAGE_WIDTH,
  buildResultShareData,
  buildResultShareSvg,
  createResultShareData,
} from "../libs/game/resultShareCard.mjs";

const soloSource = {
  id: "case-sensitive-id",
  userId: "player-one",
  status: "verdict",
  title: "Sensitive case title",
  primaryCategory: "rental-dispute",
  complexity: 2,
  premise: {
    clientName: "Private Client",
    opponentName: "Private Opponent",
  },
  verdict: {
    winner: "player",
    summary: "Private verdict summary",
    finalScore: { player: 86, opponent: 72 },
  },
  settlement: {
    finalTerms: ["Private settlement term"],
  },
  courtroomTranscript: [{ text: "Private transcript" }],
};

const soloWin = buildResultShareData({
  sourceType: "caseSession",
  source: soloSource,
  viewerId: "player-one",
  categoryTitle: "Rental Dispute",
});
assert.equal(soloWin.outcome, "won");
assert.equal(soloWin.playerScore, 86);
assert.equal(soloWin.opponentScore, 72);
assert.equal(soloWin.categoryTitle, "Rental Dispute");
assert.equal(soloWin.complexity, 2);
assert.match(soloWin.caption, /Level 2 Rental Dispute.*86–72/);

for (const [winner, outcome] of [
  ["opponent", "lost"],
  ["draw", "draw"],
]) {
  const result = buildResultShareData({
    sourceType: "caseSession",
    source: {
      ...soloSource,
      verdict: { ...soloSource.verdict, winner },
    },
    viewerId: "player-one",
    categoryTitle: "Rental Dispute",
  });
  assert.equal(result.outcome, outcome);
}

const challengeSource = {
  status: "verdict",
  title: "Private PVP title",
  primaryCategory: "business-dispute",
  complexity: 4,
  participants: [
    { userId: "player-a", score: 91, verdict: "win", name: "Private A" },
    { userId: "player-b", score: 73, verdict: "loss", name: "Private B" },
  ],
  verdict: {
    winnerUserId: "player-a",
    winner: "initiator",
    summary: "Private PVP summary",
  },
};

const pvpWinner = buildResultShareData({
  sourceType: "challenge",
  source: challengeSource,
  viewerId: "player-a",
  categoryTitle: "Business Dispute",
});
assert.equal(pvpWinner.outcome, "won");
assert.deepEqual(
  [pvpWinner.playerScore, pvpWinner.opponentScore],
  [91, 73],
  "PVP scores should be ordered from the requesting player's perspective"
);

const pvpLoser = buildResultShareData({
  sourceType: "challenge",
  source: challengeSource,
  viewerId: "player-b",
  categoryTitle: "Business Dispute",
});
assert.equal(pvpLoser.outcome, "lost");
assert.deepEqual([pvpLoser.playerScore, pvpLoser.opponentScore], [73, 91]);

const settlement = buildResultShareData({
  sourceType: "caseSession",
  source: {
    ...soloSource,
    status: "settled",
    primaryCategory: "property",
    complexity: 5,
    settlement: {
      status: "settled",
      resolved: true,
      resolution: "settled",
      finalTerms: ["Private settlement term"],
    },
  },
  viewerId: "player-one",
  categoryTitle: "Property",
  settlementQualityScore: 84,
});
assert.equal(settlement.outcome, "settled");
assert.equal(settlement.settlementQualityScore, 84);
assert.equal(settlement.playerScore, null);
assert.match(settlement.caption, /84\/100 settlement quality/);

assert.throws(
  () =>
    buildResultShareData({
      sourceType: "caseSession",
      source: { ...soloSource, status: "courtroom" },
      viewerId: "player-one",
      categoryTitle: "Rental Dispute",
    }),
  /Resolve this case/
);
assert.throws(
  () =>
    buildResultShareData({
      sourceType: "challenge",
      source: challengeSource,
      viewerId: "not-a-participant",
      categoryTitle: "Business Dispute",
    }),
  /not found/
);

const approvedKeys = new Set([
  "resolutionType",
  "outcome",
  "outcomeLabel",
  "playerScore",
  "opponentScore",
  "settlementQualityScore",
  "category",
  "categoryTitle",
  "complexity",
  "levelLabel",
  "caption",
  "fileName",
]);
assert.ok(
  Object.keys(soloWin).every((key) => approvedKeys.has(key)),
  "share data must be allowlisted rather than copying source details"
);

const verdictSvg = buildResultShareSvg(soloWin);
for (const privateValue of [
  soloSource.title,
  soloSource.premise.clientName,
  soloSource.premise.opponentName,
  soloSource.verdict.summary,
  soloSource.settlement.finalTerms[0],
  soloSource.courtroomTranscript[0].text,
]) {
  assert.doesNotMatch(verdictSvg, new RegExp(privateValue));
}
assert.match(verdictSvg, /WON/);
assert.match(verdictSvg, /86 — 72/);
assert.match(verdictSvg, /Rental Dispute/);
assert.match(verdictSvg, /LEVEL 2/);
assert.match(verdictSvg, /LEGALARENA\.APP/);

const png = await sharp(Buffer.from(verdictSvg)).png().toBuffer();
const metadata = await sharp(png).metadata();
assert.equal(metadata.format, "png");
assert.equal(metadata.width, RESULT_SHARE_IMAGE_WIDTH);
assert.equal(metadata.height, RESULT_SHARE_IMAGE_HEIGHT);

const escaped = createResultShareData({
  resolutionType: "verdict",
  outcome: "draw",
  playerScore: 50,
  opponentScore: 50,
  category: "test",
  categoryTitle: "Claims & <Appeals>",
  complexity: 99,
});
assert.equal(escaped.complexity, 5);
assert.match(buildResultShareSvg(escaped), /Claims &amp; &lt;Appeals&gt;/);

const service = await readFile(
  new URL("../libs/resultShareImage.js", import.meta.url),
  "utf8"
);
assert.match(service, /CaseSession\.findOne\(\{ _id: sourceId, userId \}\)/);
assert.match(service, /"participants\.userId": userId/);
assert.match(service, /calculateSettlementQuality/);

const route = await readFile(
  new URL("../app/api/result-share/[sourceType]/[sourceId]/route.js", import.meta.url),
  "utf8"
);
assert.match(route, /getRequestSession/);
assert.match(route, /status: 401/);
assert.match(route, /status: 400/);
assert.match(route, /Content-Type": "image\/png"/);
assert.match(route, /Cache-Control": "private, no-store, max-age=0"/);

const client = await readFile(
  new URL("../components/legal-arena/ShareResultButton.js", import.meta.url),
  "utf8"
);
assert.match(client, /navigator\.canShare\(\{ files: \[file\] \}\)/);
assert.match(client, /navigator\.share\(/);
assert.match(client, /error\?\.name === "AbortError"/);
assert.match(client, /downloadResult\(blob, shareData\.fileName\)/);
for (const eventName of [
  "result_share_button_viewed",
  "result_share_started",
  "result_share_completed",
  "result_share_cancelled",
  "result_share_downloaded",
  "result_share_failed",
]) {
  assert.match(client, new RegExp(eventName));
}

const workspace = await readFile(
  new URL("../components/legal-arena/CaseWorkspace.js", import.meta.url),
  "utf8"
);
assert.match(workspace, /resolutionType="settlement"/);
assert.match(workspace, /resolutionType="verdict"/);

console.log("Result share tests passed.");
