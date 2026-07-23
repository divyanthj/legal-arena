import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import {
  LEGAL_CASE_CATEGORIES,
  listEvergreenTemplateCategories,
} from "../libs/game/categories.js";
import {
  applyCurrentEventAnonymizationRepair,
  buildPublicCurrentEventInspiration,
  findCurrentEventLeaks,
  hasPlayableCurrentEventCaseShape,
  normalizeCurrentEventSources,
  rankCurrentEventCandidates,
} from "../libs/game/currentEventsCore.mjs";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");

const headlines = LEGAL_CASE_CATEGORIES.find(
  (category) => category.slug === "current-events"
);
assert.ok(headlines, "Headlines category should be registered");
assert.equal(headlines.title, "Headlines");
assert.equal(headlines.supportsDynamicCases, true);
assert.equal(headlines.supportsEvergreenTemplates, false);
assert.equal(headlines.crossPracticeArea, true);
assert.equal(headlines.live, true);
assert.equal(headlines.isNew, true);
assert.equal(
  listEvergreenTemplateCategories().some(
    (category) => category.slug === "current-events"
  ),
  false,
  "Headlines must not enter evergreen template coverage"
);

const [
  dashboardSource,
  challengeButtonSource,
  landingPageSource,
  whatsNewSource,
] = await Promise.all([
  read("../components/legal-arena/DashboardHub.js"),
  read("../components/legal-arena/ChallengeButton.js"),
  read("../app/page.js"),
  read("../components/legal-arena/WhatsNewDialog.js"),
]);
assert.match(dashboardSource, /Skill \{categoryCap\}/);
assert.match(dashboardSource, /\{category\.description\}/);
assert.match(
  dashboardSource,
  /\{selectedCategoryMeta\?\.description\}[\s\S]*text-xs italic[\s\S]*\{selectedDynamicDifficultyMeta\.label\} -[\s\S]*\{selectedDynamicDifficultyMeta\.summary\}/
);
assert.match(dashboardSource, /category\.isNew/);
assert.doesNotMatch(dashboardSource, /category\.live \? "Live"/);
assert.match(challengeButtonSource, /category\.isNew/);
assert.doesNotMatch(challengeButtonSource, /category\.live/);
assert.doesNotMatch(landingPageSource, /headlines-announcement-title/);
assert.doesNotMatch(landingPageSource, /data-landing-source="headlines_announcement"/);
assert.match(landingPageSource, /New category — Headlines/);
assert.match(landingPageSource, /data-landing-source="headlines_launch_banner"/);
assert.match(landingPageSource, /NewspaperIcon/);
assert.match(whatsNewSource, /Headlines: argue today's biggest legal issues/);
assert.ok(
  whatsNewSource.indexOf("Headlines: argue today's biggest legal issues") <
    whatsNewSource.indexOf("A smoother settlement rhythm"),
  "Headlines must be the first item in What's new"
);
assert.match(whatsNewSource, /badge: "New"/);

const sources = normalizeCurrentEventSources(
  [
    {
      url: "https://news.example/story",
      title: "Original title",
      publisher: "Example News",
    },
    { url: "not-a-url", title: "Invalid" },
  ],
  [
    {
      url: "https://news.example/story",
      publishedAt: "2026-07-20",
    },
    {
      url: "https://authority.example/release",
      title: "Official release",
    },
  ]
);
assert.equal(sources.length, 2);
assert.equal(sources[0].title, "Original title");
assert.equal(sources[0].publishedAt, "2026-07-20");

const rankedCandidates = rankCurrentEventCandidates(
  [
    {
      key: "routine-fine",
      headline: "Regulator issues a small routine fine",
      summary:
        "A regulator issued a modest penalty over an isolated checkout problem.",
      eventDate: "2026-07-17",
      ongoing: false,
      geographicReach: "local",
      publicAttention: 2,
      recentMomentum: 1,
      legalSignificance: 2,
      publicControversy: 1,
      routineRegulatoryAction: true,
      sources: [
        { url: "https://authority.example/fine" },
        { url: "https://news.example/fine" },
      ],
    },
    {
      key: "national-protest",
      headline: "Nationwide protests trigger a constitutional dispute",
      summary:
        "An ongoing nationwide movement raises live questions about assembly rights and police powers.",
      eventDate: "2026-07-23",
      ongoing: true,
      geographicReach: "national",
      publicAttention: 5,
      recentMomentum: 5,
      legalSignificance: 5,
      publicControversy: 5,
      routineRegulatoryAction: false,
      sources: [
        { url: "https://news-one.example/protest" },
        { url: "https://news-two.example/protest" },
        { url: "https://rights.example/protest" },
      ],
    },
  ],
  { now: new Date("2026-07-24T00:00:00.000Z") }
);
assert.equal(rankedCandidates[0].key, "national-protest");
assert.ok(rankedCandidates[0].score > rankedCandidates[1].score);

const brief = {
  country: { code: "US", name: "United States" },
  namedEntities: ["Elon Musk", "ACME Corp.", "United States"],
  identifyingDetails: ["$14.7 million", "July 20, 2026"],
};
assert.deepEqual(
  findCurrentEventLeaks(
    {
      title: "A fictional case",
      plaintiffStory:
        "ELON-MUSK disputed a payment of $14.7 million through Acme Corp.",
      caseCountry: { name: "United States" },
    },
    brief
  ),
  ["Elon Musk", "ACME Corp.", "$14.7 million"]
);
assert.deepEqual(
  findCurrentEventLeaks(
    {
      title: "The Harbor Ledger",
      plaintiffStory:
        "A fictional minister disputed a newly invented payment in the United States.",
    },
    brief
  ),
  []
);

assert.equal(
  hasPlayableCurrentEventCaseShape({
    title: "The Harbor Ledger",
    plaintiffName: "Avery Shah",
    defendantName: "North Coast Authority",
    coreDispute: "Whether records support the challenged decision.",
    plaintiffStory: "The claimant says the process was rushed.",
    defendantStory: "The authority says the process was regular.",
    plaintiffOpeningStatement: "I want the record reviewed.",
    defendantOpeningStatement: "The decision was supported.",
    evidencePool: [{ id: "one" }, { id: "two" }],
  }),
  true
);
assert.equal(hasPlayableCurrentEventCaseShape({ title: "Incomplete" }), false);

const originalPlayableCase = {
  title: "Real Organization Dispute",
  plaintiffName: "Avery Shah",
  defendantName: "Real Organization",
  coreDispute: "Whether the challenged official action was lawful.",
  plaintiffStory: "The claimant says Real Organization acted unfairly.",
  defendantStory: "Real Organization says its process was lawful.",
  plaintiffOpeningStatement: "The claimant asks for review.",
  defendantOpeningStatement: "The authority defends its decision.",
  evidencePool: [
    { id: "e1", label: "Notice", detail: "Original notice" },
    { id: "e2", label: "Reply", detail: "Original reply" },
  ],
  courtroomPositions: {
    plaintiff: [{ id: "p1", linkedEvidenceIds: ["e1"] }],
    defendant: [{ id: "d1", linkedEvidenceIds: ["e2"] }],
  },
};
const mergedRepair = applyCurrentEventAnonymizationRepair(originalPlayableCase, {
  correctedCase: {
    title: "Harbor Authority Dispute",
    defendantName: "Harbor Authority",
    plaintiffStory: "The claimant says Harbor Authority acted unfairly.",
    evidencePool: [{ id: "e1", label: "Fictional Notice" }],
    defendantOpeningStatement: "",
  },
});
assert.equal(mergedRepair.title, "Harbor Authority Dispute");
assert.equal(mergedRepair.defendantName, "Harbor Authority");
assert.equal(mergedRepair.evidencePool.length, 2);
assert.equal(mergedRepair.evidencePool[0].detail, "Original notice");
assert.equal(
  mergedRepair.defendantOpeningStatement,
  originalPlayableCase.defendantOpeningStatement
);
assert.deepEqual(
  mergedRepair.courtroomPositions,
  originalPlayableCase.courtroomPositions
);
assert.equal(hasPlayableCurrentEventCaseShape(mergedRepair), true);

const publicInspiration = buildPublicCurrentEventInspiration({
  country: brief.country,
  eventDate: "2026-07-20",
  retrievedAt: "2026-07-23T10:00:00.000Z",
  namedEntities: ["Must never be public"],
  eventSummary: "Must never be public",
  sources,
});
assert.equal(publicInspiration.sources.length, 2);
assert.equal("namedEntities" in publicInspiration, false);
assert.equal("eventSummary" in publicInspiration, false);
assert.match(publicInspiration.disclaimer, /fictionalized/i);

const [
  dynamicCaseSource,
  currentEventsSource,
  storeSource,
  challengesSource,
  caseModelSource,
  challengeModelSource,
  rebalancerSource,
  generationSource,
  gptSource,
] = await Promise.all([
  read("../libs/game/dynamicCase.js"),
  read("../libs/game/currentEvents.js"),
  read("../libs/game/store.js"),
  read("../libs/game/challenges.js"),
  read("../models/CaseSession.js"),
  read("../models/Challenge.js"),
  read("../libs/caseTemplateRebalancer.js"),
  read("../libs/game/generation.js"),
  read("../libs/gpt.js"),
]);

assert.match(currentEventsSource, /\{ days: 14, scope: "country" \}/);
assert.match(currentEventsSource, /\{ days: 30, scope: "country" \}/);
assert.match(currentEventsSource, /\{ days: 30, scope: "regional-impact" \}/);
assert.match(currentEventsSource, /Find and compare exactly 5 eligible recent events/);
assert.match(currentEventsSource, /covered in the last 72 hours/);
assert.match(currentEventsSource, /routine minor story/);
assert.match(currentEventsSource, /rankCurrentEventCandidates/);
assert.match(currentEventsSource, /candidates\.slice\(0, 3\)/);
assert.match(dynamicCaseSource, /isCurrentEvents\s*\?\s*await researchCurrentEvent/);
assert.match(dynamicCaseSource, /applyCurrentEventAnonymizationRepair/);
assert.match(
  dynamicCaseSource,
  /const \{ currentEventProvenance, \.\.\.publicDynamicCase \} = dynamicCase/
);
assert.match(storeSource, /currentEventResolved && privateCurrentEventProvenance/);
assert.match(challengesSource, /currentEventResolved && privateCurrentEventProvenance/);
assert.match(caseModelSource, /currentEventProvenance:[\s\S]*?private: true/);
assert.match(challengeModelSource, /currentEventProvenance:[\s\S]*?private: true/);
assert.match(rebalancerSource, /listEvergreenTemplateCategories/);
assert.match(generationSource, /supportsEvergreenTemplates === false/);

const webSearchHelperSource = gptSource.slice(
  gptSource.indexOf("export const requestWebGroundedStructuredCompletion"),
  gptSource.indexOf("const data = await response.json()", gptSource.indexOf("export const requestWebGroundedStructuredCompletion"))
);
assert.match(webSearchHelperSource, /tools: \[\{ type: "web_search" \}\]/);
assert.match(
  webSearchHelperSource,
  /include: \["web_search_call\.action\.sources"\]/
);
assert.doesNotMatch(
  webSearchHelperSource,
  /text:\s*\{\s*format:|response_format/,
  "Responses web search must not enable incompatible JSON mode"
);
assert.match(webSearchHelperSource, /retryAttempts = 1/);
assert.match(webSearchHelperSource, /attemptMaxTokens/);
assert.match(
  gptSource,
  /export const requestStructuredCompletion[\s\S]*text:\s*\{[\s\S]*format: buildResponsesStructuredFormat\(\)/,
  "Ordinary non-search structured completions should retain JSON mode"
);

console.log("Current events tests passed.");
