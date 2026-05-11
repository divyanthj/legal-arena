import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const userModelSource = await readFile(
  new URL("../models/User.js", import.meta.url),
  "utf8"
);
const progressionSource = await readFile(
  new URL("../libs/game/progression.js", import.meta.url),
  "utf8"
);
const challengeModelSource = await readFile(
  new URL("../models/Challenge.js", import.meta.url),
  "utf8"
);
const challengeStoreSource = await readFile(
  new URL("../libs/game/challenges.js", import.meta.url),
  "utf8"
);
const challengeWorkspaceSource = await readFile(
  new URL("../components/legal-arena/ChallengeWorkspace.js", import.meta.url),
  "utf8"
);

assert.match(userModelSource, /const pvpProgressSchema = mongoose\.Schema/);
assert.match(userModelSource, /completedChallenges/);
assert.match(userModelSource, /pvp:\s*{\s*type:\s*pvpProgressSchema/);

assert.match(progressionSource, /export const normalizePvpProgression/);
assert.match(progressionSource, /applyChallengeVerdictToPvpProgression/);
assert.match(progressionSource, /pvp:\s*normalizePvpProgression\(source\.pvp\)/);
assert.match(progressionSource, /pvp:\s*progression\.pvp/);
assert.match(challengeModelSource, /quitByUserId/);
assert.match(challengeModelSource, /stayBonus/);
assert.match(challengeStoreSource, /export const quitChallengeForUser/);
assert.match(challengeStoreSource, /staying bonus/);
assert.match(challengeStoreSource, /seedParticipantFactSheetIfEmpty/);
assert.match(challengeStoreSource, /seedChallengeFactSheetsIfNeeded/);
assert.match(challengeStoreSource, /const setParticipantFactSheet = /);
assert.match(challengeStoreSource, /participant\.set\("factSheet", factSheet\)/);
assert.match(challengeStoreSource, /challenge\.markModified\("participants"\)/);
assert.match(challengeStoreSource, /const markCourtroomRoundsModified = /);
assert.match(challengeStoreSource, /buildTranscriptBackfillPatch/);
assert.match(challengeStoreSource, /backfillChallengeFactSheetsFromTranscript/);
assert.match(
  challengeStoreSource,
  /changed = backfillChallengeFactSheetsFromTranscript\(challenge\) \|\| changed/
);
assert.match(challengeStoreSource, /advanceChallengeToCourtIfPlaintiffReady/);
assert.match(
  challengeStoreSource,
  /changed = advanceChallengeToCourtIfPlaintiffReady\(challenge\) \|\| changed/
);
assert.match(challengeStoreSource, /plaintiffParticipant\?\.status === "ready"/);
assert.match(challengeStoreSource, /const plaintiffReady = participant\.side === "client"/);
assert.match(challengeStoreSource, /if \(allReady \|\| plaintiffReady\)/);
assert.match(challengeStoreSource, /buildConversationFactSheetFallback/);
assert.match(
  challengeStoreSource,
  /const exchangePatch = buildConversationFactSheetFallback/
);
assert.doesNotMatch(challengeStoreSource, /const confirmedProofCuePattern =/);
assert.match(challengeStoreSource, /const scoreChallengeSubmission = async/);
assert.match(challengeStoreSource, /const backfillChallengeCourtroomScores = async/);
assert.match(challengeStoreSource, /await backfillChallengeCourtroomScores\(challenge\)/);
assert.match(challengeStoreSource, /submission\.judgeNotes\?\.benchSignal/);
assert.match(challengeStoreSource, /!\["active", "courtroom"\]\.includes\(challenge\.status\)/);
assert.match(challengeStoreSource, /participant\.status !== "ready"/);
assert.match(challengeStoreSource, /Finalize your fact sheet before filing in court/);
assert.match(challengeStoreSource, /await scoreChallengeSubmission\(/);
assert.match(challengeStoreSource, /await closeRoundIfReady\(/);
assert.doesNotMatch(challengeStoreSource, /judgeRoundIfReady/);
assert.match(challengeStoreSource, /benchSummary: round\.benchSummary \|\| ""/);
assert.match(challengeWorkspaceSource, /const viewerReady = viewer\.status === "ready"/);
assert.match(
  challengeWorkspaceSource,
  /challenge\.status === "courtroom" && viewerReady/
);
assert.match(
  challengeWorkspaceSource,
  /\["active", "courtroom"\]\.includes\(challenge\.status\)\s*\?\s*"interview"/
);

console.log("Challenge progression tests passed");
