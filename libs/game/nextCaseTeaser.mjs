const TEASER_HOOKS = {
  "current-events": [
    {
      key: "headline-public-decision",
      headline: "A fictional dispute drawn from a decision shaping today’s headlines",
      challenge:
        "Separate reported claims from provable facts, then decide whether negotiation or court creates the stronger result.",
    },
    {
      key: "headline-public-pressure",
      headline: "A current public controversy rebuilt as a contested legal matter",
      challenge:
        "Test competing accounts, incomplete reporting, and the evidence each fictional party can actually prove.",
    },
  ],
  "rental-dispute": [
    {
      key: "rental-deposit-repairs",
      headline: "A withheld deposit after months of disputed repair complaints",
      challenge:
        "Conflicting inspection notes, photographs, and move-out messages will determine which account survives.",
    },
    {
      key: "rental-notice-habitability",
      headline: "A notice dispute with habitability complaints on both sides",
      challenge:
        "Build a reliable timeline and decide whether the records support possession, compensation, or a negotiated exit.",
    },
  ],
  "marital-dispute": [
    {
      key: "marital-shared-obligations",
      headline: "A separation dispute over shared expenses and an unwritten promise",
      challenge:
        "Messages, payment records, and competing memories will test what each person actually agreed to.",
    },
    {
      key: "marital-property-support",
      headline: "A family dispute over support, property, and conflicting expectations",
      challenge:
        "Distinguish emotional grievances from the obligations and evidence that can support a practical resolution.",
    },
  ],
  "business-dispute": [
    {
      key: "business-founder-payment",
      headline: "A founder payment dispute hidden inside contradictory messages",
      challenge:
        "Invoices, ownership expectations, and an ambiguous approval trail will force you to choose the strongest commercial theory.",
    },
    {
      key: "business-vendor-performance",
      headline: "A vendor relationship that collapsed after disputed performance",
      challenge:
        "Work out whether late delivery, changed requirements, or unpaid work caused the commercial breakdown.",
    },
  ],
  "contract-violation": [
    {
      key: "contract-changed-terms",
      headline: "A contract dispute over changed terms and unfinished work",
      challenge:
        "Compare the written agreement with later messages and decide whether they changed the parties’ obligations.",
    },
    {
      key: "contract-payment-delivery",
      headline: "A payment claim with conflicting accounts of delivery",
      challenge:
        "Use records, timing, and witness accounts to prove whether performance was complete, defective, or refused.",
    },
  ],
  employment: [
    {
      key: "employment-dismissal-records",
      headline: "A dismissal challenged by disputed performance records",
      challenge:
        "Conflicting reviews, emails, and witness accounts will test whether the stated reason holds up.",
    },
    {
      key: "employment-pay-policy",
      headline: "A workplace pay dispute complicated by an inconsistently applied policy",
      challenge:
        "Trace the policy, exceptions, and manager communications to decide what the employee was actually owed.",
    },
  ],
  property: [
    {
      key: "property-boundary-use",
      headline: "A boundary dispute built around years of informal use",
      challenge:
        "Photographs, plans, and neighbor accounts will test whether long practice or formal title controls.",
    },
    {
      key: "property-possession-notice",
      headline: "A possession dispute with competing notices and a broken timeline",
      challenge:
        "Reconstruct who knew what and when before choosing the strongest claim to the property.",
    },
  ],
  "personal-injury": [
    {
      key: "injury-unsafe-premises",
      headline: "An injury claim after warnings about an unsafe condition",
      challenge:
        "Incident accounts, photographs, and prior complaints will determine whether the risk was foreseeable.",
    },
    {
      key: "injury-conflicting-accounts",
      headline: "A negligence claim with sharply conflicting accounts of the accident",
      challenge:
        "Test causation and credibility without overclaiming what the available records can prove.",
    },
  ],
  consumer: [
    {
      key: "consumer-refund-promises",
      headline: "A refund dispute after contradictory sales promises",
      challenge:
        "Compare advertising, receipts, and support messages to show what the buyer was reasonably promised.",
    },
    {
      key: "consumer-fees-service",
      headline: "A service complaint with unexplained fees and incomplete records",
      challenge:
        "Separate poor service from provable unfair conduct and identify the remedy the evidence supports.",
    },
  ],
  criminal: [
    {
      key: "criminal-stop-timeline",
      headline: "A late-night stop with a missing minute in the official timeline",
      challenge:
        "Test procedure, possession, and witness reliability before choosing the defense theory that fits the record.",
    },
    {
      key: "criminal-identification",
      headline: "A disputed identification complicated by inconsistent witnesses",
      challenge:
        "Compare opportunity, memory, and corroborating evidence without assuming any hidden version is true.",
    },
  ],
  administrative: [
    {
      key: "administrative-permit-delay",
      headline: "A permit delay shaped by inconsistent agency instructions",
      challenge:
        "Notices, submission records, and shifting explanations will determine whether the process was lawfully handled.",
    },
    {
      key: "administrative-license-record",
      headline: "A licensing decision challenged by an incomplete administrative record",
      challenge:
        "Identify the missing reasoning and decide whether correction, reconsideration, or appeal is the best route.",
    },
  ],
};

const stableWeight = (value = "") =>
  String(value)
    .split("")
    .reduce(
      (total, character, index) =>
        (total + character.charCodeAt(0) * (index + 1)) % 2147483647,
      0
    );

export const buildNextCaseTeaser = ({
  recommendation = {},
  sourceCaseId = "",
  playerId = "",
  countryCode = "US",
} = {}) => {
  const categorySlug = recommendation.categorySlug || "contract-violation";
  const hooks =
    TEASER_HOOKS[categorySlug] || TEASER_HOOKS["contract-violation"];
  const complexity = Math.max(
    1,
    Math.min(5, Number(recommendation.complexity) || 1)
  );
  const hook =
    hooks[
      stableWeight(
        `${playerId}:${sourceCaseId}:${categorySlug}:${complexity}:${countryCode}`
      ) % hooks.length
    ];

  return {
    key: `${hook.key}:level-${complexity}:${String(countryCode || "US").toLowerCase()}`,
    headline: hook.headline,
    challenge: hook.challenge,
    categoryTitle: recommendation.categoryTitle || categorySlug,
    complexity,
    countryCode: String(countryCode || "US").toUpperCase(),
  };
};

export const buildTeaserScenarioHint = (teaser = {}) =>
  [teaser.headline, teaser.challenge].filter(Boolean).join(". ");
