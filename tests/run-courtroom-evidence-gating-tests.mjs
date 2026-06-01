import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const courtroomSource = readFileSync(
  new URL("../libs/game/engine/courtroom.js", import.meta.url),
  "utf8"
);
const engineSource = readFileSync(
  new URL("../libs/game/engine.js", import.meta.url),
  "utf8"
);

const buildContextSource =
  courtroomSource.match(
    /export const buildCourtroomAgentContext = \(\{[\s\S]*?\n\};\nexport const pickFactMentions/
  )?.[0] || "";
const fallbackSource =
  courtroomSource.match(
    /export const buildCourtroomFallback = \(\{[\s\S]*?\n\};\n\nexport const buildVerdictFallback/
  )?.[0] || "";
const normalizeCourtResultSource =
  courtroomSource.match(
    /export const normalizeCourtResult = \(\{[\s\S]*?\n\};\n?$/
  )?.[0] || "";

assert.ok(buildContextSource, "buildCourtroomAgentContext source should be found");
assert.ok(fallbackSource, "buildCourtroomFallback source should be found");
assert.ok(normalizeCourtResultSource, "normalizeCourtResult source should be found");

assert.doesNotMatch(buildContextSource, /canonicalWorld/);
assert.doesNotMatch(buildContextSource, /canonicalStoryWorld/);
assert.doesNotMatch(buildContextSource, /buildCanonicalWorldPacket/);
assert.doesNotMatch(buildContextSource, /buildRoleFactPacket/);
assert.doesNotMatch(buildContextSource, /safeTemplate\.canonicalFacts/);
assert.doesNotMatch(buildContextSource, /safeTemplate\.evidenceItems/);
assert.match(buildContextSource, /preparedCaseFile: opponentPortfolio/);
assert.match(buildContextSource, /recordBound: true/);
assert.match(buildContextSource, /playerCaseFile: caseSession\.factSheet/);
assert.match(buildContextSource, /opponentCaseFile: opponentPortfolio/);

assert.match(courtroomSource, /export const buildOpponentCourtroomPortfolio/);
assert.match(courtroomSource, /OPPONENT_FACT_LIMITS/);
assert.match(courtroomSource, /OPPONENT_EVIDENCE_LIMITS/);
assert.match(courtroomSource, /evidenceIsProofForSide/);
assert.match(courtroomSource, /holderSide === "third-party"[\s\S]*return false/);
assert.match(courtroomSource, /preparedEvidenceIds: proofEvidenceIds/);
assert.match(courtroomSource, /evidenceLeads/);

assert.doesNotMatch(fallbackSource, /safeTemplate\.canonicalFacts/);
assert.match(fallbackSource, /buildOpponentCourtroomPortfolio/);
assert.match(fallbackSource, /opponentPortfolio\.knownClaims/);
assert.match(fallbackSource, /opponentPortfolio\.corroboratedFacts/);

assert.match(normalizeCourtResultSource, /sanitizeCourtFacts/);
assert.match(normalizeCourtResultSource, /validFactText\.has/);
assert.match(normalizeCourtResultSource, /sanitizeCourtClaims/);
assert.match(normalizeCourtResultSource, /sanitizeCourtRules/);
assert.match(normalizeCourtResultSource, /caseSession\.factSheet\.discoveredClaimIds/);

assert.match(engineSource, /The courtroom is fully record-bound/);
assert.match(engineSource, /opposingCounsel\.preparedCaseFile/);
assert.match(engineSource, /Do not infer, cite, or credit any fact/);
assert.match(engineSource, /Do not cite or imply hidden canonical story facts/);

console.log("Courtroom evidence gating tests passed");
