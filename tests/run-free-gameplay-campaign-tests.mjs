import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  resolveSoloGameplayAccessDecision,
} from "../libs/freeGameplayCampaignAccess.js";

const activeCampaign = {
  active: true,
  state: "active",
  campaign: {
    startsAt: "2026-06-01T00:00:00.000Z",
    endsAt: "2026-06-08T00:00:00.000Z",
  },
};

const expiredCampaign = {
  active: false,
  state: "expired",
  campaign: {
    startsAt: "2026-06-01T00:00:00.000Z",
    endsAt: "2026-06-02T00:00:00.000Z",
  },
};

assert.equal(
  resolveSoloGameplayAccessDecision({ hasFullAccess: true }).reason,
  "full_access"
);

assert.deepEqual(
  resolveSoloGameplayAccessDecision({
    action: "create",
    soloTrial: { state: "available" },
  }),
  {
    allowed: true,
    reason: "evergreen_trial_available",
    hasArenaAccess: false,
    trialState: "available",
    requiresTrialClaim: true,
  }
);

assert.equal(
  resolveSoloGameplayAccessDecision({
    action: "play",
    soloTrial: { state: "active", caseSessionId: "case-1" },
    caseSession: { _id: "case-1", status: "interview" },
  }).reason,
  "evergreen_trial_continuation"
);

assert.equal(
  resolveSoloGameplayAccessDecision({
    action: "create",
    soloTrial: { state: "active", caseSessionId: "case-1" },
  }).upgradeRequired,
  true
);

assert.equal(
  resolveSoloGameplayAccessDecision({
    action: "create",
    progression: { completedCases: 1 },
    soloTrial: { state: "resolved", caseSessionId: "case-1" },
  }).reason,
  "free_verdict_completed"
);

assert.equal(
  resolveSoloGameplayAccessDecision({
    action: "list",
    soloTrial: { state: "resolved", caseSessionId: "case-1" },
  }).reason,
  "dashboard_read"
);

assert.equal(
  resolveSoloGameplayAccessDecision({
    progression: { completedCases: 0 },
    campaignStatus: activeCampaign,
  }).reason,
  "active_free_campaign"
);

assert.equal(
  resolveSoloGameplayAccessDecision({
    progression: { completedCases: 0 },
    campaignStatus: expiredCampaign,
  }).allowed,
  false
);

assert.equal(
  resolveSoloGameplayAccessDecision({
    progression: { completedCases: 0 },
    campaignStatus: expiredCampaign,
    caseSession: {
      status: "interview",
      freeGameplayCampaignAccess: {
        grantedAt: "2026-06-01T12:00:00.000Z",
      },
    },
  }).reason,
  "campaign_case_continuation"
);

assert.equal(
  resolveSoloGameplayAccessDecision({
    progression: { completedCases: 1 },
    campaignStatus: activeCampaign,
  }).reason,
  "free_verdict_completed"
);

assert.equal(
  resolveSoloGameplayAccessDecision({
    progression: { completedCases: 1 },
    campaignStatus: expiredCampaign,
    action: "read",
    caseSession: { status: "verdict" },
  }).reason,
  "completed_verdict_read"
);

const adminOpsSource = await readFile(
  new URL("../libs/adminOps.js", import.meta.url),
  "utf8"
);
const opsRouteSource = await readFile(
  new URL("../app/api/admin/ops-config/route.js", import.meta.url),
  "utf8"
);
const adminLabSource = await readFile(
  new URL("../components/legal-arena/AdminCaseLab.js", import.meta.url),
  "utf8"
);
const landingPageSource = await readFile(
  new URL("../app/page.js", import.meta.url),
  "utf8"
);
const casesRouteSource = await readFile(
  new URL("../app/api/cases/route.js", import.meta.url),
  "utf8"
);
const courtroomRouteSource = await readFile(
  new URL("../app/api/cases/[caseId]/courtroom/route.js", import.meta.url),
  "utf8"
);

assert.match(adminOpsSource, /DEFAULT_FREE_GAMEPLAY_CAMPAIGN/);
assert.match(adminOpsSource, /export const sanitizeFreeGameplayCampaign/);
assert.match(adminOpsSource, /export const getFreeGameplayCampaignStatus/);
assert.match(adminOpsSource, /export const getActiveFreeGameplayAnnouncement/);
assert.match(opsRouteSource, /freeGameplayCampaign: body\.freeGameplayCampaign/);
assert.match(adminLabSource, /Free Gameplay Campaign/);
assert.match(adminLabSource, /type="datetime-local"/);
assert.match(adminLabSource, /Start Immediately/);
assert.match(adminLabSource, /startFreeGameplayCampaignImmediately/);
assert.match(adminLabSource, /enabled:\s*true/);
assert.match(adminLabSource, /startsAt:\s*now\.toISOString\(\)/);
assert.match(adminLabSource, /FREE_GAMEPLAY_START_NOW_DEFAULT_DAYS\s*=\s*7/);
assert.match(adminLabSource, /getValidFutureCampaignEnd\(current\.endsAt, now\)/);
assert.match(adminLabSource, /announcementEnabled:\s*true/);
assert.match(adminLabSource, /Free solo cases are open/);
assert.match(landingPageSource, /getActiveFreeGameplayAnnouncement/);
assert.match(landingPageSource, /getFreeGameplayCampaignStatus/);
assert.match(landingPageSource, /campaignCtaLabel/);
assert.match(landingPageSource, /freeGameplayAnnouncement\.ctaHref/);
assert.match(casesRouteSource, /getSoloGameplayAccessForSession/);
assert.match(casesRouteSource, /freeGameplayCampaignAccess: access\.freeGameplayCampaignAccess/);
assert.match(courtroomRouteSource, /getSoloGameplayAccessForSession/);
assert.match(casesRouteSource, /claimEvergreenSoloTrial/);
assert.match(casesRouteSource, /access\.requiresTrialClaim \? 1 : body\?\.complexity/);

console.log("Free gameplay campaign tests passed");
