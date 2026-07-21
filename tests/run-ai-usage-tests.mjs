import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");
const [gpt, tracker, eventModel, userModel, dynamicCase, datafast, layout, privacy] =
  await Promise.all([
    read("../libs/gpt.js"),
    read("../libs/aiUsage.js"),
    read("../models/AIUsageEvent.js"),
    read("../models/User.js"),
    read("../libs/game/dynamicCase.js"),
    read("../libs/datafast.js"),
    read("../components/LayoutClient.js"),
    read("../app/privacy-policy/page.js"),
  ]);

assert.match(gpt, /service_tier: requestedServiceTier/);
assert.match(gpt, /data\?\.service_tier \|\| requestedServiceTier/);
assert.match(gpt, /recordAIUsageEvent\(\{ userId, \.\.\.usagePayload \}\)/);
assert.match(gpt, /durationMs: Date\.now\(\) - requestStartedAt/);
assert.match(dynamicCase, /serviceTier: "priority"/);
assert.match(dynamicCase, /"gpt-5\.4-mini"/);
assert.match(dynamicCase, /promptCacheKey: "la:dynamic-case:v2"/);

assert.match(tracker, /AIUsageEvent\.create\(entry\)/);
assert.match(tracker, /aiUsageTotals\.total/);
assert.match(tracker, /aiUsageTotals\.\$\{bucket\}/);
assert.match(tracker, /tier === "priority"/);
assert.match(eventModel, /requestedServiceTier/);
assert.match(eventModel, /billingClass/);
assert.match(eventModel, /isPriority/);
assert.match(eventModel, /userId: 1, billingClass: 1/);
assert.match(userModel, /aiUsageTotals/);

assert.match(datafast, /window\.datafast\?\.\("identify", identity\)/);
assert.match(datafast, /user_id: String\(userId\)/);
assert.match(layout, /<DatafastIdentity \/>/);
assert.match(layout, /account_status: "authenticated"/);
assert.match(privacy, /associated with your account identifier across sessions and devices/);

console.log("AI usage and user identification tests passed");
