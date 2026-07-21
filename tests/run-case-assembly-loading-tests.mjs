import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  CASE_ASSEMBLY_STAGES,
  buildCaseAssemblyBrief,
  buildCaseAssemblyPreview,
  getCaseAssemblyStageState,
} from "../libs/caseAssemblyCore.mjs";

assert.deepEqual(
  CASE_ASSEMBLY_STAGES.map((stage) => stage.key),
  ["brief", "draft", "dossier", "portraits", "opening"]
);

assert.deepEqual(
  CASE_ASSEMBLY_STAGES.map((stage) => getCaseAssemblyStageState(stage.key, "generating")),
  ["complete", "active", "upcoming", "upcoming", "upcoming"]
);
assert.deepEqual(
  CASE_ASSEMBLY_STAGES.map((stage) => getCaseAssemblyStageState(stage.key, "portraits")),
  ["complete", "complete", "complete", "active", "upcoming"]
);
assert.deepEqual(
  CASE_ASSEMBLY_STAGES.map((stage) => getCaseAssemblyStageState(stage.key, "opening")),
  ["complete", "complete", "complete", "complete", "active"]
);
assert.equal(getCaseAssemblyStageState("draft", "error"), "error");

assert.deepEqual(
  buildCaseAssemblyBrief({
    mode: "dynamic",
    categorySlug: "contract-violation",
    categoryTitle: "Contract Violation",
    difficultyLabel: "Level 2 - Beginner",
    countryName: "India",
  }),
  {
    mode: "dynamic",
    categorySlug: "contract-violation",
    categoryTitle: "Contract Violation",
    difficultyLabel: "Level 2 - Beginner",
    countryName: "India",
    templateTitle: "",
  }
);
assert.equal(buildCaseAssemblyBrief({ mode: "template" }).mode, "template");

const preview = buildCaseAssemblyPreview({
  id: "case-1",
  title: "Morgan v. Northstar",
  playerSideLabel: "Plaintiff",
  playerPartyName: "Alex Morgan",
  opponentPartyName: "Northstar Renovations",
  playerInterviewSubjectName: "Alex Morgan",
  premise: {
    courtName: "District Civil Court",
    desiredRelief: "Recover the unpaid contract balance.",
    hiddenTruth: "must never be exposed",
  },
  canonicalStory: { hiddenFact: "secret admission" },
  factSheet: { disputedFacts: ["private discovery"] },
  interviewTranscript: [{ text: "raw transcript" }],
  template: { canonicalFacts: [{ detail: "hidden evidence" }] },
});

assert.equal(preview.clientName, "Alex Morgan");
assert.equal(preview.opponentName, "Northstar Renovations");
assert.equal(preview.objective, "Recover the unpaid contract balance.");
assert.doesNotMatch(
  JSON.stringify(preview),
  /hiddenTruth|secret admission|private discovery|raw transcript|hidden evidence/
);

const dashboardSource = await readFile(
  new URL("../components/legal-arena/DashboardHub.js", import.meta.url),
  "utf8"
);
const workspaceSource = await readFile(
  new URL("../components/legal-arena/CaseWorkspace.js", import.meta.url),
  "utf8"
);
const portraitRouteSource = await readFile(
  new URL("../app/api/cases/[caseId]/client-portrait/route.js", import.meta.url),
  "utf8"
);
const challengePortraitRouteSource = await readFile(
  new URL("../app/api/challenges/[challengeId]/client-portrait/route.js", import.meta.url),
  "utf8"
);
const createStart = dashboardSource.indexOf("const handleCreateCase");
const createEnd = dashboardSource.indexOf("const retryCaseAssembly", createStart);
const createSource = dashboardSource.slice(createStart, createEnd);
assert.match(createSource, /status: "generating"/);
assert.match(createSource, /status: "portraits"/);
assert.match(createSource, /status: "opening"/);
assert.match(createSource, /`\/cases\/\$\{caseRef\}\/client-portrait`/);
assert.match(createSource, /client: \{ status: "generating", image: "" \}/);
assert.match(createSource, /client: \{ status: "complete", image: clientPortraitImage \}/);
assert.match(createSource, /portraits_background: false/);
assert.doesNotMatch(createSource, /await Promise\.all\(\[\s*generatePortrait/);
assert.ok(
  createSource.indexOf("router.push(caseHref)") >
    createSource.indexOf('trackGoal("case_creation_wait_completed"'),
  "case creation should navigate only after recording the portrait generation wait"
);
assert.ok(
  createSource.indexOf("router.prefetch(caseHref)") >
    createSource.indexOf("portraitCompletedAt"),
  "intake must not be prefetched before the saved portrait is available"
);
assert.doesNotMatch(createSource, /startNavigationLoading\(/);

assert.match(workspaceSource, /const keepNewestPortrait = \(currentPortrait = \{\}, incomingPortrait = \{\}\) =>/);
assert.match(workspaceSource, /clientPortrait: keepNewestPortrait\(current\.clientPortrait, nextCase\.clientPortrait\)/);
assert.doesNotMatch(workspaceSource, /requestCasePortraitOnce/);
assert.doesNotMatch(workspaceSource, /portrait_background_completed/);

assert.match(portraitRouteSource, /OPENAI_PORTRAIT_IMAGE_MODEL/);
assert.match(portraitRouteSource, /OPENAI_PORTRAIT_IMAGE_QUALITY/);
assert.match(portraitRouteSource, /"gpt-image-2"/);
assert.match(portraitRouteSource, /\["low", "medium", "high"\]\.includes/);
assert.match(portraitRouteSource, /quality: IMAGE_QUALITY/);
assert.match(portraitRouteSource, /const IMAGE_SIZE = IMAGE_MODEL === "gpt-image-2" \? "816x816" : "1024x1024"/);
assert.match(portraitRouteSource, /size: IMAGE_SIZE/);
assert.match(portraitRouteSource, /const PORTRAIT_WIDTH = 256/);
assert.match(portraitRouteSource, /const PORTRAIT_HEIGHT = 288/);
assert.match(portraitRouteSource, /const PORTRAIT_OUTPUT_QUALITY = 58/);
assert.match(portraitRouteSource, /Keep rendering detail moderate/);
assert.match(challengePortraitRouteSource, /OPENAI_PORTRAIT_IMAGE_QUALITY/);
assert.match(challengePortraitRouteSource, /OPENAI_PORTRAIT_IMAGE_MODEL/);
assert.match(challengePortraitRouteSource, /"gpt-image-2"/);
assert.match(challengePortraitRouteSource, /quality: IMAGE_QUALITY/);
assert.match(challengePortraitRouteSource, /const IMAGE_SIZE = IMAGE_MODEL === "gpt-image-2" \? "816x816" : "1024x1024"/);
assert.match(challengePortraitRouteSource, /size: IMAGE_SIZE/);
assert.match(challengePortraitRouteSource, /const PORTRAIT_WIDTH = 256/);
assert.match(challengePortraitRouteSource, /const PORTRAIT_HEIGHT = 288/);
assert.match(challengePortraitRouteSource, /const PORTRAIT_OUTPUT_QUALITY = 58/);
assert.match(challengePortraitRouteSource, /Keep rendering detail moderate/);
assert.match(portraitRouteSource, /useCache: true/);
assert.match(portraitRouteSource, /private, max-age=31536000, immutable/);
assert.match(portraitRouteSource, /generationMs:/);
assert.match(portraitRouteSource, /resizeMs:/);
assert.match(portraitRouteSource, /storageMs:/);
assert.match(portraitRouteSource, /persistenceMs:/);
assert.match(portraitRouteSource, /portrait: \{/);
const activationReturnStart = dashboardSource.indexOf("if (useActivationDashboard)");
const activationReturnEnd = dashboardSource.indexOf(
  '<main className="arena-app-shell min-h-screen overflow-x-hidden',
  activationReturnStart
);
const activationBranch = dashboardSource.slice(activationReturnStart, activationReturnEnd);
assert.match(
  activationBranch,
  /<CaseAssemblyOverlay/,
  "the active dashboard render branch must mount the assembly overlay"
);

const overlaySource = await readFile(
  new URL("../components/legal-arena/CaseAssemblyOverlay.js", import.meta.url),
  "utf8"
);
assert.match(overlaySource, /Usually about 1–2 minutes/);
assert.match(overlaySource, /elapsedMs >= 120000/);
assert.match(overlaySource, /aria-live="polite"/);
assert.match(overlaySource, /Retry case assembly/);
assert.match(overlaySource, /Portrait unavailable/);

console.log("Case assembly loading tests passed.");
