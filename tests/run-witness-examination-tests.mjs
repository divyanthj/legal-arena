import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");

const witnessSource = read("../libs/game/witnesses.js");
const modelSource = read("../models/CaseSession.js");
const storeSource = read("../libs/game/store.js");
const courtroomSource = read("../libs/game/engine/courtroom.js");
const courtroomRouteSource = read("../app/api/cases/[caseId]/courtroom/route.js");
const witnessRouteSource = read("../app/api/cases/[caseId]/witness/route.js");
const portraitRouteSource = read("../app/api/cases/[caseId]/witness-portrait/route.js");
const workspaceSource = read("../components/legal-arena/CaseWorkspace.js");

assert.match(modelSource, /witnesses:\s*\{[\s\S]*?private:\s*true/);
assert.match(modelSource, /witnessRosterVersion:\s*\{[\s\S]*?private:\s*true/);
assert.match(modelSource, /enum:\s*\["player", "opponent", "witness", "judge"\]/);
assert.match(modelSource, /enum:\s*\["idle", "direct", "cross"\]/);
assert.match(modelSource, /objectionGround/);
assert.match(modelSource, /admitted:\s*\{ type: Boolean/);

const publicPayloadSource =
  witnessSource.match(
    /export const buildPublicWitnessPayload[\s\S]*?\n\};\n\nexport const startWitnessExamination/
  )?.[0] || "";
assert.ok(publicPayloadSource, "public witness payload source should be found");
assert.match(publicPayloadSource, /publicSummary/);
assert.match(publicPayloadSource, /examinationStatus/);
assert.match(publicPayloadSource, /portrait: witness\.portrait\?\.image/);
assert.doesNotMatch(publicPayloadSource, /credibility/);
assert.doesNotMatch(publicPayloadSource, /personality/);
assert.doesNotMatch(publicPayloadSource, /knowledge/);
assert.doesNotMatch(publicPayloadSource, /portraitDirection/);

assert.match(storeSource, /buildPublicWitnessPayload/);
assert.match(storeSource, /courtroomWitnesses/);
assert.match(witnessSource, /knownFacts are the only facts they may affirm/);
assert.match(witnessSource, /Credibility characteristics and portrait expression cues are hidden/);
assert.match(witnessSource, /Direct examination generally bars leading questions/);
assert.match(witnessSource, /cross-examination generally permits them/);
assert.match(witnessSource, /A sustained objection produces no substantive witness answer/);
assert.match(witnessSource, /privateMotive/);
assert.match(witnessSource, /pressureResponse/);
assert.match(witnessSource, /liveAdjustment/);
assert.match(witnessSource, /export const buildWitnessRosterPlan/);
assert.match(witnessSource, /explicit-witness-evidence/);
assert.match(witnessSource, /complexity === 1/);
assert.match(witnessSource, /simple-record-or-party-testimony-case/);
assert.match(witnessSource, /no-natural-non-party-witness/);
assert.match(witnessSource, /witness-omitted-for-case-variety/);
assert.match(witnessSource, /const inclusionThreshold = \{ 2: 0\.4, 3: 0\.7, 4: 0\.88, 5: 1 \}/);
assert.match(witnessSource, /maxWitnesses: enabled \? \(complexity >= 4 \? 2 : 1\) : 0/);

assert.match(witnessRouteSource, /action === "call"/);
assert.match(witnessRouteSource, /action === "question"/);
assert.match(witnessRouteSource, /action === "end"/);
assert.match(courtroomRouteSource, /Finish the active witness examination/);

assert.match(courtroomSource, /buildAdmittedWitnessRecord/);
assert.match(courtroomSource, /entry\?\.admitted === true/);
assert.match(courtroomSource, /excluded answers, sustained questions/);

assert.match(portraitRouteSource, /expression must be subtle and psychologically ambiguous/);
assert.match(portraitRouteSource, /must never look like a morality label/);
assert.match(portraitRouteSource, /without turning nationality, occupation, gender, age, ethnicity/);
assert.match(portraitRouteSource, /witness\.portrait =/);

assert.match(workspaceSource, />Witness stand</);
assert.match(workspaceSource, /Call for direct examination/);
assert.match(workspaceSource, /Begin cross-examination/);
assert.match(workspaceSource, /Ask the witness/);
assert.match(workspaceSource, /End examination/);
assert.match(workspaceSource, /!activeWitness \? \(/);
assert.match(workspaceSource, /const WITNESS_RESPONSE_TIMEOUT_MS = 45_000/);
assert.match(workspaceSource, /\{ timeout: WITNESS_RESPONSE_TIMEOUT_MS \}/);

console.log("Witness examination tests passed");
