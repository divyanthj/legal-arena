import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const {
  calculateUnderdogBonus,
  lockCaseAssessment,
  normalizeCaseAssessment,
} = await import("../libs/game/caseAssessment.js");

const normalized = normalizeCaseAssessment({
  successChance: 127.4,
  reasons: ["  Strong records. ", "", "Thin timeline.", "Extra reason."],
});

assert.equal(normalized.currentSuccessChance, 100);
assert.deepEqual(normalized.currentReasons, ["Strong records.", "Thin timeline.", "Extra reason."]);

const previous = normalizeCaseAssessment({
  successChance: 42,
  reasons: ["Weak proof."],
});
assert.equal(normalizeCaseAssessment({ successChance: "nope" }, previous), previous);

const locked = lockCaseAssessment(previous);
assert.equal(locked.lockedCourtEntryChance, 42);
assert.deepEqual(locked.lockedReasons, ["Weak proof."]);
assert.equal(Boolean(locked.lockedAt), true);

assert.deepEqual(calculateUnderdogBonus(32, "player"), {
  bonusXp: 22,
  bonusRating: 4,
  note: "Won as a 32% underdog",
});
assert.deepEqual(calculateUnderdogBonus(50, "player"), {
  bonusXp: 0,
  bonusRating: 0,
  note: "",
});
assert.deepEqual(calculateUnderdogBonus(20, "opponent"), {
  bonusXp: 0,
  bonusRating: 0,
  note: "",
});

const engineSource = await readFile(new URL("../libs/game/engine.js", import.meta.url), "utf8");
const assessmentSource = engineSource.slice(
  engineSource.indexOf("export const assessCaseSuccessChance"),
  engineSource.indexOf("const buildConversationFactSheetPatch")
);
assert.match(assessmentSource, /factSheet/);
assert.match(assessmentSource, /recentTranscript/);
assert.doesNotMatch(assessmentSource, /canonicalFacts/i);
assert.doesNotMatch(assessmentSource, /evidenceItems/i);
assert.doesNotMatch(assessmentSource, /canonicalWorld/i);

console.log("Case assessment tests passed");
