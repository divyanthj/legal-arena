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
const userModelSource = await readFile(
  new URL("../models/User.js", import.meta.url),
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
  /settlement\/\$\{initial \? "start" : "message"\}/,
  "Workspace should call the settlement start route."
);
assert.match(
  caseWorkspaceSource,
  /caseSession\.primaryCategory !== "criminal"/,
  "Criminal matters should not show the settlement action."
);
assert.match(
  soloSettlementStartRouteSource,
  /caseSession\.primaryCategory === "criminal"/,
  "Solo settlement start route should reject criminal cases."
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

console.log("Settlement tests passed");
