import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) =>
  readFile(new URL(`../${path}`, import.meta.url), "utf8");

const [
  manifest,
  serviceWorker,
  releaseConfig,
  downloadPage,
  downloadActions,
  assetLinks,
  twaManifestSource,
  buildScript,
  gitignore,
  reportRoute,
  deletionRoute,
  restoreRoute,
] = await Promise.all([
  read("app/manifest.js"),
  read("public/sw.js"),
  read("libs/appRelease.js"),
  read("app/download/android/page.js"),
  read("components/AndroidDownloadActions.js"),
  read("app/.well-known/assetlinks.json/route.js"),
  read("android-twa/twa-manifest.json"),
  read("scripts/build-android.ps1"),
  read(".gitignore"),
  read("app/api/reports/route.js"),
  read("app/api/account/delete/route.js"),
  read("app/api/account/restore-access/route.js"),
]);

const twaManifest = JSON.parse(twaManifestSource);

assert.equal(twaManifest.packageId, "app.legalarena");
assert.equal(twaManifest.host, "legalarena.app");
assert.equal(twaManifest.minSdkVersion, 28);
assert.equal(twaManifest.enableNotifications, false);
assert.equal(twaManifest.features.playBilling.enabled, false);

assert.match(manifest, /display:\s*"standalone"/);
assert.match(manifest, /purpose:\s*"maskable"/);
assert.match(serviceWorker, /request\.mode !== "navigate"/);
assert.doesNotMatch(serviceWorker, /caches\.put/);
assert.doesNotMatch(serviceWorker, /\/api\//);

assert.match(releaseConfig, /apkUrl\.startsWith\("https:\/\/"\)/);
assert.match(releaseConfig, /\/\^\[a-f0-9\]\{64\}\$\//);
assert.match(downloadPage, /install unknown apps/i);
assert.match(downloadPage, /SHA-256/);
assert.match(downloadActions, /Install web app/);

assert.match(assetLinks, /ANDROID_SIGNING_SHA256/);
assert.match(assetLinks, /package_name:\s*ANDROID_PACKAGE_ID/);
assert.match(releaseConfig, /ANDROID_PACKAGE_ID = "app\.legalarena"/);
assert.match(buildScript, /secrets\/legal-arena-release\.keystore/);
assert.match(buildScript, /signingKeyAlias=legal-arena/);
assert.match(buildScript, /Get-FileHash/);
assert.match(buildScript, /targetSdkVersion 36/);
assert.match(buildScript, /compileSdkVersion 36/);
assert.match(gitignore, /\*\.keystore/);
assert.match(gitignore, /\*\.jks/);

assert.match(reportRoute, /ContentReport\.create/);
assert.match(reportRoute, /"participants\.userId": session\.user\.id/);
assert.match(reportRoute, /userId: session\.user\.id/);
assert.match(deletionRoute, /deleteAccountForUser/);
assert.match(restoreRoute, /getFullArenaAccessForSession/);
assert.match(restoreRoute, /Cache-Control": "no-store/);

console.log("PASS independent Android distribution surfaces and safeguards");
