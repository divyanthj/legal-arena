import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");
const [openingSource, finalizeSource, courtroomRouteSource, casePageSource] =
  await Promise.all([
    read("../libs/game/courtroomOpening.js"),
    read("../app/api/cases/[caseId]/finalize/route.js"),
    read("../app/api/cases/[caseId]/courtroom/route.js"),
    read("../app/dashboard/cases/[caseId]/page.js"),
  ]);

assert.match(
  openingSource,
  /status === "courtroom"[\s\S]*getPlayerSide\(caseSession\) === "opponent"[\s\S]*roundsCompleted[\s\S]*transcript\.length === 0/
);
assert.match(openingSource, /generatePlaintiffCourtOpeningStatement/);
assert.match(openingSource, /buildFallbackPlaintiffOpening/);
assert.match(
  openingSource,
  /round: 1[\s\S]*speaker: "opponent"[\s\S]*The plaintiff has opened the case\. The defense may respond\./
);
assert.match(finalizeSource, /ensurePlaintiffCourtOpening/);
assert.match(courtroomRouteSource, /ensurePlaintiffCourtOpening/);
assert.match(
  casePageSource,
  /getCaseSessionDocumentForUser[\s\S]*ensurePlaintiffCourtOpening[\s\S]*caseDocument\.save\(\)/
);

console.log("Courtroom opening tests passed.");
