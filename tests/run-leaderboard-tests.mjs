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
assert.match(progressionSource, /export const listDashboardLeaderboards/);
assert.match(progressionSource, /rankCategoryLeaderboardEntries\(users, categorySlug\)/);
assert.match(
  dashboardPageSource,
  /listDashboardLeaderboards\(\{\s*categorySlugs: LEGAL_CASE_CATEGORIES\.map\(\(category\) => category\.slug\),\s*overallLimit: 8,\s*includeUserId: session\.user\.id,/s
);

console.log("Leaderboard tests passed");
