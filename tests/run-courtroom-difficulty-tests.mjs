import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const {
  getCourtroomDifficultyProfile,
  getOpponentResponsePromptRules,
  getOpponentStrategyPromptRules,
  isPlayerAdverseVerdictPoint,
  limitOpponentResponseForDifficulty,
  normalizePlayerPerspectiveVerdictLists,
  normalizeCourtroomDeltasForDifficulty,
  normalizeVerdictForDifficulty,
  reconcileVerdictWinnerWithSummary,
} = await import("../libs/game/courtroomDifficulty.js");

const lowestProfile = getCourtroomDifficultyProfile(-10);
assert.equal(lowestProfile.complexity, 1);
assert.equal(lowestProfile.opponentMinDelta, 0);
assert.equal(lowestProfile.opponentMaxDelta, 20);
assert.equal(lowestProfile.playerMinDelta, 0);
assert.equal(lowestProfile.partialCreditBonus, 0);
assert.equal(lowestProfile.opponentResponseLimits.issueBudget, 1);
assert.deepEqual(lowestProfile.preparation, {
  factLimit: 2,
  evidenceLimit: 1,
  evidenceLeadLimit: 0,
  contradictionBudget: 0,
  ruleCombinationLimit: 1,
  maxIssuePivots: 0,
  secondaryWeaknessBudget: 0,
});

const newcomerProfile = getCourtroomDifficultyProfile(1, {
  newcomerAssist: true,
});
assert.equal(newcomerProfile.newcomerAssist, true);
assert.equal(newcomerProfile.opponentMaxDelta, 16);
assert.equal(newcomerProfile.partialCreditBonus, 2);
assert.equal(newcomerProfile.verdictGuidance.length, 2);

const paidBeginnerProfile = getCourtroomDifficultyProfile(1, {
  newcomerAssist: false,
});
assert.equal(paidBeginnerProfile.opponentMaxDelta, 20);
assert.equal(paidBeginnerProfile.partialCreditBonus, 0);

const misplacedNewcomerProfile = getCourtroomDifficultyProfile(2, {
  newcomerAssist: true,
});
assert.equal(misplacedNewcomerProfile.newcomerAssist, false);

const defaultProfile = getCourtroomDifficultyProfile("nope");
assert.equal(defaultProfile.complexity, 3);

const highestProfile = getCourtroomDifficultyProfile(99);
assert.equal(highestProfile.complexity, 5);
assert.equal(highestProfile.opponentMaxDelta, 20);
assert.equal(highestProfile.partialCreditBonus, 0);
assert.equal(highestProfile.opponentResponseLimits.issueBudget, 5);
assert.deepEqual(highestProfile.preparation, {
  factLimit: 8,
  evidenceLimit: 7,
  evidenceLeadLimit: 3,
  contradictionBudget: 3,
  ruleCombinationLimit: 4,
  maxIssuePivots: 3,
  secondaryWeaknessBudget: 3,
});

const expectedPreparationBudgets = [
  [2, 1, 0, 0, 1, 0, 0],
  [3, 2, 0, 1, 1, 0, 0],
  [4, 3, 1, 1, 2, 1, 1],
  [6, 5, 2, 2, 3, 2, 2],
  [8, 7, 3, 3, 4, 3, 3],
];
expectedPreparationBudgets.forEach((expected, index) => {
  const profile = getCourtroomDifficultyProfile(index + 1);
  assert.deepEqual(Object.values(profile.preparation), expected);
  assert.deepEqual(
    [profile.playerMinDelta, profile.playerMaxDelta, profile.opponentMinDelta, profile.opponentMaxDelta],
    [0, 20, 0, 20],
    `level ${index + 1} must use difficulty-neutral bench bounds`
  );
});

assert.deepEqual(
  normalizeCourtroomDeltasForDifficulty({
    playerDelta: 8,
    opponentDelta: 19,
    difficultyProfile: lowestProfile,
    hasPartialCredit: true,
  }),
  {
    playerDelta: 8,
    opponentDelta: 19,
  }
);

assert.deepEqual(
  normalizeCourtroomDeltasForDifficulty({
    playerDelta: 8,
    opponentDelta: 19,
    difficultyProfile: newcomerProfile,
    hasPartialCredit: true,
  }),
  {
    playerDelta: 10,
    opponentDelta: 16,
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
  "opponent"
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

assert.equal(
  normalizeVerdictForDifficulty({
    verdict: {
      winner: "opponent",
      summary: "The requested relief is denied because the exact amount was not proven.",
      highlights: [],
      concerns: [],
    },
    updatedScore: { player: 99, opponent: 1 },
    fallbackVerdict: {
      winner: "player",
      summary: "The player had the higher performance score.",
      highlights: [],
      concerns: [],
    },
    difficultyProfile: lowestProfile,
    playerPartyName: "Maya Rivera",
    opponentPartyName: "Ethan Cole",
  }).winner,
  "opponent"
);

assert.equal(
  reconcileVerdictWinnerWithSummary({
    winner: "player",
    summary:
      "Judgment for Jordan Lee. The State has not carried its burden to prove knowing possession beyond a reasonable doubt.",
    playerPartyName: "The State",
    opponentPartyName: "Jordan Lee",
  }),
  "opponent"
);

assert.equal(
  reconcileVerdictWinnerWithSummary({
    winner: "player",
    summary:
      "The Court denies your requested money judgment on the present record. You presented a plausible theory that the two transfers were advances to be repaid, but you did not place the exact amount before the Court.",
    playerPartyName: "Maya Rivera",
    opponentPartyName: "Ethan Cole",
  }),
  "opponent"
);

assert.equal(
  normalizeVerdictForDifficulty({
    verdict: {
      winner: "player",
      summary:
        "The Court denies your requested money judgment on the present record. You presented a plausible theory that the two transfers were advances to be repaid, but you did not place the exact amount before the Court.",
      highlights: [],
      concerns: [],
    },
    updatedScore: { player: 35, opponent: 22 },
    fallbackVerdict: {
      winner: "player",
      summary: "Maya Rivera carried the record.",
      highlights: [],
      concerns: [],
    },
    difficultyProfile: highestProfile,
    playerPartyName: "Maya Rivera",
    opponentPartyName: "Ethan Cole",
  }).winner,
  "opponent"
);

assert.equal(
  normalizeVerdictForDifficulty({
    verdict: {
      winner: "player",
      summary:
        "Judgment for Jordan Lee. The State has not carried its burden to prove knowing possession beyond a reasonable doubt.",
      highlights: [],
      concerns: [],
    },
    updatedScore: { player: 32, opponent: 26 },
    fallbackVerdict: {
      winner: "player",
      summary: "The State carried the record.",
      highlights: [],
      concerns: [],
    },
    difficultyProfile: highestProfile,
    playerPartyName: "The State",
    opponentPartyName: "Jordan Lee",
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
assert.match(
  getOpponentStrategyPromptRules(lowestProfile).join(" "),
  /Do not pivot to a new core issue across rounds/
);
assert.match(
  getOpponentStrategyPromptRules(lowestProfile).join(" "),
  /Do not pursue secondary weaknesses/
);
assert.match(
  getOpponentStrategyPromptRules(highestProfile).join(" "),
  /make at most 3 strategic issue pivots/
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

const courtroomSource = await readFile(
  new URL("../libs/game/engine/courtroom.js", import.meta.url),
  "utf8"
);
assert.match(courtroomSource, /export const buildCourtroomRuleApplicationGuidance/);
assert.match(courtroomSource, /Rule 11/);
assert.match(courtroomSource, /itemization, actual-cost support/);
assert.match(courtroomSource, /Rule 9/);
assert.match(courtroomSource, /ordinary wear/);
assert.match(courtroomSource, /landlord must justify/);
assert.match(courtroomSource, /partial remedy or reduced award/);

console.log("Courtroom difficulty tests passed");
