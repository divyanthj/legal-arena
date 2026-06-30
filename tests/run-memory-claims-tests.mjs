import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  buildMemoryClaimFactSheetPatch,
  mergeMemoryClaims,
  normalizeMemoryClaims,
} from "../libs/game/memoryClaims.js";

const bikePatch = buildMemoryClaimFactSheetPatch({
  ownClaims: [
    {
      text: "He stole my bike.",
      topicKey: "possession-bike",
      side: "client",
    },
  ],
  opposingClaims: [
    {
      text: "I did not steal the bike.",
      topicKey: "possession-bike",
      side: "opponent",
      stance: "denies",
    },
  ],
  side: "client",
});
assert.deepEqual(bikePatch.knownClaims, []);
assert.deepEqual(bikePatch.disputedFacts, ["Whether He stole my bike."]);

const shoesPatch = buildMemoryClaimFactSheetPatch({
  ownClaims: [
    {
      text: "He stole my shoes.",
      topicKey: "possession-shoes",
      side: "client",
    },
  ],
  opposingClaims: [
    {
      text: "I did not steal the bike.",
      topicKey: "possession-bike",
      side: "opponent",
    },
  ],
  side: "client",
});
assert.deepEqual(shoesPatch.knownClaims, ["He stole my shoes."]);
assert.deepEqual(shoesPatch.disputedFacts, []);

const depositPatch = buildMemoryClaimFactSheetPatch({
  ownClaims: [
    {
      text: "I paid a $1,200 security deposit.",
      topicKey: "deposit-amount",
      side: "client",
    },
  ],
  opposingClaims: [],
  side: "client",
});
assert.deepEqual(depositPatch.knownClaims, ["I paid a $1,200 security deposit."]);
assert.deepEqual(depositPatch.disputedFacts, []);

const deductionPatch = buildMemoryClaimFactSheetPatch({
  ownClaims: [
    {
      text: "The landlord withheld $950.",
      topicKey: "withheld-amount",
      side: "client",
    },
  ],
  opposingClaims: [
    {
      text: "Only $500 was withheld.",
      topicKey: "withheld-amount",
      side: "opponent",
    },
  ],
  side: "client",
});
assert.deepEqual(deductionPatch.knownClaims, []);
assert.deepEqual(deductionPatch.disputedFacts, ["Whether The landlord withheld $950."]);

assert.deepEqual(
  normalizeMemoryClaims([{ claim: "The repair was approved.", topicKey: " consent repair " }]),
  [
    {
      text: "The repair was approved.",
      topicKey: "consent-repair",
      side: "client",
      stance: "claims",
    },
  ]
);

assert.deepEqual(
  mergeMemoryClaims(
    [
      {
        text: "I think the deposit was $1,200.",
        topicKey: "deposit-amount",
        side: "client",
      },
    ],
    [
      {
        text: "I think the deposit was $1,200.",
        topicKey: "deposit-amount",
        side: "client",
      },
      {
        text: "They kept about $950.",
        topicKey: "withheld-amount",
        side: "client",
        stance: "uncertain",
      },
    ]
  ),
  [
    {
      text: "I think the deposit was $1,200.",
      topicKey: "deposit-amount",
      side: "client",
      stance: "claims",
    },
    {
      text: "They kept about $950.",
      topicKey: "withheld-amount",
      side: "client",
      stance: "uncertain",
    },
  ]
);

const courtroomSource = await readFile(
  new URL("../libs/game/engine/courtroom.js", import.meta.url),
  "utf8"
);
assert.match(courtroomSource, /recordBound:\s*true/);
assert.match(courtroomSource, /Do not infer, cite, or credit facts, claims, story details, or evidence outside those visible side files/);
assert.doesNotMatch(courtroomSource, /canonicalWorld/);

console.log("Memory claim tests passed");
