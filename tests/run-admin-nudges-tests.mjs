import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  getNudgeWarnings,
  hasTemplateFraming,
  normalizeNudgeSuggestions,
  validateManualNudgeDraft,
} from "../libs/adminNudgesCore.mjs";

const ctaByConcept = {
  resume_intake: { label: "Resume intake", path: "/dashboard/cases/example" },
  next_case: { label: "Choose your next case", path: "/dashboard" },
  award_progress: { label: "View achievements", path: "/dashboard" },
};

const suggestions = normalizeNudgeSuggestions(
  {
    suggestions: [
      {
        conceptKey: "resume_intake",
        title: "Finish the open intake",
        rationale: "An intake is currently open.",
        subject: "Your open matter is ready",
        message: "Hello Counsel,\n\nYour open matter is ready for the next question.\n\nRegards,\nLegal Arena",
        ctaPath: "https://attacker.invalid",
      },
      {
        conceptKey: "next_case",
        title: "Build on the last result",
        rationale: "The player recently completed a matter.",
        subject: "Ready for another matter?",
        message: "A new matter can keep your recent momentum moving.",
      },
      {
        conceptKey: "award_progress",
        title: "Keep the award streak moving",
        rationale: "There is recent award progress.",
        subject: "Your achievements are growing",
        message: "One more focused matter could add to your achievements.",
      },
      {
        conceptKey: "not_allowed",
        title: "Unsafe",
        rationale: "Invalid concept.",
        subject: "Unsafe",
        message: "Unsafe",
      },
    ],
  },
  { ctaByConcept }
);

assert.equal(suggestions.length, 3);
assert.equal(suggestions[0].message, "Your open matter is ready for the next question.");
assert.equal(suggestions[0].ctaPath, "/dashboard/cases/example");
assert.equal(hasTemplateFraming(suggestions[0].message), false);

const now = new Date("2026-07-16T12:00:00.000Z");
const warnings = getNudgeWarnings({
  now,
  conceptKey: "next_case",
  logs: [
    {
      sentAt: "2026-07-16T06:00:00.000Z",
      meta: { conceptKey: "resume_intake" },
    },
    {
      sentAt: "2026-07-01T12:00:00.000Z",
      meta: { conceptKey: "next_case" },
    },
  ],
});
assert.deepEqual(warnings.map((warning) => warning.code), ["recent_nudge", "duplicate_concept"]);

assert.deepEqual(
  validateManualNudgeDraft({
    conceptKey: "next_case",
    subject: " A useful next matter ",
    message: " Pick a fresh matter while your recent lessons are still clear. ",
  }),
  {
    conceptKey: "next_case",
    subject: "A useful next matter",
    message: "Pick a fresh matter while your recent lessons are still clear.",
  }
);
assert.throws(
  () =>
    validateManualNudgeDraft({
      conceptKey: "next_case",
      subject: "Next matter",
      message: "Hi Counsel,\n\nPick another matter.",
    }),
  /Remove the greeting/
);

const serviceSource = await readFile(new URL("../libs/adminNudges.js", import.meta.url), "utf8");
const activitySelects = [...serviceSource.matchAll(/\.select\(\s*\n?\s*"([^"]+)"/g)].map((match) => match[1]);
assert.ok(activitySelects.length >= 3, "activity queries should use explicit field selection");
assert.doesNotMatch(activitySelects.join(" "), /interviewTranscript|courtroomTranscript/);
const packetStart = serviceSource.indexOf("export const buildAdminNudgeActivityPacket");
const packetEnd = serviceSource.indexOf("const getSuppression", packetStart);
const packetSource = serviceSource.slice(packetStart, packetEnd);
assert.doesNotMatch(packetSource, /\bemail\b/i, "the AI activity packet must not include email");
assert.doesNotMatch(packetSource, /interviewTranscript|courtroomTranscript/);
assert.match(serviceSource, /EmailSuppression/);
assert.match(serviceSource, /overrideWarnings/);
assert.match(serviceSource, /ADMIN_NUDGE_TYPE/);
assert.match(serviceSource, /message: draft\.message/);
assert.match(serviceSource, /getAdminNudgeDirectoryData/);

for (const routePath of [
  "../app/api/admin/nudges/analyze/route.js",
  "../app/api/admin/nudges/send/route.js",
]) {
  const routeSource = await readFile(new URL(routePath, import.meta.url), "utf8");
  assert.match(routeSource, /requireAdminSession/);
}

const directorySource = await readFile(
  new URL("../components/legal-arena/BarAssociationDirectory.js", import.meta.url),
  "utf8"
);
assert.match(directorySource, /isAdmin && !isViewer && entry\.canReceiveAdminNudge/);
assert.match(directorySource, /Subject/);
assert.match(directorySource, /Message body/);
assert.match(directorySource, /Last nudge sent/);
assert.match(directorySource, /messageAvailable/);

console.log("Admin nudge tests passed.");
