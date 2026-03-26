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

const originalApiKey = process.env.LEMONSQUEEZY_API_KEY;
const originalStoreId = process.env.LEMONSQUEEZY_STORE_ID;

process.env.LEMONSQUEEZY_API_KEY = "test-key";
process.env.LEMONSQUEEZY_STORE_ID = "12345";

const results = [];

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
