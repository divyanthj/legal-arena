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
const caseWorkspaceSource = await readFile(
  new URL("../components/legal-arena/CaseWorkspace.js", import.meta.url),
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

assert.match(
  caseWorkspaceSource,
  /const mobileInterviewExchangeHistory = mobileInterviewExchangePairs\.slice\(0, -1\);/
);
assert.doesNotMatch(
  caseWorkspaceSource,
  /mobileInterviewExchangePairs\s*\.\s*slice\(0, -1\)\s*\.\s*reverse\(\)/
);

const firstHistoryRender = caseWorkspaceSource.indexOf(
  "{showMobileExchangeHistory && mobileInterviewExchangeHistory.length > 0 ? ("
);
const firstLatestExchangeRender = caseWorkspaceSource.indexOf(
  "{latestMobileInterviewExchange ? ("
);
assert.ok(
  firstHistoryRender > -1 && firstLatestExchangeRender > -1,
  "Interview exchange history and latest exchange blocks should both render."
);
assert.ok(
  firstHistoryRender < firstLatestExchangeRender,
  "Expanded interview history should render above the latest exchange."
);
assert.match(
  caseWorkspaceSource,
  /const \[interviewHistoryHeight, setInterviewHistoryHeight\] = useState\(\s*INTERVIEW_HISTORY_DEFAULT_HEIGHT\s*\);/
);
assert.match(caseWorkspaceSource, /handleInterviewHistoryResizeStart/);
assert.match(caseWorkspaceSource, /onPointerDown=\{handleInterviewHistoryResizeStart\}/);
assert.match(caseWorkspaceSource, /aria-label="Resize interview history"/);
assert.match(caseWorkspaceSource, /style=\{\{ height: `\$\{interviewHistoryHeight\}px` \}\}/);
assert.match(caseWorkspaceSource, /resizeInterviewHistoryBy\(-24\)/);
assert.match(caseWorkspaceSource, /resizeInterviewHistoryBy\(24\)/);
assert.doesNotMatch(
  caseWorkspaceSource,
  /arena-scroll mt-3 max-h-60/,
  "Interview history should use the resizable height instead of the fixed max-h-60 panel."
);
assert.match(caseWorkspaceSource, /const shouldPromptForEvidenceProduction = /);
assert.match(caseWorkspaceSource, /const getEvidenceFollowUpQuestions = /);
assert.match(caseWorkspaceSource, /const latestEvidenceProductionQuestions =/);
assert.match(caseWorkspaceSource, /Turn evidence into proof/);
assert.match(caseWorkspaceSource, /Ask them to read, quote, or describe the record/);
assert.match(caseWorkspaceSource, /useSuggestedIntakeQuestion\(questionText/);
assert.match(caseWorkspaceSource, /closeFactSheetDialog: true/);
assert.match(caseWorkspaceSource, /Read me the portal message, including the date and exact wording\./);

console.log("Interview language regression tests passed");
