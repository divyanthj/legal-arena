import assert from "node:assert/strict";
import {
  addEmailUtmParams,
  trackLegalArenaLinksInHtml,
  trackLegalArenaLinksInText,
} from "../libs/emailTracking.mjs";

const options = { domainName: "legalarena.app", campaign: "Challenge Invite" };
const tracked = new URL(addEmailUtmParams("https://legalarena.app/dashboard?case=42#court", options));
assert.equal(tracked.searchParams.get("case"), "42");
assert.equal(tracked.searchParams.get("utm_source"), "legal_arena");
assert.equal(tracked.searchParams.get("utm_medium"), "email");
assert.equal(tracked.searchParams.get("utm_campaign"), "challenge_invite");
assert.equal(tracked.hash, "#court");

assert.equal(
  addEmailUtmParams("https://example.com/dashboard", options),
  "https://example.com/dashboard"
);
assert.equal(
  addEmailUtmParams("https://legalarena.app/unsubscribe?token=secret", options),
  "https://legalarena.app/unsubscribe?token=secret"
);

const authUrl = new URL(
  addEmailUtmParams(
    "https://legalarena.app/api/auth/callback/email?callbackUrl=https%3A%2F%2Flegalarena.app%2Fdashboard&token=secret",
    options
  )
);
const callbackUrl = new URL(authUrl.searchParams.get("callbackUrl"));
assert.equal(callbackUrl.searchParams.get("utm_campaign"), "challenge_invite");
assert.equal(authUrl.searchParams.get("utm_campaign"), null);

const html = trackLegalArenaLinksInHtml(
  '<a href="https://legalarena.app/blog?topic=law">Read</a><a href="https://example.com">External</a>',
  options
);
assert.match(html, /utm_campaign=challenge_invite/);
assert.match(html, /href="https:\/\/example\.com"/);

const text = trackLegalArenaLinksInText(
  "Open https://legalarena.app/dashboard. External: https://example.com/page.",
  options
);
assert.match(text, /utm_campaign=challenge_invite\./);
assert.match(text, /https:\/\/example\.com\/page\./);

console.log("Email tracking tests passed.");
