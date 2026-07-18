import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  resolveSoloGameplayAccessDecision,
  resolveTimedSoloCampaignStatus,
  resolveTimedSoloLoginEnrollment,
} from "../libs/freeGameplayCampaignAccess.js";

const now = new Date("2026-07-18T12:00:00.000Z");
const fixed = {
  enabled: true,
  mode: "fixed_window",
  startsAt: "2026-07-18T10:00:00.000Z",
  endsAt: "2026-07-18T14:00:00.000Z",
};
const rolling = {
  enabled: true,
  mode: "after_login",
  durationHours: 3,
  campaignId: "campaign-2",
  launchedAt: "2026-07-18T10:00:00.000Z",
};

assert.equal(resolveTimedSoloCampaignStatus(fixed, now).state, "active");
assert.equal(
  resolveTimedSoloCampaignStatus({
    ...fixed,
    startsAt: "2026-07-19T10:00:00.000Z",
    endsAt: "2026-07-19T14:00:00.000Z",
  }, now).state,
  "scheduled"
);
assert.equal(
  resolveTimedSoloCampaignStatus({ ...fixed, endsAt: now.toISOString() }, now).state,
  "expired"
);
assert.equal(
  resolveTimedSoloCampaignStatus({ ...fixed, startsAt: fixed.endsAt }, now).state,
  "invalid"
);
assert.equal(resolveTimedSoloCampaignStatus(rolling, now).state, "active");
assert.equal(
  resolveTimedSoloCampaignStatus({ ...rolling, campaignId: "" }, now).state,
  "not_launched"
);

const rollingStatus = resolveTimedSoloCampaignStatus(rolling, now);
const firstEnrollment = resolveTimedSoloLoginEnrollment({
  campaignStatus: rollingStatus,
  loginAtInput: now,
});
assert.equal(firstEnrollment.campaignId, rolling.campaignId);
assert.equal(firstEnrollment.startedAt.toISOString(), now.toISOString());
assert.equal(firstEnrollment.endsAt.toISOString(), "2026-07-18T15:00:00.000Z");
const repeatedEnrollment = resolveTimedSoloLoginEnrollment({
  campaignStatus: rollingStatus,
  currentAccess: firstEnrollment,
  loginAtInput: new Date("2026-07-18T13:00:00.000Z"),
});
assert.strictEqual(repeatedEnrollment, firstEnrollment);
assert.equal(
  resolveTimedSoloLoginEnrollment({
    campaignStatus: rollingStatus,
    loginAtInput: new Date("2026-07-18T09:59:59.000Z"),
  }),
  null
);
const relaunchedStatus = resolveTimedSoloCampaignStatus(
  { ...rolling, campaignId: "campaign-3" },
  now
);
assert.equal(
  resolveTimedSoloLoginEnrollment({
    campaignStatus: relaunchedStatus,
    currentAccess: firstEnrollment,
    loginAtInput: now,
  }).campaignId,
  "campaign-3"
);
assert.equal(
  resolveTimedSoloLoginEnrollment({
    campaignStatus: rollingStatus,
    hasFullAccess: true,
    loginAtInput: now,
  }),
  null
);

assert.equal(
  resolveSoloGameplayAccessDecision({
    timedCampaignStatus: resolveTimedSoloCampaignStatus(fixed, now),
    nowInput: now,
  }).reason,
  "active_timed_fixed_window"
);
assert.equal(
  resolveSoloGameplayAccessDecision({
    timedCampaignStatus: resolveTimedSoloCampaignStatus(rolling, now),
    timedCampaignAccess: {
      campaignId: rolling.campaignId,
      endsAt: "2026-07-18T13:00:00.000Z",
    },
    nowInput: now,
  }).reason,
  "active_timed_after_login"
);
assert.equal(
  resolveSoloGameplayAccessDecision({
    timedCampaignStatus: resolveTimedSoloCampaignStatus(rolling, now),
    timedCampaignAccess: {
      campaignId: rolling.campaignId,
      endsAt: now.toISOString(),
    },
    nowInput: now,
  }).reason,
  "timed_after_login_expired"
);
assert.equal(
  resolveSoloGameplayAccessDecision({
    timedCampaignStatus: resolveTimedSoloCampaignStatus(
      { ...rolling, enabled: false },
      now
    ),
    timedCampaignAccess: {
      campaignId: rolling.campaignId,
      endsAt: "2026-07-19T13:00:00.000Z",
    },
    nowInput: now,
  }).reason,
  "timed_campaign_inactive"
);
assert.equal(
  resolveSoloGameplayAccessDecision({
    timedCampaignStatus: resolveTimedSoloCampaignStatus(rolling, now),
    timedCampaignAccess: {
      campaignId: rolling.campaignId,
      endsAt: now.toISOString(),
    },
    campaignStatus: { active: true, state: "active", campaign: {} },
    progression: { completedCases: 0 },
    nowInput: now,
  }).reason,
  "active_free_campaign"
);

const [adminOps, adminAccess, auth, userModel, adminUi, launchRoute, disableRoute] = await Promise.all([
  readFile(new URL("../libs/adminOps.js", import.meta.url), "utf8"),
  readFile(new URL("../libs/admin.js", import.meta.url), "utf8"),
  readFile(new URL("../libs/next-auth.js", import.meta.url), "utf8"),
  readFile(new URL("../models/User.js", import.meta.url), "utf8"),
  readFile(new URL("../components/legal-arena/AdminCaseLab.js", import.meta.url), "utf8"),
  readFile(new URL("../app/api/admin/timed-solo-campaign/launch/route.js", import.meta.url), "utf8"),
  readFile(new URL("../app/api/admin/timed-solo-campaign/route.js", import.meta.url), "utf8"),
]);

assert.match(adminOps, /DEFAULT_TIMED_SOLO_CAMPAIGN/);
assert.match(adminOps, /crypto\.randomUUID\(\)/);
assert.match(adminOps, /Campaign identity is only changed by the dedicated launch operation/);
assert.match(adminAccess, /recordTimedSoloCampaignLogin/);
assert.match(adminAccess, /timedSoloCampaignAccess\.campaignId/);
assert.match(auth, /events:\s*\{[\s\S]*signIn:/);
assert.match(userModel, /timedSoloCampaignAccess:/);
assert.match(adminUi, /Unlimited solo access/);
assert.match(adminUi, /Launch New Campaign/);
assert.match(adminUi, /Timed campaigns/);
assert.match(adminUi, /Disable Now/);
assert.match(launchRoute, /requireAdminSession/);
assert.match(launchRoute, /launchTimedSoloCampaign/);
assert.match(disableRoute, /requireAdminSession/);
assert.match(disableRoute, /disableTimedSoloCampaign/);
assert.match(adminOps, /timedSoloCampaign\.enabled": false/);

console.log("Timed solo campaign tests passed");
