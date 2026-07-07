import assert from "node:assert/strict";

const { hasClientSettlementAuthority, hasClientSettlementRejection } = await import(
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

assert.equal(
  hasClientSettlementRejection([
    {
      role: "player",
      text: "Would you be willing to settle this case?",
    },
    {
      role: "party",
      text: "No, I don't want to settle.",
    },
  ]),
  true
);

assert.equal(
  hasClientSettlementRejection([
    {
      role: "player",
      text: "Would you be willing to settle this case?",
    },
    {
      role: "party",
      text: "Yes, I'd consider settling for $300.",
    },
  ]),
  false
);

console.log("Settlement authority tests passed");
