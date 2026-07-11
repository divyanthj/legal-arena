import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const model = await readFile(new URL("../models/BlogPost.js", import.meta.url), "utf8");
assert.match(model, /sourceType: 1, sourceId: 1.*unique: true/s, "one report must be enforced per source");
assert.match(model, /"awaiting_consent".*"generating".*"published".*"failed".*"unpublished"/s);

const user = await readFile(new URL("../models/User.js", import.meta.url), "utf8");
assert.match(user, /autoPublishCaseReports:[\s\S]*?default: false/);
assert.match(user, /allowPortraitInCaseReports:[\s\S]*?default: false/);

const service = await readFile(new URL("../libs/caseReports.js", import.meta.url), "utf8");
assert.match(service, /participantIds\.every/, "PVP generation must require every participant's consent");
assert.match(service, /status = "unpublished"/);
assert.match(service, /access: "private"/, "report images must use the configured private blob store");
assert.match(service, /\/case-report-images\//, "report images must use the public proxy route");
assert.match(service, /allowPortraitInCaseReports && user\.image/);
assert.doesNotMatch(service, /deleteOne|findOneAndDelete/, "source locks must not be deleted");

const reportRoute = await readFile(new URL("../app/api/case-reports/[sourceType]/[sourceId]/route.js", import.meta.url), "utf8");
assert.match(reportRoute, /getRequestSession/);
assert.match(reportRoute, /export async function POST/);
assert.match(reportRoute, /export async function DELETE/);

const articlePage = await readFile(new URL("../app/blog/[articleId]/page.js", import.meta.url), "utf8");
assert.match(articlePage, /getBlogArticle/);
assert.match(articlePage, /article\.dynamic/);
assert.match(articlePage, /force-dynamic/);

console.log("Case report tests passed.");
