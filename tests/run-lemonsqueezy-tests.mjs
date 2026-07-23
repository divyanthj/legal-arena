import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createLemonSqueezyCheckout } from "../libs/lemonsqueezy.js";

async function runTest(name, fn) {
  try {
    await fn();
    console.log(`PASS ${name}`);
    return true;
  } catch (error) {
    console.error(`FAIL ${name}`);
    console.error(error);
    return false;
  }
}

const originalApiKey = process.env.LEMONSQUEEZY_API_KEY;
const originalStoreId = process.env.LEMONSQUEEZY_STORE_ID;

process.env.LEMONSQUEEZY_API_KEY = "test-key";
process.env.LEMONSQUEEZY_STORE_ID = "12345";

const results = [];

const checkoutButtonSource = await readFile(
  new URL("../components/legal-arena/EarlyAccessCheckoutButton.js", import.meta.url),
  "utf8"
);
assert.match(checkoutButtonSource, /window\.location\.href = response\.url;\s*return;/);
assert.doesNotMatch(checkoutButtonSource, /finally\s*\{\s*setIsLoading\(false\)/);
assert.match(checkoutButtonSource, /attribution:\s*getAcquisitionAttribution\(\)/);

const datafastSource = await readFile(
  new URL("../libs/datafast.js", import.meta.url),
  "utf8"
);
assert.match(datafastSource, /utm_campaign/);
assert.match(datafastSource, /legalarena_attribution_v1/);

const checkoutRouteSource = await readFile(
  new URL("../app/api/lemonsqueezy/create-checkout/route.js", import.meta.url),
  "utf8"
);
assert.match(checkoutRouteSource, /const attribution = getAttribution\(body\.attribution\)/);

const layoutSource = await readFile(new URL("../app/layout.js", import.meta.url), "utf8");
assert.doesNotMatch(layoutSource, /data-disable-payments/);

const clientLayoutSource = await readFile(
  new URL("../components/LayoutClient.js", import.meta.url),
  "utf8"
);
assert.match(clientLayoutSource, /getAcquisitionAttribution\(\)/);

results.push(
  await runTest("returns null when variant id is missing", async () => {
    const url = await createLemonSqueezyCheckout({
      redirectUrl: "https://legalarena.app/dashboard",
      email: "divyanth.jayaraj@gmail.com",
    });

    assert.equal(url, null);
  })
);

if (originalApiKey === undefined) {
  delete process.env.LEMONSQUEEZY_API_KEY;
} else {
  process.env.LEMONSQUEEZY_API_KEY = originalApiKey;
}

if (originalStoreId === undefined) {
  delete process.env.LEMONSQUEEZY_STORE_ID;
} else {
  process.env.LEMONSQUEEZY_STORE_ID = originalStoreId;
}

const passed = results.filter(Boolean).length;

if (passed !== results.length) {
  process.exit(1);
}

console.log(`Passed ${passed} Lemon Squeezy tests.`);
