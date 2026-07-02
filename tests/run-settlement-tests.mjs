import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const progressionSource = await readFile(
  new URL("../libs/game/progression.js", import.meta.url),
  "utf8"
);
const settlementSource = await readFile(
  new URL("../libs/game/settlement.js", import.meta.url),
  "utf8"
);
const caseWorkspaceSource = await readFile(
  new URL("../components/legal-arena/CaseWorkspace.js", import.meta.url),
  "utf8"
);
const soloSettlementStartRouteSource = await readFile(
  new URL("../app/api/cases/[caseId]/settlement/start/route.js", import.meta.url),
  "utf8"
);
const soloSettlementMessageRouteSource = await readFile(
  new URL("../app/api/cases/[caseId]/settlement/message/route.js", import.meta.url),
  "utf8"
);
const challengeSource = await readFile(
  new URL("../libs/game/challenges.js", import.meta.url),
  "utf8"
);
const soloSettlementDashboardRouteSource = await readFile(
  new URL("../app/dashboard/cases/[caseId]/settlement/page.js", import.meta.url),
  "utf8"
);
const pvpSettlementDashboardRouteSource = await readFile(
  new URL("../app/dashboard/challenges/[challengeId]/settlement/page.js", import.meta.url),
  "utf8"
);
const userModelSource = await readFile(
  new URL("../models/User.js", import.meta.url),
  "utf8"
);
const caseSessionModelSource = await readFile(
  new URL("../models/CaseSession.js", import.meta.url),
  "utf8"
);
const challengeModelSource = await readFile(
  new URL("../models/Challenge.js", import.meta.url),
  "utf8"
);
const settlementProgressionBody =
  progressionSource.match(/export const applySettlementToProgression = async \(\{[\s\S]*?\n\};/)?.[0] ||
  "";

assert.match(
  userModelSource,
  /settlements:\s*\{\s*type:\s*Number,\s*default:\s*0,\s*\}/s,
  "User progression schemas should persist settlement counts with a zero default."
);

assert.match(
  progressionSource,
  /export const calculateSettlementXp/,
  "Settlement XP helper should be exported for deterministic reward checks."
);
assert.match(
  progressionSource,
  /55 \+ \(Number\(complexity\) \|\| 1\) \* 15/,
  "Settlement base XP should be 55 + complexity * 15."
);
assert.match(
  progressionSource,
  /progression\.settlements \+= 1/,
  "Solo settlement progression should increment settlement count."
);
assert.doesNotMatch(
  settlementProgressionBody,
  /progression\.wins \+=|progression\.losses \+=|progression\.draws \+=/,
  "Settlement progression should not increment wins, losses, or draws."
);

assert.match(
  settlementSource,
  /export const clampMood = \(value\) =>\s*Math\.max\(-100, Math\.min\(100,/,
  "Settlement moods should clamp to -100..100."
);
assert.match(
  settlementSource,
  /moods\.player <= -100 \|\| moods\.opponent <= -100/,
  "Negotiations should fail when either party reaches -100 mood."
);
assert.match(
  settlementSource,
  /clientAccepts && opponentAccepts && currentTerms\.length > 0/,
  "Settlement should require both AI parties to accept current terms."
);
assert.match(
  settlementSource,
  /export const calculateSettlementRejectionCooldownMs/,
  "Settlement rejections should use a shared cooldown calculator."
);
assert.match(
  settlementSource,
  /60 \* 1000[\s\S]*2 \*\* Math\.max\(0, \(Number\(rejectionCount\) \|\| 1\) - 1\)/,
  "Settlement rejection cooldown should start at one minute and double each rejection."
);
assert.match(
  settlementSource,
  /cooldownUntil = rejected[\s\S]*calculateSettlementRejectionCooldownMs\(rejectionCount\)/,
  "Rejected settlement attempts should stamp a cooldown deadline."
);
assert.match(
  caseSessionModelSource,
  /rejectionCount:\s*\{\s*type:\s*Number,\s*default:\s*0,?\s*\}[\s\S]*cooldownUntil:\s*\{\s*type:\s*Date,\s*default:\s*null,?\s*\}/,
  "Solo settlement schema should persist rejection cooldown state."
);
assert.match(
  challengeModelSource,
  /rejectionCount:\s*\{\s*type:\s*Number,\s*default:\s*0,?\s*\}[\s\S]*cooldownUntil:\s*\{\s*type:\s*Date,\s*default:\s*null,?\s*\}/,
  "PVP settlement schema should persist rejection cooldown state."
);

assert.match(
  caseWorkspaceSource,
  /renderSettleButton/,
  "Intake UI should render a settle action."
);
assert.match(
  caseWorkspaceSource,
  /renderSettlementPanel/,
  "Workspace should render a settlement mode panel."
);
assert.match(
  caseWorkspaceSource,
  /\) : isSettlement \|\| isSettled \? \(\s*renderSettlementPanel\(\)\s*\) : isExited/s,
  "Settlement mode should replace the courtroom workspace, not render beneath it."
);
assert.match(
  caseWorkspaceSource,
  /activeSettlementTab/,
  "Settlement mode should provide tabbed negotiation cockpit views."
);
assert.match(
  caseWorkspaceSource,
  /Deal Status[\s\S]*Messages[\s\S]*Strategy Notes/,
  "Settlement cockpit should default around deal status, messages, and strategy notes."
);
assert.doesNotMatch(
  caseWorkspaceSource,
  /Earlier messages are hidden/,
  "Collapsed settlement history should not leave a placeholder panel."
);
assert.match(
  caseWorkspaceSource,
  /Current Offer[\s\S]*Settlement Chance[\s\S]*Recommended next move/,
  "Settlement deal status should prioritize current offer, acceptance chance, and next move."
);
assert.match(
  caseWorkspaceSource,
  /id="settlement" className="settlement-cockpit mx-auto w-full max-w-\[1600px\]/,
  "Settlement mode should align to the wide case header width."
);
assert.match(
  caseWorkspaceSource,
  /lg:grid-cols-\[19rem_minmax\(0,1fr\)_19rem\]/,
  "Settlement mode should render as a broad negotiation cockpit with side rails."
);
assert.match(
  caseWorkspaceSource,
  /Your Client[\s\S]*Settlement Talks[\s\S]*Opponent/,
  "Settlement board should have client, settlement talks, and opponent zones."
);
assert.match(
  caseWorkspaceSource,
  /Build Formal Offer[\s\S]*Case Reference/,
  "Settlement mode should render formal offer builder and compact case reference areas."
);
assert.match(
  caseWorkspaceSource,
  /!isSettlement && !isSettled \? \(\s*<div className="mt-4 grid grid-cols-3/s,
  "Settlement mode should hide brief, fact sheet, and lawbook shortcut links."
);
assert.match(
  caseWorkspaceSource,
  /isSettlement \|\| isSettled \|\| isCourtroom \? null : \(/,
  "Settlement mode should not show fact sheet or lawbook side panels."
);
assert.match(
  caseWorkspaceSource,
  /router\.replace\(getSettlementHref\(nextCase\)\)/,
  "Opening settlement should move the browser to the settlement workspace route."
);
assert.match(
  caseWorkspaceSource,
  /settlement\/\$\{initial \? "start" : "message"\}/,
  "Workspace should call the settlement start route."
);
assert.match(
  caseWorkspaceSource,
  /caseSession\.primaryCategory !== "criminal"/,
  "Criminal matters should not show the settlement action."
);
assert.match(
  caseWorkspaceSource,
  /Settle in \$\{settlementCooldownLabel\}/,
  "Settlement action should show a live retry cooldown label."
);
assert.match(
  soloSettlementStartRouteSource,
  /caseSession\.primaryCategory === "criminal"/,
  "Solo settlement start route should reject criminal cases."
);
assert.match(
  soloSettlementStartRouteSource,
  /getSettlementCooldownState\(caseSession\.settlement \|\| \{\}\)/,
  "Solo settlement start route should enforce rejection cooldowns."
);
assert.match(
  soloSettlementMessageRouteSource,
  /caseSession\.primaryCategory === "criminal"/,
  "Solo settlement message route should reject criminal cases."
);
assert.match(
  challengeSource,
  /challenge\.primaryCategory === "criminal"/,
  "PVP settlement flows should reject criminal cases."
);
assert.match(
  challengeSource,
  /getSettlementCooldownState\(challenge\.settlement \|\| \{\}\)/,
  "PVP settlement flows should enforce rejection cooldowns."
);
assert.match(
  soloSettlementDashboardRouteSource,
  /export \{ default, dynamic \} from "\.\.\/page";/,
  "Solo cases should expose a dashboard settlement route."
);
assert.match(
  pvpSettlementDashboardRouteSource,
  /export \{ default, dynamic \} from "\.\.\/page";/,
  "PVP challenges should expose a dashboard settlement route."
);

console.log("Settlement tests passed");
