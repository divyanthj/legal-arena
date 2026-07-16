import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");
const [providerSource, workspaceSource] = await Promise.all([
  read("../components/NavigationLoadingProvider.js"),
  read("../components/legal-arena/CaseWorkspace.js"),
]);

assert.match(providerSource, /minimumVisibleMs/);
assert.match(providerSource, /minimumVisibleUntilRef/);
assert.match(providerSource, /remainingMinimumMs/);
assert.match(
  workspaceSource,
  /previousStage === "intake" && currentWorkspaceStage === "courtroom"[\s\S]*Convening the court/
);
assert.match(
  workspaceSource,
  /previousStage === "intake" && currentWorkspaceStage === "settlement"[\s\S]*Opening settlement talks/
);
assert.match(
  workspaceSource,
  /previousStage === "settlement" && currentWorkspaceStage === "intake"[\s\S]*Returning to client intake/
);
assert.match(
  workspaceSource,
  /previousStage === "settlement" && currentWorkspaceStage === "courtroom"[\s\S]*Convening the court/
);
assert.match(
  workspaceSource,
  /const handleFinalize = async[\s\S]*startNavigationLoading\("Convening the court"[\s\S]*stopNavigationLoading/
);
assert.match(workspaceSource, /startNavigationLoading\("Opening settlement talks"/);
assert.match(workspaceSource, /startNavigationLoading\("Returning to client intake"/);

console.log("Stage transition loading tests passed.");
