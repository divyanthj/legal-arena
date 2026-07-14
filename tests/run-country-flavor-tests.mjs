import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  CASE_COUNTRIES,
  DEFAULT_COUNTRY_CODE,
  buildCaseCountry,
  detectCountryCodeFromHeaders,
  getCountryFlavorGuidance,
  normalizeCountryCode,
  resolveCountryDetectionFromHeaders,
  resolveInitialCountryCode,
} from "../libs/game/countries.js";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");

assert.equal(CASE_COUNTRIES.length, 249, "country catalog should cover ISO 3166-1");
assert.equal(new Set(CASE_COUNTRIES.map((country) => country.code)).size, 249);
assert.equal(buildCaseCountry("in").name, "India");
assert.equal(buildCaseCountry("US").name, "United States");
assert.equal(normalizeCountryCode(" zz "), "");
assert.equal(DEFAULT_COUNTRY_CODE, "US");

const indiaHeaders = new Map([["x-vercel-ip-country", "in"]]);
const emptyHeaders = new Map();
assert.equal(detectCountryCodeFromHeaders(indiaHeaders), "IN");
assert.deepEqual(resolveCountryDetectionFromHeaders(indiaHeaders), {
  countryCode: "IN",
  source: "detected",
});
assert.deepEqual(resolveCountryDetectionFromHeaders(emptyHeaders), {
  countryCode: "US",
  source: "default",
});
assert.equal(resolveInitialCountryCode({ storedCode: "GB", detectedCode: "IN" }), "GB");
assert.equal(
  resolveInitialCountryCode({ profileCode: "IN", storedCode: "GB", detectedCode: "US" }),
  "IN"
);
assert.equal(resolveInitialCountryCode({ detectedCode: "IN" }), "IN");
assert.equal(resolveInitialCountryCode({}), "US");

const indiaGuidance = getCountryFlavorGuidance({ code: "IN" }, "marital-dispute").join(" ");
const usGuidance = getCountryFlavorGuidance({ code: "US" }, "criminal").join(" ");
const japanGuidance = getCountryFlavorGuidance({ code: "JP" }, "consumer").join(" ");
assert.match(indiaGuidance, /false promise to marry/i);
assert.match(indiaGuidance, /varied regions and communities/i);
assert.match(usGuidance, /firearm possession, storage, transport/i);
assert.match(japanGuidance, /do not merely rename an otherwise American case/i);
assert.match(japanGuidance, /Avoid caricature/i);

const [
  casesRoute,
  challengesRoute,
  caseModel,
  challengeModel,
  dynamicCase,
  store,
  challenges,
  picker,
  dashboard,
  challengeButton,
  soloPortrait,
  challengePortrait,
  caseReports,
  engine,
  settlement,
  userModel,
  countryPreference,
  countryPreferenceRoute,
] = await Promise.all([
  read("../app/api/cases/route.js"),
  read("../app/api/challenges/route.js"),
  read("../models/CaseSession.js"),
  read("../models/Challenge.js"),
  read("../libs/game/dynamicCase.js"),
  read("../libs/game/store.js"),
  read("../libs/game/challenges.js"),
  read("../components/legal-arena/CountryFlagPicker.js"),
  read("../components/legal-arena/DashboardHub.js"),
  read("../components/legal-arena/ChallengeButton.js"),
  read("../app/api/cases/[caseId]/client-portrait/route.js"),
  read("../app/api/challenges/[challengeId]/client-portrait/route.js"),
  read("../libs/caseReports.js"),
  read("../libs/game/engine.js"),
  read("../libs/game/settlement.js"),
  read("../models/User.js"),
  read("../libs/game/countryPreference.js"),
  read("../app/api/players/case-country/route.js"),
]);

for (const route of [casesRoute, challengesRoute]) {
  assert.match(route, /body\?\.countryCode && !isValidCountryCode/);
  assert.match(route, /detectCountryCodeFromHeaders\(req\.headers\)/);
  assert.match(route, /countryCode,/);
}
for (const model of [caseModel, challengeModel]) {
  assert.match(model, /caseCountry:\s*\{/);
  assert.match(model, /uppercase: true/);
}
assert.match(dynamicCase, /caseCountry,\s*\n\s*countryGuidance/);
assert.match(dynamicCase, /Treat caseCountry as immutable input/);
assert.match(dynamicCase, /caseCountry: dynamicCase\.caseCountry \|\| null/);
assert.match(store, /countryCode: caseCountry\.code/);
assert.match(store, /caseCountry,/);
assert.match(
  store,
  /payload\.caseCountry\?\.code \|\| template\?\.caseCountry\?\.code/,
  "lawyer profiles should preserve stored countries and fall back legacy cases"
);
assert.match(store, /\{ fallback: true \}/);
assert.match(challenges, /caseCountry: template\.caseCountry \|\| null/);
assert.match(picker, /fi-\$\{normalizedCode\.toLowerCase\(\)\}/);
assert.match(picker, /aria-label={`Select \$\{country\.name\}`}/);
assert.match(picker, /document\.addEventListener\("keydown"/);
assert.match(picker, /window\.localStorage\.setItem\(COUNTRY_STORAGE_KEY/);
assert.match(picker, /\/api\/players\/case-country/);
assert.match(picker, /detectedCountrySource === "profile"/);
assert.match(userModel, /preferredCaseCountryCode/);
assert.match(countryPreference, /getPlayerCaseCountryPreference/);
assert.match(countryPreference, /setPlayerCaseCountryPreference/);
assert.match(countryPreferenceRoute, /export async function PATCH/);
assert.match(dashboard, /<CountryFlagPicker/);
assert.match(dashboard, /countryCode: selectedCountryCode/);
assert.match(challengeButton, /<CountryFlagPicker/);
assert.match(challengeButton, /countryCode: selectedCountryCode/);
assert.match(soloPortrait, /const PORTRAIT_PROMPT_VERSION = 8/);
assert.match(challengePortrait, /const PORTRAIT_PROMPT_VERSION = 7/);
assert.match(soloPortrait, /Country setting:/);
assert.match(challengePortrait, /Country setting:/);
assert.match(caseReports, /caseCountry: source\.caseCountry \|\| null/);
assert.match(engine, /Preserve exact currency figures/);
assert.match(engine, /₹/);
assert.match(settlement, /₹/);

console.log("Country flavor tests passed");
