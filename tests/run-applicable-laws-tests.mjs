import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import {
  DEFAULT_LAW_SOURCE,
  normalizeLawSource,
  resolveLawSource,
} from "../libs/game/lawSource.js";
import { pickRuleMentions } from "../libs/game/lawbookCitation.js";

assert.equal(DEFAULT_LAW_SOURCE, "rulebook");
assert.equal(normalizeLawSource("REAL"), "real");
assert.equal(normalizeLawSource("arena"), "");
assert.equal(resolveLawSource("unknown"), "rulebook");

assert.deepEqual(
  pickRuleMentions("Section 44 of the Housing Act applies.", [
    {
      id: "real:abc",
      title: "Section 44 — Housing Act",
      citation: "Housing Act, Section 44",
      provisionLabel: "Section 44",
      instrumentTitle: "Housing Act",
      tags: [],
    },
  ]),
  ["real:abc"]
);

const files = await Promise.all(
  [
    "../components/legal-arena/LawSourceToggle.js",
    "../components/legal-arena/CaseWorkspace.js",
    "../components/legal-arena/DashboardHub.js",
    "../components/legal-arena/ChallengeButton.js",
    "../libs/game/applicableLaws.js",
    "../models/CaseSession.js",
    "../models/Challenge.js",
  ].map((path) => readFile(new URL(path, import.meta.url), "utf8"))
);
const [
  toggle,
  workspace,
  dashboard,
  challengeButton,
  service,
  soloModel,
  challengeModel,
] = files;

assert.match(toggle, /Use real laws/);
assert.match(toggle, /className="checkbox checkbox-warning shrink-0"/);
assert.doesNotMatch(toggle, /className="toggle /);
assert.doesNotMatch(toggle, /Arena mode/i);
assert.match(workspace, /Applicable laws/);
assert.match(workspace, /Open official source/);
assert.match(workspace, /const applicableLawSnippet = \(\) =>/);
assert.match(workspace, /caseSession\.lawSource === "real"/);
assert.match(workspace, /applicableLaws\.find\(\(item\) => item\?\.sourceType === "real"\)/);
assert.match(workspace, /"Cite applicable law" : "Cite lawbook"/);
assert.match(workspace, /Favors point/);
assert.match(workspace, /Challenges point/);
assert.match(workspace, /Mixed effect/);
assert.match(workspace, /getLawEffectForFactSheetPoint/);
assert.match(workspace, /group\/point/);
assert.match(workspace, /getApplicableLawsForFactSheetPoint/);
assert.match(workspace, /requiredPoints: 1/);
assert.match(workspace, /distinctLaws: distinctLawIds\.size/);
assert.match(workspace, /metrics\.distinctLaws > 0/);
assert.match(
  workspace,
  /Distinct applicable laws \/ points they apply to/
);
assert.match(workspace, /fact-sheet-law-coverage-tooltip/);
assert.match(workspace, /"applicable_laws_opened"/);
assert.match(workspace, /"applicable_law_opened"/);
assert.match(workspace, /"applicable_law_source_opened"/);
assert.match(workspace, /applicableLawAnalyticsParams/);
assert.match(workspace, /law_source: caseSession\.lawSource \|\| "rulebook"/);
assert.match(workspace, /surface: "fact_sheet_point"/);
assert.match(workspace, /layout: "desktop"/);
assert.match(workspace, /layout: "mobile"/);
assert.match(dashboard, /"case_law_source_selected"/);
assert.match(dashboard, /law_source: caseSession\.lawSource \|\| selectedLawSource/);
assert.match(challengeButton, /"pvp_law_source_selected"/);
assert.match(challengeButton, /law_source: response\.challenge\.lawSource \|\| selectedLawSource/);
assert.match(
  workspace,
  /\(\{pointLaws\.length\} applicable/
);
assert.ok(
  workspace.indexOf("const applicableLaws =") >
    workspace.indexOf("const isCourtroom ="),
  "applicable laws must not read isCourtroom before it is initialized"
);
assert.match(service, /Never use hidden facts/);
assert.match(service, /factSheetReferences/);
assert.match(service, /effect: "supports\|undermines\|context"/);
assert.match(service, /effectSummary: "short plain-language explanation"/);
assert.match(service, /representedSide/);
assert.match(service, /exact visible fact-sheet point text/);
assert.match(service, /validateSourceUrl/);
assert.match(service, /wordingAppearsInSource/);
assert.match(soloModel, /lockedApplicableLaws/);
assert.match(challengeModel, /applicableLaws/);

console.log("Applicable laws tests passed");
