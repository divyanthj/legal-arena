import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const storeSource = await readFile(new URL("../libs/game/store.js", import.meta.url), "utf8");
const challengeSource = await readFile(
  new URL("../libs/game/challenges.js", import.meta.url),
  "utf8"
);

assert.match(storeSource, /const buildTheorySeedFromOpening = \(opening = ""\) =>/);
assert.match(storeSource, /const buildTimelineSeedsFromOpening = \(opening = ""\) =>/);
assert.match(storeSource, /export const buildInitialFactSheetFromOpening =/);
assert.match(storeSource, /factSheet: buildInitialFactSheetFromOpening\(\{/);
assert.match(storeSource, /caseSession\.factSheet = buildInitialFactSheetFromOpening\(\{/);
assert.match(storeSource, /replaceExisting: !hasPlayerQuestions/);
assert.match(storeSource, /Deposit withholding appears unsupported by documented damage/);
assert.match(storeSource, /Security deposit paid \(\$\{amounts\[0\]\}\); partial return received/);
assert.match(
  challengeSource,
  /import \{ buildInitialFactSheetFromOpening, listScenarioOptions \} from "\.\/store"/
);
assert.match(challengeSource, /participant\.factSheet = buildInitialFactSheetFromOpening\(\{/);
assert.match(challengeSource, /const blankFactSheet = \(template, side, openingStatement = ""\) =>\s*buildInitialFactSheetFromOpening/);

console.log("Intake opening seed tests passed");
