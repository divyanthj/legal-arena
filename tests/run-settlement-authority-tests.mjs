import assert from "node:assert/strict";

const { hasClientSettlementAuthority } = await import(
  "../libs/game/settlementAuthority.js"
);

assert.equal(
  hasClientSettlementAuthority([
    {
      role: "player",
      text: "Would you be open to settling?",
    },
    {
      role: "party",
      text: "Yes, I'd be open to settling.",
    },
  ]),
  true
);

assert.equal(
  hasClientSettlementAuthority([
    {
      role: "player",
      text: "Would you be open to settling?",
    },
    {
      role: "party",
      text: "No, I would rather go to court.",
    },
  ]),
  false
);

console.log("Settlement authority tests passed");
