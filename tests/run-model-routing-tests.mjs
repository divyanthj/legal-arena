import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");
const [
  modelRouting,
  gpt,
  dynamicCase,
  currentEvents,
  applicableLaws,
  clientMemory,
  engine,
  store,
  challenges,
  generation,
  envExample,
] = await Promise.all([
  read("../libs/game/aiModels.js"),
  read("../libs/gpt.js"),
  read("../libs/game/dynamicCase.js"),
  read("../libs/game/currentEvents.js"),
  read("../libs/game/applicableLaws.js"),
  read("../libs/game/clientMemory.js"),
  read("../libs/game/engine.js"),
  read("../libs/game/store.js"),
  read("../libs/game/challenges.js"),
  read("../libs/game/generation.js"),
  read("../.env.example"),
]);

assert.match(
  modelRouting,
  /process\.env\.OPENAI_CASE_CREATION_MODEL\?\.trim\(\)[\s\S]*process\.env\.OPENAI_DYNAMIC_CASE_MODEL\?\.trim\(\)[\s\S]*"gpt-5\.6-sol"/
);
assert.match(gpt, /DEFAULT_MODEL[\s\S]*"gpt-5\.6-terra"/);
assert.match(generation, /DEFAULT_GENERATION_MODEL[\s\S]*"gpt-5\.6-terra"/);
assert.match(currentEvents, /CURRENT_EVENTS_MODEL[\s\S]*"gpt-5\.6-terra"/);
assert.match(applicableLaws, /REAL_LAW_MODEL[\s\S]*"gpt-5\.6-terra"/);

assert.match(dynamicCase, /model = CASE_CREATION_MODEL/);
assert.match(dynamicCase, /researchCurrentEvent\(\{[\s\S]*?model,/);
assert.match(dynamicCase, /requestStructuredCompletion\(\{[\s\S]*?model,/);
assert.match(dynamicCase, /repairCurrentEventAnonymization\(\{[\s\S]*?model,/);
assert.match(currentEvents, /discoverHotButtonCandidates[\s\S]*model = CURRENT_EVENTS_MODEL/);
assert.match(currentEvents, /buildDetailedEventBrief[\s\S]*model = CURRENT_EVENTS_MODEL/);
assert.match(currentEvents, /repairCurrentEventAnonymization[\s\S]*model = CURRENT_EVENTS_MODEL/);

const createCaseSource = store.slice(
  store.indexOf("export const createCaseSession = async"),
  store.indexOf("export const listCaseSessionsForUser")
);
assert.equal(
  [...createCaseSource.matchAll(/model: CASE_CREATION_MODEL/g)].length,
  6,
  "solo initialization should route six AI entry points through the case-creation model"
);

const participantInitializationSource = challenges.slice(
  challenges.indexOf("const ensureParticipantClientMemory = async"),
  challenges.indexOf("const getOpenRound")
);
assert.equal(
  [...participantInitializationSource.matchAll(/model: CASE_CREATION_MODEL/g)].length,
  2,
  "deferred PvP participant memory initialization should use the case-creation model"
);

const createChallengeSource = challenges.slice(
  challenges.indexOf("export const createChallenge = async"),
  challenges.indexOf("export const listChallengesForUser")
);
assert.equal(
  [...createChallengeSource.matchAll(/model: CASE_CREATION_MODEL/g)].length,
  3,
  "PvP creation should route generation, jurisdiction, and initial laws through the case-creation model"
);

assert.match(applicableLaws, /generateLegalJurisdiction[\s\S]*model = MODEL/);
assert.match(applicableLaws, /selectApplicableRulebookLaws[\s\S]*model = MODEL/);
assert.match(applicableLaws, /researchApplicableRealLaws[\s\S]*model = REAL_LAW_MODEL/);
assert.match(clientMemory, /generateClientMemoryExcerpt[\s\S]*model = CLIENT_MEMORY_EXCERPT_MODEL/);
assert.match(engine, /ensureClientMemory[\s\S]*model = CLIENT_MEMORY_MODEL/);
assert.doesNotMatch(engine, /CASE_CREATION_MODEL/);

assert.match(gpt, /isGpt56Model\(model\) \? "none" : ""/);
assert.equal(
  [...gpt.matchAll(/\.\.\.buildReasoningPayload\(\{ model, reasoningEffort \}\)/g)].length,
  2,
  "structured and web-grounded Responses requests should both pin GPT-5.6 reasoning"
);

for (const [name, source] of Object.entries({
  gpt,
  dynamicCase,
  currentEvents,
  applicableLaws,
  clientMemory,
  engine,
  store,
  challenges,
  generation,
  envExample,
})) {
  assert.doesNotMatch(source, /"gpt-5\.4"|=gpt-5\.4(?:\r?$)/m, `${name} retains a full GPT-5.4 default`);
}

assert.match(engine, /"gpt-5\.4-mini"/);
assert.match(clientMemory, /"gpt-5\.4-mini"/);
assert.match(applicableLaws, /"gpt-5\.4-mini"/);
assert.match(envExample, /OPENAI_CASE_CREATION_MODEL=gpt-5\.6-sol/);
assert.match(envExample, /OPENAI_CURRENT_EVENTS_MODEL=gpt-5\.6-terra/);
assert.match(envExample, /OPENAI_LEGAL_RESEARCH_MODEL=gpt-5\.6-terra/);

console.log("Model routing tests passed");
