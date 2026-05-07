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
  "Client says the sink was slow before move-out.",
]);
assert.deepEqual(legacyFactSheet.theory, [
  "I can argue the charge was not caused by my client.",
]);
assert.deepEqual(legacyFactSheet.desiredRelief, ["Return the withheld deposit."]);
assert.deepEqual(legacyFactSheet.supportingFacts, [
  "Client says the sink was slow before move-out.",
]);

assert.deepEqual(
  sanitizeFactSheetList("timeline", "Client moved in.\nClient moved out.\n"),
  ["Client moved in.", "Client moved out."]
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

console.log("Fact sheet tests passed");
