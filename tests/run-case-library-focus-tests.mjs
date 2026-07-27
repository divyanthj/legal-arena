import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  clampCaseLibraryDifficulty,
  getCaseLibraryChallengeCap,
} from "../libs/game/caseLibraryFocus.mjs";

assert.equal(
  getCaseLibraryChallengeCap({
    playerComplexityCap: 4,
    unlockedComplexity: 3,
  }),
  4,
  "the case library should retain the existing one-level stretch allowance"
);
assert.equal(
  getCaseLibraryChallengeCap({
    playerComplexityCap: 5,
    unlockedComplexity: 5,
  }),
  5,
  "the challenge cap must never exceed level five"
);
assert.equal(
  clampCaseLibraryDifficulty({
    difficulty: 3,
    playerComplexityCap: 4,
    unlockedComplexity: 3,
  }),
  3,
  "a playable manual difficulty should be preserved"
);
assert.equal(
  clampCaseLibraryDifficulty({
    difficulty: 5,
    playerComplexityCap: 3,
    unlockedComplexity: 2,
  }),
  3,
  "an unavailable difficulty should clamp to the category's highest playable level"
);
assert.equal(
  clampCaseLibraryDifficulty({
    difficulty: 0,
    playerComplexityCap: 1,
    unlockedComplexity: 1,
  }),
  1
);

const dashboardSource = await readFile(
  new URL("../components/legal-arena/DashboardHub.js", import.meta.url),
  "utf8"
);
const navigatorSource = await readFile(
  new URL("../components/legal-arena/MobileSectionNavigator.js", import.meta.url),
  "utf8"
);
const globalsSource = await readFile(
  new URL("../app/globals.css", import.meta.url),
  "utf8"
);

assert.match(
  dashboardSource,
  /nextCaseRecommendation\?\.categorySlug \|\| categories\[0\]\?\.slug/,
  "the recommended category must remain the initial selection"
);
assert.match(
  dashboardSource,
  /Number\(nextCaseRecommendation\?\.complexity\) \|\| 1/,
  "the recommended complexity must remain the initial selection"
);
assert.match(
  dashboardSource,
  /showCaseCategoryChooser, setShowCaseCategoryChooser\] = useState\(false\)/,
  "the category chooser should be collapsed by default"
);
assert.match(dashboardSource, /Your selected practice area/);
assert.match(dashboardSource, /Change area/);
assert.match(dashboardSource, /aria-controls="case-library-category-chooser"/);
assert.match(dashboardSource, /aria-expanded=\{false\}/);
assert.match(dashboardSource, /aria-expanded=\{true\}/);
assert.match(
  dashboardSource,
  /showCaseCategoryChooser \|\| !selectedCategoryMeta[\s\S]*categories\.map/,
  "the full category grid should only render through the expandable chooser"
);

assert.match(
  dashboardSource,
  /scrollIntoView\(\{[\s\S]*behavior: reduceMotion \? "auto" : "smooth"[\s\S]*block: "center"/,
  "case-library navigation should center the selected category and respect reduced motion"
);
assert.match(
  dashboardSource,
  /caseLibraryHeadingRef\.current[\s\S]*focus\(\{ preventScroll: true \}\)/,
  "focused navigation should move keyboard focus to the selected category heading"
);
assert.match(
  dashboardSource,
  /window\.location\.hash !== "#case-library"/,
  "direct case-library hash visits should use the focused behavior"
);

const focusStart = dashboardSource.indexOf("const focusCaseLibraryCategory");
const focusEnd = dashboardSource.indexOf("const handleCaseLibraryLink", focusStart);
assert.ok(focusStart >= 0 && focusEnd > focusStart);
const focusSource = dashboardSource.slice(focusStart, focusEnd);
assert.doesNotMatch(
  focusSource,
  /setSelectedCategory/,
  "reopening the case library must not reset a manual category selection"
);

for (const source of [
  "desktop_rail",
  "mobile_dashboard_card",
  "desktop_hero",
  "desktop_shortcut",
  "mobile_section_navigator",
  "direct_hash",
]) {
  assert.match(
    dashboardSource,
    new RegExp(`"${source}"`),
    `the ${source} entry point should use focused navigation`
  );
}

for (const eventName of [
  "case_library_category_focused",
  "case_library_category_chooser_opened",
  "case_library_category_chooser_closed",
]) {
  assert.match(dashboardSource, new RegExp(eventName));
}
assert.match(dashboardSource, /matches_recommendation/);
assert.match(dashboardSource, /clampCaseLibraryDifficulty/);
assert.match(dashboardSource, /preserveScroll: false/);

assert.match(navigatorSource, /onNavigate/);
assert.match(navigatorSource, /onNavigate\?\.\(section\)/);
assert.match(
  dashboardSource,
  /<MobileSectionNavigator[\s\S]*onNavigate=\{\(section\)[\s\S]*section\.key === "library"/
);

assert.match(globalsSource, /\.arena-case-library-zoom/);
assert.match(globalsSource, /@keyframes arena-case-library-zoom/);
assert.match(
  globalsSource,
  /@media \(prefers-reduced-motion: reduce\)[\s\S]*\.arena-case-library-zoom/
);

console.log("Case library focus tests passed.");
