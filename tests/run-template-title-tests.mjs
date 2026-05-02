import assert from "node:assert/strict";

const { buildDepositCaseTitle, extractMoneyValues } = await import(
  "../libs/game/templateBuilder/titleUtils.js"
);

assert.deepEqual(extractMoneyValues("$1,200 deposit and 950 dollars withheld"), [
  "1200",
  "950",
]);
assert.equal(
  buildDepositCaseTitle("tenant paid a $1,200 deposit and landlord withheld $950"),
  "The $950 Deposit Fight"
);
assert.equal(buildDepositCaseTitle("security deposit dispute"), "The Deposit Fight");

console.log("Template title tests passed");
