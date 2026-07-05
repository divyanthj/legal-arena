import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const caseSessionModel = await readFile(
  new URL("../models/CaseSession.js", import.meta.url),
  "utf8"
);
const challengeModel = await readFile(
  new URL("../models/Challenge.js", import.meta.url),
  "utf8"
);
const engineSource = await readFile(
  new URL("../libs/game/engine.js", import.meta.url),
  "utf8"
);
const soloInterviewRoute = await readFile(
  new URL("../app/api/cases/[caseId]/interview/route.js", import.meta.url),
  "utf8"
);
const challengeSource = await readFile(
  new URL("../libs/game/challenges.js", import.meta.url),
  "utf8"
);
const templateInterviewSource = await readFile(
  new URL("../libs/game/templateInterview.js", import.meta.url),
  "utf8"
);
const storeSource = await readFile(
  new URL("../libs/game/store.js", import.meta.url),
  "utf8"
);
const clientMemorySource = await readFile(
  new URL("../libs/game/clientMemory.js", import.meta.url),
  "utf8"
);
const interviewEngineSource = await readFile(
  new URL("../libs/game/engine/interview.js", import.meta.url),
  "utf8"
);
const caseWorkspaceSource = await readFile(
  new URL("../components/legal-arena/CaseWorkspace.js", import.meta.url),
  "utf8"
);

assert.match(caseSessionModel, /clientMemory:\s*{[\s\S]*?type:\s*mongoose\.Schema\.Types\.Mixed/);
assert.match(caseSessionModel, /clientMemory:\s*{[\s\S]*?private:\s*true/);
assert.match(caseSessionModel, /clientMemoryExcerpt:\s*{/);
assert.match(challengeModel, /clientMemory:\s*{[\s\S]*?type:\s*mongoose\.Schema\.Types\.Mixed/);
assert.match(challengeModel, /clientMemory:\s*{[\s\S]*?private:\s*true/);
assert.match(challengeModel, /clientMemoryExcerpt:\s*{/);

assert.match(engineSource, /const CLIENT_MEMORY_MODEL =/);
assert.match(engineSource, /const INTERVIEW_RESPONSE_TEMPERATURE = 0\.7/);
assert.match(engineSource, /temperature:\s*INTERVIEW_RESPONSE_TEMPERATURE/);
assert.match(engineSource, /export const ensureClientMemory = async/);
assert.match(engineSource, /const getClientMemoryText =/);
assert.match(engineSource, /const normalizeLegacyClientMemoryText =/);
assert.match(engineSource, /typeof clientMemory === "string"/);
assert.match(engineSource, /clientMemory\.clientNarrative/);
assert.match(engineSource, /clientMemory\.personalMemory/);
assert.match(engineSource, /clientMemory\.evidenceAccess/);
assert.match(engineSource, /const normalizeClientMemory = \(aiResult\) =>/);
assert.match(engineSource, /coerceString\(aiResult\.clientStory\)/);
assert.match(engineSource, /clientStory:\s*"string"/);
assert.match(engineSource, /memoryClaims:\s*\[/);
assert.match(engineSource, /freeform first-person client memory story/);
assert.match(engineSource, /subjective truth as they see it/);
assert.match(engineSource, /may be wrong, self-serving, defensive, selectively truthful/);
assert.match(engineSource, /may add plausible case-domain details that are party-side claims rather than canon/);
assert.match(engineSource, /do not create new evidence artifacts/);
assert.match(engineSource, /plausible invented claims/);
assert.match(engineSource, /buildClientMemoryMoneyAnchors/);
assert.match(engineSource, /moneyAnchors/);
assert.match(engineSource, /Preserve exact dollar figures from moneyAnchors/);
assert.match(engineSource, /original deposit amount and the amount withheld, returned, or deducted/);
assert.match(engineSource, /invented details are party claims, not new documents, photos, messages, witnesses, records, or proof/);
assert.match(engineSource, /treat the latest question as a continuation/);
assert.match(engineSource, /Retell the stored client memory only if the lawyer explicitly asks/);
assert.match(engineSource, /Never answer a proof-possession question by retelling the full memory story/);
assert.match(engineSource, /speaking privately to the lawyer/);
assert.match(engineSource, /Never address the lawyer as Your Honor/);
assert.match(engineSource, /memoryClaims:\s*getClientMemoryClaims\(clientMemoryResult\.clientMemory, playerSide\)/);
assert.match(engineSource, /newMemoryClaims:\s*\[/);
assert.match(engineSource, /If an amount, date, name, location, or count question asks for a central case detail/);
assert.match(engineSource, /you may give one plausible party-side claim or estimate/);
assert.match(engineSource, /include it in newMemoryClaims/);
assert.match(engineSource, /use existing memoryClaims first/);
assert.match(engineSource, /Do not invent documents, photos, receipts, witnesses, messages, admissions, records, or automatic evidence/);
assert.match(engineSource, /const nextClientMemory = withClientMemoryClaims/);
assert.match(engineSource, /interviewResult\.newMemoryClaims\.length/);
assert.doesNotMatch(
  engineSource,
  /For amount, date, name, location, or count questions, answer in one sentence with that detail only; if you do not remember it, say that plainly and stop/
);
assert.doesNotMatch(engineSource, /const pickSpecificMemoryAnswer =/);
assert.doesNotMatch(engineSource, /const buildProofPossessionMemoryAnswer =/);
assert.doesNotMatch(engineSource, /splitMemorySentences\(memoryText\)/);
assert.doesNotMatch(engineSource, /section:\s*UNCERTAINTY_PATTERN\.test\(text\)/);
assert.doesNotMatch(engineSource, /sanitizeIdList\(clientMemory\.factIds/);
assert.doesNotMatch(engineSource, /sanitizeIdList\(clientMemory\.evidenceIds/);
assert.match(engineSource, /const interviewSubject = getInterviewSubjectForSide\(template, playerSide\)/);
assert.match(engineSource, /representedLegalPartyName:\s*legalPartyName/);
assert.match(engineSource, /process\.env\.OPENAI_CLIENT_MEMORY_MODEL\?\.trim\(\) \|\| GAMEPLAY_MODEL/);
assert.match(engineSource, /generateClientMemoryExcerpt/);
assert.match(engineSource, /clientMemoryExcerpt,/);
assert.match(engineSource, /canonicalRoleContext:\s*actorContext/);
assert.match(engineSource, /mode:\s*"stored_client_memory"/);
assert.match(engineSource, /mode:\s*"canonical_context"/);
assert.doesNotMatch(engineSource, /mode:\s*"canonical_fallback"/);
assert.match(engineSource, /clientMemory:\s*[\s\S]*clientMemoryResult\.created \|\| interviewResult\.newMemoryClaims\.length[\s\S]*\? nextClientMemory[\s\S]*: null/);
assert.match(
  engineSource,
  /Use the stored freeform client memory story, memoryClaims, current visible fact sheet, and recent transcript/
);
assert.match(
  engineSource,
  /You update a lawyer's private working fact sheet from the conversation only/
);
assert.match(
  engineSource,
  /Do not state anything as proven unless the client actually said it or produced it/
);

assert.match(soloInterviewRoute, /caseSession\.clientMemory = result\.clientMemory/);
assert.match(soloInterviewRoute, /caseSession\.markModified\?\.\("clientMemory"\)/);
assert.match(soloInterviewRoute, /caseSession\.clientMemoryExcerpt = result\.clientMemoryExcerpt/);
assert.match(soloInterviewRoute, /applyClientMemoryOpeningToCaseSession\(/);
assert.match(soloInterviewRoute, /speaker:\s*[\s\S]*result\.interviewSubjectName/);

assert.match(challengeSource, /const setParticipantClientMemory =/);
assert.match(challengeSource, /const applyClientMemoryOpeningToParticipant =/);
assert.match(challengeSource, /generateClientMemoryExcerpt/);
assert.match(challengeSource, /const ensureParticipantClientMemory = async/);
assert.match(challengeSource, /clientMemory:\s*participant\.clientMemory \|\| null/);
assert.match(challengeSource, /clientMemoryExcerpt:\s*participant\.clientMemoryExcerpt \|\| ""/);
assert.match(challengeSource, /applyClientMemoryOpeningToParticipant\(/);
assert.match(challengeSource, /setParticipantClientMemory\(/);
assert.match(challengeSource, /ensureParticipantClientMemory\(\{[\s\S]*?participant,[\s\S]*?otherParticipant,[\s\S]*?userId/);
assert.match(challengeSource, /speaker:\s*[\s\S]*result\.interviewSubjectName/);
assert.match(challengeSource, /interviewSubjectName:/);
assert.match(
  challengeSource,
  /const \{ clientMemory, \.\.\.publicParticipant \} = participant;/
);

assert.match(templateInterviewSource, /export const buildInterviewSubjectForSide =/);
assert.match(templateInterviewSource, /the people\|people of\|state of/);
assert.match(templateInterviewSource, /Loss-prevention employee/);
assert.match(
  storeSource,
  /import \{ ensureClientMemory, rebuildFactSheetFromTranscript \} from "\.\/engine"/
);
assert.match(storeSource, /generateClientMemoryExcerpt/);
assert.match(storeSource, /export const applyClientMemoryOpeningToCaseSession =/);
assert.match(storeSource, /const clientMemoryExcerpt = String\(plainCase\.clientMemoryExcerpt \|\| ""\)\.trim\(\)/);
assert.match(storeSource, /clientMemoryExcerpt,/);
assert.match(storeSource, /const clientMemoryResult = await ensureClientMemory\(/);
assert.match(storeSource, /caseSession\.clientMemory = clientMemoryResult\.clientMemory/);
assert.match(storeSource, /caseSession\.clientMemoryExcerpt = await generateClientMemoryExcerpt\(/);
assert.match(storeSource, /applyClientMemoryOpeningToCaseSession\(/);
assert.match(storeSource, /await caseSession\.save\(\)/);
assert.ok(
  storeSource.indexOf("const clientMemoryResult = await ensureClientMemory(") <
    storeSource.indexOf("await caseSession.save()"),
  "solo case creation should attempt client memory before saving"
);
const createChallengeStart = challengeSource.indexOf("export const createChallenge = async");
const createChallengeEnd = challengeSource.indexOf("export const listChallengesForUser");
const createChallengeSource = challengeSource.slice(createChallengeStart, createChallengeEnd);
assert.doesNotMatch(
  createChallengeSource,
  /await ensureParticipantClientMemory/,
  "challenge creation should return without synchronous AI client-memory preparation"
);
assert.ok(
  createChallengeSource.indexOf("await challenge.save()") <
    createChallengeSource.indexOf("await sendChallengeInviteEmail"),
  "challenge creation should persist before non-blocking invite email work"
);
assert.match(challengeSource, /export const getChallengeForUser = async[\s\S]*ensureParticipantClientMemory/);
assert.match(challengeSource, /export const acceptChallengeForUser = async[\s\S]*ensureParticipantClientMemory/);
assert.match(storeSource, /playerInterviewSubjectName:/);
assert.match(storeSource, /speaker:\s*playerInterviewSubject\.name/);
assert.match(caseWorkspaceSource, /getPlayerInterviewSubjectName/);
assert.match(caseWorkspaceSource, /Interview \{playerInterviewSubjectName\}/);
assert.match(caseWorkspaceSource, /const heroNarrativeExcerpt =/);
assert.match(caseWorkspaceSource, /caseSession\.clientMemoryExcerpt/);
assert.match(caseWorkspaceSource, /const cleanIntakePartySpeech = \(value = ""\) =>/);
assert.match(caseWorkspaceSource, /cleanIntakePartySpeech\(caseSession\.clientMemoryExcerpt\)/);
assert.match(caseWorkspaceSource, /\{heroNarrativeExcerpt\}/);
assert.match(clientMemorySource, /export const generateClientMemoryExcerpt = async/);
assert.match(clientMemorySource, /requestStructuredCompletion/);
assert.match(clientMemorySource, /usageLabel:\s*"intake\.clientMemoryExcerpt"/);
assert.match(clientMemorySource, /Avoid generic setup lines/);
assert.match(clientMemorySource, /Never address the listener as Your Honor/);
assert.match(clientMemorySource, /No courtroom address; do not say Your Honor/);
assert.match(interviewEngineSource, /const cleanPartyResponseAddress = \(value = ""\) =>/);
assert.match(interviewEngineSource, /cleanPartyResponseAddress\(coerceString\(aiResult\.partyResponse\)\)/);
assert.doesNotMatch(clientMemorySource, /buildSafeClientMemoryExcerpt/);
assert.doesNotMatch(clientMemorySource, /normalizePartySpeechToFirstPerson/);
assert.doesNotMatch(clientMemorySource, /hasThirdPersonSelfReference/);

console.log("Client memory intake tests passed");
