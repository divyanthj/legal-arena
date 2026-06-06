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
const caseWorkspaceSource = await readFile(
  new URL("../components/legal-arena/CaseWorkspace.js", import.meta.url),
  "utf8"
);

assert.match(caseSessionModel, /clientMemory:\s*{[\s\S]*?type:\s*mongoose\.Schema\.Types\.Mixed/);
assert.match(caseSessionModel, /clientMemory:\s*{[\s\S]*?private:\s*true/);
assert.match(challengeModel, /clientMemory:\s*{[\s\S]*?type:\s*mongoose\.Schema\.Types\.Mixed/);
assert.match(challengeModel, /clientMemory:\s*{[\s\S]*?private:\s*true/);

assert.match(engineSource, /const CLIENT_MEMORY_MODEL =/);
assert.match(engineSource, /export const ensureClientMemory = async/);
assert.match(engineSource, /Number\(clientMemory\.version \|\| 0\) >= 2/);
assert.match(engineSource, /clientMemory\.interviewSubjectName/);
assert.match(engineSource, /const interviewSubject = getInterviewSubjectForSide\(template, playerSide\)/);
assert.match(engineSource, /representedLegalPartyName:\s*legalPartyName/);
assert.match(engineSource, /process\.env\.OPENAI_CLIENT_MEMORY_MODEL\?\.trim\(\) \|\| GAMEPLAY_MODEL/);
assert.match(engineSource, /canonicalRoleContext:\s*actorContext/);
assert.match(engineSource, /mode:\s*"stored_client_memory"/);
assert.match(engineSource, /mode:\s*"canonical_fallback"/);
assert.match(engineSource, /clientMemory:\s*clientMemoryResult\.created \? clientMemoryResult\.clientMemory : null/);
assert.match(
  engineSource,
  /Use only the stored client memory, current visible fact sheet, and recent transcript/
);

assert.match(soloInterviewRoute, /caseSession\.clientMemory = result\.clientMemory/);
assert.match(soloInterviewRoute, /caseSession\.markModified\?\.\("clientMemory"\)/);
assert.match(soloInterviewRoute, /speaker:\s*[\s\S]*result\.interviewSubjectName/);

assert.match(challengeSource, /const setParticipantClientMemory =/);
assert.match(challengeSource, /clientMemory:\s*participant\.clientMemory \|\| null/);
assert.match(challengeSource, /setParticipantClientMemory\(challenge, participant, result\.clientMemory\)/);
assert.match(challengeSource, /speaker:\s*[\s\S]*result\.interviewSubjectName/);
assert.match(challengeSource, /interviewSubjectName:/);
assert.match(
  challengeSource,
  /const \{ clientMemory, \.\.\.publicParticipant \} = participant;/
);

assert.match(templateInterviewSource, /export const buildInterviewSubjectForSide =/);
assert.match(templateInterviewSource, /the people\|people of\|state of/);
assert.match(templateInterviewSource, /Loss-prevention employee/);
assert.match(storeSource, /playerInterviewSubjectName:/);
assert.match(storeSource, /speaker:\s*playerInterviewSubject\.name/);
assert.match(caseWorkspaceSource, /getPlayerInterviewSubjectName/);
assert.match(caseWorkspaceSource, /Interview \{playerInterviewSubjectName\}/);

console.log("Client memory intake tests passed");
