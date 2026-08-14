import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  INDEPENDENCE_DAY_PROMO,
  getActiveIndependenceDayDiscountCode,
  getDiscountedPrice,
  isIndependenceDayPromoActive,
} from "../libs/independenceDayPromo.js";

assert.equal(INDEPENDENCE_DAY_PROMO.code, "INDIA");
assert.equal(INDEPENDENCE_DAY_PROMO.discountPercent, 25);
assert.equal(INDEPENDENCE_DAY_PROMO.endsAt, "2026-08-17T23:59:00.000Z");

assert.equal(
  isIndependenceDayPromoActive(new Date("2026-08-17T23:58:59.999Z")),
  true
);
assert.equal(
  isIndependenceDayPromoActive(new Date("2026-08-17T23:59:00.000Z")),
  false
);
assert.equal(
  getActiveIndependenceDayDiscountCode(new Date("2026-08-17T23:58:00.000Z")),
  "INDIA"
);
assert.equal(
  getActiveIndependenceDayDiscountCode(new Date("2026-08-18T00:00:00.000Z")),
  null
);
assert.equal(getDiscountedPrice(15.99), 11.99);

const landingPageSource = await readFile(
  new URL("../app/page.js", import.meta.url),
  "utf8"
);
const checkoutRouteSource = await readFile(
  new URL("../app/api/lemonsqueezy/create-checkout/route.js", import.meta.url),
  "utf8"
);
const paywallSource = await readFile(
  new URL("../components/legal-arena/DevelopmentAccessGate.js", import.meta.url),
  "utf8"
);
const configSource = await readFile(
  new URL("../config.js", import.meta.url),
  "utf8"
);
const promoBannerSource = await readFile(
  new URL("../components/legal-arena/IndependenceDayPromoBanner.js", import.meta.url),
  "utf8"
);

assert.match(landingPageSource, /IndependenceDayPromoBanner/);
assert.doesNotMatch(landingPageSource, /Brand new UI/);
assert.match(landingPageSource, /WhatsNewDialog/);
assert.match(promoBannerSource, /Happy Independence Day, India!/);
assert.match(promoBannerSource, /25% off/);
assert.match(promoBannerSource, />\s*INDIA\s*</);
assert.match(promoBannerSource, /Ends Aug 17, 23:59 UTC/);
assert.match(promoBannerSource, /India Independence Day offer/);
assert.doesNotMatch(promoBannerSource, /Sale ends in|window\.setInterval|30% off/);
assert.match(checkoutRouteSource, /getActiveIndependenceDayDiscountCode/);
assert.match(
  checkoutRouteSource,
  /discountCode: getActiveIndependenceDayDiscountCode\(\) \|\| undefined/
);
assert.match(paywallSource, /Build your legal career/);
assert.match(paywallSource, /Unlock the full Legal Arena\./);
assert.match(
  paywallSource,
  /Take on unlimited AI-generated disputes[\s\S]*challenge other players in PVP\./
);
assert.match(paywallSource, /One-time purchase\. No subscription\./);
assert.match(
  paywallSource,
  /Unlock the Full Game — \$\{[\s\S]*promoActive \? promoPrice : currentPrice/
);
assert.match(
  paywallSource,
  /One-time payment · Secure checkout through Lemon Squeezy/
);
assert.match(paywallSource, /<HeroIcons\.CheckIcon/);
assert.match(
  paywallSource,
  /India Independence Day offer: get 25% off the full game\. Use code\s+INDIA at checkout by August 17, 23:59 UTC\./
);
assert.doesNotMatch(paywallSource, /early-access build/i);
assert.doesNotMatch(paywallSource, /lifetime access/i);
assert.doesNotMatch(paywallSource, /every future update/i);
assert.match(
  paywallSource,
  /Legal Arena is still growing\. Your purchase includes the complete game[\s\S]*gameplay updates released during early access\./
);
assert.match(paywallSource, /const PAYWALL_COPY_VERSION = "experience_v2"/);
assert.match(paywallSource, /early_access_paywall_page_viewed/);
assert.match(paywallSource, /paywall_copy_version: PAYWALL_COPY_VERSION/);
assert.match(
  configSource,
  /Unlimited AI-generated solo cases across multiple areas of law[\s\S]*Client interviews, case preparation, and courtroom arguments[\s\S]*PVP cases judged by AI[\s\S]*Rankings, XP, awards, and progression[\s\S]*Future gameplay updates released during early access/
);
assert.doesNotMatch(
  configSource,
  /Immediate access to the full Legal Arena build|All future early-access updates included/
);
assert.doesNotMatch(paywallSource, /auto-applies/);
assert.match(paywallSource, /setPromoActive\(isIndependenceDayPromoActive\(\)\)/);

console.log("Independence Day promo tests passed");
