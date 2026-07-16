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
const createStart = dashboardSource.indexOf("const handleCreateCase");
const createEnd = dashboardSource.indexOf("const retryCaseAssembly", createStart);
const createSource = dashboardSource.slice(createStart, createEnd);
assert.match(createSource, /status: "generating"/);
assert.match(createSource, /status: "portraits"/);
assert.match(createSource, /generatePortrait\("client"\)/);
assert.match(createSource, /generatePortrait\("opponent"\)/);
assert.match(createSource, /portrait_failures/);
assert.doesNotMatch(createSource, /startNavigationLoading\(/);
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
