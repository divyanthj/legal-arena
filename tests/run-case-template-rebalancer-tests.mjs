import assert from "node:assert/strict";
import {
  DEFAULT_CASE_TEMPLATE_TARGET_PER_CATEGORY,
  deriveComplexityTargets,
  hasValidCaseTemplateRebalanceSecret,
  parseCaseTemplateRebalanceOptions,
  parseCaseTemplateTargetPerCategory,
  selectNextCaseTemplateGenerationTarget,
} from "../libs/caseTemplateRebalancer.mjs";

const categories = [
  { slug: "rental-dispute", title: "Rental Dispute" },
  { slug: "marital-dispute", title: "Marital Dispute" },
  { slug: "business-dispute", title: "Business Dispute" },
];

const buildCount = ({ primaryCategory, complexity, count }) => ({
  _id: {
    primaryCategory,
    complexity,
  },
  count,
});

const tests = [
  {
    name: "missing env target defaults to 15",
    run() {
      assert.equal(
        parseCaseTemplateTargetPerCategory(undefined),
        DEFAULT_CASE_TEMPLATE_TARGET_PER_CATEGORY
      );
    },
  },
  {
    name: "invalid env target falls back to 15",
    run() {
      assert.equal(
        parseCaseTemplateTargetPerCategory("-4"),
        DEFAULT_CASE_TEMPLATE_TARGET_PER_CATEGORY
      );
      assert.equal(
        parseCaseTemplateTargetPerCategory("wat"),
        DEFAULT_CASE_TEMPLATE_TARGET_PER_CATEGORY
      );
    },
  },
  {
    name: "zero env target is accepted and disables generation",
    run() {
      assert.equal(parseCaseTemplateTargetPerCategory("0"), 0);
    },
  },
  {
    name: "15 derives even targets across all five complexities",
    run() {
      assert.deepEqual(deriveComplexityTargets(15), [
        { complexity: 1, target: 3 },
        { complexity: 2, target: 3 },
        { complexity: 3, target: 3 },
        { complexity: 4, target: 3 },
        { complexity: 5, target: 3 },
      ]);
    },
  },
  {
    name: "remainders are assigned to lower complexities first",
    run() {
      assert.deepEqual(deriveComplexityTargets(17), [
        { complexity: 1, target: 4 },
        { complexity: 2, target: 4 },
        { complexity: 3, target: 3 },
        { complexity: 4, target: 3 },
        { complexity: 5, target: 3 },
      ]);
      assert.deepEqual(deriveComplexityTargets(4), [
        { complexity: 1, target: 1 },
        { complexity: 2, target: 1 },
        { complexity: 3, target: 1 },
        { complexity: 4, target: 1 },
        { complexity: 5, target: 0 },
      ]);
    },
  },
  {
    name: "selector prefers the lowest incomplete complexity first",
    run() {
      const result = selectNextCaseTemplateGenerationTarget({
        targetPerCategory: 15,
        categories,
        counts: [
          buildCount({
            primaryCategory: "rental-dispute",
            complexity: 1,
            count: 3,
          }),
          buildCount({
            primaryCategory: "marital-dispute",
            complexity: 1,
            count: 2,
          }),
          buildCount({
            primaryCategory: "business-dispute",
            complexity: 2,
            count: 0,
          }),
        ],
      });

      assert.equal(result.selectedTarget.categorySlug, "business-dispute");
      assert.equal(result.selectedTarget.complexity, 1);
      assert.equal(result.selectedTarget.currentCount, 0);
    },
  },
  {
    name: "selector spreads coverage across categories at the same complexity",
    run() {
      const result = selectNextCaseTemplateGenerationTarget({
        targetPerCategory: 15,
        categories,
        counts: [
          buildCount({
            primaryCategory: "rental-dispute",
            complexity: 1,
            count: 1,
          }),
          buildCount({
            primaryCategory: "marital-dispute",
            complexity: 1,
            count: 0,
          }),
          buildCount({
            primaryCategory: "business-dispute",
            complexity: 1,
            count: 0,
          }),
        ],
      });

      assert.equal(result.selectedTarget.categorySlug, "marital-dispute");
      assert.equal(result.selectedTarget.complexity, 1);
    },
  },
  {
    name: "selector returns noop state once all targets are satisfied",
    run() {
      const fullCounts = [];

      categories.forEach((category) => {
        [1, 2, 3, 4, 5].forEach((complexity) => {
          fullCounts.push(
            buildCount({
              primaryCategory: category.slug,
              complexity,
              count: 3,
            })
          );
        });
      });

      const result = selectNextCaseTemplateGenerationTarget({
        targetPerCategory: 15,
        categories,
        counts: fullCounts,
      });

      assert.equal(result.selectedTarget, null);
    },
  },
  {
    name: "rebalance options parse dryRun from query and body",
    run() {
      assert.deepEqual(
        parseCaseTemplateRebalanceOptions({
          query: { dryRun: "true" },
        }),
        { dryRun: true }
      );
      assert.deepEqual(
        parseCaseTemplateRebalanceOptions({
          body: { dryRun: false },
        }),
        { dryRun: false }
      );
    },
  },
  {
    name: "secret validation accepts bearer and custom header tokens",
    run() {
      assert.equal(
        hasValidCaseTemplateRebalanceSecret({
          secret: "shhh",
          headers: { authorization: "Bearer shhh" },
        }),
        true
      );
      assert.equal(
        hasValidCaseTemplateRebalanceSecret({
          secret: "shhh",
          headers: { "x-case-template-rebalance-secret": "shhh" },
        }),
        true
      );
      assert.equal(
        hasValidCaseTemplateRebalanceSecret({
          secret: "shhh",
          headers: { authorization: "Bearer nope" },
        }),
        false
      );
    },
  },
];

let passed = 0;

for (const testCase of tests) {
  testCase.run();
  passed += 1;
  console.log(`PASS ${testCase.name}`);
}

console.log(`Completed ${passed} case template rebalance tests.`);
