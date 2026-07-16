import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  getAdjournmentAllowance,
  getAdjournmentRemaining,
  hasAdjournmentRequestForRound,
  recordAdjournmentDecision,
  resolveActiveAdjournment,
} from "../libs/game/adjournment.js";

assert.equal(getAdjournmentAllowance(1), 1);
assert.equal(getAdjournmentAllowance(2), 1);
assert.equal(getAdjournmentAllowance(3), 2);
assert.equal(getAdjournmentAllowance(4), 2);
assert.equal(getAdjournmentAllowance(5), 3);

const source = { complexity: 4, adjournment: {}, markModified() {} };
recordAdjournmentDecision({
  source,
  trigger: "player_request",
  requestedByUserId: "player-1",
  courtroomRound: 2,
  reason: "A material record is missing.",
  ruling: "Granted so counsel may obtain the record.",
  granted: true,
});
assert.equal(source.adjournment.active, true);
assert.equal(source.adjournment.grantsUsed, 1);
assert.equal(source.adjournment.grantsAllowed, 2);
assert.equal(getAdjournmentRemaining(source.adjournment, source.complexity), 1);
assert.equal(
  hasAdjournmentRequestForRound({
    adjournment: source.adjournment,
    round: 2,
    requestedByUserId: "player-1",
  }),
  true
);

recordAdjournmentDecision({
  source,
  trigger: "player_request",
  requestedByUserId: "player-1",
  courtroomRound: 3,
  reason: "More time is requested.",
  ruling: "Denied because no curable material gap was identified.",
  granted: false,
});
assert.equal(source.adjournment.grantsUsed, 1, "denials must not consume grants");
assert.equal(source.adjournment.active, false);

const resumeSource = {
  complexity: 2,
  adjournment: {
    active: true,
    grantsUsed: 1,
    grantsAllowed: 1,
    history: [source.adjournment.history[0]],
  },
  markModified() {},
};
assert.equal(resolveActiveAdjournment(resumeSource), true);
assert.equal(resumeSource.adjournment.active, false);
assert.ok(resumeSource.adjournment.history.at(-1).resumedAt);

const challengeSource = await readFile(
  new URL("../libs/game/challenges.js", import.meta.url),
  "utf8"
);
const soloRouteSource = await readFile(
  new URL("../app/api/cases/[caseId]/adjournment/request/route.js", import.meta.url),
  "utf8"
);
const workspaceSource = await readFile(
  new URL("../components/legal-arena/CaseWorkspace.js", import.meta.url),
  "utf8"
);

assert.match(challengeSource, /pauseChallengeForAdjournment/);
assert.match(challengeSource, /challenge\.courtroomDeadlineAt = null/);
assert.match(challengeSource, /resumingAdjournment[\s\S]*allReady/);
assert.match(challengeSource, /getSubmissionForParticipant\(round, participant\)/);
assert.match(soloRouteSource, /caseSession\.status = "interview"/);
assert.match(soloRouteSource, /caseSession\.maxCourtRounds \+= 1/);
assert.match(workspaceSource, /Ask for adjournment/);
assert.match(workspaceSource, /Adjourned — intake reopened/);

console.log("Adjournment tests passed");
