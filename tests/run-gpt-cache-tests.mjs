import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const gptSource = await readFile(new URL("../libs/gpt.js", import.meta.url), "utf8");
const engineSource = await readFile(
  new URL("../libs/game/engine.js", import.meta.url),
  "utf8"
);
const clientMemorySource = await readFile(
  new URL("../libs/game/clientMemory.js", import.meta.url),
  "utf8"
);

assert.match(gptSource, /export const getPromptCacheHitRate =/);
assert.match(gptSource, /cached \/ input/);
assert.match(gptSource, /toFixed\(4\)/);
assert.match(gptSource, /promptCacheKey = ""/);
assert.match(gptSource, /prompt_cache_key/);
assert.match(gptSource, /String\(promptCacheKey\)\.trim\(\)\.slice\(0, 64\)/);
assert.match(gptSource, /usage\?\.input_tokens_details\?\.cached_tokens/);
assert.match(gptSource, /usage\?\.input_cached_tokens/);
assert.match(gptSource, /const cacheHitRate = getPromptCacheHitRate\(usage\)/);
assert.match(gptSource, /cacheHitRate,/);
assert.match(gptSource, /promptCacheKey:/);

assert.match(engineSource, /import \{ createHash \} from "node:crypto"/);
assert.match(engineSource, /const buildGameplayPromptCacheKey =/);
assert.match(engineSource, /shortHash\(model\)/);
assert.match(engineSource, /shortHash\(getSessionCacheIdentity\(caseSession\)\)/);
assert.match(engineSource, /family:\s*"partyResponse"/);
assert.match(engineSource, /family:\s*"factSheetPatch"/);
assert.match(engineSource, /family:\s*"assessment"/);
assert.match(engineSource, /family:\s*"counselAnalysis"/);
assert.match(engineSource, /family:\s*shouldReturnVerdict \? "roundWithVerdict" : "round"/);
assert.match(engineSource, /promptCacheKey: buildGameplayPromptCacheKey/);
assert.match(clientMemorySource, /promptCacheKey = ""/);
assert.match(clientMemorySource, /promptCacheKey,/);

const partyPromptStart = engineSource.indexOf('usageLabel: "intake.partyResponse"');
const partyPromptEnd = engineSource.indexOf("const interviewResult = normalizeInterviewResult");
const partyPromptSource = engineSource.slice(partyPromptStart, partyPromptEnd);
assert.ok(
  partyPromptSource.indexOf("outputSchema") <
    partyPromptSource.indexOf("latestQuestion: question"),
  "party response prompt should keep stable schema before latest question"
);
assert.ok(
  partyPromptSource.indexOf("roleArchitecture") <
    partyPromptSource.indexOf("recentTranscript"),
  "party response prompt should keep role architecture before recent transcript"
);

const courtroomPromptStart = engineSource.indexOf(
  'usageLabel: shouldReturnVerdict ? "courtroom.roundWithVerdict" : "courtroom.round"'
);
const courtroomPromptEnd = engineSource.indexOf("return {", courtroomPromptStart);
const courtroomPromptSource = engineSource.slice(courtroomPromptStart, courtroomPromptEnd);
assert.ok(
  courtroomPromptSource.indexOf("opponentResponseRules") <
    courtroomPromptSource.indexOf("courtroomArchitecture"),
  "courtroom round prompt should keep stable rules before courtroom architecture"
);
assert.ok(
  courtroomPromptSource.indexOf("outputSchema") <
    courtroomPromptSource.indexOf("latestPlayerArgument: argument"),
  "courtroom round prompt should keep stable schema before latest argument"
);

console.log("GPT cache tests passed");
