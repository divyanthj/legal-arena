import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import { buildSuggestedQuestionsForSide } from "../libs/game/templateInterview.js";

const template = {
  plaintiffName: "Former Tenant",
  defendantName: "Desert Bloom Rentals LLC",
  interviewBlueprint: {
    plaintiff: {
      priorityFactIds: ["condition", "photos", "deductions"],
      suggestedQuestions: [
        "Did you clean the stove before turning in the keys?",
        "Were there nail holes when you moved out?",
        "Do you have photos showing the apartment was left in good condition?",
      ],
    },
    defendant: {
      priorityFactIds: ["condition", "photos", "deductions"],
      suggestedQuestions: [
        "Did you clean the stove before turning in the keys?",
        "Were there nail holes when you moved out?",
        "Do you have photos showing the apartment was left in good condition?",
      ],
    },
  },
  canonicalFacts: [
    {
      factId: "condition",
      label: "move-out condition",
      discoverability: { phase: "interview", priority: 3 },
      claims: [
        { party: "plaintiff", claimedDetail: "The unit was clean." },
        { party: "defendant", claimedDetail: "The unit needed cleaning." },
      ],
    },
    {
      factId: "photos",
      label: "inspection photographs",
      discoverability: { phase: "interview", priority: 2 },
      claims: [
        { party: "plaintiff", claimedDetail: "The photographs support my account." },
        { party: "defendant", claimedDetail: "Management photographed the damage." },
      ],
    },
    {
      factId: "deductions",
      label: "itemized deductions",
      discoverability: { phase: "interview", priority: 1 },
      claims: [
        { party: "plaintiff", claimedDetail: "The deductions were unsupported." },
        { party: "defendant", claimedDetail: "The deductions were justified." },
      ],
    },
  ],
  evidenceItems: [],
};

const defendantQuestions = buildSuggestedQuestionsForSide(template, "opponent");
assert.equal(defendantQuestions.length, 3);
assert.match(defendantQuestions[0], /respond to the other side/i);
assert.match(defendantQuestions[1], /support your account/i);
assert.match(defendantQuestions[2], /do you dispute/i);
assert.doesNotMatch(defendantQuestions.join(" "), /did you clean|when you moved out/i);

const nextDefendantQuestions = buildSuggestedQuestionsForSide(template, "defendant", {
  excludedQuestions: [defendantQuestions[0]],
});
assert.notDeepEqual(nextDefendantQuestions, defendantQuestions);
assert.equal(nextDefendantQuestions.includes(defendantQuestions[0]), false);

const [storeSource, engineSource, promptSource, deterministicSource] = await Promise.all([
  readFile(new URL("../libs/game/store.js", import.meta.url), "utf8"),
  readFile(new URL("../libs/game/engine.js", import.meta.url), "utf8"),
  readFile(new URL("../libs/game/templateBuilder/prompts.js", import.meta.url), "utf8"),
  readFile(
    new URL("../libs/game/templateBuilder/deterministic.js", import.meta.url),
    "utf8"
  ),
]);

assert.match(storeSource, /excludedQuestions:[\s\S]*interviewTranscript/);
assert.match(engineSource, /Every openQuestions item must be addressed/);
assert.match(promptSource, /Defendant suggestedQuestions must investigate the defense/);
assert.match(deterministicSource, /How do you respond to the claimant's account/);

console.log("Side-aware suggested-question tests passed");
