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
  courtroomRoute,
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
  read("../app/api/cases/[caseId]/courtroom/route.js"),
]);
const globalsCss = await read("../app/globals.css");

assert.match(userModel, /soloTrial:\s*\{/);
assert.match(userModel, /enum: \["available", "active", "resolved"\]/);
assert.match(caseModel, /continuationOfCaseId/);
assert.match(caseModel, /continuationTeaserKey/);
assert.match(caseModel, /newcomerAssist:\s*\{/);
assert.match(caseModel, /partialFilterExpression/);
assert.match(casesRoute, /claimEvergreenSoloTrial/);
assert.match(casesRoute, /access\.requiresTrialClaim \? 1/);
assert.match(casesRoute, /newcomerAssist: Boolean\(access\.requiresTrialClaim\)/);
assert.match(casesRoute, /CaseSession\.exists/);
assert.match(courtroomRoute, /!access\.hasArenaAccess/);
assert.match(courtroomRoute, /access\.soloTrial\?\.caseSessionId/);
assert.match(courtroomRoute, /caseSession\.newcomerAssist = true/);
assert.match(courtroomRoute, /courtroomEvent:\s*\{/);
assert.match(courtroomRoute, /adjournmentGranted: Boolean\(automaticAdjournment\?\.granted\)/);

assert.match(nextRoute, /getFullArenaAccessForSession/);
assert.match(nextRoute, /\["verdict", "settled"\]/);
assert.match(nextRoute, /continuationOfCaseId: sourceCase\._id/);
assert.match(nextRoute, /buildNextCaseTeaser/);
assert.match(nextRoute, /continuationTeaserKey: teaser\.key/);
assert.match(nextRoute, /scenarioHint: buildTeaserScenarioHint\(teaser\)/);
assert.match(nextRoute, /categorySlug: recommendation\.categorySlug/);
assert.match(nextRoute, /complexity: recommendation\.complexity/);
assert.match(nextRoute, /countryCode: sourceCase\.caseCountry\?\.code/);

assert.match(dashboard, /Start Your Free Case/);
assert.match(dashboard, /Continue Your Free Case/);
assert.match(dashboard, /Your free case is ready\./);
assert.match(dashboard, /free_trial_confirmation_viewed/);
assert.match(dashboard, /free_trial_confirmation_purchase_clicked/);
assert.match(dashboard, /Prefer unlimited access\?/);
assert.match(dashboard, /Buy lifetime access for/);
assert.match(dashboard, /freeTrialConfirmed: true/);
assert.match(dashboard, /Start My Free Case/);
assert.ok(
  dashboard.indexOf("Start My Free Case") <
    dashboard.indexOf("Prefer unlimited access?"),
  "The free-case action must precede the paid alternative in DOM and keyboard order."
);
assert.match(landingPage, /Play 1 Case Free/);
assert.match(landingPage, /const SHOW_HEADLINES_LAUNCH_BANNER = false;/);
assert.match(landingPage, /New category — Headlines/);
assert.match(landingPage, /data-landing-source="headlines_launch_banner"/);
assert.match(landingPage, /<NewspaperIcon className="h-5 w-5"/);
assert.doesNotMatch(landingPage, /Your first case is now free to play\./);
assert.doesNotMatch(landingPage, /evergreen_free_case_banner/);
assert.match(nextCard, /Take Recommended Case/);
assert.match(nextCard, /Unlock This Case/);
assert.match(nextCard, /setTeaser\(response\?\.teaser/);
assert.match(nextCard, /Your next matter is ready/);
assert.match(nextCard, /post-resolution-card__layout/);
assert.match(
  caseWorkspace,
  /className="arena-resolution-screen mx-auto w-full max-w-\[1600px\] space-y-4"/
);
assert.match(
  caseWorkspace,
  /className=\{`arena-resolution-screen arena-surface overflow-hidden border/
);
assert.match(
  globalsCss,
  /\.arena-resolution-screen \{[\s\S]*text-shadow: 0 0 7px rgba\(255, 255, 255, 0\.075\);/
);
assert.match(
  globalsCss,
  /\.arena-resolution-screen \.text-black \{[\s\S]*text-shadow: none;/
);
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
