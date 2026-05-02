import assert from "node:assert/strict";

const {
  buildJudgeProfile,
  buildSessionTemplateSnapshot,
  buildStoryContextForSide,
  getCanonicalStoryWorld,
  normalizeCanonicalStory,
} = await import("../libs/game/storyWorld.js");

const story = normalizeCanonicalStory({
  canonicalStory: "Tenant moved out and the manager later inspected the unit.",
  storyBeats: ["Tenant returned keys after hours.", "Manager inspected the next day."],
  plaintiffPressurePoints: ["Photos do not show every angle."],
  defendantPressurePoints: ["Invoices are incomplete."],
  likelyEvidence: ["Move-out photos", "Cleaning invoice"],
  missingOrUncertainRecords: ["No move-in checklist"],
});

assert.equal(story.story.includes("Tenant moved out"), true);
assert.equal(story.events.length, 2);
assert.equal(story.partyMentalStates.plaintiff[0], "Photos do not show every angle.");
assert.equal(story.evidenceNarrative.length, 2);
assert.equal(story.ambiguities[0], "No move-in checklist");

const template = {
  id: "template-1",
  slug: "deposit-fight",
  title: "Deposit Fight",
  overview: "A deposit dispute.",
  desiredRelief: "Return the deposit.",
  openingStatement: "I want my deposit back.",
  starterTheory: "The withholding was not supported.",
  practiceArea: "Landlord-Tenant",
  primaryCategory: "rental-dispute",
  complexity: 1,
  courtName: "Small Claims Court",
  plaintiffName: "Tenant",
  defendantName: "Landlord",
  canonicalStory: story,
  canonicalFacts: [
    {
      factId: "F1",
      label: "Keys returned",
      canonicalDetail: "Tenant returned keys after hours.",
      claims: [
        { party: "plaintiff", claimedDetail: "I returned the keys after hours." },
        { party: "defendant", claimedDetail: "The keys were returned after hours." },
      ],
    },
  ],
  evidenceItems: [],
};

const snapshot = buildSessionTemplateSnapshot(template);
assert.equal(snapshot.canonicalStory.events[0], "Tenant returned keys after hours.");

const defendantStory = buildStoryContextForSide(template, "defendant");
assert.equal(defendantStory.myMentalState[0], "Invoices are incomplete.");

const legacyStory = getCanonicalStoryWorld({
  overview: "Legacy overview",
  authoringNotes: "Legacy authoring notes",
  starterTheory: "Legacy theory",
  canonicalFacts: template.canonicalFacts,
  evidenceItems: [{ label: "Invoice", detail: "Cleaning invoice", availabilityStatus: "missing" }],
});
assert.equal(legacyStory.story.includes("Legacy overview"), true);
assert.equal(legacyStory.evidenceNarrative[0], "Invoice: Cleaning invoice");

const judge = buildJudgeProfile({ caseSessionId: "abc", complexity: 2 });
assert.equal(Boolean(judge.label), true);
assert.equal(judge.complexity, 2);

console.log("Story world tests passed");
