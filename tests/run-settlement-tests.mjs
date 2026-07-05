import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const progressionSource = await readFile(
  new URL("../libs/game/progression.js", import.meta.url),
  "utf8"
);
const settlementQualitySource = await readFile(
  new URL("../libs/game/settlementQuality.js", import.meta.url),
  "utf8"
);
const settlementSource = await readFile(
  new URL("../libs/game/settlement.js", import.meta.url),
  "utf8"
);
const caseWorkspaceSource = await readFile(
  new URL("../components/legal-arena/CaseWorkspace.js", import.meta.url),
  "utf8"
);
const soloSettlementStartRouteSource = await readFile(
  new URL("../app/api/cases/[caseId]/settlement/start/route.js", import.meta.url),
  "utf8"
);
const soloSettlementMessageRouteSource = await readFile(
  new URL("../app/api/cases/[caseId]/settlement/message/route.js", import.meta.url),
  "utf8"
);
const soloSettlementPreviewRouteSource = await readFile(
  new URL("../app/api/cases/[caseId]/settlement/preview/route.js", import.meta.url),
  "utf8"
);
const pvpSettlementPreviewRouteSource = await readFile(
  new URL("../app/api/challenges/[challengeId]/settlement/preview/route.js", import.meta.url),
  "utf8"
);
const challengeSource = await readFile(
  new URL("../libs/game/challenges.js", import.meta.url),
  "utf8"
);
const soloSettlementDashboardRouteSource = await readFile(
  new URL("../app/dashboard/cases/[caseId]/settlement/page.js", import.meta.url),
  "utf8"
);
const pvpSettlementDashboardRouteSource = await readFile(
  new URL("../app/dashboard/challenges/[challengeId]/settlement/page.js", import.meta.url),
  "utf8"
);
const userModelSource = await readFile(
  new URL("../models/User.js", import.meta.url),
  "utf8"
);
const caseSessionModelSource = await readFile(
  new URL("../models/CaseSession.js", import.meta.url),
  "utf8"
);
const challengeModelSource = await readFile(
  new URL("../models/Challenge.js", import.meta.url),
  "utf8"
);
const settlementProgressionBody =
  progressionSource.match(/export const applySettlementToProgression = async \(\{[\s\S]*?\n\};/)?.[0] ||
  "";

assert.match(
  userModelSource,
  /settlements:\s*\{\s*type:\s*Number,\s*default:\s*0,\s*\}/s,
  "User progression schemas should persist settlement counts with a zero default."
);

assert.match(
  progressionSource,
  /export \{ calculateSettlementXp \} from "\.\/settlementQuality"/,
  "Settlement XP helper should be exported for deterministic reward checks."
);
assert.match(
  settlementQualitySource,
  /55 \+ \(Number\(complexity\) \|\| 1\) \* 15/,
  "Settlement base XP should be 55 + complexity * 15."
);
assert.match(
  settlementQualitySource,
  /floorSatisfaction \* 0\.55 \+ averageSatisfaction \* 0\.45/,
  "Settlement quality should reward balanced satisfaction across both parties."
);
assert.match(
  progressionSource,
  /progression\.settlements \+= 1/,
  "Solo settlement progression should increment settlement count."
);
assert.doesNotMatch(
  settlementProgressionBody,
  /progression\.wins \+=|progression\.losses \+=|progression\.draws \+=/,
  "Settlement progression should not increment wins, losses, or draws."
);

assert.match(
  settlementSource,
  /export const clampMood = \(value\) =>\s*Math\.max\(-100, Math\.min\(100,/,
  "Settlement moods should clamp to -100..100."
);
assert.match(
  settlementSource,
  /moods\.player <= -100 \|\| moods\.opponent <= -100/,
  "Negotiations should fail when either party reaches -100 mood."
);
assert.match(
  settlementSource,
  /clientAccepts && opponentAccepts && currentTerms\.length > 0/,
  "Settlement should require both AI parties to accept current terms."
);
assert.match(
  settlementSource,
  /export const calculateSettlementRejectionCooldownMs/,
  "Settlement rejections should use a shared cooldown calculator."
);
assert.match(
  settlementSource,
  /60 \* 1000[\s\S]*2 \*\* Math\.max\(0, \(Number\(rejectionCount\) \|\| 1\) - 1\)/,
  "Settlement rejection cooldown should start at one minute and double each rejection."
);
assert.match(
  settlementSource,
  /cooldownUntil = rejected[\s\S]*calculateSettlementRejectionCooldownMs\(rejectionCount\)/,
  "Rejected settlement attempts should stamp a cooldown deadline."
);
assert.match(
  caseSessionModelSource,
  /rejectionCount:\s*\{\s*type:\s*Number,\s*default:\s*0,?\s*\}[\s\S]*cooldownUntil:\s*\{\s*type:\s*Date,\s*default:\s*null,?\s*\}/,
  "Solo settlement schema should persist rejection cooldown state."
);
assert.match(
  challengeModelSource,
  /rejectionCount:\s*\{\s*type:\s*Number,\s*default:\s*0,?\s*\}[\s\S]*cooldownUntil:\s*\{\s*type:\s*Date,\s*default:\s*null,?\s*\}/,
  "PVP settlement schema should persist rejection cooldown state."
);

assert.match(
  caseWorkspaceSource,
  /renderSettleButton/,
  "Intake UI should render a settle action."
);
assert.match(
  caseWorkspaceSource,
  /renderSettlementPanel/,
  "Workspace should render a settlement mode panel."
);
assert.match(
  caseWorkspaceSource,
  /\) : isSettlement \|\| isSettled \? \(\s*renderSettlementPanel\(\)\s*\) : isExited/s,
  "Settlement mode should replace the courtroom workspace, not render beneath it."
);
assert.match(
  caseWorkspaceSource,
  /Negotiation Room/,
  "Settlement mode should render a focused negotiation room."
);
assert.match(
  caseWorkspaceSource,
  /Your Client[\s\S]*Opponent[\s\S]*Main Blocker[\s\S]*Stage/,
  "Settlement room should summarize negotiation state at the top."
);
assert.doesNotMatch(
  caseWorkspaceSource,
  /Earlier messages are hidden/,
  "Collapsed settlement history should not leave a placeholder panel."
);
assert.match(
  caseWorkspaceSource,
  /Current Offer[\s\S]*Will this settle\?[\s\S]*Recommended next move[\s\S]*Message to opponent[\s\S]*Recent exchanges/,
  "Settlement room should prioritize offer, viability, next move, composer, and recent exchanges."
);
assert.match(
  caseWorkspaceSource,
  /settlementCaseContextLine[\s\S]*View matter summary/,
  "Settlement header should use a compact case context with an optional matter summary."
);
assert.match(
  caseWorkspaceSource,
  /id="settlement" className="settlement-cockpit mx-auto w-full max-w-\[1600px\]/,
  "Settlement mode should align to the wide case header width."
);
assert.match(
  caseWorkspaceSource,
  /md:grid-cols-2 xl:grid-cols-4/,
  "Settlement mode should use compact responsive summary cards instead of side rails."
);
assert.match(
  caseWorkspaceSource,
  /Settlement Amount[\s\S]*Payment Timeline[\s\S]*Corrective Work[\s\S]*Release[\s\S]*Costs[\s\S]*Fault/,
  "Settlement room should show the current offer as compact terms."
);
assert.match(
  caseWorkspaceSource,
  /settlementDraftState[\s\S]*sourceSignature[\s\S]*values[\s\S]*dirty/,
  "Workspace should keep local editable settlement draft state."
);
assert.match(
  caseWorkspaceSource,
  /const editableSettlementTerms = settlementDraftDefaultEntries\.map/,
  "Workspace should derive editable settlement terms from the current offer baseline."
);
assert.match(
  caseWorkspaceSource,
  /settlementClientPreview[\s\S]*settlementPreviewApiPath[\s\S]*\/settlement\/preview[\s\S]*fetch\(`\/api\$\{settlementPreviewApiPath\}`/,
  "Settlement draft edits should request AI private client reaction previews."
);
assert.match(
  caseWorkspaceSource,
  /SETTLEMENT_PREVIEW_DEBOUNCE_MS = 350[\s\S]*setSettlementClientPreviewLoading\(true\)[\s\S]*window\.setTimeout[\s\S]*SETTLEMENT_PREVIEW_DEBOUNCE_MS/,
  "Settlement client preview should show pending feedback immediately while debouncing model calls."
);
assert.match(
  caseWorkspaceSource,
  /const draftClientReaction =\s*settlementClientPreviewLoading\s*\?\s*\{[\s\S]*\$\{playerPartyName\} is considering/,
  "Settlement client huddle should show the client considering as soon as draft terms change."
);
assert.doesNotMatch(
  caseWorkspaceSource,
  /amountClientImpact|timingClientImpact|faultClientImpact|extractSettlementDollarAmount/,
  "Client draft reaction should not use local deterministic scoring."
);
assert.match(
  settlementSource,
  /OPENAI_SETTLEMENT_PREVIEW_MODEL[\s\S]*previewSettlementDraftForClient[\s\S]*settlement\.clientPreview/,
  "Settlement client preview should be generated by a lightweight AI settlement preview model."
);
assert.match(
  settlementSource,
  /Do not tell a money-seeking client they prefer less money[\s\S]*acceptable floor[\s\S]*close-now authority/,
  "Settlement client previews should frame weaker money terms as compromise authority, not client preference."
);
assert.match(
  settlementSource,
  /higher recovery is normally better[\s\S]*clientMoneyPosture/,
  "Settlement client previews should include represented-client monetary posture."
);
assert.match(
  soloSettlementPreviewRouteSource,
  /previewSettlementDraftForClient[\s\S]*appendUsageEntriesToCaseSession[\s\S]*preview: result\.preview/,
  "Solo settlement preview route should return an AI client preview and record usage."
);
assert.match(
  pvpSettlementPreviewRouteSource,
  /previewChallengeSettlementDraft[\s\S]*preview: result\.preview/,
  "PVP settlement preview route should return an AI client preview."
);
assert.match(
  caseWorkspaceSource,
  /Private Client Huddle[\s\S]*Client reaction to draft[\s\S]*Private Draft Terms/,
  "Settlement UI should frame draft editing as a private client huddle."
);
assert.match(
  caseWorkspaceSource,
  /\$\{playerPartyName\} is considering/,
  "Settlement client huddle loading copy should name the client, not the AI system."
);
assert.doesNotMatch(
  caseWorkspaceSource,
  /AI is reviewing|AI preview unavailable|AI reviewed|private AI read|AI is checking/,
  "Settlement client huddle should not show dev-facing AI copy."
);
assert.doesNotMatch(
  settlementSource,
  /AI preview unavailable|AI client preview did not return|The AI evaluated/,
  "Settlement preview fallbacks should stay client-facing."
);
assert.match(
  caseWorkspaceSource,
  /const currentOfferTerms = \[[\s\S]*Settlement Amount[\s\S]*Payment Timeline[\s\S]*Corrective Work[\s\S]*Release Terms[\s\S]*Costs[\s\S]*Fault/,
  "Editable settlement drafts should cover the six expected settlement terms."
);
assert.match(
  caseWorkspaceSource,
  /filledEditableSettlementTerms[\s\S]*const settlementDraftMessage = filledEditableSettlementTerms\.length[\s\S]*Counteroffer:/,
  "Generated settlement messages should serialize only filled optional draft terms."
);
assert.match(
  caseWorkspaceSource,
  /editableSidePanelTermRows\.map[\s\S]*<textarea[\s\S]*updateSettlementDraftTerm[\s\S]*<input[\s\S]*updateSettlementDraftTerm/,
  "Player-side settlement terms should render editable fields."
);
assert.match(
  caseWorkspaceSource,
  /Current Public Terms[\s\S]*sidePanelTermRows\.map[\s\S]*opponent-\$\{term\.label\}[\s\S]*\{term\.value\}/,
  "Current public settlement terms should remain read-only."
);
assert.match(
  caseWorkspaceSource,
  /Latest response from across the table[\s\S]*latestSettlementResponse[\s\S]*getSettlementEntryText\(latestSettlementResponse\)/,
  "Settlement UI should show the latest response before asking for the next move."
);
assert.match(
  caseWorkspaceSource,
  /settlementAcceptMessage[\s\S]*submitSettlementMessage\(\{ messageOverride: settlementAcceptMessage \}\)/,
  "Accept settlement action should send an acceptance message instead of doing nothing."
);
assert.match(
  caseWorkspaceSource,
  /Apply pressure[\s\S]*settlementPressureMessage[\s\S]*Warn client[\s\S]*settlementClientWarningText[\s\S]*Walk away/,
  "Settlement next moves should include pressure, private client warning, and walk-away posture options."
);
assert.match(
  caseWorkspaceSource,
  /Private note to client[\s\S]*settlementClientCounselNote[\s\S]*Walk away now/,
  "Warn-client action should show a private client note before walking away."
);
assert.match(
  caseWorkspaceSource,
  /Do This Next[\s\S]*nextActionTitle[\s\S]*nextActionBody[\s\S]*nextActionChecklist/,
  "Settlement outlook should give a concrete next action instead of only a stage label."
);
assert.match(
  caseWorkspaceSource,
  /clientReactionNeedsFix[\s\S]*Client dislikes this draft[\s\S]*Client concerns must be fixed before presenting/,
  "Settlement blocker copy should become actionable when the client dislikes the draft."
);
assert.match(
  caseWorkspaceSource,
  /Suggested revision[\s\S]*clientSuggestedRevision/,
  "Client huddle should show the suggested revision from the client reaction."
);
assert.match(
  caseWorkspaceSource,
  /Optional deal points\. Leave any section blank/,
  "Settlement draft terms should explain that sections are optional."
);
assert.match(
  caseWorkspaceSource,
  /getSettlementOutgoingMessage\(messageOverride = ""\)[\s\S]*messageOverride[\s\S]*settlementMessage\.trim\(\) \|\| settlementDraftMessage[\s\S]*message: submittedMessage/,
  "Sending a settlement message should support action overrides and fall back to serialized edited draft terms."
);
assert.match(
  caseWorkspaceSource,
  /Supporting info/,
  "Settlement mode should keep supporting info compact at the bottom."
);
assert.match(
  caseWorkspaceSource,
  /settlementTourStorageKey[\s\S]*SettlementTourOverlay[\s\S]*data-settlement-tour-target/,
  "Settlement mode should have its own guided tour overlay and target markers."
);
assert.match(
  caseWorkspaceSource,
  /setShowSettlementTour\(true\)[\s\S]*Take the settlement tour/,
  "Settlement mode should expose a manual tour replay action."
);
assert.match(
  caseWorkspaceSource,
  /Start in the client huddle[\s\S]*Check your client's reaction[\s\S]*Edit the private terms[\s\S]*Check the public proposal[\s\S]*Present the offer[\s\S]*Read the reply[\s\S]*Choose what to do next/,
  "Settlement tour should guide the user through the negotiation loop step by step."
);
assert.match(
  caseWorkspaceSource,
  /settlement-client-reaction[\s\S]*settlement-draft-terms[\s\S]*settlement-public-terms[\s\S]*settlement-message[\s\S]*settlement-latest-response[\s\S]*settlement-next-move/,
  "Settlement tour should target client reaction, draft terms, public terms, message, latest response, and next-move controls."
);
assert.match(
  caseWorkspaceSource,
  /showSettlementTour && isSettlement/,
  "Settlement tour should only run during active settlement negotiation."
);
assert.match(
  caseWorkspaceSource,
  /Client priorities[\s\S]*Opponent priorities[\s\S]*Compare with court[\s\S]*Case facts[\s\S]*Full negotiation history/,
  "Settlement mode should expose compact supporting info actions."
);
assert.match(
  caseWorkspaceSource,
  /btn btn-ghost settlement-interactive h-auto min-h-16/,
  "Settlement supporting info actions should use DaisyUI button styling."
);
assert.match(
  caseWorkspaceSource,
  /isSettlementInfoModalOpen[\s\S]*modal modal-bottom sm:modal-middle[\s\S]*modal-open[\s\S]*className="modal-box[\s\S]*className="card card-compact/,
  "Settlement supporting info should use a persistent DaisyUI modal with DaisyUI cards and animated open state."
);
assert.match(
  caseWorkspaceSource,
  /btn btn-circle btn-ghost btn-sm[\s\S]*modal-backdrop/,
  "Settlement supporting info modal should use DaisyUI close and backdrop affordances."
);
assert.doesNotMatch(
  caseWorkspaceSource.match(/const renderSettlementPanel = \(\) => \{[\s\S]*?const renderLawbookFilters/)?.[0] || "",
  /Case Reference|Open Full Case File|fact-sheet-details/,
  "Settlement mode should not include full fact sheet or case file links."
);
assert.match(
  caseWorkspaceSource,
  /settlementInfoRows[\s\S]*facts: settlementCaseFacts/,
  "Settlement case facts should be available only through supporting info."
);
assert.match(
  caseWorkspaceSource,
  /!isSettlement && !isSettled \? \(\s*<div className="mt-4 grid grid-cols-3/s,
  "Settlement mode should hide brief, fact sheet, and lawbook shortcut links."
);
assert.match(
  caseWorkspaceSource,
  /isSettlement \|\| isSettled \|\| isCourtroom \? null : \(/,
  "Settlement mode should not show fact sheet or lawbook side panels."
);
assert.match(
  caseWorkspaceSource,
  /\) : isSettlement \|\| isSettled \? null : \(\s*<>\s*\{workspaceNotice\}\s*<div id="fact-sheet-details"/,
  "Settlement mode should not render the desktop case file aside."
);
assert.match(
  caseWorkspaceSource,
  /router\.replace\(getSettlementHref\(nextCase\)\)/,
  "Opening settlement should move the browser to the settlement workspace route."
);
assert.match(
  caseWorkspaceSource,
  /settlement\/\$\{initial \? "start" : "message"\}/,
  "Workspace should call the settlement start route."
);
assert.match(
  caseWorkspaceSource,
  /caseSession\.primaryCategory !== "criminal"/,
  "Criminal matters should not show the settlement action."
);
assert.match(
  caseWorkspaceSource,
  /Settle in \$\{settlementCooldownLabel\}/,
  "Settlement action should show a live retry cooldown label."
);
assert.match(
  caseWorkspaceSource,
  /inline-flex min-h-0 w-full items-center justify-center gap-2 px-4 py-3 text-sm[\s\S]*Use terms in message/,
  "Settlement draft terms button should align its icon and label as a single centered action."
);
assert.match(
  caseWorkspaceSource,
  /settlementMessageComposerRef[\s\S]*settlementMessageTextareaRef[\s\S]*scrollIntoView[\s\S]*focus\(\{ preventScroll: true \}\)/,
  "Using settlement draft terms should scroll to and focus the message composer."
);
assert.match(
  caseWorkspaceSource,
  /const useSettlementDraftMessage = \(\) => \{[\s\S]*setSettlementMessageAndFocus\(settlementDraftMessage\)/,
  "The Use in message button should populate the composer through the scroll-and-focus helper."
);
assert.match(
  caseWorkspaceSource,
  /settlementResolvedRef[\s\S]*hasReachedSettlement[\s\S]*settlementTopRef\.current\?\.scrollIntoView/,
  "Reaching settlement should scroll the player back to the top of the settlement page."
);
assert.match(
  caseWorkspaceSource,
  /SettlementPartyPortrait[\s\S]*caseSession\.clientPortrait\?\.image[\s\S]*caseSession\.opponentPortrait\?\.image/,
  "Settlement page should show saved client and opponent portraits in the party panels."
);
assert.match(
  caseWorkspaceSource,
  /requestedOpponentPortraitRef[\s\S]*client-portrait\?target=opponent[\s\S]*updateCaseFromResponseRef\.current\?\.\(response\)/,
  "Settlement page should request a generated opponent portrait when one is missing."
);
assert.match(
  soloSettlementStartRouteSource,
  /caseSession\.primaryCategory === "criminal"/,
  "Solo settlement start route should reject criminal cases."
);
assert.match(
  soloSettlementStartRouteSource,
  /getSettlementCooldownState\(caseSession\.settlement \|\| \{\}\)/,
  "Solo settlement start route should enforce rejection cooldowns."
);
assert.match(
  soloSettlementMessageRouteSource,
  /caseSession\.primaryCategory === "criminal"/,
  "Solo settlement message route should reject criminal cases."
);
assert.match(
  challengeSource,
  /challenge\.primaryCategory === "criminal"/,
  "PVP settlement flows should reject criminal cases."
);
assert.match(
  challengeSource,
  /getSettlementCooldownState\(challenge\.settlement \|\| \{\}\)/,
  "PVP settlement flows should enforce rejection cooldowns."
);
assert.match(
  soloSettlementDashboardRouteSource,
  /export \{ default, dynamic \} from "\.\.\/page";/,
  "Solo cases should expose a dashboard settlement route."
);
assert.match(
  pvpSettlementDashboardRouteSource,
  /export \{ default, dynamic \} from "\.\.\/page";/,
  "PVP challenges should expose a dashboard settlement route."
);

console.log("Settlement tests passed");
