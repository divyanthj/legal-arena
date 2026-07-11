import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  generateApiCredential,
  hashApiSecret,
  parseApiKey,
} from "../libs/apiCredentialsCore.mjs";

const first = generateApiCredential();
const second = generateApiCredential();
assert.match(first.apiKey, /^la_live_[A-Za-z0-9_-]{12}_[A-Za-z0-9_-]{43}$/);
assert.deepEqual(parseApiKey(first.apiKey), { keyId: first.keyId, secret: first.secret });
assert.equal(parseApiKey("la_live_bad"), null);
assert.notEqual(first.apiKey, second.apiKey);
assert.equal(hashApiSecret(first.secret).length, 64);
assert.ok(!hashApiSecret(first.secret).includes(first.secret));

const modelSource = await readFile(new URL("../models/ApiCredential.js", import.meta.url), "utf8");
assert.match(modelSource, /secretHash: \{ type: String, required: true, select: false \}/);
assert.doesNotMatch(modelSource, /\bsecret:\s*\{/);

const adminRouteSource = await readFile(
  new URL("../app/api/admin/api-credentials/route.js", import.meta.url),
  "utf8"
);
assert.match(adminRouteSource, /accountType: "ai"/);
assert.match(adminRouteSource, /name: playerName/);
assert.match(adminRouteSource, /User\.create/);
assert.doesNotMatch(adminRouteSource, /User\.findOne\(email/);

for (const route of [
  "../app/api/cases/route.js",
  "../app/api/challenges/route.js",
  "../app/api/players/reset/route.js",
  "../app/api/transcribe/route.js",
]) {
  const source = await readFile(new URL(route, import.meta.url), "utf8");
  assert.match(source, /getRequestSession/);
  assert.doesNotMatch(source, /getServerSession/);
}

for (const route of [
  "../app/api/admin/access/route.js",
  "../app/api/stripe/create-portal/route.js",
  "../app/api/lemonsqueezy/create-portal/route.js",
]) {
  const source = await readFile(new URL(route, import.meta.url), "utf8");
  assert.doesNotMatch(source, /getRequestSession/);
}

console.log("API credential tests passed.");
