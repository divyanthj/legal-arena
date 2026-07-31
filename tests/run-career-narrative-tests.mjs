import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  buildCaseCareerNarrative,
  buildCareerDevelopments,
  buildNextCaseCareerBridge,
  buildResolutionAftermath,
  getCareerChapter,
} from "../libs/game/careerNarrative.mjs";

assert.deepEqual(
  getCareerChapter({ completedCases: 0, overallXp: 0 }),
  {
    number: 1,
    title: "First Briefs",
    roleTitle: "Rookie Advocate",
    description: "Your first matters will establish the instincts and reputation of your new practice.",
  }
);
assert.equal(getCareerChapter({ completedCases: 3 }).title, "Building a Practice");
assert.equal(getCareerChapter({ completedCases: 30 }).roleTitle, "Leading Counsel");

const baseCase = {
  primaryCategory: "housing",
  playerSide: "opponent",
  playerPartyName: "Desert Bloom Rentals LLC",
  caseCountry: { code: "US", name: "United States" },
  lawSource: "real",
  status: "interview",
  applicableLaws: [{ id: "ars-33-1341" }],
};

const opening = buildCaseCareerNarrative({
  caseSession: baseCase,
  progression: { completedCases: 0 },
});
assert.match(opening.origin, /Desert Bloom Rentals LLC/);
assert.match(opening.stakes, /legally significant facts/);
assert.equal(opening.continuation, false);

const continuation = buildCaseCareerNarrative({
  caseSession: baseCase,
  progression: { completedCases: 4 },
  continuationOfCaseId: "prior-case",
});
assert.match(continuation.origin, /last result/i);
assert.match(continuation.origin, /referral/i);
assert.equal(continuation.continuation, true);

const developments = buildCareerDevelopments({
  caseSession: baseCase,
  factSheet: {
    theory: ["The deduction was justified."],
    supportingFacts: ["Cleaning records exist."],
    corroboratedFacts: [],
    sourceLinks: [],
    risks: ["The exact amount is unclear."],
    disputedFacts: [],
    missingEvidence: [],
  },
  careerNarrative: opening,
});
assert.deepEqual(
  developments.map((item) => item.key),
  [
    "matter-opened",
    "theory-formed",
    "record-strengthened",
    "law-path-clearer",
    "pressure-point",
  ]
);
assert.match(developments[3].body, /actual-law provision/);
assert.doesNotMatch(
  developments.map((item) => item.body).join(" "),
  /hidden canonical/i,
  "Career developments must be derived from the visible case file only."
);

const winAftermath = buildResolutionAftermath({
  caseSession: {
    ...baseCase,
    status: "verdict",
    verdict: { winner: "player" },
    careerNarrative: continuation,
  },
});
const lossAftermath = buildResolutionAftermath({
  caseSession: {
    ...baseCase,
    status: "verdict",
    verdict: { winner: "opponent" },
    careerNarrative: continuation,
  },
});
const settlementAftermath = buildResolutionAftermath({
  caseSession: {
    ...baseCase,
    status: "settled",
    settlement: { status: "settled", accepted: true },
    careerNarrative: continuation,
  },
});
assert.equal(winAftermath.outcome, "win");
assert.match(winAftermath.careerImpact, /strengthens your reputation/i);
assert.equal(lossAftermath.outcome, "loss");
assert.match(lossAftermath.nextLead, /weakness/i);
assert.equal(settlementAftermath.outcome, "settlement");
assert.match(settlementAftermath.title, /negotiated result/i);

const bridge = buildNextCaseCareerBridge({
  caseSession: baseCase,
  aftermath: winAftermath,
  teaser: { headline: "A lease renewal with a missing notice" },
  recommendation: { kind: "level_up" },
});
assert.match(bridge, /prospective client|referral/i);
assert.match(bridge, /lease renewal with a missing notice/i);
assert.match(bridge, /raises the stakes/i);

const [workspaceSource, dashboardSource, nextCaseSource, storeSource] =
  await Promise.all([
    readFile(
      new URL("../components/legal-arena/CaseWorkspace.js", import.meta.url),
      "utf8"
    ),
    readFile(
      new URL("../components/legal-arena/DashboardHub.js", import.meta.url),
      "utf8"
    ),
    readFile(
      new URL(
        "../components/legal-arena/PostResolutionNextCaseCard.js",
        import.meta.url
      ),
      "utf8"
    ),
    readFile(new URL("../libs/game/store.js", import.meta.url), "utf8"),
  ]);

assert.match(workspaceSource, /Career thread/);
assert.match(workspaceSource, /Career aftermath/);
assert.match(workspaceSource, /View \{careerDevelopments\.length\} developments/);
assert.match(dashboardSource, /getCareerChapter\(progression\)/);
assert.match(dashboardSource, /Career chapter \{careerChapter\.number\}/);
assert.match(nextCaseSource, /Career consequence/);
assert.match(nextCaseSource, /buildNextCaseCareerBridge/);
assert.match(storeSource, /buildCaseCareerNarrative/);
assert.match(storeSource, /buildCareerDevelopments/);

console.log("Career narrative tests passed");
