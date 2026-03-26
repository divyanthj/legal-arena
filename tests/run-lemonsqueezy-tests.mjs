import assert from "node:assert/strict";
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

const originalFetch = global.fetch;
const originalApiKey = process.env.LEMONSQUEEZY_API_KEY;
const originalStoreId = process.env.LEMONSQUEEZY_STORE_ID;

process.env.LEMONSQUEEZY_API_KEY = "test-key";
process.env.LEMONSQUEEZY_STORE_ID = "12345";

let capturedRequest = null;

global.fetch = async (url, options) => {
  capturedRequest = {
    url,
    options,
  };

  return {
    ok: true,
    async json() {
      return {
        data: {
          attributes: {
            url: "https://checkout.test/abc",
          },
        },
      };
    },
  };
};

const results = [];

results.push(
  await runTest("creates checkout with normalized email, name, and custom user id", async () => {
    capturedRequest = null;

    const url = await createLemonSqueezyCheckout({
      variantId: "987",
      redirectUrl: "https://legalarena.app/dashboard",
      email: " Divyanth.Jayaraj@GMAIL.com ",
      name: "Divyanth",
      userId: " user-123 ",
    });

    assert.equal(url, "https://checkout.test/abc");
    assert.ok(capturedRequest);
    assert.equal(capturedRequest.url, "https://api.lemonsqueezy.com/v1/checkouts");

    const payload = JSON.parse(capturedRequest.options.body);
    const checkoutData = payload.data.attributes.checkout_data;

    assert.equal(checkoutData.email, "divyanth.jayaraj@gmail.com");
    assert.equal(checkoutData.name, "Divyanth");
    assert.deepEqual(checkoutData.custom, { userId: "user-123" });
  })
);

results.push(
  await runTest("fails fast when checkout email is missing", async () => {
    await assert.rejects(
      () =>
        createLemonSqueezyCheckout({
          variantId: "987",
          redirectUrl: "https://legalarena.app/dashboard",
          email: "   ",
        }),
      /A signed-in email address is required for checkout/
    );
  })
);

global.fetch = originalFetch;

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
