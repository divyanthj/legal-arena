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
  "I can argue the charge was not caused by my client.",
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
  ["Unavailable: Relevant messages."]
);

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
assert.match(
  engineSource,
  /const combinedPatch = mergeFactSheetPatches\(interviewResult\.patch, conversationPatch\)/
);
assert.match(
  engineSource,
  /const fallbackProofAndClassificationPatch = normalizeFactSheetPatch/
);
assert.match(
  engineSource,
  /timeline: uniqueList\(\[\.\.\.patch\.timeline, \.\.\.fallbackProofAndClassificationPatch\.timeline\]\)/
);
assert.match(
  engineSource,
  /patch\.desiredRelief\.push\(answer\);\s*}\s*if \(\s*!\s*proofRelated/
);
assert.match(
  engineSource,
  /const disputePattern =/
);
assert.match(
  engineSource,
  /const intakeRiskPattern =/
);
assert.match(
  engineSource,
  /patch\.disputedFacts\.push\(`Live dispute from intake: \$\{answer\}`\);/
);
assert.match(
  engineSource,
  /patch\.risks\.push\("Point may need more support\."\);/
);
assert.match(
  engineSource,
  /disputedFacts: uniqueList\(\[\s*\.\.\.patch\.disputedFacts,\s*\.\.\.fallbackProofAndClassificationPatch\.disputedFacts,\s*\]\)/
);
assert.match(engineSource, /what i had\|what i have/);
assert.match(
  engineSource,
  /timeline:\s*bestItem\?\.section === "memory" \? \[bestItem\.text\] : \[\]/
);
assert.match(
  engineSource,
  /knownClaims:\s*bestItem\?\.section === "memory" \? \[bestItem\.text\] : \[\]/
);
assert.doesNotMatch(
  engineSource,
  /answerShowsProofPossession \|\|\s*proofTermPattern\.test\(lowerAnswer\)/
);

const challengeSource = await readFile(
  new URL("../libs/game/challenges.js", import.meta.url),
  "utf8"
);
assert.match(challengeSource, /buildConversationFactSheetFallback/);
assert.doesNotMatch(challengeSource, /const disputeCuePattern =/);
assert.match(challengeSource, /\"disputedFacts\"/);
assert.match(
  challengeSource,
  /const exchangePatch = buildConversationFactSheetFallback/
);
assert.match(challengeSource, /exchangePatch\[field\]\?\.length/);

console.log("Fact sheet tests passed");
