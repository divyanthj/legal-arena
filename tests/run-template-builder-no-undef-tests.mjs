import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { ESLint } from "eslint";

const templateBuilderFiles = [
  "libs/game/engine.js",
  "libs/game/generation.js",
  "libs/game/templateBuilder.js",
  "libs/game/templateBuilder/deterministic.js",
  "libs/game/templateBuilder/progress.js",
  "libs/game/templateBuilder/prompts.js",
  "libs/game/templateBuilder/repair.js",
  "libs/game/templateBuilder/schemas.js",
  "libs/game/templateBuilder/shared.js",
  "libs/game/templateBuilder/titleUtils.js",
];

const eslint = new ESLint({
  ignore: false,
  overrideConfig: {
    rules: {
      "no-undef": "error",
    },
  },
});

const results = await eslint.lintFiles(templateBuilderFiles);
const failures = [];

for (const result of results) {
  for (const message of result.messages || []) {
    if (message.fatal || message.ruleId === "no-undef") {
      failures.push(
        `${result.filePath}:${message.line}:${message.column} ${message.message}`
      );
    }
  }
}

assert.deepEqual(failures, []);

const generationSource = await readFile(
  new URL("../libs/game/generation.js", import.meta.url),
  "utf8"
);
const promptSource = await readFile(
  new URL("../libs/game/templateBuilder/prompts.js", import.meta.url),
  "utf8"
);

assert.match(generationSource, /getCategoryStoryRules/);
assert.match(generationSource, /original deposit amount and the amount withheld/);
assert.match(generationSource, /item-by-item split is disputed/);
assert.match(promptSource, /preserve the concrete deposit amount/);
assert.match(promptSource, /Do not collapse deposit and deduction amounts into vague phrases/);
assert.match(promptSource, /making the basic deposit total unknowable/);

console.log("Template builder no-undef tests passed");
