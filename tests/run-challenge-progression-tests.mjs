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
const engineSource = await readFile(
  new URL("../libs/game/engine.js", import.meta.url),
  "utf8"
);
const challengeTimeoutRouteSource = await readFile(
  new URL("../app/api/internal/challenges/courtroom-timeouts/run/route.js", import.meta.url),
  "utf8"
);
const vercelConfigSource = await readFile(
  new URL("../vercel.json", import.meta.url),
  "utf8"
);
const emailSenderSource = await readFile(
  new URL("../libs/emailSender.js", import.meta.url),
  "utf8"
);
const challengeWorkspaceSource = await readFile(
  new URL("../components/legal-arena/ChallengeWorkspace.js", import.meta.url),
  "utf8"
);
const dashboardHubSource = await readFile(
  new URL("../components/legal-arena/DashboardHub.js", import.meta.url),
  "utf8"
);
const challengeButtonSource = await readFile(
  new URL("../components/legal-arena/ChallengeButton.js", import.meta.url),
  "utf8"
);
const caseWorkspaceSource = await readFile(
  new URL("../components/legal-arena/CaseWorkspace.js", import.meta.url),
  "utf8"
);
const gameStoreSource = await readFile(
  new URL("../libs/game/store.js", import.meta.url),
  "utf8"
);
const soloExitRouteSource = await readFile(
  new URL("../app/api/cases/[caseId]/exit/route.js", import.meta.url),
  "utf8"
);

assert.match(userModelSource, /const pvpProgressSchema = mongoose\.Schema/);
assert.match(userModelSource, /completedChallenges/);
assert.match(userModelSource, /pvp:\s*{\s*type:\s*pvpProgressSchema/);

assert.match(progressionSource, /export const normalizePvpProgression/);
assert.match(progressionSource, /applyChallengeVerdictToPvpProgression/);
assert.match(progressionSource, /pvp:\s*normalizePvpProgression\(source\.pvp\)/);
assert.match(progressionSource, /pvp,\s*\n\s*}/);
assert.match(progressionSource, /const pvp = normalizePvpProgression\(progression\.pvp\)/);
assert.match(progressionSource, /combinedWins = \(progression\.wins \|\| 0\) \+ \(pvp\.wins \|\| 0\)/);
assert.match(progressionSource, /combinedLosses = \(progression\.losses \|\| 0\) \+ \(pvp\.losses \|\| 0\)/);
assert.match(progressionSource, /combinedDraws = \(progression\.draws \|\| 0\) \+ \(pvp\.draws \|\| 0\)/);
assert.match(progressionSource, /pvpCategoryStat\?\.wins \|\| 0/);
assert.match(progressionSource, /right\.completedCases/);
assert.match(dashboardHubSource, /\{entry\.completedCases\} matches \| \{entry\.wins\} wins/);
assert.match(dashboardHubSource, /const pvpDocketTabs = \[/);
assert.match(dashboardHubSource, /value: "needs-response"/);
assert.match(dashboardHubSource, /value: "active-intake"/);
assert.match(dashboardHubSource, /value: "settlement"/);
assert.match(dashboardHubSource, /const getPvpDocketTab = /);
assert.match(dashboardHubSource, /const getPvpDisplayStatus = /);
assert.match(dashboardHubSource, /\["proposed", "active"\]\.includes\(challenge\.settlement\?\.status\)/);
assert.match(dashboardHubSource, /const getPvpActionLabel = /);
assert.match(dashboardHubSource, /My PVP Docket/);
assert.match(dashboardHubSource, /Open PVP Docket/);
assert.match(dashboardHubSource, /PVP docket is still loading/);
assert.match(dashboardHubSource, /challengesLoadTimedOut/);
assert.doesNotMatch(dashboardHubSource, /No PVP docket yet/);
assert.match(challengeButtonSource, /Generating case\.\.\./);
assert.match(challengeModelSource, /quitByUserId/);
assert.match(challengeModelSource, /stayBonus/);
assert.match(challengeModelSource, /courtroomLastActivityAt/);
assert.match(challengeModelSource, /courtroomDeadlineAt/);
assert.match(challengeModelSource, /courtroomTimeoutStartedAt/);
assert.match(challengeModelSource, /courtroomTimedOutAt/);
assert.match(challengeModelSource, /courtroomTimeoutFinalizingAt/);
assert.match(challengeModelSource, /highlights:\s*\{ type: \[String\], default: \[\] \}/);
assert.match(challengeStoreSource, /export const quitChallengeForUser/);
assert.match(challengeStoreSource, /const COURTROOM_RESPONSE_TIMEOUT_MS = 24 \* 60 \* 60 \* 1000/);
assert.match(challengeStoreSource, /const resetChallengeCourtroomTimer = /);
assert.match(challengeStoreSource, /const ensureChallengeCourtroomTimer = /);
assert.match(challengeStoreSource, /changed = ensureChallengeCourtroomTimer\(challenge\) \|\| changed/);
assert.match(
  challengeStoreSource,
  /const quittingFromPrivateIntake = quittingParticipant\.status !== "ready"/,
  "PVP quit should detect private intake from the player's participant status."
);
assert.match(
  challengeStoreSource,
  /if \(challenge\.status === "verdict"\) \{[\s\S]*return buildChallengePayload\(\{ challenge, viewerUserId: userId \}\)/,
  "PVP quit should be idempotent when a forfeit verdict has already been declared."
);
assert.match(
  challengeStoreSource,
  /!\["active", "settlement", "courtroom"\]\.includes\(challenge\.status\)[\s\S]*\(!quittingFromPrivateIntake && !quittingFromCourtroom\)/,
  "PVP quit should allow private-intake quits even when the global challenge stage is ahead."
);
assert.match(
  challengeStoreSource,
  /const intakeForfeit = quittingFromPrivateIntake/,
  "PVP quit should make any private-intake quit an immediate forfeit."
);
assert.match(
  challengeStoreSource,
  /intakeForfeit[\s\S]*Math\.max\(12, challenge\.complexity \* 6,[\s\S]*quittingParticipant\.score[\s\S]*baseStayingScore \+ 1\)/,
  "Intake-stage PVP quit should force the staying player ahead on score."
);
assert.match(
  challengeStoreSource,
  /const winnerParticipant = stayingParticipant[\s\S]*stayingParticipant\.verdict = "win"[\s\S]*quittingParticipant\.verdict = "loss"/,
  "PVP quit should award the verdict directly to the player who stayed."
);
assert.match(
  challengeStoreSource,
  /wins immediately by forfeit because the other player quit during intake/,
  "Intake-stage PVP quit verdict should explain that the other player quit during intake."
);
assert.match(
  challengeStoreSource,
  /wins immediately by forfeit because the other player quit during court/,
  "Court-stage PVP quit verdict should explain immediate court forfeit."
);
assert.match(
  challengeStoreSource,
  /resetChallengeCourtroomTimer\(challenge\)/,
  "PVP courtroom submissions should reset the response deadline."
);
assert.match(
  challengeStoreSource,
  /if \(allReady \|\| plaintiffReady\) \{[\s\S]*challenge\.status = "courtroom"[\s\S]*resetChallengeCourtroomTimer\(challenge\)[\s\S]*appendOpenRoundIfNeeded\(challenge\)/,
  "PVP court entry should initialize the response deadline immediately."
);
assert.match(
  challengeStoreSource,
  /The response window expired\. The court is preparing a timeout verdict\./,
  "PVP courtroom submissions should be blocked after the stored response deadline expires."
);
assert.match(challengeStoreSource, /export const runChallengeCourtroomTimeouts/);
assert.match(challengeStoreSource, /runPvpCourtroomTimeoutVerdict/);
assert.match(challengeStoreSource, /No courtroom arguments were filed before the response deadline/);
assert.match(challengeStoreSource, /courtroomTimeoutFinalizingAt: now/);
assert.match(challengeStoreSource, /courtroomTimedOutAt = timedOutAt/);
assert.match(challengeTimeoutRouteSource, /CRON_SECRET/);
assert.match(challengeTimeoutRouteSource, /acquireInternalJobLock/);
assert.match(challengeTimeoutRouteSource, /runChallengeCourtroomTimeouts/);
assert.match(challengeTimeoutRouteSource, /export async function GET/);
assert.match(challengeTimeoutRouteSource, /export async function POST/);
assert.match(vercelConfigSource, /\/api\/internal\/challenges\/courtroom-timeouts\/run/);
assert.match(vercelConfigSource, /"schedule": "0 \*\/3 \* \* \*"/);
assert.match(engineSource, /export const runPvpCourtroomTimeoutVerdict/);
assert.match(engineSource, /usageLabel: "courtroom\.pvpTimeoutVerdict"/);
assert.match(engineSource, /winner: "initiator\|challenged\|draw"/);
assert.match(challengeStoreSource, /sendChallengeAcceptedEmail/);
assert.match(challengeStoreSource, /challenge accepted email failed/);
assert.match(challengeStoreSource, /User\.findById\(challenge\.initiatorId\)\.select\("name email"\)/);
assert.match(challengeStoreSource, /acceptedByUser/);
assert.match(emailSenderSource, /export async function sendChallengeAcceptedEmail/);
assert.match(emailSenderSource, /Challenge accepted/);
assert.match(emailSenderSource, /accepted your Legal Arena PVP challenge/);
assert.match(emailSenderSource, /callbackUrl: challengePath/);
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
assert.match(
  challengeStoreSource,
  /const buildTranscriptBackfillPatch = \(\) => normalizeFactSheetPatch\(\{\}\)/
);
assert.doesNotMatch(challengeStoreSource, /buildConversationFactSheetFallback/);
assert.doesNotMatch(challengeStoreSource, /const exchangePatch =/);
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
assert.match(challengeWorkspaceSource, /const replaceOwnSideSubject = /);
assert.match(challengeWorkspaceSource, /const normalizeFeedbackForViewer = /);
assert.match(challengeWorkspaceSource, /ownSideLabel = viewer\.side === "opponent" \? "Defendant" : "Plaintiff"/);
assert.match(challengeWorkspaceSource, /viewer\.partyName \? `Counsel for \$\{viewer\.partyName\}` : ""/);
assert.match(challengeWorkspaceSource, /const viewerJudgedSubmissions = judgedRounds/);
assert.match(challengeWorkspaceSource, /const opponentJudgedSubmissions = judgedRounds/);
assert.match(challengeWorkspaceSource, /const viewerStrengths = normalizeFeedbackForViewer/);
assert.match(challengeWorkspaceSource, /const viewerWeaknesses = normalizeFeedbackForViewer/);
assert.match(challengeWorkspaceSource, /const opponentStrengths = uniqueTextList/);
assert.match(challengeWorkspaceSource, /const opponentWeaknesses = uniqueTextList/);
assert.match(challengeWorkspaceSource, /highlights:\s*viewerStrengths/);
assert.match(challengeWorkspaceSource, /weaknesses:\s*viewerWeaknesses/);
assert.match(challengeWorkspaceSource, /viewer\.verdict === "loss" && opponentWeaknesses\.length/);
assert.match(challengeWorkspaceSource, /viewer\.verdict === "win" && opponentStrengths\.length/);
assert.match(
  challengeWorkspaceSource,
  /displayStatus === "courtroom" && viewerReady/
);
assert.match(
  challengeWorkspaceSource,
  /\["active", "courtroom"\]\.includes\(displayStatus\)\s*\?\s*"interview"/
);
assert.match(challengeWorkspaceSource, /const getChallengeDisplayStatus = /);
assert.doesNotMatch(challengeWorkspaceSource, /\["proposed", "active"\]\.includes\(challenge\.settlement\?\.status\)/);
assert.match(challengeWorkspaceSource, /realtimeRefresh:\s*true/);
assert.match(challengeWorkspaceSource, /realtimeRefreshPath:\s*`\/challenges\/\$\{challengeRef\}`/);
assert.match(challengeWorkspaceSource, /realtimeVersionPath:\s*`\/challenges\/\$\{challengeRef\}\/version`/);
assert.match(challengeWorkspaceSource, /realtimeVersionIntervalMs:\s*1200/);
assert.match(challengeWorkspaceSource, /courtroomSubmitOnly:\s*true/);
assert.match(challengeWorkspaceSource, /courtroomDeadlineAt: challenge\.courtroomDeadlineAt/);
assert.match(challengeWorkspaceSource, /Quit this PVP challenge\? You will lose immediately\./);
assert.match(challengeWorkspaceSource, /requirePlaintiffOpening:\s*true/);
assert.match(challengeWorkspaceSource, /turnBasedCourtroom:\s*true/);
assert.match(challengeWorkspaceSource, /counselLabels:\s*true/);
assert.match(challengeWorkspaceSource, /playerCounselName:\s*viewer\.name/);
assert.match(challengeWorkspaceSource, /opponentCounselName:\s*opponent\.name/);
assert.match(caseWorkspaceSource, /apiClient\.get\(realtimeRefreshPath\)/);
assert.match(gameStoreSource, /if \(caseSession\.status === "interview"\)[\s\S]*caseSession\.status = "exited"/);
assert.match(gameStoreSource, /if \(caseSession\.status === "courtroom"\)[\s\S]*caseSession\.status = "verdict"/);
assert.match(gameStoreSource, /winner: "opponent"/);
assert.match(gameStoreSource, /You quit during court, so the court enters judgment for the other side\./);
assert.match(gameStoreSource, /applyVerdictToProgression\(\{[\s\S]*verdictWinner: "opponent"/);
assert.match(gameStoreSource, /This case already has a final verdict\./);
assert.match(soloExitRouteSource, /caseSession: buildCasePayload\(caseSession\)/);
assert.match(caseWorkspaceSource, /window\.setInterval\(refreshCase, realtimeRefreshIntervalMs\)/);
assert.match(caseWorkspaceSource, /apiClient\.get\(realtimeVersionPath\)/);
assert.match(caseWorkspaceSource, /buildRealtimeVersionKey/);
assert.match(caseWorkspaceSource, /nextVersionKey !== realtimeVersionKeyRef\.current[\s\S]*apiClient\.get\(realtimeRefreshPath\)/);
assert.match(caseWorkspaceSource, /Opponent Argument/);
assert.match(caseWorkspaceSource, /const waitingForPlaintiffOpening = Boolean/);
assert.match(caseWorkspaceSource, /const waitingForOpponentResponse = Boolean/);
assert.match(caseWorkspaceSource, /const courtroomDeadlineLabel = courtroomTimeoutPending/);
assert.match(caseWorkspaceSource, /Response due in/);
assert.match(caseWorkspaceSource, /Court is preparing a timeout verdict/);
assert.match(caseWorkspaceSource, /courtroomTimeoutPending \|\| !argument\.trim\(\)/);
assert.match(caseWorkspaceSource, /\{isInterview \|\| isCourtroom \? \(/);
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
assert.match(caseWorkspaceSource, /PresentingArgumentIndicator/);
assert.match(
  caseWorkspaceSource,
  /form\.dispatchEvent\(new Event\("submit", \{ bubbles: true, cancelable: true \}\)\)/
);
assert.doesNotMatch(caseWorkspaceSource, /requestSubmit/);

console.log("Challenge progression tests passed");
