import assert from "node:assert/strict";
import {
  NUDGE_TYPES,
  determineRetentionNudge,
  hasValidNudgeSecret,
  parseNudgeRunOptions,
  selectRecommendedTemplate,
} from "../libs/emailNudgesCore.mjs";

const now = new Date("2026-03-16T12:00:00.000Z");

const buildCase = ({
  id,
  status,
  updatedAt,
  createdAt = updatedAt,
  exitedAt = null,
  caseTemplateId = "template-1",
}) => ({
  id,
  _id: id,
  title: `Case ${id}`,
  status,
  updatedAt: new Date(updatedAt),
  createdAt: new Date(createdAt),
  exitedAt: exitedAt ? new Date(exitedAt) : null,
  caseTemplateId,
  primaryCategory: "housing",
  premise: { clientName: "Maya Chen" },
  factSheet: { openQuestions: ["Q1", "Q2", "Q3"] },
  score: { roundsCompleted: 1, lastBenchSignal: "Push harder on notice." },
  verdict: { winner: "player", summary: "You won.", highlights: ["Strong timeline"] },
});

const buildLog = ({ nudgeType, caseSessionId, sentAt }) => ({
  nudgeType,
  caseSessionId,
  dedupeKey: `${nudgeType}:${caseSessionId || "user"}`,
  sentAt: new Date(sentAt),
});

const tests = [
  {
    name: "resume_interview is selected for a stalled intake",
    run() {
      const result = determineRetentionNudge({
        now,
        caseSessions: [
          buildCase({
            id: "case-1",
            status: "interview",
            createdAt: "2026-03-15T08:00:00.000Z",
            updatedAt: "2026-03-16T04:30:00.000Z",
          }),
        ],
        logs: [],
      });

      assert.equal(result.candidate.type, NUDGE_TYPES.RESUME_INTERVIEW);
    },
  },
  {
    name: "resume_courtroom is selected for an idle hearing",
    run() {
      const result = determineRetentionNudge({
        now,
        caseSessions: [
          buildCase({
            id: "case-2",
            status: "courtroom",
            updatedAt: "2026-03-16T08:00:00.000Z",
          }),
        ],
        logs: [],
      });

      assert.equal(result.candidate.type, NUDGE_TYPES.RESUME_COURTROOM);
    },
  },
  {
    name: "post_verdict_next_case outranks lower-priority candidates",
    run() {
      const result = determineRetentionNudge({
        now,
        caseSessions: [
          buildCase({
            id: "case-3",
            status: "verdict",
            updatedAt: "2026-03-15T12:00:00.000Z",
          }),
          buildCase({
            id: "case-4",
            status: "exited",
            updatedAt: "2026-03-15T05:00:00.000Z",
            exitedAt: "2026-03-15T05:00:00.000Z",
            caseTemplateId: "template-priority",
          }),
        ],
        logs: [],
      });

      assert.equal(result.candidate.type, NUDGE_TYPES.POST_VERDICT_NEXT_CASE);
    },
  },
  {
    name: "cooldown_return is selected after the 24-hour lock expires",
    run() {
      const result = determineRetentionNudge({
        now,
        caseSessions: [
          buildCase({
            id: "case-5",
            status: "exited",
            updatedAt: "2026-03-15T09:00:00.000Z",
            exitedAt: "2026-03-15T09:00:00.000Z",
            caseTemplateId: "template-cooldown",
          }),
        ],
        logs: [],
      });

      assert.equal(result.candidate.type, NUDGE_TYPES.COOLDOWN_RETURN);
    },
  },
  {
    name: "a recent retention email enforces the 24-hour global cap",
    run() {
      const result = determineRetentionNudge({
        now,
        caseSessions: [
          buildCase({
            id: "case-6",
            status: "interview",
            createdAt: "2026-03-15T08:00:00.000Z",
            updatedAt: "2026-03-16T04:00:00.000Z",
          }),
        ],
        logs: [
          buildLog({
            nudgeType: NUDGE_TYPES.RESUME_INTERVIEW,
            caseSessionId: "different-case",
            sentAt: "2026-03-16T02:00:00.000Z",
          }),
        ],
      });

      assert.equal(result.candidate, null);
      assert.equal(result.skipReason, "global_cap");
    },
  },
  {
    name: "dedupe prevents resending the same case nudge",
    run() {
      const result = determineRetentionNudge({
        now,
        caseSessions: [
          buildCase({
            id: "case-7",
            status: "courtroom",
            updatedAt: "2026-03-16T07:30:00.000Z",
          }),
        ],
        logs: [
          buildLog({
            nudgeType: NUDGE_TYPES.RESUME_COURTROOM,
            caseSessionId: "case-7",
            sentAt: "2026-03-14T02:00:00.000Z",
          }),
        ],
      });

      assert.equal(result.candidate, null);
      assert.equal(result.skipReason, "no_eligible_nudge");
    },
  },
  {
    name: "a newer active case blocks stale post-verdict nudges",
    run() {
      const result = determineRetentionNudge({
        now,
        caseSessions: [
          buildCase({
            id: "case-8",
            status: "verdict",
            updatedAt: "2026-03-15T12:00:00.000Z",
          }),
          buildCase({
            id: "case-9",
            status: "interview",
            createdAt: "2026-03-16T02:00:00.000Z",
            updatedAt: "2026-03-16T04:00:00.000Z",
          }),
        ],
        logs: [],
      });

      assert.equal(result.candidate.type, NUDGE_TYPES.RESUME_INTERVIEW);
    },
  },
  {
    name: "recommended template prefers the same category, then highest unlocked complexity",
    run() {
      const template = selectRecommendedTemplate({
        preferredCategory: "housing",
        templates: [
          { id: "1", title: "Services 5", primaryCategory: "services", complexity: 5, unlocked: true },
          { id: "2", title: "Housing 2", primaryCategory: "housing", complexity: 2, unlocked: true },
          { id: "3", title: "Housing 4", primaryCategory: "housing", complexity: 4, unlocked: true },
        ],
      });

      assert.equal(template.id, "3");
    },
  },
  {
    name: "run options parse dryRun and limit from query/body inputs",
    run() {
      const options = parseNudgeRunOptions({
        query: { dryRun: "true" },
        body: { limit: "25" },
      });

      assert.deepEqual(options, { dryRun: true, limit: 25 });
    },
  },
  {
    name: "secret validation accepts bearer and custom header tokens",
    run() {
      assert.equal(
        hasValidNudgeSecret({
          secret: "shhh",
          headers: { authorization: "Bearer shhh" },
        }),
        true
      );
      assert.equal(
        hasValidNudgeSecret({
          secret: "shhh",
          headers: { "x-email-nudge-secret": "shhh" },
        }),
        true
      );
      assert.equal(
        hasValidNudgeSecret({
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

console.log(`Passed ${passed} email nudge tests.`);
