import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { annotateSettlementMoodReactions } from "../libs/game/settlementMoodReactions.mjs";

const transcript = annotateSettlementMoodReactions(
  [
    {
      role: "player",
      text: "We can resolve this for the revised amount.",
      moodSnapshot: { player: 12, opponent: -4 },
    },
    {
      role: "opponent",
      text: "We are prepared to keep talking.",
      moodSnapshot: { player: 21, opponent: -10 },
    },
    {
      role: "client",
      text: "That protects what matters most.",
      moodSnapshot: { player: 21, opponent: -10 },
    },
  ],
  { playerName: "Maya Chen", opponentName: "Northstar Ltd" }
);

assert.deepEqual(transcript[0].moodReactions, []);
assert.deepEqual(
  transcript[1].moodReactions.map(({ key, delta, tone, label }) => ({ key, delta, tone, label })),
  [
    {
      key: "player",
      delta: 9,
      tone: "positive",
      label: "Maya Chen liked this proposal",
    },
    {
      key: "opponent",
      delta: -6,
      tone: "negative",
      label: "Northstar Ltd became less receptive",
    },
  ]
);
assert.deepEqual(transcript[2].moodReactions, []);

const workspaceSource = await readFile(
  new URL("../components/legal-arena/CaseWorkspace.js", import.meta.url),
  "utf8"
);
assert.match(workspaceSource, /Include the essentials/);
assert.match(workspaceSource, /Concrete amount or terms/);
assert.match(workspaceSource, /Timing or deadline/);
assert.match(workspaceSource, /Requested next step/);
assert.match(workspaceSource, /Reaction to this exchange/);

console.log("Settlement mood reaction tests passed.");
