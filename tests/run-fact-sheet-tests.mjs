import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const { sanitizeFactSheet, sanitizeFactSheetList } = await import(
  "../libs/game/factSheetSanitizer.js"
);

const legacyFactSheet = sanitizeFactSheet({
  summary: "Client says the sink was slow before move-out.",
  theory: "I can argue the charge was not caused by my client.",
  desiredRelief: "Return the withheld deposit.",
  supportingFacts: [
    "Client says the sink was slow before move-out.",
    "Client says the sink was slow before move-out.",
    "  ",
  ],
});

assert.deepEqual(legacyFactSheet.summary, [
  "The sink was slow before move-out.",
]);
assert.deepEqual(legacyFactSheet.theory, [
  "Charge was not caused by the client.",
]);
assert.deepEqual(legacyFactSheet.desiredRelief, ["Return the withheld security deposit."]);
assert.deepEqual(legacyFactSheet.supportingFacts, [
  "The sink was slow before move-out.",
]);

assert.deepEqual(
  sanitizeFactSheetList("timeline", "Client moved in.\nClient moved out.\n"),
  ["Client moved in.", "Client moved out."]
);

assert.deepEqual(
  sanitizeFactSheetList(
    "timeline",
    "I run North Star Web Studio. BrightPath hired me to build a basic website. We worked out the project through email and text, and the understanding was that it was a fixed-price job with part paid up front and the rest due when the site launched."
  ),
  []
);

assert.deepEqual(
  sanitizeFactSheetList(
    "missingEvidence",
    "Unavailable: Unavailable: Unavailable: Relevant messages."
  ),
  []
);

const screenshotStyleFactSheet = sanitizeFactSheet({
  theory: [
    "Agreement was made through emails/texts and deposit payment rather than a formal signed MOU.",
    "Agreement was formed through emails/texts and performance, confirmed by deposit payment and later launch/access records rather than a signed pre-start document.",
    "Contract formed through communications, deposit, and performance.",
    "Contract formed through emails, texts, deposit payment, and performance; site was substantially completed and launched, so final payment became due.",
  ],
  timeline: [
    "I know that is not ideal, in hindsight, and I wish I had made them sign something more detailed, but at the time it did not feel unusual.",
    "Before work began, no formal signed documents were executed.",
    "Project terms were discussed by email and text.",
    "A deposit was paid.",
    "The site went live.",
    "After launch, payment dispute arose over final invoice.",
    "After launch, there was back-and-forth about fixes and changes.",
    "After launch, client kept addressing raised issues.",
  ],
  supportingFacts: [
    "I recalls there was no formal signed agreement before work began.",
    "No formal pre-start memorandum signed.",
    "No formal signed agreement before work began.",
    "Project communications occurred by email and text.",
    "Deposit payment exists.",
    "Client identifies deposit payment and final invoice records.",
    "Agreement was handled through emails and texts.",
    "A deposit was paid.",
  ],
  risks: [
    "No signed memorandum documenting terms.",
    "What I do have, or at least what I believe shows the real story, are the emails and texts about the project, the deposit payment, the final invoice, and whatever records exist showing the site was live or that they had access.",
    "BrightPath may argue the project was not finished as promised or had unresolved problems.",
    "Post-launch issues may support nonpayment defense.",
    "BrightPath may argue post-launch issues showed the work was incomplete.",
  ],
  disputedFacts: [
    "Whether launch meant the project was completed enough for final payment.",
    "Whether the remaining issues were ordinary tweaks or serious defects.",
    "Whether post-launch issues justified withholding payment.",
    "Whether the parties agreed to ongoing post-launch maintenance or bug-fix obligations.",
    "Whether post-launch issues were minor tweaks or serious defects justifying nonpayment.",
    "Whether raised issues were bugs, revisions, or maintenance.",
  ],
  corroboratedFacts: [
    "Email communications.",
    "Text messages.",
    "Deposit payment record.",
    "Final invoice.",
    "Relevant messages.",
    "Proof for this point.",
  ],
  missingEvidence: [
    "Any signed memorandum of understanding or formal written contract.",
    "Signed pre-start agreement absent.",
    "Records showing site went live or client access.",
    "A written term specifically defining post-launch maintenance or bug-fix obligations.",
    "Formal post-launch maintenance agreement.",
  ],
  desiredRelief: [
    "Payment of the unpaid contract balance, late fees or interest if allowed, and court costs.",
    "Unpaid balance, allowable interest or fees, costs.",
  ],
});

assert.deepEqual(screenshotStyleFactSheet.theory, [
  "Contract formation rests on emails, texts, deposit payment, and performance.",
  "Site launch and substantial completion support final payment.",
]);
assert.equal(
  screenshotStyleFactSheet.timeline.includes(
    "I know that is not ideal, in hindsight, and I wish I had made them sign something more detailed, but at the time it did not feel unusual."
  ),
  false
);
assert.equal(
  screenshotStyleFactSheet.supportingFacts.filter((item) =>
    /signed|memorandum|agreement/i.test(item)
  ).length,
  1
);
assert.equal(
  screenshotStyleFactSheet.disputedFacts.filter((item) =>
    /post-launch|bugs|revisions|maintenance|defects/i.test(item)
  ).length <= 3,
  true
);
assert.deepEqual(screenshotStyleFactSheet.corroboratedFacts, [
  "Deposit payment record.",
  "Final invoice.",
]);
assert.equal(
  screenshotStyleFactSheet.missingEvidence.filter((item) =>
    /signed|memorandum|contract|agreement/i.test(item)
  ).length,
  1
);

const allScreenshotNotes = Object.values(screenshotStyleFactSheet).flat();
assert.equal(allScreenshotNotes.some((item) => /^(i|my|we|our)\b/i.test(item)), false);
assert.equal(
  allScreenshotNotes.some((item) =>
    /^(client says|i recall|i recalls|i believe|what i)\b/i.test(item)
  ),
  false
);
assert.equal(allScreenshotNotes.includes("Proof for this point."), false);
assert.equal(allScreenshotNotes.includes("Relevant messages."), false);
assert.equal(screenshotStyleFactSheet.theory.length <= 2, true);

const storeSource = await readFile(new URL("../libs/game/store.js", import.meta.url), "utf8");
assert.match(storeSource, /factSheet:\s*{[\s\S]*?summary:\s*\[\]/);
assert.match(storeSource, /factSheet:\s*{[\s\S]*?theory:\s*\[\]/);
assert.match(storeSource, /factSheet:\s*{[\s\S]*?desiredRelief:\s*\[\]/);
assert.doesNotMatch(
  storeSource,
  /factSheet:\s*{[\s\S]*?summary:\s*buildOverviewForSide/
);
assert.doesNotMatch(
  storeSource,
  /factSheet:\s*{[\s\S]*?theory:\s*buildStarterTheoryForSide/
);
assert.doesNotMatch(
  storeSource,
  /factSheet:\s*{[\s\S]*?desiredRelief:\s*buildDesiredReliefForSide/
);

const sharedSource = await readFile(
  new URL("../libs/game/engine/shared.js", import.meta.url),
  "utf8"
);
const mergeSource = sharedSource.slice(
  sharedSource.indexOf("export const mergeFactSheet"),
  sharedSource.indexOf("export const coerceString")
);
assert.doesNotMatch(mergeSource, /buildSummaryForSide/);
assert.doesNotMatch(mergeSource, /buildTheoryForSide/);
assert.doesNotMatch(mergeSource, /buildDesiredReliefForSide/);

const engineSource = await readFile(new URL("../libs/game/engine.js", import.meta.url), "utf8");
const caseWorkspaceSource = await readFile(
  new URL("../components/legal-arena/CaseWorkspace.js", import.meta.url),
  "utf8"
);
const globalsCssSource = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
const clientMemorySource = await readFile(
  new URL("../libs/game/clientMemory.js", import.meta.url),
  "utf8"
);
const caseSessionModel = await readFile(
  new URL("../models/CaseSession.js", import.meta.url),
  "utf8"
);
const sessionUsageSource = await readFile(
  new URL("../libs/game/sessionUsage.js", import.meta.url),
  "utf8"
);
const interviewRouteSource = await readFile(
  new URL("../app/api/cases/[caseId]/interview/route.js", import.meta.url),
  "utf8"
);
const courtroomRouteSource = await readFile(
  new URL("../app/api/cases/[caseId]/courtroom/route.js", import.meta.url),
  "utf8"
);
const finalizeRouteSource = await readFile(
  new URL("../app/api/cases/[caseId]/finalize/route.js", import.meta.url),
  "utf8"
);
assert.match(
  engineSource,
  /const combinedPatch = mergeFactSheetPatches\(memoryClaimPatch, conversationPatch\)/
);
assert.doesNotMatch(
  engineSource,
  /mergeFactSheetPatches\(interviewResult\.patch, conversationPatch\)/
);
assert.match(
  engineSource,
  /const transcriptFactSheet = rebuildFactSheetFromTranscript/
);
assert.match(
  engineSource,
  /const currentConversationFactSheet = factSheetHasVisibleContent\(caseSession\.factSheet\)/
);
assert.match(engineSource, /const completedSections = \[/);
assert.match(engineSource, /completedSections < 4/);
assert.match(engineSource, /warnings\.push\("case theory"\)/);
assert.doesNotMatch(engineSource, /missing\.push\("case theory"\)/);
assert.match(
  engineSource,
  /export const rebuildFactSheetFromTranscript/
);
assert.match(
  engineSource,
  /blankConversationFactSheet\(\)/
);
assert.match(
  storeSource,
  /plainCase\.status === "interview"[\s\S]*!factSheetHasVisibleContent\(plainCase\.factSheet\)[\s\S]*rebuildFactSheetFromTranscript/
);
assert.match(
  storeSource,
  /plainCase\.factSheet \|\| activeIntakeRebuild/
);
assert.doesNotMatch(engineSource, /fallbackProofAndClassificationPatch/);
assert.doesNotMatch(engineSource, /buildConversationFactSheetFallback/);
assert.doesNotMatch(engineSource, /buildConversationProofClassificationFallback/);
assert.doesNotMatch(engineSource, /const disputePattern =/);
assert.doesNotMatch(engineSource, /const intakeRiskPattern =/);
assert.doesNotMatch(engineSource, /Live dispute from intake/);
assert.doesNotMatch(engineSource, /Point may need more support/);
assert.doesNotMatch(engineSource, /what i had\|what i have/);
assert.doesNotMatch(engineSource, /bestItem\?\.section === "memory"/);
assert.doesNotMatch(
  engineSource,
  /answerShowsProofPossession \|\|\s*proofTermPattern\.test\(lowerAnswer\)/
);

assert.match(caseSessionModel, /usage:\s*{/);
assert.match(caseSessionModel, /intake:\s*{[\s\S]*?usageBucketSchema/);
assert.match(caseSessionModel, /courtroom:\s*{[\s\S]*?usageBucketSchema/);
assert.match(caseSessionModel, /total:\s*{[\s\S]*?usageBucketSchema/);
assert.match(caseSessionModel, /entries:\s*{[\s\S]*?private:\s*true/);
assert.match(sessionUsageSource, /export const createUsageCollector/);
assert.match(sessionUsageSource, /export const appendUsageEntriesToCaseSession/);
assert.match(sessionUsageSource, /inputTokens/);
assert.match(sessionUsageSource, /cachedInputTokens/);
assert.match(sessionUsageSource, /reasoningTokens/);
assert.match(engineSource, /usageLabel:\s*"intake\.clientMemory"/);
assert.match(engineSource + clientMemorySource, /usageLabel:\s*"intake\.clientMemoryExcerpt"/);
assert.match(engineSource, /usageLabel:\s*"intake\.partyResponse"/);
assert.match(engineSource, /usageLabel:\s*"intake\.factSheetPatch"/);
assert.match(engineSource, /usageLabel:\s*"intake\.assessment"/);
assert.match(engineSource, /usageLabel:\s*"courtroom\.counselAnalysis"/);
assert.match(engineSource, /usageLabel:\s*shouldReturnVerdict \? "courtroom\.roundWithVerdict" : "courtroom\.round"/);
assert.match(caseWorkspaceSource, /const getFactSheetSectionCounts = \(factSheet = \{\}\) =>/);
assert.match(caseWorkspaceSource, /const getFactSheetProgressDelta = \(previousFactSheet = \{\}, nextFactSheet = \{\}\) =>/);
assert.match(caseWorkspaceSource, /const previousFactSheet = caseSession\.factSheet/);
assert.match(caseWorkspaceSource, /const nextCase = updateCaseFromResponse\(response\)/);
assert.match(caseWorkspaceSource, /triggerFactSheetProgress\(progressDelta\)/);
assert.match(caseWorkspaceSource, /recentFactSheetProgress\[sectionKey\]/);
assert.match(caseWorkspaceSource, /renderFactSheetProgressBadge\(section\.key\)/);
assert.doesNotMatch(caseWorkspaceSource, /factSheetProgressTimeoutRef/);
assert.doesNotMatch(caseWorkspaceSource, /setTimeout\(\(\) => \{\s*setRecentFactSheetProgress\(\{\}\)/);
assert.match(globalsCssSource, /\.arena-fact-progress-pop/);
assert.match(globalsCssSource, /\.arena-fact-progress-glow/);
assert.match(interviewRouteSource, /appendUsageEntriesToCaseSession\(caseSession, result\.usageEntries\)/);
assert.match(courtroomRouteSource, /appendUsageEntriesToCaseSession\(caseSession, result\.usageEntries\)/);
assert.match(finalizeRouteSource, /createUsageCollector\("courtroom"\)/);
assert.match(finalizeRouteSource, /usageLabel:\s*"courtroom\.assessment"/);

const challengeSource = await readFile(
  new URL("../libs/game/challenges.js", import.meta.url),
  "utf8"
);
assert.match(challengeSource, /const buildTranscriptBackfillPatch = \(\) => normalizeFactSheetPatch\(\{\}\)/);
assert.doesNotMatch(challengeSource, /buildConversationFactSheetFallback/);
assert.doesNotMatch(challengeSource, /const disputeCuePattern =/);
assert.match(challengeSource, /\"disputedFacts\"/);
assert.doesNotMatch(challengeSource, /const exchangePatch =/);
assert.doesNotMatch(challengeSource, /exchangePatch\[field\]\?\.length/);

console.log("Fact sheet tests passed");
