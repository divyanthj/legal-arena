import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  buildNextCaseRecommendation,
  getDynamicDifficultyLimits,
} from "../libs/game/nextCaseRecommendation.mjs";
import {
  buildNextCaseTeaser,
  buildTeaserScenarioHint,
} from "../libs/game/nextCaseTeaser.mjs";

const categories = [
  { slug: "rental-dispute", title: "Rental Dispute" },
  { slug: "employment", title: "Employment" },
  { slug: "consumer", title: "Consumer" },
  { slug: "criminal", title: "Criminal" },
  { slug: "contract-violation", title: "Contract Violation" },
];

const progression = ({
  overallXp = 0,
  stats = {},
} = {}) => ({
  overallXp,
  categoryStats: categories.map((category) => ({
    categorySlug: category.slug,
    completedCases: stats[category.slug]?.completedCases || 0,
    unlockedComplexity: stats[category.slug]?.unlockedComplexity || 1,
  })),
});

const resolvedCase = ({
  id,
  category,
  complexity,
  completedAt,
  status = "verdict",
}) => ({
  id,
  primaryCategory: category,
  complexity,
  completedAt,
  status,
});

const employmentTeaserInput = {
  recommendation: {
    categorySlug: "employment",
    categoryTitle: "Employment",
    complexity: 2,
  },
  sourceCaseId: "case-1",
  playerId: "player-a",
  countryCode: "US",
};
const employmentTeaser = buildNextCaseTeaser(employmentTeaserInput);
assert.deepEqual(
  buildNextCaseTeaser(employmentTeaserInput),
  employmentTeaser,
  "the same resolved case must always produce the same teaser"
);
assert.equal(employmentTeaser.categoryTitle, "Employment");
assert.equal(employmentTeaser.complexity, 2);
assert.match(employmentTeaser.headline, /dismissal|workplace pay/);
assert.match(buildTeaserScenarioHint(employmentTeaser), /Employment|dismissal|workplace|performance|policy/i);

const recommend = ({ cases = [], playerProgression, playerId = "player-a" }) =>
  buildNextCaseRecommendation({
    cases,
    progression: playerProgression || progression(),
    categories,
    playerId,
    defaultCategorySlug: "contract-violation",
  });

{
  const result = recommend({});
  assert.equal(result.kind, "starter");
  assert.equal(result.categorySlug, "contract-violation");
  assert.equal(result.complexity, 1);
  assert.equal(result.recentRepeatCount, 0);
}

{
  const result = recommend({
    cases: [
      resolvedCase({
        id: "rental-2",
        category: "rental-dispute",
        complexity: 1,
        completedAt: "2026-07-24T12:00:00Z",
      }),
      resolvedCase({
        id: "rental-1",
        category: "rental-dispute",
        complexity: 1,
        completedAt: "2026-07-23T12:00:00Z",
      }),
    ],
    playerProgression: progression({
      stats: {
        "rental-dispute": { completedCases: 2, unlockedComplexity: 2 },
      },
    }),
  });

  assert.equal(result.kind, "level_up");
  assert.equal(result.categorySlug, "rental-dispute");
  assert.equal(result.complexity, 2);
  assert.equal(result.reasonCode, "repeat_pair_step_up");
  assert.equal(result.recentRepeatCount, 2);
  assert.equal(result.isStretch, true);
}

{
  const result = recommend({
    cases: [
      resolvedCase({
        id: "rental-level-2",
        category: "rental-dispute",
        complexity: 2,
        completedAt: "2026-07-25T12:00:00Z",
      }),
      resolvedCase({
        id: "rental-level-1-b",
        category: "rental-dispute",
        complexity: 1,
        completedAt: "2026-07-24T12:00:00Z",
      }),
      resolvedCase({
        id: "rental-level-1-a",
        category: "rental-dispute",
        complexity: 1,
        completedAt: "2026-07-23T12:00:00Z",
      }),
    ],
    playerProgression: progression({
      overallXp: 500,
      stats: {
        "rental-dispute": { completedCases: 3, unlockedComplexity: 2 },
      },
    }),
  });

  assert.equal(result.kind, "broaden");
  assert.notEqual(result.categorySlug, "rental-dispute");
  assert.equal(result.complexity, 1);
}

{
  const result = recommend({
    cases: [
      resolvedCase({
        id: "employment-first",
        category: "employment",
        complexity: 1,
        completedAt: "2026-07-25T12:00:00Z",
      }),
    ],
    playerProgression: progression({
      stats: {
        employment: { completedCases: 1, unlockedComplexity: 1 },
      },
    }),
  });

  assert.equal(result.kind, "level_up");
  assert.equal(result.categorySlug, "employment");
  assert.equal(result.complexity, 2);
  assert.equal(result.reasonCode, "new_category_deepen");
}

{
  const result = recommend({
    cases: [
      resolvedCase({
        id: "rental-max",
        category: "rental-dispute",
        complexity: 5,
        completedAt: "2026-07-25T12:00:00Z",
      }),
    ],
    playerProgression: progression({
      overallXp: 5000,
      stats: {
        "rental-dispute": { completedCases: 9, unlockedComplexity: 5 },
      },
    }),
  });

  assert.equal(result.kind, "broaden");
  assert.notEqual(result.categorySlug, "rental-dispute");
  assert.equal(result.reasonCode, "mastery_cap_reached");
}

{
  const result = recommend({
    cases: [
      resolvedCase({
        id: "rental-stretch",
        category: "rental-dispute",
        complexity: 2,
        completedAt: "2026-07-25T12:00:00Z",
      }),
    ],
    playerProgression: progression({
      overallXp: 0,
      stats: {
        "rental-dispute": { completedCases: 1, unlockedComplexity: 5 },
      },
    }),
  });

  assert.equal(
    getDynamicDifficultyLimits({
      progression: progression({
        overallXp: 0,
        stats: {
          "rental-dispute": { completedCases: 1, unlockedComplexity: 5 },
        },
      }),
      categorySlug: "rental-dispute",
    }).challengeComplexityCap,
    2
  );
  assert.equal(result.kind, "broaden");
  assert.notEqual(result.categorySlug, "rental-dispute");
}

{
  const input = {
    cases: [
      resolvedCase({
        id: "rental-current",
        category: "rental-dispute",
        complexity: 2,
        completedAt: "2026-07-25T12:00:00Z",
      }),
      resolvedCase({
        id: "rental-previous",
        category: "rental-dispute",
        complexity: 1,
        completedAt: "2026-07-24T12:00:00Z",
      }),
    ],
    playerProgression: progression({
      stats: {
        "rental-dispute": { completedCases: 2, unlockedComplexity: 2 },
      },
    }),
    playerId: "stable-player",
  };

  assert.deepEqual(recommend(input), recommend(input));
}

{
  const result = recommend({
    cases: [
      resolvedCase({
        id: "unfinished-rental",
        category: "rental-dispute",
        complexity: 1,
        completedAt: "2026-07-26T12:00:00Z",
        status: "interview",
      }),
      resolvedCase({
        id: "finished-employment",
        category: "employment",
        complexity: 1,
        completedAt: "2026-07-25T12:00:00Z",
      }),
    ],
    playerProgression: progression({
      stats: {
        employment: { completedCases: 1, unlockedComplexity: 1 },
      },
    }),
  });

  assert.equal(result.kind, "level_up");
  assert.equal(result.categorySlug, "employment");
  assert.equal(result.complexity, 2);
}

const dashboardSource = await readFile(
  new URL("../components/legal-arena/DashboardHub.js", import.meta.url),
  "utf8"
);
const postResolutionSource = await readFile(
  new URL(
    "../components/legal-arena/PostResolutionNextCaseCard.js",
    import.meta.url
  ),
  "utf8"
);
const nextRouteSource = await readFile(
  new URL("../app/api/cases/next/route.js", import.meta.url),
  "utf8"
);
const casesRouteSource = await readFile(
  new URL("../app/api/cases/route.js", import.meta.url),
  "utf8"
);
const storeSource = await readFile(
  new URL("../libs/game/store.js", import.meta.url),
  "utf8"
);
const caseSessionModelSource = await readFile(
  new URL("../models/CaseSession.js", import.meta.url),
  "utf8"
);
const globalsSource = await readFile(
  new URL("../app/globals.css", import.meta.url),
  "utf8"
);

assert.match(
  dashboardSource,
  /nextCaseRecommendation\?\.categorySlug \|\| categories\[0\]\?\.slug/,
  "The dashboard category should initialize from the recommendation."
);
assert.match(
  dashboardSource,
  /Number\(nextCaseRecommendation\?\.complexity\) \|\| 1/,
  "The dashboard difficulty should initialize from the recommendation."
);
assert.match(
  dashboardSource,
  /canResumeLastCase\s*\?\s*"Continue Case"/,
  "An unfinished case should keep resume priority."
);
assert.match(
  dashboardSource,
  /Familiar pick\. Try[\s\S]*Switch/,
  "Repeated familiar selections should show a compact, non-blocking switch prompt."
);
assert.match(
  dashboardSource,
  /next_case_recommendation_(?:accepted|overridden)/,
  "Recommendation outcomes should be tracked."
);
assert.match(
  dashboardSource,
  /dashboard-recommendation-tooltip[\s\S]*nextCaseRecommendation\?\.reason/,
  "The recommended difficulty badge should explain why it was recommended."
);
assert.match(
  postResolutionSource,
  /\.get\("\/cases\/next", \{ params: \{ sourceCaseId \} \}\)/,
  "The post-resolution card should preview the server recommendation."
);
assert.doesNotMatch(
  postResolutionSource,
  /if \(!hasArenaAccess \|\| !sourceCaseId\) return;/,
  "Trial users should receive the same recommendation preview."
);
assert.match(postResolutionSource, /setTeaser\(response\?\.teaser/);
assert.match(postResolutionSource, /Unlock This Case/);
assert.match(
  postResolutionSource,
  /post-resolution-unlock-cta[\s\S]*text-base font-black[\s\S]*contentClassName="font-black/
);
assert.match(
  globalsSource,
  /\.post-resolution-unlock-cta \{[\s\S]*animation: post-resolution-unlock-cta-breathe 4\.8s/
);
assert.match(
  globalsSource,
  /@media \(prefers-reduced-motion: reduce\) \{[\s\S]*\.post-resolution-unlock-cta \{[\s\S]*animation: none;/
);
assert.match(
  nextRouteSource,
  /export async function GET\(req\)/,
  "The next-case endpoint should expose an authenticated preview."
);
assert.match(
  nextRouteSource,
  /categorySlug: recommendation\.categorySlug[\s\S]*complexity: recommendation\.complexity/,
  "Next-case creation should use the personalized recommendation."
);
assert.match(nextRouteSource, /buildNextCaseTeaser/);
assert.match(nextRouteSource, /continuationTeaserKey: teaser\.key/);
assert.match(nextRouteSource, /scenarioHint: buildTeaserScenarioHint\(teaser\)/);
const topLevelCaseSchemaSource =
  caseSessionModelSource.split("const caseSessionSchema = mongoose.Schema(")[1] ||
  "";
assert.match(
  topLevelCaseSchemaSource,
  /continuationOfCaseId:[\s\S]*continuationTeaserKey:/,
  "Continuation traceability fields must be persisted on the case itself."
);
assert.doesNotMatch(
  caseSessionModelSource.split("const usageEntrySchema = mongoose.Schema(")[0],
  /continuationTeaserKey:/,
  "The continuation teaser key must not be nested in settlement state."
);
assert.match(
  casesRouteSource,
  /nextCaseRecommendation: dashboardData\.nextCaseRecommendation/,
  "The cases API should expose the dashboard recommendation."
);
assert.match(
  storeSource,
  /import \{[\s\S]*getEligibleComplexityForCategory,[\s\S]*\} from "\.\/progression";/,
  "The store should retain the eligibility helper used by template availability."
);

console.log("Next-case recommendation tests passed");
