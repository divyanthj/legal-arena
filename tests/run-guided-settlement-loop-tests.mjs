import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");
const [
  workspaceSource,
  settlementSource,
  challengesSource,
  challengeModelSource,
  challengeWorkspaceSource,
  soloPreviewRouteSource,
  soloMessageRouteSource,
  challengePreviewRouteSource,
] = await Promise.all([
  read("../components/legal-arena/CaseWorkspace.js"),
  read("../libs/game/settlement.js"),
  read("../libs/game/challenges.js"),
  read("../models/Challenge.js"),
  read("../components/legal-arena/ChallengeWorkspace.js"),
  read("../app/api/cases/[caseId]/settlement/preview/route.js"),
  read("../app/api/cases/[caseId]/settlement/message/route.js"),
  read("../app/api/challenges/[challengeId]/settlement/preview/route.js"),
]);

assert.match(workspaceSource, /mode: "assisted_follow_up"/);
assert.match(workspaceSource, /clientConsultedLatestOffer/);
assert.match(workspaceSource, /Client consulted/);
assert.match(workspaceSource, /setSettlementMessageAndFocus\(responseAwareSettlementMessage\)/);
assert.match(workspaceSource, /payload\?\.caseSession \|\| payload\?\.challenge/);
assert.doesNotMatch(
  workspaceSource,
  /Give me concrete authority for the next offer\. State the revised total contract price/
);

assert.match(settlementSource, /getSettlementOfferSignature/);
assert.match(settlementSource, /sourceOfferSignature/);
assert.match(settlementSource, /recommendedAction/);
assert.match(settlementSource, /consultationMode/);
assert.match(settlementSource, /assisted outgoingDraft must materially address the latest blocker/);
assert.match(settlementSource, /do not repeat terms the parties already appear to agree on/);
assert.match(settlementSource, /openIssues/);
assert.match(settlementSource, /agreedTerms/);
assert.match(workspaceSource, /Adjustments requested/);
assert.match(workspaceSource, /Already aligned/);
assert.match(workspaceSource, /Decisive move/);
assert.match(workspaceSource, /Exchange \{Math\.min\(settlementExchangeCount \+ 1, settlementExchangeLimit\)\}/);
assert.match(settlementSource, /MAX_SETTLEMENT_PUBLIC_EXCHANGES = 8/);
assert.match(
  settlementSource,
  /noProgressCount >= 2[\s\S]*tacticShiftTriggered[\s\S]*tacticShiftFailed[\s\S]*exchangeLimitReached/
);
assert.match(settlementSource, /eight-exchange limit without agreement/);
assert.match(challengesSource, /MAX_SETTLEMENT_PUBLIC_EXCHANGES/);
assert.match(
  challengesSource,
  /repeatedOwnProposal[\s\S]*tacticShiftTriggered[\s\S]*convergenceFailed[\s\S]*exchangeLimitReached/
);
assert.match(settlementSource, /repeatedDraft[\s\S]*recommendedAction: repeatedDraft \? "clarify"/);
assert.match(settlementSource, /acceptLatestSoloSettlementOffer/);
assert.match(
  settlementSource,
  /preview\.sourceOfferSignature !== currentSignature[\s\S]*preview\.acceptanceAuthority !== "accept"/
);

assert.match(
  soloPreviewRouteSource,
  /body\?\.mode === "assisted_follow_up"[\s\S]*clientPreview: result\.preview/
);
assert.match(
  soloMessageRouteSource,
  /body\?\.acceptTerms === true[\s\S]*acceptLatestSoloSettlementOffer/
);
assert.match(
  soloMessageRouteSource,
  /else if \(result\.failed\) \{[\s\S]*caseSession\.status = "interview"/
);
assert.match(
  workspaceSource,
  /opponentWalkoutOrImpasseActive[\s\S]*settlementFailureRedirectKeyRef[\s\S]*router\.replace\(settlementFailureWorkspaceHref\)/
);
assert.match(workspaceSource, /Settlement ended at impasse\. Intake is open again\./);

assert.match(challengeModelSource, /settlementAssistant:[\s\S]*private: true/);
assert.match(
  challengesSource,
  /previewChallengeSettlementDraft[\s\S]*applyPrivateClientHuddleMood[\s\S]*participants\.\$\.settlementAssistant/
);
assert.match(
  challengesSource,
  /clientMemory, settlementAssistant, \.\.\.publicParticipant/
);
assert.match(challengesSource, /settlementAssistant: participant\.settlementAssistant \|\| null/);
assert.match(
  challengesSource,
  /assistantPreview\.sourceOfferSignature !== currentOfferSignature[\s\S]*assistantPreview\.acceptanceAuthority !== "accept"/
);
assert.match(challengeWorkspaceSource, /clientPreview: viewer\.settlementAssistant\?\.preview/);
assert.match(challengePreviewRouteSource, /mode: body\?\.mode \|\| "manual"/);
assert.match(challengePreviewRouteSource, /NextResponse\.json\(result\)/);

console.log("Guided settlement loop tests passed.");
