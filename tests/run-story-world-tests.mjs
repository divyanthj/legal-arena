import assert from "node:assert/strict";

const {
  buildJudgeProfile,
  buildSessionTemplateSnapshot,
  buildStoryContextForSide,
  getCanonicalStoryWorld,
  normalizeCanonicalStory,
  storyItemToText,
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

const structuredStory = normalizeCanonicalStory({
  canonicalStory: "Tenant moved out and the manager later inspected the unit.",
  storyBeats: [
    {
      beatId: "B1",
      order: 1,
      label: "Key return",
      detail: "Tenant returned keys through the office drop slot after hours.",
      status: "settled",
    },
  ],
  likelyEvidence: [
    {
      label: "Move-out photos",
      detail: "Phone photos show an empty, generally clean unit.",
      type: "photo",
      holderSide: "plaintiff",
      availabilityStatus: "confirmed",
    },
  ],
  missingOrUncertainRecords: [
    {
      label: "Move-in checklist",
      detail: "No shared move-in checklist has been found.",
    },
  ],
});

assert.equal(structuredStory.events[0].label, "Key return");
assert.equal(structuredStory.events[0].detail.includes("drop slot"), true);
assert.equal(storyItemToText(structuredStory.events[0]).includes("drop slot"), true);
assert.notEqual(structuredStory.events[0], "[object Object]");

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

const structuredContext = buildStoryContextForSide(
  { ...template, canonicalStory: structuredStory },
  "plaintiff"
);
assert.equal(structuredContext.chronologicalEvents[0].includes("drop slot"), true);
assert.equal(structuredContext.evidenceInWorld[0].includes("Move-out photos"), true);

const legacyStory = getCanonicalStoryWorld({
  overview: "Legacy overview",
  authoringNotes: "Legacy authoring notes",
  starterTheory: "Legacy theory",
  canonicalFacts: template.canonicalFacts,
  evidenceItems: [{ label: "Invoice", detail: "Cleaning invoice", availabilityStatus: "missing" }],
});
assert.equal(legacyStory.story.includes("Legacy overview"), true);
assert.equal(legacyStory.evidenceNarrative[0], "Invoice: Cleaning invoice");

const corruptedStory = getCanonicalStoryWorld({
  overview: "Legacy overview",
  canonicalStory: {
    story: "Template has a story but corrupted event values.",
    events: ["[object Object]", "[object Object]"],
  },
  canonicalFacts: template.canonicalFacts,
  evidenceItems: [],
});
assert.equal(corruptedStory.events[0], "Tenant returned keys after hours.");

const judge = buildJudgeProfile({ caseSessionId: "abc", complexity: 2 });
assert.equal(Boolean(judge.label), true);
assert.equal(judge.complexity, 2);

console.log("Story world tests passed");
