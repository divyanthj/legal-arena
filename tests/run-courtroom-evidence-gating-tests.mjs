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
const caseWorkspaceSource = readFileSync(
  new URL("../components/legal-arena/CaseWorkspace.js", import.meta.url),
  "utf8"
);
const globalsSource = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");

const buildContextSource =
  courtroomSource.match(
    /export const buildCourtroomAgentContext = \(\{[\s\S]*?\r?\n\};\r?\nexport const normalizeCourtResult/
  )?.[0] || "";
const normalizeCourtResultSource =
  courtroomSource.match(
    /export const normalizeCourtResult = \(\{[\s\S]*?\r?\n\};\r?\n?$/
  )?.[0] || "";

assert.ok(buildContextSource, "buildCourtroomAgentContext source should be found");
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
assert.match(buildContextSource, /ruleApplicationGuidance/);
assert.match(buildContextSource, /buildCourtroomRuleApplicationGuidance/);
assert.match(courtroomSource, /\.\.\.\(caseSession\.factSheet\.knownClaims \|\| \[\]\)/);
assert.match(courtroomSource, /\.\.\.\(caseSession\.factSheet\.disputedFacts \|\| \[\]\)/);

assert.match(courtroomSource, /export const buildOpponentCourtroomPortfolio/);
assert.match(courtroomSource, /export const buildCourtroomRuleApplicationGuidance/);
assert.match(courtroomSource, /Apply every materially cited lawbook rule/);
assert.match(courtroomSource, /For security-deposit disputes, apply Rule 11 directly/);
assert.match(courtroomSource, /itemization, actual-cost support/);
assert.match(courtroomSource, /For security-deposit disputes, apply Rule 9 directly/);
assert.match(courtroomSource, /ordinary wear, routine turnover cleaning/);
assert.match(courtroomSource, /Use deposit burden allocation/);
assert.match(courtroomSource, /Missing landlord receipts, invoices, itemization, or condition records/);
assert.match(courtroomSource, /OPPONENT_FACT_LIMITS/);
assert.match(courtroomSource, /OPPONENT_EVIDENCE_LIMITS/);
assert.match(courtroomSource, /evidenceIsProofForSide/);
assert.match(courtroomSource, /holderSide === "third-party"[\s\S]*return false/);
assert.match(courtroomSource, /preparedEvidenceIds: proofEvidenceIds/);
assert.match(courtroomSource, /evidenceLeads/);

assert.doesNotMatch(courtroomSource, /buildCourtroomFallback/);
assert.doesNotMatch(courtroomSource, /buildVerdictFallback/);
assert.doesNotMatch(courtroomSource, /pickFactMentions/);
assert.doesNotMatch(courtroomSource, /pickClaimMentions/);
assert.doesNotMatch(courtroomSource, /fallback\.opponentResponse/);

assert.match(normalizeCourtResultSource, /sanitizeCourtFacts/);
assert.match(normalizeCourtResultSource, /validFactText\.has/);
assert.match(normalizeCourtResultSource, /sanitizeCourtClaims/);
assert.match(normalizeCourtResultSource, /sanitizeCourtRules/);
assert.match(normalizeCourtResultSource, /caseSession\.factSheet\.discoveredClaimIds/);
assert.match(normalizeCourtResultSource, /Courtroom response generation returned no opponent response/);
assert.match(normalizeCourtResultSource, /Courtroom response generation returned no score deltas/);
assert.match(normalizeCourtResultSource, /Courtroom response generation returned no final verdict/);

assert.match(engineSource, /The courtroom is fully record-bound/);
assert.match(engineSource, /usageLabel:\s*"courtroom\.opening"/);
assert.match(engineSource, /generatePlaintiffCourtOpeningStatement/);
assert.match(engineSource, /opposingCounsel\.preparedCaseFile/);
assert.match(engineSource, /Do not infer, cite, or credit any fact/);
assert.match(engineSource, /Do not cite or imply hidden canonical story facts/);
assert.match(engineSource, /must follow the bench ruleApplicationGuidance/);
assert.match(engineSource, /especially Rule 9 and Rule 11 in security-deposit disputes/);
assert.match(engineSource, /the landlord must justify deductions with itemization, actual costs, or specific condition evidence/);
assert.match(engineSource, /visible approximate party-side amounts as claims or testimony/);
assert.match(engineSource, /prefer partial relief or a reduced award/);

assert.match(caseWorkspaceSource, /const PresentingArgumentIndicator = /);
assert.match(caseWorkspaceSource, /loading loading-dots loading-xs/);
assert.match(caseWorkspaceSource, /arena-presenting-gavel/);
assert.match(caseWorkspaceSource, /arena-presenting-gavel-icon/);
assert.match(caseWorkspaceSource, /arena-presenting-gavel-swing/);
assert.match(caseWorkspaceSource, /pendingAction === "courtroom" \? \(\s*<PresentingArgumentIndicator/);
assert.match(globalsSource, /@keyframes arena-gavel-strike/);
assert.match(globalsSource, /\.arena-presenting-gavel-swing/);

console.log("Courtroom evidence gating tests passed");
