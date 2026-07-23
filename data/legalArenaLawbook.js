import { LEGAL_CASE_CATEGORIES } from "../libs/game/categories.js";

export const LAWBOOK_VERSION = "v2";
export const LAWBOOK_ALL_CATEGORIES = "all";

const universalCategorySlugs = LEGAL_CASE_CATEGORIES.map((category) => category.slug);

export const legalArenaLawbook = [
  {
    id: "burden-of-proof",
    title: "Rule 1: The Claim Needs Proof",
    principle:
      "The side asking the court for relief must point to specific facts, records, or testimony that support the request.",
    guidance:
      "Strong arguments cite dates, documents, and direct observations instead of broad accusations.",
    tags: ["evidence", "records", "credibility", "criminal"],
    categorySlugs: universalCategorySlugs,
    universal: true,
    icon: "ScaleIcon",
  },
  {
    id: "reliable-records",
    title: "Rule 2: Reliable Records Beat Vague Stories",
    principle:
      "Receipts, photos, timestamps, and written messages usually carry more weight than unsupported recollections.",
    guidance:
      "When stories conflict, the side with consistent records gains credibility.",
    tags: ["records", "evidence", "credibility", "criminal"],
    categorySlugs: universalCategorySlugs,
    universal: true,
    icon: "DocumentTextIcon",
  },
  {
    id: "credibility-under-pressure",
    title: "Rule 3: Credibility Turns on Consistency",
    principle:
      "When timelines shift or witnesses contradict themselves, the court becomes more cautious about accepting the accusation.",
    guidance:
      "Arguments are stronger when they identify inconsistencies and tie them to the burden of proof.",
    tags: ["criminal", "credibility", "records"],
    categorySlugs: universalCategorySlugs,
    universal: true,
    icon: "ChatBubbleLeftRightIcon",
  },
  {
    id: "notice-and-fair-warning",
    title: "Rule 4: Fair Notice Matters",
    principle:
      "A party should warn the other side about important problems before imposing a major penalty or withholding money.",
    guidance:
      "Late surprise claims are weaker than issues raised promptly and clearly.",
    tags: ["notice", "fairness", "housing", "services"],
    categorySlugs: universalCategorySlugs,
    universal: true,
    icon: "BellAlertIcon",
  },
  {
    id: "mitigation-and-reasonableness",
    title: "Rule 5: Losses Must Be Handled Reasonably",
    principle:
      "A party should take sensible steps to reduce avoidable harm instead of letting losses grow unnecessarily.",
    guidance:
      "Courts favor practical responses over inflated or strategic escalation.",
    tags: ["reasonableness", "damages", "services", "employment"],
    categorySlugs: universalCategorySlugs,
    universal: true,
    icon: "WrenchScrewdriverIcon",
  },
  {
    id: "proportional-remedy",
    title: "Rule 6: The Remedy Should Match the Harm",
    principle:
      "The requested outcome should be tied to the proven injury and not exceed what fairness requires.",
    guidance:
      "Narrow, well-supported remedies usually land better than sweeping demands.",
    tags: ["damages", "remedy", "fairness"],
    categorySlugs: universalCategorySlugs,
    universal: true,
    icon: "AdjustmentsHorizontalIcon",
  },
  {
    id: "procedure-shapes-fairness",
    title: "Rule 7: Procedure Protects Fairness",
    principle:
      "The court considers whether investigators, agencies, or accusers followed a fair process before relying on the result.",
    guidance:
      "Sloppy notice, weak verification, or rushed procedure can undermine the case even when suspicion exists.",
    tags: ["criminal", "notice", "fairness", "administrative"],
    categorySlugs: universalCategorySlugs,
    universal: true,
    icon: "ClipboardDocumentCheckIcon",
  },
  {
    id: "presumption-and-proof",
    title: "Rule 8: Suspicion Is Not Proof",
    principle:
      "Accusation alone is not enough; the record must support each key element with reliable proof.",
    guidance:
      "Weak inferences and shaky identifications carry less weight than direct evidence and consistent testimony.",
    tags: ["criminal", "evidence", "credibility"],
    categorySlugs: universalCategorySlugs,
    universal: true,
    icon: "ShieldCheckIcon",
  },
  {
    id: "ordinary-wear-vs-damage",
    title: "Rule 9: Ordinary Wear Is Not Misconduct",
    principle:
      "Normal use over time is treated differently from negligent or intentional damage.",
    guidance:
      "The court weighs whether the claimed harm is routine wear or something exceptional.",
    tags: ["housing", "damage", "fairness"],
    categorySlugs: ["rental-dispute", "property"],
    icon: "HomeModernIcon",
  },
  {
    id: "habitability-before-rent-pressure",
    title: "Rule 10: Habitability Changes the Rent Story",
    principle:
      "A serious living-condition problem can affect how the court views rent, repairs, access, and possession.",
    guidance:
      "Tie habitability arguments to specific defects, notice, and the landlord's response time.",
    tags: ["housing", "repairs", "notice"],
    categorySlugs: ["rental-dispute"],
    icon: "HomeIcon",
  },
  {
    id: "deposit-deductions-need-itemization",
    title: "Rule 11: Deposit Deductions Need Detail",
    principle:
      "A security-deposit deduction is stronger when it is itemized, timely, and tied to actual costs.",
    guidance:
      "Challenge broad deductions by asking what was withheld, why, when notice was sent, and what proof supports the amount.",
    tags: ["housing", "damages", "records"],
    categorySlugs: ["rental-dispute"],
    icon: "ReceiptRefundIcon",
  },
  {
    id: "eviction-requires-authority",
    title: "Rule 12: Eviction Requires Legal Authority",
    principle:
      "A party seeking possession must connect the requested eviction to lease terms, notice, and a lawful basis.",
    guidance:
      "The court looks for a clean chain from default or violation to notice to requested possession.",
    tags: ["housing", "notice", "remedy"],
    categorySlugs: ["rental-dispute", "property"],
    icon: "KeyIcon",
  },
  {
    id: "support-depends-on-ability-and-need",
    title: "Rule 13: Support Turns on Need and Ability",
    principle:
      "Support arguments are strongest when they address both one party's need and the other party's ability to pay.",
    guidance:
      "Use income, expenses, childcare, health, and work capacity instead of moral blame alone.",
    tags: ["family", "support", "money"],
    categorySlugs: ["marital-dispute"],
    icon: "BanknotesIcon",
  },
  {
    id: "shared-obligations-survive-conflict",
    title: "Rule 14: Shared Obligations Still Count",
    principle:
      "Relationship conflict does not erase shared financial, parenting, or property responsibilities.",
    guidance:
      "Separate emotional grievances from obligations the court can actually enforce.",
    tags: ["family", "property", "fairness"],
    categorySlugs: ["marital-dispute"],
    icon: "UserGroupIcon",
  },
  {
    id: "best-interest-centers-the-child",
    title: "Rule 15: Child Issues Center the Child",
    principle:
      "When a dispute affects a child, the court focuses on stability, safety, caregiving, and practical routines.",
    guidance:
      "Arguments should show how the requested outcome helps the child rather than punishing the other adult.",
    tags: ["family", "child", "safety"],
    categorySlugs: ["marital-dispute"],
    icon: "HeartIcon",
  },
  {
    id: "fiduciary-duty-in-business",
    title: "Rule 17: Business Partners Owe Loyalty",
    principle:
      "Partners, founders, and managers with entrusted authority must act loyally and avoid self-dealing.",
    guidance:
      "Look for undisclosed conflicts, diverted opportunities, secret payments, or decisions made for personal gain.",
    tags: ["business", "fiduciary", "trust"],
    categorySlugs: ["business-dispute"],
    icon: "BriefcaseIcon",
  },
  {
    id: "business-records-define-the-deal",
    title: "Rule 18: Business Records Define the Deal",
    principle:
      "Operating agreements, invoices, ledgers, emails, and meeting notes can establish what the parties actually agreed to do.",
    guidance:
      "A practical paper trail often beats after-the-fact descriptions of business expectations.",
    tags: ["business", "records", "agreement"],
    categorySlugs: ["business-dispute", "contract-violation"],
    icon: "FolderOpenIcon",
  },
  {
    id: "lost-profits-need-a-foundation",
    title: "Rule 19: Lost Profits Need a Foundation",
    principle:
      "A claim for lost profits must rest on concrete assumptions, not optimistic projections.",
    guidance:
      "Use prior sales, signed orders, market data, and cost offsets to separate proof from speculation.",
    tags: ["business", "damages", "money"],
    categorySlugs: ["business-dispute"],
    icon: "ChartBarIcon",
  },
  {
    id: "contract-terms-control",
    title: "Rule 21: Contract Terms Control First",
    principle:
      "When a valid agreement addresses the disputed issue, the court starts with the contract's words.",
    guidance:
      "Quote the exact obligation, deadline, condition, or remedy before arguing fairness around it.",
    tags: ["contract", "terms", "records"],
    categorySlugs: ["contract-violation"],
    icon: "DocumentTextIcon",
  },
  {
    id: "material-breach-changes-remedies",
    title: "Rule 22: Material Breach Changes Remedies",
    principle:
      "Not every mistake justifies ending performance; the breach must matter enough to affect the bargain.",
    guidance:
      "Explain why the failure was central, repeated, costly, or curable before asking for a major remedy.",
    tags: ["contract", "breach", "remedy"],
    categorySlugs: ["contract-violation"],
    icon: "ExclamationTriangleIcon",
  },
  {
    id: "conditions-must-happen-first",
    title: "Rule 23: Conditions Must Happen First",
    principle:
      "If a duty depends on a condition, the court asks whether that condition actually occurred or was excused.",
    guidance:
      "Find approval clauses, delivery milestones, payment triggers, inspection rights, and notice requirements.",
    tags: ["contract", "conditions", "performance"],
    categorySlugs: ["contract-violation"],
    icon: "CheckBadgeIcon",
  },
  {
    id: "wages-need-clear-accounting",
    title: "Rule 25: Pay Claims Need Clear Accounting",
    principle:
      "Wage, commission, and reimbursement disputes turn on what was earned, paid, withheld, and documented.",
    guidance:
      "Use pay stubs, schedules, policies, approvals, and exact calculations.",
    tags: ["employment", "wages", "records"],
    categorySlugs: ["employment"],
    icon: "BanknotesIcon",
  },
  {
    id: "discipline-needs-consistent-standards",
    title: "Rule 26: Discipline Needs Consistency",
    principle:
      "Workplace discipline is stronger when the employer applied clear standards consistently.",
    guidance:
      "Compare similarly situated workers, prior warnings, handbook rules, and documented performance issues.",
    tags: ["employment", "discipline", "fairness"],
    categorySlugs: ["employment"],
    icon: "ClipboardDocumentListIcon",
  },
  {
    id: "retaliation-turns-on-causation",
    title: "Rule 27: Retaliation Requires a Link",
    principle:
      "A retaliation theory needs a connection between protected activity and the adverse action.",
    guidance:
      "Timing helps, but stronger arguments add decision-maker knowledge, changed treatment, or inconsistent explanations.",
    tags: ["employment", "retaliation", "causation"],
    categorySlugs: ["employment"],
    icon: "ArrowPathIcon",
  },
  {
    id: "possession-needs-better-right",
    title: "Rule 29: Possession Needs the Better Right",
    principle:
      "A property dispute turns on who has the stronger legal or practical right to possess or control the property.",
    guidance:
      "Use title, lease terms, registration, payment records, access history, and consent.",
    tags: ["property", "possession", "title"],
    categorySlugs: ["property"],
    icon: "MapPinIcon",
  },
  {
    id: "damage-value-needs-proof",
    title: "Rule 30: Property Damage Needs Value Proof",
    principle:
      "Damage claims require proof of condition, cause, repair cost, or loss of value.",
    guidance:
      "Photos help, but invoices, estimates, age, and preexisting condition often decide the amount.",
    tags: ["property", "damage", "records"],
    categorySlugs: ["property", "personal-injury"],
    icon: "WrenchIcon",
  },
  {
    id: "access-and-boundaries-matter",
    title: "Rule 31: Boundaries and Access Matter",
    principle:
      "Use of property depends on boundaries, permission, easements, and prior access arrangements.",
    guidance:
      "Pin the dispute to maps, notices, gate codes, keys, surveys, or repeated patterns of access.",
    tags: ["property", "access", "boundaries"],
    categorySlugs: ["property"],
    icon: "MapIcon",
  },
  {
    id: "negligence-needs-duty-breach-causation",
    title: "Rule 33: Negligence Needs the Chain",
    principle:
      "A personal-injury claim needs duty, breach, causation, and harm to line up.",
    guidance:
      "The argument should connect unsafe conduct to the injury without skipping causation.",
    tags: ["injury", "negligence", "causation"],
    categorySlugs: ["personal-injury"],
    icon: "LifebuoyIcon",
  },
  {
    id: "comparative-fault-reduces-recovery",
    title: "Rule 34: Fault Can Be Shared",
    principle:
      "If both sides contributed to an injury, the court may reduce recovery to reflect comparative fault.",
    guidance:
      "Address warning signs, choices, timing, visibility, and whether the injured party acted reasonably.",
    tags: ["injury", "fault", "damages"],
    categorySlugs: ["personal-injury"],
    icon: "ScaleIcon",
  },
  {
    id: "medical-proof-connects-injury",
    title: "Rule 35: Medical Proof Connects Injury",
    principle:
      "Injury damages are stronger when medical records connect symptoms, treatment, and limitations to the event.",
    guidance:
      "Gaps in treatment, prior conditions, and vague pain claims need careful handling.",
    tags: ["injury", "medical", "records"],
    categorySlugs: ["personal-injury"],
    icon: "HeartIcon",
  },
  {
    id: "consumer-promises-must-be-honored",
    title: "Rule 37: Consumer Promises Count",
    principle:
      "A seller or service provider is held to specific promises about price, quality, timing, and deliverables.",
    guidance:
      "Quote ads, receipts, invoices, chat messages, warranties, and service descriptions.",
    tags: ["consumer", "services", "contract"],
    categorySlugs: ["consumer", "contract-violation"],
    icon: "ShoppingBagIcon",
  },
  {
    id: "fees-need-disclosure",
    title: "Rule 38: Fees Need Disclosure",
    principle:
      "Unexpected fees are weaker when they were not clearly disclosed before the customer committed.",
    guidance:
      "Compare what the customer saw before purchase with the charge later imposed.",
    tags: ["consumer", "fees", "notice"],
    categorySlugs: ["consumer"],
    icon: "ReceiptPercentIcon",
  },
  {
    id: "repair-opportunity-can-matter",
    title: "Rule 39: A Chance to Cure Can Matter",
    principle:
      "For product or service problems, the court may consider whether the provider had a fair chance to fix the issue.",
    guidance:
      "Show requests for repair, responses, delays, repeat failures, or refusal to correct the problem.",
    tags: ["consumer", "services", "repair"],
    categorySlugs: ["consumer", "contract-violation"],
    icon: "WrenchScrewdriverIcon",
  },
  {
    id: "deceptive-practice-needs-materiality",
    title: "Rule 40: Deception Must Matter",
    principle:
      "A misleading statement matters most when it would affect a reasonable person's decision to buy, pay, or continue.",
    guidance:
      "Tie the alleged deception to price, safety, quality, timing, or another meaningful choice.",
    tags: ["consumer", "misrepresentation", "fairness"],
    categorySlugs: ["consumer", "business-dispute"],
    icon: "EyeIcon",
  },
  {
    id: "elements-must-be-proven",
    title: "Rule 41: Each Element Must Be Proven",
    principle:
      "In a criminal matter, every required element must be supported by reliable evidence.",
    guidance:
      "Attack the missing element directly instead of arguing only general unfairness.",
    tags: ["criminal", "elements", "proof"],
    categorySlugs: ["criminal"],
    icon: "ListBulletIcon",
  },
  {
    id: "identity-must-be-reliable",
    title: "Rule 42: Identity Evidence Must Be Reliable",
    principle:
      "The court treats identification evidence cautiously when visibility, memory, procedure, or bias is in doubt.",
    guidance:
      "Focus on lighting, distance, timing, prior familiarity, lineup procedure, and inconsistent descriptions.",
    tags: ["criminal", "identity", "credibility"],
    categorySlugs: ["criminal"],
    icon: "FingerPrintIcon",
  },
  {
    id: "search-and-seizure-limits-evidence",
    title: "Rule 43: Search Limits Can Shape Evidence",
    principle:
      "Evidence obtained through an unlawful or unreliable search process may carry less force or be excluded in the simulation.",
    guidance:
      "Ask who searched, why, what authority they had, and whether the record supports the search basis.",
    tags: ["criminal", "procedure", "evidence"],
    categorySlugs: ["criminal"],
    icon: "MagnifyingGlassIcon",
  },
  {
    id: "agency-decision-needs-record-support",
    title: "Rule 45: Agency Decisions Need Record Support",
    principle:
      "Administrative decisions are stronger when the agency can point to evidence in the record for each finding.",
    guidance:
      "Separate what the agency found from what the record actually proves.",
    tags: ["administrative", "records", "agency"],
    categorySlugs: ["administrative"],
    icon: "BuildingLibraryIcon",
  },
  {
    id: "exhaustion-and-deadlines-matter",
    title: "Rule 46: Deadlines and Channels Matter",
    principle:
      "Administrative relief may depend on using the correct appeal path and meeting required deadlines.",
    guidance:
      "Check filing dates, notice dates, required forms, and whether internal remedies were used.",
    tags: ["administrative", "deadlines", "procedure"],
    categorySlugs: ["administrative"],
    icon: "CalendarDaysIcon",
  },
  {
    id: "agency-discretion-has-limits",
    title: "Rule 47: Discretion Has Limits",
    principle:
      "An agency may have discretion, but it cannot act arbitrarily, ignore required factors, or rely on forbidden ones.",
    guidance:
      "Show inconsistency, missing findings, irrelevant considerations, or unexplained departures from practice.",
    tags: ["administrative", "discretion", "fairness"],
    categorySlugs: ["administrative"],
    icon: "AdjustmentsVerticalIcon",
  },
];

export const getLawbookRules = () => legalArenaLawbook;

export const getLawbookRulesForCategory = (categorySlug = LAWBOOK_ALL_CATEGORIES) => {
  if (
    !categorySlug ||
    categorySlug === LAWBOOK_ALL_CATEGORIES ||
    categorySlug === "current-events"
  ) {
    return legalArenaLawbook;
  }

  return legalArenaLawbook.filter(
    (rule) => rule.universal || rule.categorySlugs?.includes(categorySlug)
  );
};

export const getLawbookRuleById = (ruleId) =>
  legalArenaLawbook.find((rule) => rule.id === ruleId) || null;
