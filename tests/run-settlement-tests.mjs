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
  /Negotiation Room/,
  "Settlement mode should render a focused negotiation room."
);
assert.match(
  caseWorkspaceSource,
  /Your Client[\s\S]*Opponent[\s\S]*Main Blocker[\s\S]*Stage/,
  "Settlement room should summarize negotiation state at the top."
);
assert.doesNotMatch(
  caseWorkspaceSource,
  /Earlier messages are hidden/,
  "Collapsed settlement history should not leave a placeholder panel."
);
assert.match(
  caseWorkspaceSource,
  /Current Offer[\s\S]*Will this settle\?[\s\S]*Recommended next move[\s\S]*Message to opponent[\s\S]*Recent exchanges/,
  "Settlement room should prioritize offer, viability, next move, composer, and recent exchanges."
);
assert.match(
  caseWorkspaceSource,
  /settlementCaseContextLine[\s\S]*View matter summary/,
  "Settlement header should use a compact case context with an optional matter summary."
);
assert.match(
  caseWorkspaceSource,
  /id="settlement" className="settlement-cockpit mx-auto w-full max-w-\[1600px\]/,
  "Settlement mode should align to the wide case header width."
);
assert.match(
  caseWorkspaceSource,
  /md:grid-cols-2 xl:grid-cols-4/,
  "Settlement mode should use compact responsive summary cards instead of side rails."
);
assert.match(
  caseWorkspaceSource,
  /Settlement Amount[\s\S]*Payment Timeline[\s\S]*Corrective Work[\s\S]*Release[\s\S]*Costs[\s\S]*Fault/,
  "Settlement room should show the current offer as compact terms."
);
assert.match(
  caseWorkspaceSource,
  /Supporting info/,
  "Settlement mode should keep supporting info compact at the bottom."
);
assert.match(
  caseWorkspaceSource,
  /settlementTourStorageKey[\s\S]*SettlementTourOverlay[\s\S]*data-settlement-tour-target/,
  "Settlement mode should have its own guided tour overlay and target markers."
);
assert.match(
  caseWorkspaceSource,
  /setShowSettlementTour\(true\)[\s\S]*Take the settlement tour/,
  "Settlement mode should expose a manual tour replay action."
);
assert.match(
  caseWorkspaceSource,
  /settlement-status[\s\S]*settlement-offer[\s\S]*settlement-viability[\s\S]*settlement-next-move[\s\S]*settlement-message[\s\S]*settlement-recent[\s\S]*settlement-support/,
  "Settlement tour should walk through the main negotiation room sections."
);
assert.match(
  caseWorkspaceSource,
  /showSettlementTour && \(isSettlement \|\| isSettled\)/,
  "Settlement tour should only run on settlement-style pages."
);
assert.match(
  caseWorkspaceSource,
  /Client priorities[\s\S]*Opponent priorities[\s\S]*Compare with court[\s\S]*Case facts[\s\S]*Full negotiation history/,
  "Settlement mode should expose compact supporting info actions."
);
assert.match(
  caseWorkspaceSource,
  /btn btn-ghost settlement-interactive h-auto min-h-16/,
  "Settlement supporting info actions should use DaisyUI button styling."
);
assert.match(
  caseWorkspaceSource,
  /isSettlementInfoModalOpen[\s\S]*modal modal-bottom sm:modal-middle[\s\S]*modal-open[\s\S]*className="modal-box[\s\S]*className="card card-compact/,
  "Settlement supporting info should use a persistent DaisyUI modal with DaisyUI cards and animated open state."
);
assert.match(
  caseWorkspaceSource,
  /btn btn-circle btn-ghost btn-sm[\s\S]*modal-backdrop/,
  "Settlement supporting info modal should use DaisyUI close and backdrop affordances."
);
assert.doesNotMatch(
  caseWorkspaceSource.match(/const renderSettlementPanel = \(\) => \{[\s\S]*?const renderLawbookFilters/)?.[0] || "",
  /Case Reference|Open Full Case File|fact-sheet-details/,
  "Settlement mode should not include full fact sheet or case file links."
);
assert.match(
  caseWorkspaceSource,
  /settlementInfoRows[\s\S]*facts: settlementCaseFacts/,
  "Settlement case facts should be available only through supporting info."
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
  /\) : isSettlement \|\| isSettled \? null : \(\s*<>\s*\{workspaceNotice\}\s*<div id="fact-sheet-details"/,
  "Settlement mode should not render the desktop case file aside."
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
