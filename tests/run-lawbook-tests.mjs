import assert from "node:assert/strict";

import {
  LAWBOOK_ALL_CATEGORIES,
  getLawbookRules,
  getLawbookRulesForCategory,
  legalArenaLawbook,
} from "../data/legalArenaLawbook.js";
import { LEGAL_CASE_CATEGORIES } from "../libs/game/categories.js";
import { pickRuleMentions } from "../libs/game/lawbookCitation.js";

const validIconKeys = new Set([
  "AdjustmentsHorizontalIcon",
  "AdjustmentsVerticalIcon",
  "ArrowPathIcon",
  "BanknotesIcon",
  "BellAlertIcon",
  "BriefcaseIcon",
  "BuildingLibraryIcon",
  "CalendarDaysIcon",
  "ChartBarIcon",
  "ChatBubbleLeftRightIcon",
  "CheckBadgeIcon",
  "ClipboardDocumentCheckIcon",
  "ClipboardDocumentListIcon",
  "DocumentTextIcon",
  "ExclamationTriangleIcon",
  "EyeIcon",
  "FingerPrintIcon",
  "FolderOpenIcon",
  "HeartIcon",
  "HomeIcon",
  "HomeModernIcon",
  "KeyIcon",
  "LifebuoyIcon",
  "ListBulletIcon",
  "MagnifyingGlassIcon",
  "MapIcon",
  "MapPinIcon",
  "ReceiptPercentIcon",
  "ReceiptRefundIcon",
  "ScaleIcon",
  "ShieldCheckIcon",
  "ShoppingBagIcon",
  "UserGroupIcon",
  "WrenchIcon",
  "WrenchScrewdriverIcon",
]);

const categorySlugs = new Set(LEGAL_CASE_CATEGORIES.map((category) => category.slug));
const rules = getLawbookRules();

assert.equal(rules, legalArenaLawbook);
assert.equal(rules.length, 40);
assert.equal(getLawbookRulesForCategory(LAWBOOK_ALL_CATEGORIES).length, rules.length);

const ids = new Set();
for (const rule of rules) {
  assert.ok(rule.id);
  assert.equal(ids.has(rule.id), false, `duplicate lawbook id: ${rule.id}`);
  ids.add(rule.id);

  assert.ok(rule.title);
  assert.ok(rule.principle);
  assert.ok(rule.guidance);
  assert.ok(Array.isArray(rule.tags));
  assert.equal(validIconKeys.has(rule.icon), true, `invalid icon key: ${rule.icon}`);

  assert.ok(rule.universal || rule.categorySlugs?.length > 0);
  for (const categorySlug of rule.categorySlugs || []) {
    assert.equal(categorySlugs.has(categorySlug), true, `invalid category: ${categorySlug}`);
  }
}

const universalRules = rules.filter((rule) => rule.universal);
assert.ok(universalRules.length >= 6);

for (const category of LEGAL_CASE_CATEGORIES) {
  const filteredRules = getLawbookRulesForCategory(category.slug);
  assert.ok(filteredRules.length > universalRules.length);
  assert.ok(universalRules.every((rule) => filteredRules.includes(rule)));
  assert.ok(filteredRules.some((rule) => rule.categorySlugs?.includes(category.slug)));
}

assert.deepEqual(
  pickRuleMentions(
    "The contract terms control first, and the burden of proof still matters.",
    rules
  ),
  ["burden-of-proof", "contract-terms-control"]
);

assert.deepEqual(
  pickRuleMentions("This argument invokes identity must be reliable.", rules),
  ["identity-must-be-reliable"]
);

console.log("Lawbook tests passed");
