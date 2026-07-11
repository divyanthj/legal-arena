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
const barAssociationPageSource = await readFile(
  new URL("../app/dashboard/bar-association/page.js", import.meta.url),
  "utf8"
);
const playerProfilePageSource = await readFile(
  new URL("../app/dashboard/players/[playerId]/page.js", import.meta.url),
  "utf8"
);
const playerMatterPageSource = await readFile(
  new URL("../app/dashboard/players/[playerId]/matters/[matterId]/page.js", import.meta.url),
  "utf8"
);
const storeSource = await readFile(
  new URL("../libs/game/store.js", import.meta.url),
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
assert.doesNotMatch(barAssociationPageSource, /DevelopmentAccessGate|userCanAccessArena/);
assert.doesNotMatch(playerProfilePageSource, /return <DevelopmentAccessGate/);
assert.doesNotMatch(playerMatterPageSource, /DevelopmentAccessGate|userCanAccessArena/);
assert.match(storeSource, /export const buildPublicCasePayload/);
assert.match(storeSource, /delete publicPayload\.canonicalStory/);
assert.match(storeSource, /delete publicPayload\.templateSnapshot/);
assert.match(storeSource, /canViewFullArchive\s*\? buildCasePayload[\s\S]*: buildPublicCasePayload/);

console.log("Leaderboard tests passed");
