import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const dashboardHubSource = await readFile(
  new URL("../components/legal-arena/DashboardHub.js", import.meta.url),
  "utf8"
);

assert.match(
  dashboardHubSource,
  /const desktopFeatureProgress = canContinueDesktopHeroCase \? desktopHeroCaseProgress\.percent : 0;/,
  "New-case desktop hero should start at 0% progress."
);
assert.match(
  dashboardHubSource,
  /const desktopFeatureProgressFill = canContinueDesktopHeroCase\s*\?\s*Math\.max\(8, desktopFeatureProgress\)\s*:\s*0;/,
  "The minimum visible progress fill should apply only to resumable cases."
);
assert.match(
  dashboardHubSource,
  /const desktopFeatureStageCountLabel = canContinueDesktopHeroCase\s*\?\s*`Stage \$\{Math\.max\(1, Math\.round\(desktopFeatureProgress \/ 12\.5\)\)\} of 8`\s*:\s*"Not started";/,
  "New-case desktop hero should not show Stage 1 of 8 before the case starts."
);
assert.doesNotMatch(
  dashboardHubSource,
  /canResumeLastCase \? lastCaseProgress\.percent : 12/,
  "Startable library cards should not show 12% progress before a case exists."
);

console.log("Dashboard progress tests passed");
