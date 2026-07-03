import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  INDEPENDENCE_DAY_PROMO,
  getActiveIndependenceDayDiscountCode,
  getDiscountedPrice,
  isIndependenceDayPromoActive,
} from "../libs/independenceDayPromo.js";

assert.equal(INDEPENDENCE_DAY_PROMO.code, "4THJULY");
assert.equal(INDEPENDENCE_DAY_PROMO.discountPercent, 30);
assert.equal(INDEPENDENCE_DAY_PROMO.endsAt, "2026-07-07T23:59:00.000Z");

assert.equal(
  isIndependenceDayPromoActive(new Date("2026-07-07T23:58:59.999Z")),
  true
);
assert.equal(
  isIndependenceDayPromoActive(new Date("2026-07-07T23:59:00.000Z")),
  false
);
assert.equal(
  getActiveIndependenceDayDiscountCode(new Date("2026-07-07T23:58:00.000Z")),
  "4THJULY"
);
assert.equal(
  getActiveIndependenceDayDiscountCode(new Date("2026-07-08T00:00:00.000Z")),
  null
);
assert.equal(getDiscountedPrice(15.99), 11.19);

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
const promoBannerSource = await readFile(
  new URL("../components/legal-arena/IndependenceDayPromoBanner.js", import.meta.url),
  "utf8"
);

assert.match(landingPageSource, /IndependenceDayPromoBanner/);
assert.doesNotMatch(landingPageSource, /Brand new UI/);
assert.doesNotMatch(landingPageSource, /WhatsNewDialog/);
assert.match(promoBannerSource, /INDEPENDENCE DAY OFFER/);
assert.match(promoBannerSource, /Your courtroom\. Your arguments\. Your verdict\./);
assert.match(promoBannerSource, /every\s+argument is yours to make/);
assert.match(promoBannerSource, /Sale ends in/);
assert.match(promoBannerSource, /window\.setInterval/);
assert.doesNotMatch(promoBannerSource, /label: "Sec"/);
assert.match(promoBannerSource, /grid-cols-3/);
assert.match(promoBannerSource, /return null/);
assert.match(promoBannerSource, /Claim My 30% Off/);
assert.doesNotMatch(promoBannerSource, /23:59 UTC/);
assert.match(checkoutRouteSource, /getActiveIndependenceDayDiscountCode/);
assert.match(
  checkoutRouteSource,
  /discountCode: getActiveIndependenceDayDiscountCode\(\) \|\| undefined/
);
assert.match(paywallSource, /Claim 30% Off Lifetime Access/);
assert.match(
  paywallSource,
  /Independence Day offer: get 30% off lifetime access\. No code needed -\s+your discount is ready at checkout\./
);
assert.doesNotMatch(paywallSource, /23:59 UTC/);
assert.doesNotMatch(paywallSource, /auto-applies/);
assert.match(paywallSource, /setPromoActive\(isIndependenceDayPromoActive\(\)\)/);

console.log("Independence Day promo tests passed");
