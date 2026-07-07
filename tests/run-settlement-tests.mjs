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
const challengeWorkspaceSource = await readFile(
  new URL("../components/legal-arena/ChallengeWorkspace.js", import.meta.url),
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
const pvpChallengePortraitRouteSource = await readFile(
  new URL("../app/api/challenges/[challengeId]/client-portrait/route.js", import.meta.url),
  "utf8"
);
const challengeSource = await readFile(
  new URL("../libs/game/challenges.js", import.meta.url),
  "utf8"
);
const storeSource = await readFile(
  new URL("../libs/game/store.js", import.meta.url),
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
  /representedClient[\s\S]*opposingClient[\s\S]*playerMoodDelta changes the representedClient mood/,
  "Settlement prompts should distinguish represented and opposing AI clients."
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
  challengeModelSource,
  /endedNegotiations:\s*\{\s*type:\s*Boolean,\s*default:\s*false[\s\S]*endedByUserId:[\s\S]*endedBySide:[\s\S]*endedAt:\s*\{\s*type:\s*Date,\s*default:\s*null/,
  "PVP settlement schema should persist who ended active negotiations."
);
assert.match(
  challengeModelSource,
  /intentPending:[\s\S]*intentStatus:[\s\S]*intentSenderUserId:[\s\S]*intentReceiverUserId:[\s\S]*intentMessage:[\s\S]*intentSentAt:[\s\S]*proposedByUserId:[\s\S]*proposedBySide:[\s\S]*proposalMessage:[\s\S]*proposedAt:/,
  "PVP settlement schema should persist explicit pending settlement intent flags."
);
assert.match(
  challengeModelSource,
  /latestNegotiationMessageUserId:[\s\S]*latestNegotiationMessageSide:[\s\S]*awaitingNegotiationResponseUserId:[\s\S]*negotiationTurnUserId:[\s\S]*negotiationTurnSide:[\s\S]*latestNegotiationMessageAt:/,
  "PVP settlement schema should persist negotiation turn ownership fields."
);
assert.match(
  caseSessionModelSource,
  /intentPending:[\s\S]*intentStatus:[\s\S]*intentSenderUserId:[\s\S]*intentReceiverUserId:[\s\S]*intentMessage:[\s\S]*intentSentAt:/,
  "Case session settlement schema should expose the same settlement intent flag shape."
);
assert.match(
  caseSessionModelSource,
  /latestNegotiationMessageUserId:[\s\S]*latestNegotiationMessageSide:[\s\S]*awaitingNegotiationResponseUserId:[\s\S]*negotiationTurnUserId:[\s\S]*negotiationTurnSide:[\s\S]*latestNegotiationMessageAt:/,
  "Case session settlement schema should expose the same negotiation turn field shape."
);
assert.match(
  caseSessionModelSource,
  /terms:\s*\{[\s\S]*label:\s*\{\s*type:\s*String[\s\S]*value:\s*\{\s*type:\s*String/,
  "Solo settlement transcript entries should persist structured proposal terms."
);
assert.match(
  challengeModelSource,
  /terms:\s*\{[\s\S]*label:\s*\{\s*type:\s*String[\s\S]*value:\s*\{\s*type:\s*String/,
  "PVP settlement transcript entries should persist structured proposal terms."
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
  /Your Client Mood[\s\S]*Opposing Client Mood[\s\S]*Main Blocker[\s\S]*Stage/,
  "Settlement room should summarize negotiation state at the top."
);
assert.doesNotMatch(
  caseWorkspaceSource,
  /Earlier messages are hidden/,
  "Collapsed settlement history should not leave a placeholder panel."
);
assert.match(
  caseWorkspaceSource,
  /getSettlementMoodEmoji[\s\S]*😊[\s\S]*🙂[\s\S]*😐[\s\S]*😟[\s\S]*😡/,
  "Settlement moods should be represented with emoji states."
);
assert.doesNotMatch(
  caseWorkspaceSource,
  /settlementChance|Deal viability|Outlook|Will this settle\?/,
  "Settlement mode should not collapse client moods into a success-chance style metric."
);
assert.match(
  caseWorkspaceSource,
  /Private Client Huddle[\s\S]*SettlementMoodMeter[\s\S]*Other Side&apos;s Last Offer[\s\S]*SettlementMoodMeter/,
  "Settlement room should place moods beside each party."
);
assert.match(
  caseWorkspaceSource,
  /settlementHumanTranscript[\s\S]*analyticsMode === "pvp"[\s\S]*filter\(\(entry\) => entry\?\.role === "player"[\s\S]*latestOpponentOfferEntry[\s\S]*settlementHumanTranscript[\s\S]*recentSettlementEntries = settlementHumanTranscript/,
  "PVP settlement UI should ignore stale simulated opponent/client transcript rows when deciding latest responses."
);
assert.match(
  caseWorkspaceSource,
  /const settlementComposeModal =[\s\S]*createPortal\([\s\S]*modal modal-middle modal-open[\s\S]*Message to opposing counsel[\s\S]*document\.body/,
  "Settlement room should portal the opposing-counsel composer into a centered body-level modal."
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
  settlementSource,
  /extractSettlementTermsFromMessage[\s\S]*runSettlementExchange = async \(\{[\s\S]*playerProposalTerms = extractSettlementTermsFromMessage\(message\)[\s\S]*role: "player"[\s\S]*terms: playerProposalTerms[\s\S]*role: "opponent"[\s\S]*terms: normalizeSettlementTermsAsRows\(result\.currentTerms\)/,
  "Solo settlement exchanges should derive player proposal terms from the freeform message text."
);
assert.match(
  settlementSource,
  /clientInstruction = ""[\s\S]*draftTerms[\s\S]*privateLawyerMessageToClient/,
  "Settlement client previews should accept private lawyer instructions and return draft term updates."
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
  /preview\.draftTerms[\s\S]*setSettlementDraftState[\s\S]*Object\.fromEntries/,
  "Settlement huddle should apply returned draft terms."
);
assert.match(
  caseWorkspaceSource,
  /Talk to your client[\s\S]*handleSettlementClientInstructionVoiceInput[\s\S]*Update draft with client/,
  "Settlement huddle should let the lawyer privately instruct the client by text or voice and apply returned draft terms."
);
assert.match(
  caseWorkspaceSource,
  /Message opposing counsel[\s\S]*Review and send the proposal from the message modal/,
  "Settlement center column should open the opposing-counsel message modal without pretending the message was already sent."
);
assert.match(
  caseWorkspaceSource,
  /disabled=\{settlementActionsLocked\}[\s\S]*Waiting for response[\s\S]*Your message is with the other player\. Wait for their formal response before messaging opposing counsel again/,
  "Settlement center message button should clearly lock opposing-counsel messaging while waiting for the other player."
);
assert.match(
  caseWorkspaceSource,
  /setSettlementMessageAndFocus\(\(current\) => current\.trim\(\) \|\| settlementDraftMessage\)[\s\S]*Message opposing counsel/,
  "Opening the opposing-counsel composer should prefill it with the terms discussed with the client."
);
assert.match(
  caseWorkspaceSource,
  /aria-label="Message opposing counsel"[\s\S]*<textarea[\s\S]*disabled=\{settlementActionsLocked\}[\s\S]*Use terms in message[\s\S]*submitSettlementMessage\(\{[\s\S]*messageOverride: settlementMessage\.trim\(\) \|\| settlementDraftMessage[\s\S]*disabled=\{settlementActionsLocked \|\| !getSettlementOutgoingMessage\(\)\.trim\(\)\}/,
  "The opposing-counsel composer should be locked while waiting for the other player's response."
);
assert.match(
  caseWorkspaceSource,
  /Use in message[\s\S]*disabled=\{settlementActionsLocked\}/,
  "Private draft shortcuts should not bypass the PVP opposing-counsel turn lock."
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
  /Last exchanged proposal[\s\S]*latestOpponentOfferText[\s\S]*Breakdown[\s\S]*sidePanelTermRows\.map[\s\S]*opponent-\$\{term\.label\}[\s\S]*\{term\.value\}/,
  "Opponent settlement panel should show the freeform proposal first and a player-facing breakdown below."
);
assert.match(
  caseWorkspaceSource,
  /formatSettlementOfferText[\s\S]*split\(\s*\/\\s\*;\\s\*\/\s*\)[\s\S]*normalizeSettlementTermLabel[\s\S]*`\$\{label\.charAt\(0\)\.toUpperCase\(\)\}\$\{label\.slice\(1\)\} is \$\{value\}`/,
  "PVP semicolon-separated proposal shorthand should display as a coherent paragraph."
);
assert.match(
  caseWorkspaceSource,
  /professionalizeSettlementProposalText[\s\S]*The other side rejects the proposal\.[\s\S]*formatSettlementOfferText[\s\S]*professionalizeSettlementProposalText\(text\)/,
  "Opponent-facing settlement proposal text should be cleaned into professional prose without changing the raw message."
);
assert.match(
  caseWorkspaceSource,
  /sidePanelTermRows\.length \? sidePanelTermRows\.map[\s\S]*No separate terms were stated\. Read the proposal text above as the source of truth/,
  "Settlement breakdown should only show terms parsed from the message and otherwise defer to the proposal text."
);
assert.match(
  caseWorkspaceSource,
  /compactSettlementBreakdownValue[\s\S]*Settlement Amount[\s\S]*amount\[0\][\s\S]*Payment Timeline[\s\S]*duration\[1\][\s\S]*Corrective Work[\s\S]*return "None"/,
  "Settlement breakdown rows should compact long proposal sentences into key datapoints."
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
  /shouldOptimisticallyWaitForPvpResponse[\s\S]*analyticsMode === "pvp"[\s\S]*awaitingNegotiationResponse: true[\s\S]*latestNegotiationMessageByViewer: true[\s\S]*updateCaseFromResponse\(responseForState\)/,
  "PVP settlement sends should immediately put the sender into the waiting-for-opponent state."
);
assert.match(
  caseWorkspaceSource,
  /serverSettlementStatus === "active"[\s\S]*optimisticNegotiationTurnFields[\s\S]*awaitingNegotiationResponseUserId: caseSession\.playerUserId[\s\S]*negotiationTurnUserId: caseSession\.opponentUserId/,
  "PVP settlement sends should lock the sender even when the outer challenge status is still active."
);
assert.match(
  caseWorkspaceSource,
  /playerUserId[\s\S]*awaitingNegotiationResponseUserId[\s\S]*idsMatch\(awaitingNegotiationResponseUserId, viewerUserId\)[\s\S]*idsMatch\(negotiationTurnUserId, viewerUserId\)/,
  "Settlement action state should be derived from explicit negotiation turn ownership."
);
assert.match(
  caseWorkspaceSource,
  /settlementActionsLocked =[\s\S]*awaitingNegotiationResponse[\s\S]*analyticsMode === "pvp"[\s\S]*Boolean\(negotiationTurnUserId\)[\s\S]*!receivedNegotiationMessage/,
  "PVP settlement buttons should stay locked whenever the explicit turn owner is another player."
);
assert.match(
  caseWorkspaceSource,
  /type="button"[\s\S]*submitSettlementMessage\(\{[\s\S]*messageOverride: settlementMessage\.trim\(\) \|\| settlementDraftMessage[\s\S]*Send Counteroffer/,
  "Settlement message modal should own the actual send action and post the textarea or draft message."
);
assert.match(
  caseWorkspaceSource,
  /settlement_message_blocked[\s\S]*settlement_message_submit_started[\s\S]*settlement_message_submit_succeeded[\s\S]*settlement_message_submit_failed/,
  "Settlement sends should track blocked, started, succeeded, and failed states for debugging PVP turn issues."
);
assert.match(
  caseWorkspaceSource,
  /shouldOptimisticallyWaitForPvpResponse[\s\S]*Settlement message sent\. Waiting for opposing counsel\./,
  "PVP settlement sends should show waiting copy instead of saying talks are merely open."
);
assert.match(
  challengeWorkspaceSource,
  /playerUserId: viewer\.userId[\s\S]*opponentUserId: opponent\.userId/,
  "Challenge workspaces should preserve player ids so settlement turn locks can update from the database state."
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
  /Client priorities[\s\S]*Opposing client priorities[\s\S]*Compare with court[\s\S]*Case facts[\s\S]*Full negotiation history/,
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
  /arena-btn-dark inline-flex min-h-0 items-center justify-center gap-2 px-4 py-3 text-sm[\s\S]*Use terms in message/,
  "Settlement draft terms button should align its icon and label as a single centered action."
);
assert.match(
  caseWorkspaceSource,
  /const focusSettlementMessageComposer = useCallback\(\(\) => \{[\s\S]*setShowSettlementComposeModal\(true\)[\s\S]*settlementMessageTextareaRef\.current\?\.focus\(\{ preventScroll: true \}\)/,
  "Using settlement draft terms should open and focus the message composer modal."
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
  soloSettlementStartRouteSource,
  /runSettlementExchange\(\{[\s\S]*terms: body\?\.terms \|\| \{\}/,
  "Solo settlement start should pass drafted proposal terms into the settlement exchange."
);
assert.match(
  soloSettlementPreviewRouteSource,
  /clientInstruction: body\?\.clientInstruction \|\| ""/,
  "Solo settlement preview should pass private client instructions."
);
assert.match(
  soloSettlementMessageRouteSource,
  /caseSession\.primaryCategory === "criminal"/,
  "Solo settlement message route should reject criminal cases."
);
assert.match(
  soloSettlementMessageRouteSource,
  /runSettlementExchange\(\{[\s\S]*terms: body\?\.terms \|\| \{\}/,
  "Solo settlement messages should pass drafted proposal terms into the settlement exchange."
);
assert.match(
  storeSource,
  /latestOpponentTerms[\s\S]*role === "opponent"[\s\S]*coerceSettlementTermRows\(settlement\.currentTerms \|\| \[\]\)[\s\S]*latestViewerTerms/,
  "Solo case payloads should expose the latest terms proposed by the opposing side."
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
  challengeSource,
  /const isParticipantInPrivateChallengeIntake =[\s\S]*\["active", "courtroom"\]\.includes\(challenge\?\.status\)[\s\S]*participant\?\.status === "active"/,
  "PVP settlement drafting should allow a player who is still in private intake after the court phase opens."
);
assert.match(
  challengeSource,
  /if \(!isParticipantInPrivateChallengeIntake\(\{ challenge, participant \}\)\)[\s\S]*Settlement drafts can only be prepared during private intake/,
  "PVP settlement draft gating should use the viewer's private intake status."
);
assert.match(
  challengeSource,
  /status: "proposed"[\s\S]*intentPending: true[\s\S]*intentStatus: "pending"[\s\S]*intentSenderUserId: participant\.userId[\s\S]*intentReceiverUserId: otherParticipant\.userId[\s\S]*proposedByUserId: participant\.userId[\s\S]*proposalMessage: message[\s\S]*return buildChallengePayload/,
  "PVP settlement start should first create a database-backed pending intent instead of immediately opening talks."
);
assert.match(
  challengeSource,
  /isRespondingToOtherProposal[\s\S]*status: "active"[\s\S]*intentPending: false[\s\S]*intentStatus: "accepted"/,
  "PVP settlement should open when the other lawyer formally accepts the pending intent."
);
assert.match(
  challengeSource,
  /openingNegotiationTurnFields[\s\S]*latestNegotiationMessageUserId: participant\.userId[\s\S]*negotiationTurnUserId: otherParticipant\.userId[\s\S]*\.\.\.openingNegotiationTurnFields/,
  "PVP settlement intent acceptance should assign the next negotiation turn to the other player."
);
assert.match(
  challengeSource,
  /negotiationTurnUserId[\s\S]*!isSameId\(negotiationTurnUserId, userId\)[\s\S]*Waiting for the other player to respond[\s\S]*latestPlayerMessage[\s\S]*!negotiationTurnUserId[\s\S]*isSameId\(latestPlayerMessage\.userId, userId\)/,
  "PVP settlement messages should be turn-based and prevent consecutive sends by the same player."
);
assert.match(
  challengeSource,
  /playerMessageEntry[\s\S]*text: message[\s\S]*"settlement\.negotiationTurnUserId": negotiationTurnFields\.negotiationTurnUserId[\s\S]*Challenge\.collection\.findOneAndUpdate[\s\S]*\$push:[\s\S]*"settlement\.transcript": playerMessageEntry/,
  "PVP settlement sends should atomically append the raw message and persist explicit negotiation turn ownership."
);
assert.match(
  challengeSource,
  /insultPatterns[\s\S]*insultCount >= 2\) return -70[\s\S]*insultCount === 1\) return -45/,
  "PVP settlement insults should sharply reduce the receiving client's mood."
);
assert.match(
  challengeSource,
  /\$unset:[\s\S]*"settlement\.currentTerms": ""/,
  "PVP settlement sends should not store parsed helper terms as canonical database state."
);
assert.match(
  challengeSource,
  /getTermsFromSettlementMessage[\s\S]*extractSettlementTermsFromMessage\(entry\?\.text \|\| ""\)[\s\S]*currentTerms: derivedCurrentTerms/,
  "Settlement payloads should derive helper terms from the raw message text."
);
assert.doesNotMatch(
  challengeSource.match(/export const continueChallengeSettlement[\s\S]*?export const previewChallengeSettlementDraft/)?.[0] || "",
  /runSettlementExchange/,
  "PVP settlement replies should not generate an immediate simulated counter-reply."
);
assert.match(
  challengeSource,
  /awaitingNegotiationResponseUserId[\s\S]*negotiationTurnUserId[\s\S]*awaitingNegotiationResponse[\s\S]*receivedNegotiationMessage[\s\S]*latestNegotiationMessageByViewer/,
  "PVP challenge payload should expose viewer-specific settlement turn state from persisted turn fields."
);
assert.match(
  challengeSource,
  /latestOpponentSettlementTerms[\s\S]*latestViewerSettlementTerms[\s\S]*latestOpponentTerms[\s\S]*latestViewerTerms/,
  "PVP challenge payload should expose viewer-relative latest proposed settlement terms."
);
assert.match(
  challengeSource,
  /getChallengeRealtimeVersionForUser[\s\S]*latestNegotiationMessageAt[\s\S]*negotiationTurnUserId/,
  "PVP challenges should expose a cheap realtime version signal for settlement refreshes."
);
assert.match(
  caseWorkspaceSource,
  /realtimeVersionPath[\s\S]*realtimeVersionIntervalMs[\s\S]*apiClient\.get\(realtimeVersionPath\)[\s\S]*apiClient\.get\(realtimeRefreshPath\)/,
  "PVP settlement clients should refresh full challenge data when the database version changes."
);
assert.match(
  caseWorkspaceSource,
  /analyticsMode === "pvp"[\s\S]*onClick=\{handleSettlementExit\}[\s\S]*disabled=\{working \|\| pendingAction === "settlement-exit"\}[\s\S]*End negotiations/,
  "PVP settlement should expose an end-negotiations action that is not gated by mood or turn ownership."
);
assert.match(
  challengeSource,
  /wasActiveSettlement[\s\S]*endedNegotiations = true[\s\S]*endedByUserId = participant\.userId[\s\S]*endedAt = endedAt/,
  "PVP settlement exit should record who walked away from active negotiations."
);
assert.match(
  challengeSource,
  /endedByUserId[\s\S]*endedByViewer[\s\S]*endedByOther[\s\S]*endedAt/,
  "PVP settlement payload should expose viewer-relative walkout flags."
);
assert.match(
  caseWorkspaceSource,
  /settlementEndedByOther[\s\S]*renderSettlementWalkoutNoticePanel[\s\S]*Opposing counsel walked away from settlement negotiations[\s\S]*renderSettlementWalkoutNoticePanel\(\)/,
  "PVP intake should show a small note when the other side ended settlement talks."
);
assert.match(
  challengeSource,
  /getPvpSettlementSenderMoodDelta[\s\S]*clientPreviewTone[\s\S]*clientPreviewScore/,
  "PVP settlement sends should let bad private client previews reduce sender client mood."
);
assert.match(
  challengeSource,
  /syncChallengeSettlementIntentFields[\s\S]*settlement\.status !== "proposed"[\s\S]*intentPending[\s\S]*intentStatus[\s\S]*intentSenderUserId[\s\S]*intentReceiverUserId/,
  "PVP settlement reads should backfill explicit intent flags for old proposed records."
);
assert.match(
  challengeSource,
  /syncChallengeSettlementNegotiationTurnFields[\s\S]*settlement\.status !== "active"[\s\S]*latestPlayerMessage[\s\S]*latestNegotiationMessageUserId[\s\S]*negotiationTurnUserId/,
  "PVP settlement reads should backfill explicit negotiation turn flags for old active records."
);
assert.match(
  challengeSource,
  /normalizeChallengeForRead[\s\S]*syncChallengeSettlementIntentFields\(challenge\)[\s\S]*syncChallengeSettlementNegotiationTurnFields\(challenge\)/,
  "PVP challenge reads should run settlement intent and negotiation turn normalizers."
);
assert.match(
  challengeSource,
  /intentSentByViewer[\s\S]*intentReceivedByViewer[\s\S]*awaitingSettlementResponse[\s\S]*receivedSettlementIntent/,
  "PVP challenge payload should expose viewer-specific settlement intent flags."
);
assert.match(
  pvpChallengePortraitRouteSource,
  /getPortraitParticipantId[\s\S]*participantId[\s\S]*getParticipantForRequest[\s\S]*getPortraitImageUrl[\s\S]*participantId=/,
  "PVP challenge portrait route should use stable participant-specific image URLs."
);
assert.match(
  challengeSource,
  /getStableChallengePortraitImage[\s\S]*\/client-portrait\?participantId=\$\{toObjectIdString[\s\S]*clientPortrait: getStableChallengePortrait/,
  "PVP challenge payload should normalize old viewer-relative portrait URLs."
);
assert.match(
  challengeWorkspaceSource,
  /intentPending[\s\S]*intentStatus === "pending"[\s\S]*Settlement Intent Received[\s\S]*Ask your client whether they are willing to explore settlement/,
  "PVP receiver should see a prompt to ask their client about settlement intent."
);
assert.match(
  challengeWorkspaceSource,
  /Your client has given authority\. Use Respond to Settlement/,
  "PVP receiver prompt should change once their client has given settlement authority."
);
assert.match(
  caseWorkspaceSource,
  /Settlement intent sent, awaiting response[\s\S]*Settlement intent received[\s\S]*Yes, Accept[\s\S]*No, Reject/,
  "PVP settlement intent UI should show sender waiting state and receiver Yes/No consent actions."
);
assert.match(
  caseWorkspaceSource,
  /intentPending[\s\S]*intentStatus === "pending"[\s\S]*awaitingSettlementResponse[\s\S]*intakeActionsLocked[\s\S]*Settlement intent sent, awaiting response/,
  "PVP sender intake should lock while awaiting the opponent's settlement response."
);
assert.match(
  caseWorkspaceSource,
  /settlementAuthorityReady[\s\S]*intakeActionsLocked[\s\S]*Settlement Authority Ready[\s\S]*Send Settlement Intent/,
  "PVP intake should lock ordinary actions once the client gives settlement authority."
);
assert.match(
  caseWorkspaceSource,
  /const handleSendSettlementIntent = async \(\) => \{[\s\S]*submitSettlementMessage\(\{[\s\S]*initial: true,[\s\S]*messageOverride: getDefaultSettlementIntentMessage\(\),[\s\S]*\}\)/,
  "PVP settlement authority CTA should immediately persist a settlement intent."
);
assert.match(
  caseWorkspaceSource,
  /onClick=\{handleSendSettlementIntent\}[\s\S]*Send Settlement Intent[\s\S]*settlementAuthorityReady[\s\S]*handleSendSettlementIntent\(\)/,
  "PVP settlement intent CTAs should use the direct send handler."
);
assert.match(
  caseWorkspaceSource,
  /handleFactSheetPrimaryAction[\s\S]*settlementAuthorityReady[\s\S]*handleSendSettlementIntent\(\)[\s\S]*factSheetPrimaryActionDisabled[\s\S]*settlementAuthorityReady/,
  "Prominent intake/fact-sheet CTAs should send settlement intent instead of becoming dead disabled buttons."
);
assert.match(
  caseWorkspaceSource,
  /type=\{settlementAuthorityReady \? "button" : "submit"\}[\s\S]*onClick=\{settlementAuthorityReady \? handleSendSettlementIntent : undefined\}/,
  "Question submit CTAs should explicitly send settlement intent when authority is ready."
);
assert.match(
  caseWorkspaceSource,
  /Settlement Intent Received[\s\S]*Ask your client whether they consent to settlement[\s\S]*hasSettlementAuthority[\s\S]*hasSettlementRejection/,
  "PVP receiver intake should prominently notify the player about settlement intent."
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
