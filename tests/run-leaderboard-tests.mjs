import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const progressionSource = await readFile(
  new URL("../libs/game/progression.js", import.meta.url),
  "utf8"
);
const dashboardPageSource = await readFile(
  new URL("../app/dashboard/page.js", import.meta.url),
  "utf8"
);

assert.match(progressionSource, /includeUserId = ""/);
assert.match(progressionSource, /const limitedEntries = searchedEntries\.slice\(0, limit\)/);
assert.match(progressionSource, /const includedEntry = rankedEntries\.find/);
assert.match(progressionSource, /return \[\.\.\.limitedEntries, includedEntry\]/);
assert.match(
  dashboardPageSource,
  /listOverallLeaderboard\(\{ limit: 8, includeUserId: session\.user\.id \}\)/
);

console.log("Leaderboard tests passed");
