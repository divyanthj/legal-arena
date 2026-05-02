import assert from "node:assert/strict";
import { ESLint } from "eslint";

const templateBuilderFiles = [
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

console.log("Template builder no-undef tests passed");
