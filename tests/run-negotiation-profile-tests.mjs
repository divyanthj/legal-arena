import assert from "node:assert/strict";

import {
  NEGOTIATION_MODES,
  getNegotiationProfile,
} from "../libs/game/negotiationProfile.mjs";

assert.equal(getNegotiationProfile({ primaryCategory: "consumer" }).mode, "civil_settlement");

assert.equal(
  getNegotiationProfile({
    primaryCategory: "criminal",
    premise: { overview: "A hotel seeks compensation for a missing keycard and room damage." },
  }).mode,
  NEGOTIATION_MODES.RESTITUTION
);

assert.equal(
  getNegotiationProfile({
    primaryCategory: "criminal",
    premise: { overview: "The accused faces a battery charge after a minor fight." },
  }).available,
  true
);

assert.equal(
  getNegotiationProfile({
    primaryCategory: "criminal",
    premise: { overview: "The prosecution alleges murder." },
  }).mode,
  NEGOTIATION_MODES.UNAVAILABLE
);

assert.equal(
  getNegotiationProfile({
    primaryCategory: "criminal",
    negotiationProfile: { mode: "cooperation" },
    premise: { overview: "The prosecution alleges murder, but the accused may assist the state." },
  }).mode,
  NEGOTIATION_MODES.COOPERATION
);

assert.equal(
  getNegotiationProfile({
    primaryCategory: "criminal",
    negotiationProfile: { mode: "restitution" },
    premise: { overview: "The prosecution alleges rape." },
  }).available,
  false,
  "private compensation cannot override the severe-offence bar"
);

console.log("Negotiation profile tests passed");
