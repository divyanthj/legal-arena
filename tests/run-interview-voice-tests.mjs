import assert from "node:assert/strict";

const {
  hasThirdPersonSelfReference,
  normalizePartySpeechToFirstPerson,
} = await import("../libs/game/engine/voice.js");
const { buildSafeClientMemoryExcerpt } = await import("../libs/game/clientMemory.js");

assert.equal(
  normalizePartySpeechToFirstPerson({
    text: "Maria says she found an older survey in her closing papers.",
    partyName: "Maria Lopez",
    playerSide: "client",
  }),
  "I found an older survey in her closing papers."
);

assert.equal(
  normalizePartySpeechToFirstPerson({
    text: "I also remember that maria found an older survey in her closing papers.",
    partyName: "Maria Lopez",
    playerSide: "client",
  }),
  "I also remember that I found an older survey in her closing papers."
);

assert.equal(
  normalizePartySpeechToFirstPerson({
    text: "Daniel says he kept a copy of the itemized breakdown.",
    partyName: "Daniel Reed",
    playerSide: "opponent",
  }),
  "I kept a copy of the itemized breakdown."
);

assert.equal(
  normalizePartySpeechToFirstPerson({
    text: "I asked Daniel to move the fence, but Daniel refused to move the fence.",
    partyName: "Maria Lopez",
    playerSide: "client",
  }),
  "I asked Daniel to move the fence, but Daniel refused to move the fence."
);

assert.equal(
  normalizePartySpeechToFirstPerson({
    text: "Maria's survey shows the old boundary line.",
    partyName: "Maria Lopez",
    playerSide: "client",
  }),
  "My survey shows the old boundary line."
);

assert.equal(
  hasThirdPersonSelfReference({
    text: "Maria says she found an older survey.",
    partyName: "Maria Lopez",
    playerSide: "client",
  }),
  true
);

assert.equal(
  hasThirdPersonSelfReference({
    text: "I found an older survey, and Daniel refused to move the fence.",
    partyName: "Maria Lopez",
    playerSide: "client",
  }),
  false
);

assert.equal(
  buildSafeClientMemoryExcerpt({
    clientMemory: "Jordan Lee says he cleaned the apartment before returning the keys. He does not think the deductions were fair.",
    partyName: "Jordan Lee",
    playerSide: "client",
  }),
  "I cleaned the apartment before returning the keys. I do not think the deductions were fair."
);

assert.equal(
  buildSafeClientMemoryExcerpt({
    clientMemory: "Maple Street Properties says it kept photos and an invoice. The property manager thinks the tenant left real damage.",
    partyName: "Maple Street Properties, LLC",
    playerSide: "opponent",
  }),
  "I kept photos and an invoice. The property manager thinks the tenant left real damage."
);

assert.equal(
  buildSafeClientMemoryExcerpt({
    clientMemory: "The defendant claims the invoice exists.",
    partyName: "Maple Street Properties, LLC",
    playerSide: "opponent",
  }),
  ""
);

console.log("Interview voice tests passed");
