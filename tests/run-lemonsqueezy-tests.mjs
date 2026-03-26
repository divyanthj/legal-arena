import assert from "node:assert/strict";
import {
  appendLemonSqueezyPrefillParams,
  buildLemonSqueezyCheckoutPayload,
  createLemonSqueezyCheckout,
} from "../libs/lemonsqueezy.js";

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

results.push(
  await runTest(
    "builds checkout payload with normalized email, name, and custom user id",
    async () => {
      const payload = buildLemonSqueezyCheckoutPayload({
        redirectUrl: "https://legalarena.app/dashboard",
        email: " Divyanth.Jayaraj@GMAIL.com ",
        name: "Divyanth",
        userId: " user-123 ",
      });

      assert.equal(
        payload.productOptions.redirectUrl,
        "https://legalarena.app/dashboard"
      );
      assert.equal(payload.checkoutData.email, "divyanth.jayaraj@gmail.com");
      assert.equal(payload.checkoutData.name, "Divyanth");
      assert.deepEqual(payload.checkoutData.custom, { userId: "user-123" });
    }
  )
);

results.push(
  await runTest("fails fast when checkout email is missing", async () => {
    assert.throws(
      () =>
        buildLemonSqueezyCheckoutPayload({
          redirectUrl: "https://legalarena.app/dashboard",
          email: "   ",
        }),
      /A signed-in email address is required for checkout/
    );
  })
);

results.push(
  await runTest("fails fast when variant id is missing", async () => {
    await assert.rejects(
      () =>
        createLemonSqueezyCheckout({
          redirectUrl: "https://legalarena.app/dashboard",
          email: "divyanth.jayaraj@gmail.com",
        }),
      /Lemon Squeezy variant ID is required/
    );
  })
);

results.push(
  await runTest("appends email, name, and custom data to checkout url", async () => {
    const checkoutUrl = appendLemonSqueezyPrefillParams(
      "https://simplysolved.lemonsqueezy.com/checkout/buy/test-id",
      {
        email: " Divyanth.Jayaraj@GMAIL.com ",
        name: "Divyanth",
        userId: " user-123 ",
      }
    );

    const url = new URL(checkoutUrl);

    assert.equal(
      url.searchParams.get("checkout[email]"),
      "divyanth.jayaraj@gmail.com"
    );
    assert.equal(url.searchParams.get("checkout[name]"), "Divyanth");
    assert.equal(url.searchParams.get("checkout[custom][userId]"), "user-123");
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
