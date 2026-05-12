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
const caseWorkspaceSource = await readFile(
  new URL("../components/legal-arena/CaseWorkspace.js", import.meta.url),
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
assert.match(challengeStoreSource, /const buildSubmissionFeedbackBackfill = /);
assert.match(challengeStoreSource, /const backfillChallengeCourtroomFeedback = /);
assert.match(challengeStoreSource, /await backfillChallengeCourtroomScores\(challenge\)/);
assert.match(challengeStoreSource, /backfillChallengeCourtroomFeedback\(challenge\)/);
assert.match(challengeStoreSource, /submission\.judgeNotes\.strengths = feedback\.strengths/);
assert.match(challengeStoreSource, /submission\.judgeNotes\.weaknesses = feedback\.weaknesses/);
assert.match(challengeStoreSource, /submission\.judgeNotes\?\.benchSignal/);
assert.match(challengeStoreSource, /!\["active", "courtroom"\]\.includes\(challenge\.status\)/);
assert.match(challengeStoreSource, /participant\.status !== "ready"/);
assert.match(challengeStoreSource, /Finalize your fact sheet before filing in court/);
assert.match(challengeStoreSource, /const getLastCourtroomSubmission = /);
assert.match(challengeStoreSource, /const lastSubmission = getLastCourtroomSubmission\(challenge\)/);
assert.match(challengeStoreSource, /Wait for the other player's response before filing again/);
assert.match(challengeStoreSource, /const plaintiffHasFiledOpening = /);
assert.match(
  challengeStoreSource,
  /participant\.side === "opponent" && round\.round === 1 && !plaintiffHasFiledOpening/
);
assert.match(challengeStoreSource, /Wait for the plaintiff's opening statement/);
assert.match(challengeStoreSource, /await scoreChallengeSubmission\(/);
assert.match(challengeStoreSource, /await closeRoundIfReady\(/);
assert.doesNotMatch(challengeStoreSource, /judgeRoundIfReady/);
assert.match(challengeStoreSource, /benchSummary: round\.benchSummary \|\| ""/);
assert.match(
  challengeStoreSource,
  /round\.benchSummary = round\.benchSummary \|\| summarizeScoredRound\(round\)/
);
assert.match(challengeWorkspaceSource, /const viewerReady = viewer\.status === "ready"/);
assert.match(challengeWorkspaceSource, /const uniqueTextList = /);
assert.match(challengeWorkspaceSource, /const viewerJudgedSubmissions = judgedRounds/);
assert.match(challengeWorkspaceSource, /const opponentJudgedSubmissions = judgedRounds/);
assert.match(challengeWorkspaceSource, /const viewerStrengths = uniqueTextList/);
assert.match(challengeWorkspaceSource, /const viewerWeaknesses = uniqueTextList/);
assert.match(challengeWorkspaceSource, /const opponentStrengths = uniqueTextList/);
assert.match(challengeWorkspaceSource, /const opponentWeaknesses = uniqueTextList/);
assert.match(challengeWorkspaceSource, /highlights:\s*viewerStrengths/);
assert.match(challengeWorkspaceSource, /weaknesses:\s*viewerWeaknesses/);
assert.match(challengeWorkspaceSource, /viewer\.verdict === "loss" && opponentWeaknesses\.length/);
assert.match(challengeWorkspaceSource, /viewer\.verdict === "win" && opponentStrengths\.length/);
assert.match(
  challengeWorkspaceSource,
  /challenge\.status === "courtroom" && viewerReady/
);
assert.match(
  challengeWorkspaceSource,
  /\["active", "courtroom"\]\.includes\(challenge\.status\)\s*\?\s*"interview"/
);
assert.match(challengeWorkspaceSource, /realtimeRefresh:\s*true/);
assert.match(challengeWorkspaceSource, /realtimeRefreshPath:\s*`\/challenges\/\$\{challengeRef\}`/);
assert.match(challengeWorkspaceSource, /courtroomSubmitOnly:\s*true/);
assert.match(challengeWorkspaceSource, /requirePlaintiffOpening:\s*true/);
assert.match(challengeWorkspaceSource, /turnBasedCourtroom:\s*true/);
assert.match(challengeWorkspaceSource, /counselLabels:\s*true/);
assert.match(challengeWorkspaceSource, /playerCounselName:\s*viewer\.name/);
assert.match(challengeWorkspaceSource, /opponentCounselName:\s*opponent\.name/);
assert.match(caseWorkspaceSource, /apiClient\.get\(realtimeRefreshPath\)/);
assert.match(caseWorkspaceSource, /window\.setInterval\(refreshCase, realtimeRefreshIntervalMs\)/);
assert.match(caseWorkspaceSource, /const CounselIdentity = /);
assert.match(caseWorkspaceSource, /const useCounselLabels = Boolean\(apiConfig\.counselLabels\)/);
assert.match(caseWorkspaceSource, /`Counsel for \$\{opponentPartyName\}`/);
assert.match(caseWorkspaceSource, /Represented by \{representedBy\}/);
assert.match(caseWorkspaceSource, /const waitingForPlaintiffOpening = Boolean/);
assert.match(caseWorkspaceSource, /const waitingForOpponentResponse = Boolean/);
assert.match(caseWorkspaceSource, /const showCourtroomWaitingCard = Boolean/);
assert.match(caseWorkspaceSource, /apiConfig\.requirePlaintiffOpening/);
assert.match(caseWorkspaceSource, /apiConfig\.turnBasedCourtroom/);
assert.match(caseWorkspaceSource, /caseSession\.playerSide === "opponent"/);
assert.match(caseWorkspaceSource, /lastCourtroomEntry\?\.speaker === "player"/);
assert.match(caseWorkspaceSource, /\{opponentPartyName\} is preparing a response\.\.\./);
assert.match(caseWorkspaceSource, /TypingIndicator speaker=\{opponentPartyName\}/);
assert.match(caseWorkspaceSource, /LoadingBar label=\{`\$\{opponentPartyName\} is preparing a response`\}/);
assert.doesNotMatch(caseWorkspaceSource, /Your argument is filed/);
assert.match(
  caseWorkspaceSource,
  /setPendingSpeaker\(apiConfig\.courtroomSubmitOnly \? "" : getOpponentPartyName\(caseSession\)\)/
);
assert.match(caseWorkspaceSource, /Submitting\.\.\./);
assert.match(
  caseWorkspaceSource,
  /form\.dispatchEvent\(new Event\("submit", \{ bubbles: true, cancelable: true \}\)\)/
);
assert.doesNotMatch(caseWorkspaceSource, /requestSubmit/);

console.log("Challenge progression tests passed");
