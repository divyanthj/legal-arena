import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");

const [
  userModel,
  caseModel,
  casesRoute,
  nextRoute,
  dashboard,
  landingPage,
  nextCard,
  caseWorkspace,
  purchaseSuccess,
  adminAccess,
] = await Promise.all([
  read("../models/User.js"),
  read("../models/CaseSession.js"),
  read("../app/api/cases/route.js"),
  read("../app/api/cases/next/route.js"),
  read("../components/legal-arena/DashboardHub.js"),
  read("../app/page.js"),
  read("../components/legal-arena/PostResolutionNextCaseCard.js"),
  read("../components/legal-arena/CaseWorkspace.js"),
  read("../app/purchase-success/PurchaseSuccessRedirect.js"),
  read("../libs/admin.js"),
]);

assert.match(userModel, /soloTrial:\s*\{/);
assert.match(userModel, /enum: \["available", "active", "resolved"\]/);
assert.match(caseModel, /continuationOfCaseId/);
assert.match(caseModel, /partialFilterExpression/);
assert.match(casesRoute, /claimEvergreenSoloTrial/);
assert.match(casesRoute, /access\.requiresTrialClaim \? 1/);
assert.match(casesRoute, /CaseSession\.exists/);

assert.match(nextRoute, /getFullArenaAccessForSession/);
assert.match(nextRoute, /\["verdict", "settled"\]/);
assert.match(nextRoute, /continuationOfCaseId: sourceCase\._id/);
assert.match(nextRoute, /categorySlug: sourceCase\.primaryCategory/);
assert.match(nextRoute, /countryCode: sourceCase\.caseCountry\?\.code/);

assert.match(dashboard, /Start Your Free Case/);
assert.match(dashboard, /Continue Your Free Case/);
assert.match(dashboard, /Use your one free case\?/);
assert.match(dashboard, /free_trial_confirmation_viewed/);
assert.match(dashboard, /free_trial_confirmation_purchase_clicked/);
assert.match(dashboard, /Unlock Unlimited —/);
assert.match(dashboard, /freeTrialConfirmed: true/);
assert.match(dashboard, /Once it is successfully created, your free-case allowance is used/);
assert.match(landingPage, /Your first case is now free to play\./);
assert.match(landingPage, /Play Your Free Case/);
assert.match(landingPage, /Play 1 Case Free/);
assert.match(landingPage, /evergreen_free_case_banner/);
assert.match(landingPage, /<GiftIcon className="h-5 w-5"/);
assert.match(nextCard, /Fight the Next Case/);
assert.match(nextCard, /Unlock Unlimited/);
assert.match(nextCard, /post-resolution-card__layout/);
assert.match(nextCard, /continuationCaseId=\{sourceCaseId\}/);
assert.match(nextCard, /caseSession\?\.settlement\?\.accepted === true/);
assert.match(
  caseWorkspace,
  /if \(hasReachedSettlement\)[\s\S]*Settlement Complete[\s\S]*PostResolutionNextCaseCard[\s\S]*Final Agreement/
);
assert.match(purchaseSuccess, /searchParams\.get\("nextFrom"\)/);
assert.match(purchaseSuccess, /apiClient\.get\("\/arena\/access"/);
assert.match(purchaseSuccess, /apiClient\.post\([\s\S]*"\/cases\/next"/);
assert.match(adminAccess, /const getSoloTrialResolution = \(caseSession = \{\}\) => \{[\s\S]*if \(!caseSession\) return "";/);

console.log("Free trial funnel tests passed.");
