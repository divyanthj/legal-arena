import assert from "node:assert/strict";

const {
  getCourtroomDifficultyProfile,
  getOpponentResponsePromptRules,
  isPlayerAdverseVerdictPoint,
  limitOpponentResponseForDifficulty,
  normalizePlayerPerspectiveVerdictLists,
  normalizeCourtroomDeltasForDifficulty,
  normalizeVerdictForDifficulty,
} = await import("../libs/game/courtroomDifficulty.js");

const lowestProfile = getCourtroomDifficultyProfile(-10);
assert.equal(lowestProfile.complexity, 1);
assert.equal(lowestProfile.opponentMaxDelta, 11);
assert.equal(lowestProfile.partialCreditBonus, 3);
assert.equal(lowestProfile.opponentResponseLimits.issueBudget, 1);

const defaultProfile = getCourtroomDifficultyProfile("nope");
assert.equal(defaultProfile.complexity, 3);

const highestProfile = getCourtroomDifficultyProfile(99);
assert.equal(highestProfile.complexity, 5);
assert.equal(highestProfile.opponentMaxDelta, 20);
assert.equal(highestProfile.partialCreditBonus, 0);
assert.equal(highestProfile.opponentResponseLimits.issueBudget, 5);

assert.deepEqual(
  normalizeCourtroomDeltasForDifficulty({
    playerDelta: 8,
    opponentDelta: 19,
    difficultyProfile: lowestProfile,
    hasPartialCredit: true,
  }),
  {
    playerDelta: 11,
    opponentDelta: 11,
  }
);

assert.deepEqual(
  normalizeCourtroomDeltasForDifficulty({
    playerDelta: 8,
    opponentDelta: 19,
    difficultyProfile: highestProfile,
    hasPartialCredit: true,
  }),
  {
    playerDelta: 8,
    opponentDelta: 19,
  }
);

assert.equal(
  normalizeVerdictForDifficulty({
    verdict: {
      winner: "opponent",
      summary: "The record favored the opponent.",
      highlights: [],
      concerns: [],
    },
    updatedScore: { player: 24, opponent: 20 },
    fallbackVerdict: {
      winner: "player",
      summary: "The player carried the record.",
      highlights: ["Specific proof"],
      concerns: [],
    },
    difficultyProfile: lowestProfile,
  }).winner,
  "player"
);

assert.equal(
  normalizeVerdictForDifficulty({
    verdict: {
      winner: "opponent",
      summary: "The close record left room for the opponent.",
      highlights: [],
      concerns: [],
    },
    updatedScore: { player: 24, opponent: 20 },
    fallbackVerdict: {
      winner: "player",
      summary: "The player carried the record.",
      highlights: ["Specific proof"],
      concerns: [],
    },
    difficultyProfile: highestProfile,
  }).winner,
  "opponent"
);

const sprawlingOpponentResponse = [
  "The first problem is notice. Counsel has conceded the mailing went to the wrong address, and that matters because a landlord must prove timely accounting.",
  "The second problem is damages. Broad categories do not prove actual tenant-caused damage beyond ordinary wear.",
  "The third problem is invoices. No vendor invoice was tied to a specific deduction in this round.",
  "",
  "The fourth problem is condition. There is no complete move-out record fixing the unit condition at surrender.",
  "The fifth problem is ledger proof. Counsel did not tie alleged unpaid charges to a lease term or exact ledger entry.",
  "The sixth problem is remedy. The court cannot speculate toward a reduced award without a documented amount.",
].join("\n\n");

const limitedLowComplexityResponse = limitOpponentResponseForDifficulty(
  sprawlingOpponentResponse,
  lowestProfile
);
assert.equal(limitedLowComplexityResponse.split(/\n{2,}/).length, 2);
assert.ok(limitedLowComplexityResponse.length <= lowestProfile.opponentResponseLimits.maxCharacters);
assert.doesNotMatch(limitedLowComplexityResponse, /The fifth problem/);

const highComplexityResponse = limitOpponentResponseForDifficulty(
  sprawlingOpponentResponse,
  highestProfile
);
assert.match(highComplexityResponse, /The fifth problem/);

assert.match(
  getOpponentResponsePromptRules(lowestProfile).join(" "),
  /Press no more than 1 core issue/
);

const defendantLossLists = normalizePlayerPerspectiveVerdictLists({
  verdict: {
    winner: "opponent",
    summary:
      "Judgment for Maya Torres. Harbor View Properties, LLC did not carry its burden.",
    highlights: [
      "- The defense could show that an itemized deduction statement and partial refund check existed.",
      "- The record supports that the first mailing went to the old address despite forwarding-address communications.",
      "- There is no clean mailing proof and no detailed cost documentation supporting the challenged deductions.",
    ],
    concerns: [
      "- The present ruling is driven by proof gaps on notice, documentation, and amount rather than a definitive finding that every claimed condition issue was factually false.",
    ],
  },
  playerStrengths: ["The defense established that a statement and partial refund existed."],
  playerWeaknesses: ["The wrong-address mailing undermined timely notice."],
  fallbackVerdict: {
    highlights: ["The defense had some documentation in the record."],
    concerns: ["The court found unresolved notice and proof gaps."],
  },
});

assert.deepEqual(defendantLossLists.highlights, [
  "The defense could show that an itemized deduction statement and partial refund check existed.",
  "The defense established that a statement and partial refund existed.",
  "The defense had some documentation in the record.",
]);
assert.ok(
  defendantLossLists.concerns.some((item) =>
    item.includes("first mailing went to the old address")
  )
);
assert.ok(
  defendantLossLists.concerns.some((item) =>
    item.includes("no clean mailing proof")
  )
);
assert.equal(isPlayerAdverseVerdictPoint("The record supports that the first mailing went to the old address."), true);

console.log("Courtroom difficulty tests passed");
