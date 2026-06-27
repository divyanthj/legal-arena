import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const interviewSource = await readFile(
  new URL("../libs/game/engine/interview.js", import.meta.url),
  "utf8"
);
const engineSource = await readFile(new URL("../libs/game/engine.js", import.meta.url), "utf8");
const templateBuilderSharedSource = await readFile(
  new URL("../libs/game/templateBuilder/shared.js", import.meta.url),
  "utf8"
);

assert.doesNotMatch(
  templateBuilderSharedSource,
  /apartment needed more work after move-out than the tenant now admits/
);
assert.match(
  templateBuilderSharedSource,
  /but the other side frames that point differently/
);

assert.match(interviewSource, /const partyResponse = coerceString\(aiResult\.partyResponse\)/);
assert.match(interviewSource, /throw new Error\("Interview response generation returned no answer\."\)/);
assert.doesNotMatch(interviewSource, /buildInterviewFallback/);
assert.doesNotMatch(interviewSource, /FallbackPartyResponse/);
assert.doesNotMatch(interviewSource, /aiUsesWrongEvidenceType/);
assert.doesNotMatch(interviewSource, /isResponsiveInterviewAnswer/);
assert.doesNotMatch(interviewSource, /normalizedAiPartyResponse/);

assert.doesNotMatch(engineSource, /buildInterviewFallback/);
assert.doesNotMatch(engineSource, /buildClientMemoryInterviewFallback/);
assert.doesNotMatch(engineSource, /buildCanonicalInterviewBackup/);
assert.doesNotMatch(engineSource, /minimumMemoryScore/);
assert.doesNotMatch(engineSource, /canonical_fallback/);
assert.match(engineSource, /mode:\s*"canonical_context"/);
assert.match(
  engineSource,
  /normalizeInterviewResult\(\{\s*aiResult,\s*template,\s*caseSession,\s*question,\s*factSheet:\s*currentConversationFactSheet,\s*playerSide,\s*\}\)/
);

console.log("Interview language regression tests passed");
