import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  getSectionNavigatorActiveIndex,
  isSectionNavigatorLongPage,
  isSectionNavigatorOverlayOpen,
  shouldShowSectionNavigator,
} from "../libs/sectionNavigatorCore.mjs";
import { findVisibleGuidedTarget } from "../libs/guidedInteractionCore.mjs";

assert.equal(
  isSectionNavigatorLongPage({ viewportHeight: 800, scrollHeight: 1199 }),
  false
);
assert.equal(
  isSectionNavigatorLongPage({ viewportHeight: 800, scrollHeight: 1200 }),
  true
);
assert.equal(
  shouldShowSectionNavigator({
    mobile: true,
    sectionCount: 3,
    viewportHeight: 800,
    scrollHeight: 1600,
  }),
  true
);
assert.equal(
  shouldShowSectionNavigator({
    mobile: false,
    sectionCount: 5,
    viewportHeight: 800,
    scrollHeight: 1600,
  }),
  false
);
assert.equal(
  shouldShowSectionNavigator({
    mobile: true,
    modalOpen: true,
    sectionCount: 5,
    viewportHeight: 800,
    scrollHeight: 1600,
  }),
  false
);
assert.equal(
  shouldShowSectionNavigator({
    mobile: true,
    sectionCount: 2,
    viewportHeight: 800,
    scrollHeight: 1600,
  }),
  false
);

assert.equal(
  isSectionNavigatorOverlayOpen({
    rendered: true,
    ariaHidden: "true",
  }),
  false,
  "mounted but aria-hidden dialogs must not suppress the navigator"
);
assert.equal(
  isSectionNavigatorOverlayOpen({
    rendered: true,
    ariaHidden: "false",
  }),
  true,
  "a visible open modal must suppress the navigator"
);
assert.equal(
  isSectionNavigatorOverlayOpen({
    rendered: true,
    tagName: "dialog",
    nativeOpen: false,
  }),
  false,
  "closed native dialogs must not suppress the navigator"
);
assert.equal(
  isSectionNavigatorOverlayOpen({
    rendered: true,
    tagName: "dialog",
    nativeOpen: true,
  }),
  true
);

assert.equal(
  getSectionNavigatorActiveIndex([100, 400, 700], {
    viewportHeight: 800,
    scrollY: 0,
    scrollHeight: 2400,
  }),
  0
);
assert.equal(
  getSectionNavigatorActiveIndex([-500, 100, 500], {
    viewportHeight: 800,
    scrollY: 700,
    scrollHeight: 2400,
  }),
  1
);
assert.equal(
  getSectionNavigatorActiveIndex([-1500, -900, -300, 250], {
    viewportHeight: 800,
    scrollY: 1600,
    scrollHeight: 2400,
  }),
  3
);

{
  const hidden = {
    getAttribute: (name) =>
      name === "data-section-nav-target" ? "directory" : null,
    getBoundingClientRect: () => ({
      width: 0,
      height: 0,
      top: 0,
      bottom: 0,
    }),
  };
  const visible = {
    getAttribute: (name) =>
      name === "data-section-nav-target" ? "directory" : null,
    getBoundingClientRect: () => ({
      width: 300,
      height: 200,
      top: 400,
      bottom: 600,
    }),
  };
  const windowObject = {
    getComputedStyle: () => ({ display: "block", visibility: "visible" }),
  };
  const root = { querySelectorAll: () => [hidden, visible] };
  assert.equal(
    findVisibleGuidedTarget("directory", {
      root,
      windowObject,
      attribute: "data-section-nav-target",
    }),
    visible
  );
}

const [
  navigatorSource,
  dashboardSource,
  workspaceSource,
  profileSource,
  matterSource,
  directorySource,
] = await Promise.all([
  readFile(
    new URL("../components/legal-arena/MobileSectionNavigator.js", import.meta.url),
    "utf8"
  ),
  readFile(new URL("../components/legal-arena/DashboardHub.js", import.meta.url), "utf8"),
  readFile(new URL("../components/legal-arena/CaseWorkspace.js", import.meta.url), "utf8"),
  readFile(
    new URL("../components/legal-arena/PlayerProfileDossier.js", import.meta.url),
    "utf8"
  ),
  readFile(
    new URL("../components/legal-arena/PlayerMatterDossier.js", import.meta.url),
    "utf8"
  ),
  readFile(
    new URL("../components/legal-arena/BarAssociationDirectory.js", import.meta.url),
    "utf8"
  ),
]);

assert.match(navigatorSource, /aria-label="Page sections"/);
assert.match(navigatorSource, /aria-current=\{active \? "location"/);
assert.match(navigatorSource, /bg-white\/45/);
assert.match(navigatorSource, /bg-transparent/);
assert.doesNotMatch(navigatorSource, /bg-black\/55|backdrop-blur-md/);
assert.match(navigatorSource, /pulseHaptic\("selection"/);
assert.match(navigatorSource, /scrollGuidedTarget/);
assert.match(navigatorSource, /OVERLAY_SELECTOR/);
assert.match(navigatorSource, /MutationObserver/);
assert.doesNotMatch(navigatorSource, /history\.|pushState|replaceState|location\.hash/);

for (const target of [
  "dashboard-home",
  "dashboard-pvp",
  "dashboard-library",
  "dashboard-cases",
  "dashboard-rankings",
]) {
  assert.match(dashboardSource, new RegExp(`data-section-nav-target="${target}"`));
}

for (const target of [
  "workspace-overview",
  "intake-interview",
  "workspace-case-file",
  "workspace-lawbook",
  "court-hearing",
  "court-transcript",
  "court-move",
  "settlement-status",
  "settlement-offer",
  "settlement-next-move",
  "settlement-exchanges",
  "settlement-support",
  "verdict-ruling",
  "resolution-inspiration",
  "verdict-report",
  "verdict-performance",
]) {
  assert.match(workspaceSource, new RegExp(`data-section-nav-target="${target}"`));
}
assert.match(workspaceSource, /suspended=\{showIntakeTour \|\| showSettlementTour\}/);

for (const target of [
  "profile-dossier",
  "profile-specialties",
  "profile-performance",
  "profile-cases",
]) {
  assert.match(profileSource, new RegExp(`data-section-nav-target="${target}"`));
}

for (const target of [
  "matter-overview",
  "matter-ruling",
  "matter-snapshot",
  "matter-details",
]) {
  assert.match(matterSource, new RegExp(`data-section-nav-target="${target}"`));
}

for (const target of ["bar-overview", "bar-activity", "bar-directory"]) {
  assert.match(directorySource, new RegExp(`data-section-nav-target="${target}"`));
}

console.log("Mobile section navigator tests passed.");
