import "server-only";

import CaseTemplate from "@/models/CaseTemplate";
import { requestStructuredCompletion } from "@/libs/gpt";
import { DEFAULT_CATEGORY_SLUG, getCategoryBySlug } from "./categories";
import {
  enrichTemplateForGameplay,
  normalizeTemplateParty,
  normalizeEvidenceAvailabilityStatus,
  normalizeEvidenceHolderSide,
} from "./templateInterview";
import { validateCaseTemplatePayload } from "./templates";

const DEFAULT_GENERATION_MODEL =
  process.env.OPENAI_GENERATION_MODEL?.trim() ||
  process.env.OPENAI_MODEL?.trim() ||
  "gpt-5.4";

const categoryLegalTagDefaults = {
  "rental-dispute": ["housing", "notice", "records", "damage", "remedy"],
  "marital-dispute": ["fairness", "records", "credibility", "remedy"],
  "business-dispute": ["records", "reasonableness", "damages", "fairness"],
  "contract-violation": ["records", "reasonableness", "remedy", "evidence"],
  employment: ["employment", "notice", "records", "fairness"],
  property: ["records", "notice", "fairness", "remedy"],
  "personal-injury": ["evidence", "records", "damages", "credibility"],
  consumer: ["records", "fairness", "reasonableness", "remedy"],
  criminal: ["criminal", "evidence", "credibility", "records"],
  administrative: ["administrative", "notice", "records", "fairness"],
};

const ALLOWED_EVIDENCE_TYPES = new Set([
  "document",
  "photo",
  "message",
  "invoice",
  "witness",
  "record",
  "other",
]);

const uniqueList = (items = []) =>
  [...new Set((items || []).map((item) => String(item || "").trim()).filter(Boolean))];
const normalizeLookupKey = (value = "") =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const GENERATION_STAGE_LABELS = {
  story: "Writing story",
  details: "Adding details",
  plausibility: "Checking plausibility",
  template: "Building template",
  repair: "Repairing issues",
  interview: "Verifying interview plan",
  complete: "Complete",
};

const slugify = (value = "") =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);

const normalizeClientIntakeStatement = (value = "") => {
  const text = String(value || "").trim();

  if (!text) {
    return "";
  }

  return text
    .replace(/^\s*your honou?r[:,]?\s*/i, "")
    .replace(/^\s*may it please the court[:,]?\s*/i, "")
    .replace(/^\s*counsel[:,]?\s*/i, "")
    .replace(/\bthe plaintiff\b/gi, "I")
    .replace(/\bthe defendant\b/gi, "they")
    .replace(/\bour client\b/gi, "I")
    .replace(/\bmy client\b/gi, "I")
    .replace(/\bwe will demonstrate that\b/gi, "I can show that")
    .replace(/\bwe will show that\b/gi, "I can show that")
    .replace(/\bis entitled to\b/gi, "should receive")
    .replace(/\bthe fees agreed upon\b/gi, "the agreed fees")
    .replace(/\bwithout justification\b/gi, "without a real explanation")
    .replace(/\s{2,}/g, " ")
    .trim();
};

const sanitizeClaimText = (value = "") => {
  const text = String(value || "").trim();

  if (!text) {
    return "";
  }

  return text
    .replace(
      /\bthey are going to dispute this and say it does not prove my side:\s*/gi,
      ""
    )
    .replace(/\bfrom the modeled claims\b/gi, "")
    .replace(/\bmodeled claims?\b/gi, "what I remember")
    .replace(/\bmodelled claims?\b/gi, "what I remember")
    .replace(/\bclient account pending refinement\b/gi, "I need to explain that more clearly")
    .replace(/\bthe client alleges\b/gi, "I said")
    .replace(/\bthe client\b/gi, "I")
    .replace(/\bthe opponent\b/gi, "they")
    .replace(/\bI don't have (a|any) (modeled|modelled) claim here\b/gi, "I do not remember the exact detail")
    .replace(/\bI know they may use this against me:\s*/gi, "")
    .replace(/\bI know this point could be used against me:\s*/gi, "")
    .replace(/\bFrom my side, that point is being framed against me:\s*/gi, "")
    .replace(/\bMy side is that\s*/gi, "")
    .replace(/\s{2,}/g, " ")
    .replace(/\s+\./g, ".")
    .trim();
};

const isLowQualityClaimText = (value = "") => {
  const text = String(value || "").trim().toLowerCase();

  if (!text) {
    return true;
  }

  return [
    "modeled claim",
    "modelled claim",
    "pending refinement",
    "schema",
    "exact words",
    "i do not remember the exact detail",
    "i don't have a modeled claim",
    "i dont have a modeled claim",
    "i don't have any modeled claim",
    "i dont have any modeled claim",
  ].some((pattern) => text.includes(pattern));
};

const DOCUMENTATION_GAP_PATTERN =
  /\b(itemized|itemised|documentation|documented|breakdown|notice|receipt|invoice|record|records|list)\b/i;
const OMISSION_PATTERN =
  /\b(no|not|never|without|missing|failed to|did not|didn't|wasn't|weren't|has not|have not)\b/i;
const LEGAL_CONCLUSION_PATTERN =
  /\b(required to|entitled to|violat(?:e|ed|ing)|obligated to|duty to|must provide|should provide)\b/i;
const REPAIR_INACTION_PATTERN =
  /\b(repair|heater|heating|heat|leak|leaking|mold|mould|rodent|rats|mice|damp|plumbing)\b/i;
const LANDLORD_NONRESPONSE_PATTERN =
  /\b(no action|no response|ignored|did not respond|didn't respond|failed to fix|never fixed|refused to fix|unaddressed)\b/i;

const isDocumentationGapFact = (fact = {}) => {
  const corpus = [
    fact.label || "",
    fact.canonicalDetail || "",
    ...(fact.discoverability?.keywords || []),
  ].join(" ");

  return DOCUMENTATION_GAP_PATTERN.test(corpus) && OMISSION_PATTERN.test(corpus);
};

const isRepairInactionFact = (fact = {}) => {
  const corpus = [
    fact.label || "",
    fact.canonicalDetail || "",
    ...(fact.discoverability?.keywords || []),
  ].join(" ");

  return REPAIR_INACTION_PATTERN.test(corpus) && LANDLORD_NONRESPONSE_PATTERN.test(corpus);
};

const inferGeneratedFactKind = (fact = {}) => {
  const rawKind = ["timeline", "supporting", "risk", "dispute", "evidence"].includes(fact.kind)
    ? fact.kind
    : "supporting";

  if (rawKind === "risk" && isDocumentationGapFact(fact)) {
    return "supporting";
  }

  if (rawKind === "risk" && isRepairInactionFact(fact)) {
    return "supporting";
  }

  return rawKind;
};

const buildDocumentationGapClaim = ({ party, canonicalDetail = "" }) => {
  const detail = String(canonicalDetail || "").trim();

  if (!detail) {
    return party === "plaintiff"
      ? "I never got the detailed itemized documentation."
      : "I do not agree that I failed to provide the proper documentation.";
  }

  if (party === "plaintiff") {
    if (/did not provide/i.test(detail)) {
      return detail.replace(/the landlord did not provide/gi, "I never got");
    }

    return `I never got a proper itemized list or comparable documentation from the landlord.`;
  }

  return `I do not agree that I failed to provide a proper itemized list or comparable documentation.`;
};

const buildGenerationPrompt = ({ category, complexity, prompt }) => ({
  task: "Generate the base layer of a legal case template for a courtroom simulation app.",
  requirements: {
    category: category.slug,
    categoryTitle: category.title,
    complexity,
    additionalPrompt: prompt || "",
    rules: [
      "Create a realistic civil or criminal dispute appropriate to the category.",
      "Do not invent magic evidence or supernatural facts.",
      "Return a reusable case template, not a one-off transcript.",
      "Include at least 5 canonical facts.",
      "Each canonical fact must include both a plaintiff claim and a defendant claim.",
      "At least one canonical fact should be a risk or disputed point.",
      "Evidence items should correspond to the canonical facts.",
      "Do not assume every possible record is already in hand. Some evidence can be uncertain or still need confirmation.",
      "Write claims in natural spoken language that a plaintiff or defendant would actually say.",
      "Keep factual propositions separate from legal conclusions. A claim should sound like something a witness would say, not a rule statement.",
      "If the issue is that a party did not provide an itemized list, notice, receipt, or other documentation, model that as a factual proof-gap point. Do not call it corroborated unless confirmed evidence already proves the omission.",
      "Never use meta scaffolding like 'They are going to dispute this', 'I know they may use this against me', 'My side is that', or similar template-construction language in claims or openings.",
      "The openingStatement is not courtroom advocacy. It is the plaintiff's first intake-style explanation to their lawyer in plain first-person language.",
      "Do not start openingStatement with phrases like 'Your Honor', 'Your Honour', 'May it please the court', 'counsel', or other courtroom formalities.",
      "Do not use meta phrases like 'modeled claims', 'client account pending refinement', 'the plaintiff alleges', or other schema-ish wording in any claim text.",
      "Title and subtitle must feel like a polished courtroom game mission, not a generic case caption.",
      "Avoid boring titles like 'State v. Smith', 'Contract Dispute Case', 'Marital Asset Dispute', or other plain docket-style names.",
      "Prefer short, vivid, memorable titles in the style of 'Security Deposit Showdown', 'The Vanishing Invoice', or 'Midnight Tow Trouble'.",
      "Use the subtitle to explain the concrete dispute in one crisp sentence.",
      "Party profile numbers must vary by person and should usually land between 0.25 and 0.85.",
      "Avoid setting all party profile values to 1, 0, or the same repeated number unless the facts truly justify an extreme personality.",
      "speechDeterminism measures how patterned and consistent a person's speech is. Most people should be around 0.35 to 0.7, not 1.",
    ],
    titleStyleExamples: [
      {
        title: "Security Deposit Showdown",
        subtitle: "A landlord kept most of a deposit after move-out.",
      },
      {
        title: "The Vanishing Invoice",
        subtitle: "A client used the work but refuses to pay the final bill.",
      },
      {
        title: "Midnight Tow Trouble",
        subtitle: "A vehicle was towed from a permitted residential lot.",
      },
    ],
  },
  outputSchema: {
    title: "string",
    subtitle: "string",
    overview: "string",
    desiredRelief: "string",
    openingStatement: "string",
    starterTheory: "string",
    practiceArea: "string",
    primaryCategory: category.slug,
    secondaryCategories: ["string"],
    complexity: "number",
    courtName: "string",
    plaintiffName: "string",
    defendantName: "string",
    legalTags: ["string"],
    authoringNotes: "string",
    partyProfiles: {
      plaintiff: {
        role: "plaintiff",
        occupation: "string",
        educationOrTraining: "string",
        communicationStyle: "plain|precise|guarded|rambling|combative|measured",
        intelligence: "number",
        memoryDiscipline: "number",
        honesty: "number",
        emotionalControl: "number",
        speechDeterminism: "number",
        backgroundNotes: ["string"],
      },
      defendant: {
        role: "defendant",
        occupation: "string",
        educationOrTraining: "string",
        communicationStyle: "plain|precise|guarded|rambling|combative|measured",
        intelligence: "number",
        memoryDiscipline: "number",
        honesty: "number",
        emotionalControl: "number",
        speechDeterminism: "number",
        backgroundNotes: ["string"],
      },
    },
    canonicalFacts: [
      {
        factId: "string",
        label: "string",
        kind: "timeline|supporting|risk|dispute|evidence",
        truthStatus: "verified|probable|uncertain",
        canonicalDetail: "string",
        discoverability: {
          keywords: ["string"],
          phase: "interview|courtroom",
          priority: "number",
        },
        evidenceRefs: ["string"],
        followUpQuestions: ["string"],
        claims: [
          {
            party: "plaintiff|defendant",
            claimedDetail: "string",
            stance: "admits|denies|distorts|omits",
            confidence: "number",
            accessLevel: "direct|partial|hearsay",
            deceptionProfile: "string",
            keywords: ["string"],
          },
        ],
      },
    ],
    evidenceItems: [
      {
        id: "string",
        label: "string",
        detail: "string",
        type: "document|photo|message|invoice|witness|record|other",
        availabilityStatus: "confirmed|mentioned|unknown|missing|contested",
        holderSide: "plaintiff|defendant|shared|third-party|unknown",
        linkedFactIds: ["string"],
        followUpQuestions: ["string"],
      },
    ],
  },
});

const buildCanonicalStoryPrompt = ({ category, complexity, prompt }) => ({
  task: "Create the canonical story packet for a legal simulation case before any schema-heavy template extraction.",
  requirements: {
    category: category.slug,
    categoryTitle: category.title,
    complexity,
    additionalPrompt: prompt || "",
    rules: [
      "Write one coherent underlying story of what happened in plain language.",
      "Anchor the story with concrete people, actions, time markers, money, and disputed conduct.",
      "Keep legal conclusions secondary. The story should focus on events, communications, records, omissions, and motives.",
      "Make the plaintiff opening statement sound like a real client talking to their lawyer during intake.",
      "Include likely records or witnesses that exist, may exist, or are missing.",
      "Distinguish clearly between what is settled, what is disputed, and what is still a proof gap.",
      "Do not output canonicalFacts, evidenceItems, or interviewBlueprint yet.",
      "Keep the story realistic and suitable for ordinary civil or criminal disputes in this category.",
    ],
  },
  outputSchema: {
    title: "string",
    subtitle: "string",
    overview: "string",
    desiredRelief: "string",
    openingStatement: "string",
    starterTheory: "string",
    practiceArea: "string",
    primaryCategory: category.slug,
    secondaryCategories: ["string"],
    complexity: "number",
    courtName: "string",
    plaintiffName: "string",
    defendantName: "string",
    legalTags: ["string"],
    authoringNotes: "string",
    canonicalStory: "string",
    storyBeats: [
      {
        beatId: "string",
        order: "number",
        label: "string",
        detail: "string",
        status: "settled|disputed|unknown",
      },
    ],
    likelyEvidence: [
      {
        label: "string",
        detail: "string",
        type: "document|photo|message|invoice|witness|record|other",
        holderSide: "plaintiff|defendant|shared|third-party|unknown",
        availabilityStatus: "confirmed|mentioned|unknown|missing|contested",
      },
    ],
    disputedIssues: ["string"],
  },
});

const buildSpecificityExpansionPrompt = ({
  category,
  complexity,
  prompt,
  storyPacket,
}) => ({
  task: "Expand the canonical story packet into a more concrete, gameplay-ready story packet with specific but consistent details.",
  requirements: {
    category: category.slug,
    categoryTitle: category.title,
    complexity,
    additionalPrompt: prompt || "",
    rules: [
      "Keep the same core story, liability posture, and requested relief.",
      "You may invent concrete specifics that the original story left vague if they help gameplay.",
      "Good specifics include exact dates, addresses, unit numbers, names, message timing, invoice labels, and sequence details.",
      "Do not invent specifics that materially change who is right, what happened, or what records actually exist.",
      "When filling in specifics, keep them realistic and internally consistent with the story packet.",
      "Keep the dispute grounded in ordinary evidence, omissions, and witness behavior.",
    ],
  },
  storyPacket,
  outputSchema: buildCanonicalStoryPrompt({ category, complexity, prompt }).outputSchema,
});

const buildStoryPlausibilityReviewPrompt = ({
  category,
  complexity,
  prompt,
  storyPacket,
}) => ({
  task: "Review the expanded story packet for plausibility and internal consistency, then return a repaired final version if needed.",
  requirements: {
    category: category.slug,
    categoryTitle: category.title,
    complexity,
    additionalPrompt: prompt || "",
    rules: [
      "Check whether the dates, timeline, money, evidence, and witness details fit together plausibly.",
      "Repair contradictions, impossible sequencing, unrealistic records, or details that feel legally or factually off.",
      "Keep as much of the expanded story packet as possible.",
      "Do not collapse the story back into vagueness. Preserve useful specifics unless they are implausible.",
      "Do not materially change the core dispute unless a contradiction forces a narrow repair.",
    ],
  },
  storyPacket,
  outputSchema: buildCanonicalStoryPrompt({ category, complexity, prompt }).outputSchema,
});

const buildTemplateFromStoryPrompt = ({
  category,
  complexity,
  prompt,
  storyPacket,
}) => ({
  task: "Convert the canonical story packet into a structured legal case template for gameplay.",
  requirements: {
    category: category.slug,
    categoryTitle: category.title,
    complexity,
    additionalPrompt: prompt || "",
    rules: [
      "Stay faithful to the canonical story packet. Do not change the core events, parties, timeline, or requested relief without a strong internal reason.",
      "Derive the template from the story rather than inventing unrelated facts.",
      "Canonical facts should be factual propositions or disputed propositions, not legal-rule slogans.",
      "Party claims should sound like witness-style statements each side would naturally say.",
      "Use supporting for facts that help a side, risk for weaknesses that hurt that side, and dispute for genuinely contested propositions.",
      "If a fact is about ignored repair requests, landlord inaction, or unaddressed habitability problems, do not classify that fact as a plaintiff risk.",
      "If the story says a notice, itemized list, receipt, or document was not provided, model that as a factual proof-gap point rather than automatically as corroborated proof.",
      "Only mark evidence confirmed when the story packet really indicates it is in hand or clearly available.",
      "Make follow-up questions feel like real intake questions a lawyer would ask next.",
      "Keep the result internally consistent with the story packet's records, omissions, and disputed issues.",
    ],
  },
  storyPacket,
  outputSchema: buildGenerationPrompt({ category, complexity, prompt }).outputSchema,
});

const buildTemplateRepairPrompt = ({
  category,
  complexity,
  prompt,
  storyPacket,
  templateDraft,
  detectedIssues,
}) => ({
  task: "Repair a generated legal case template so it is internally consistent, playable, and faithful to the canonical story.",
  requirements: {
    category: category.slug,
    categoryTitle: category.title,
    complexity,
    additionalPrompt: prompt || "",
    detectedIssues,
    rules: [
      "Keep the same core story, parties, and requested relief unless an issue requires a narrow repair.",
      "Fix meta or schema-like claim text so every claim and opening sounds like something the party would actually say.",
      "Repair money inconsistencies across desired relief, story, facts, and evidence.",
      "Link evidenceItems and canonicalFacts consistently using evidenceRefs and linkedFactIds when the relationship is apparent.",
      "evidenceRefs must use evidence item ids, not evidence labels or paraphrases.",
      "If a fact is about ignored repair requests, landlord inaction, or unaddressed habitability problems, do not leave it classified as a plaintiff risk.",
      "Repair title or subtitle wording if it conflicts with the actual story details.",
      "Preserve useful specific details unless they contradict the canonical story or the rest of the template.",
      "Output a full corrected template payload, not a patch.",
    ],
  },
  storyPacket,
  templateDraft,
  outputSchema: buildGenerationPrompt({ category, complexity, prompt }).outputSchema,
});

const buildInterviewPlanningPrompt = ({
  category,
  complexity,
  prompt,
  basePayload,
}) => ({
  task: "Refine the generated case into an interview-ready template with staged proof and side-specific intake guidance.",
  requirements: {
    category: category.slug,
    categoryTitle: category.title,
    complexity,
    additionalPrompt: prompt || "",
    rules: [
      "Keep the same dispute, parties, and overall theory from the base case.",
      "Do not rewrite the whole case. Only refine proof status and interview guidance.",
      "Use evidence availability statuses carefully.",
      "Use confirmed only when the record is realistically in hand or clearly available.",
      "Use mentioned when a party plausibly thinks a record exists but cannot confidently prove that yet.",
      "Use unknown or missing when the interview should surface a proof gap.",
      "Write follow-up questions that a lawyer would naturally ask during intake.",
      "Write a natural opening for both sides so the interview works whether the player draws claimant-side or defense-side.",
      "Add partyProfiles for plaintiff and defendant so speech, recall quality, and disclosure style can vary by person.",
      "Keep party profile numbers realistic and differentiated. Avoid defaulting every attribute to 1 or making both parties feel identical.",
    ],
  },
  baseTemplate: basePayload,
  outputSchema: {
    canonicalFacts: [
      {
        factId: "string",
        truthStatus: "verified|probable|uncertain",
        followUpQuestions: ["string"],
      },
    ],
    evidenceItems: [
      {
        id: "string",
        availabilityStatus: "confirmed|mentioned|unknown|missing|contested",
        holderSide: "plaintiff|defendant|shared|third-party|unknown",
        followUpQuestions: ["string"],
      },
    ],
    interviewBlueprint: {
      plaintiff: {
        opening: "string",
        posture: "string",
        priorityFactIds: ["string"],
        suggestedQuestions: ["string"],
      },
      defendant: {
        opening: "string",
        posture: "string",
        priorityFactIds: ["string"],
        suggestedQuestions: ["string"],
      },
    },
    partyProfiles: {
      plaintiff: {
        communicationStyle: "plain|precise|guarded|rambling|combative|measured",
        intelligence: "number",
        memoryDiscipline: "number",
        honesty: "number",
        emotionalControl: "number",
        speechDeterminism: "number",
        backgroundNotes: ["string"],
      },
      defendant: {
        communicationStyle: "plain|precise|guarded|rambling|combative|measured",
        intelligence: "number",
        memoryDiscipline: "number",
        honesty: "number",
        emotionalControl: "number",
        speechDeterminism: "number",
        backgroundNotes: ["string"],
      },
    },
  },
});

const titleLooksGeneric = (title = "") => {
  const normalized = String(title).trim().toLowerCase();

  if (!normalized) {
    return true;
  }

  return [
    /^state\s+v\.?/,
    /^the state\s+v\.?/,
    /^people\s+v\.?/,
    /\brental dispute\b/,
    /^marital asset dispute/,
    /^contract dispute/,
    /^business dispute/,
    /^criminal case/,
    /^civil case/,
    /^property dispute/,
    /^employment dispute/,
    /^administrative dispute/,
    /^consumer dispute/,
    /\blease agreement\b/,
    /\blease dispute\b/,
    /\bhabitability issues?\b/,
    /\bcase$/
  ].some((pattern) => pattern.test(normalized));
};

const categoryTitleFallbacks = {
  "rental-dispute": "Leasehold Lockup",
  "marital-dispute": "Fault Lines at Home",
  "business-dispute": "Boardroom Breakdown",
  "contract-violation": "The Broken Bargain",
  employment: "Clocked-Out Conflict",
  property: "Lines on the Lot",
  "personal-injury": "Impact Point",
  consumer: "Receipt of Deception",
  criminal: "Midnight Alibi",
  administrative: "Red Tape Reckoning",
};

const buildInterestingTitle = ({ title, subtitle, categorySlug, story = "", overview = "" }) => {
  if (!titleLooksGeneric(title)) {
    return String(title || "").trim();
  }

  const fallback = categoryTitleFallbacks[categorySlug] || "Docket Under Fire";
  const corpus = [subtitle || "", story || "", overview || ""].join(" ").trim().toLowerCase();

  if (corpus.includes("deposit")) return "Deposit Day Reckoning";
  if (corpus.includes("invoice")) return "The Missing Final Payment";
  if (corpus.includes("burglary")) return "Burglary Before Dawn";
  if (corpus.includes("towed") || corpus.includes("tow")) return "Tow Lot Twist";
  if (corpus.includes("mold") || corpus.includes("damp")) return "Mold Behind the Walls";
  if (corpus.includes("heat") || corpus.includes("heating")) return "Cold Keys, Cold Nights";
  if (corpus.includes("rodent") || corpus.includes("rats") || corpus.includes("mice"))
    return "The Rodent Clause";
  if (corpus.includes("lease")) return "Leasehold Lockup";
  if (corpus.includes("fired") || corpus.includes("termination")) return "Termination Tangle";

  return fallback;
};

const finalizeTemplatePresentation = (payload = {}, categorySlug, storyPacket = {}) => {
  const story = String(storyPacket?.canonicalStory || "").trim();
  const nextTitle = buildInterestingTitle({
    title: payload.title,
    subtitle: payload.subtitle,
    categorySlug,
    story,
    overview: payload.overview,
  });

  return {
    ...payload,
    title: nextTitle,
    subtitle: String(payload.subtitle || "").trim(),
  };
};

const META_SCAFFOLDING_PATTERN =
  /\b(they are going to dispute this and say it does not prove my side|modeled claim|modelled claim|pending refinement|schema|i know they may use this against me|i know this point could be used against me|from my side, that point is being framed against me|my side is that)\b/i;
const MONEY_PATTERN = /\$\s?\d[\d,]*(?:\.\d{2})?|\b\d[\d,]*(?:\.\d{2})?\s?dollars?\b/gi;

const extractMoneyValues = (value = "") =>
  [...String(value || "").matchAll(MONEY_PATTERN)].map((match) =>
    String(match[0]).replace(/[^0-9.]/g, "")
  );

const tokenizeEvidenceText = (value = "") =>
  uniqueList(
    String(value || "")
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((token) => token.length > 3)
  );

const countSharedEvidenceTokens = (left = "", right = "") => {
  const rightTokens = new Set(tokenizeEvidenceText(right));
  return tokenizeEvidenceText(left).filter((token) => rightTokens.has(token)).length;
};

const reconcileEvidenceGraph = (payload = {}) => {
  const facts = Array.isArray(payload.canonicalFacts) ? payload.canonicalFacts : [];
  const evidenceItems = Array.isArray(payload.evidenceItems) ? payload.evidenceItems : [];

  const factIdLookup = new Map(
    facts.flatMap((fact) => {
      const factId = String(fact.factId || "").trim();
      const factLabel = String(fact.label || "").trim();
      return [
        [normalizeLookupKey(factId), factId],
        [normalizeLookupKey(factLabel), factId],
      ].filter(([key, value]) => key && value);
    })
  );
  const evidenceIdLookup = new Map(
    evidenceItems.flatMap((item) => {
      const id = String(item.id || "").trim();
      const label = String(item.label || "").trim();
      return [
        [normalizeLookupKey(id), id],
        [normalizeLookupKey(label), id],
      ].filter(([key, value]) => key && value);
    })
  );

  const normalizedFacts = facts.map((fact) => ({
    ...fact,
    evidenceRefs: uniqueList(
      (fact.evidenceRefs || [])
        .map((ref) => evidenceIdLookup.get(normalizeLookupKey(ref)) || "")
        .filter(Boolean)
    ),
  }));
  const normalizedEvidenceItems = evidenceItems.map((item) => ({
    ...item,
    linkedFactIds: uniqueList(
      (item.linkedFactIds || [])
        .map((factId) => factIdLookup.get(normalizeLookupKey(factId)) || "")
        .filter(Boolean)
    ),
  }));

  const evidenceRefsByFactId = new Map(
    normalizedFacts.map((fact) => [String(fact.factId || "").trim(), new Set(fact.evidenceRefs || [])])
  );
  const linkedFactIdsByEvidenceId = new Map(
    normalizedEvidenceItems.map((item) => [
      String(item.id || "").trim(),
      new Set(item.linkedFactIds || []),
    ])
  );

  normalizedEvidenceItems.forEach((item) => {
    const evidenceId = String(item.id || "").trim();
    (item.linkedFactIds || []).forEach((factId) => {
      if (!evidenceRefsByFactId.has(factId)) {
        evidenceRefsByFactId.set(factId, new Set());
      }
      evidenceRefsByFactId.get(factId).add(evidenceId);
    });
  });

  normalizedFacts.forEach((fact) => {
    const factId = String(fact.factId || "").trim();
    (fact.evidenceRefs || []).forEach((evidenceId) => {
      if (!linkedFactIdsByEvidenceId.has(evidenceId)) {
        linkedFactIdsByEvidenceId.set(evidenceId, new Set());
      }
      linkedFactIdsByEvidenceId.get(evidenceId).add(factId);
    });
  });

  return {
    ...payload,
    canonicalFacts: normalizedFacts.map((fact) => ({
      ...fact,
      evidenceRefs: uniqueList([...(evidenceRefsByFactId.get(String(fact.factId || "").trim()) || [])]),
    })),
    evidenceItems: normalizedEvidenceItems.map((item) => ({
      ...item,
      linkedFactIds: uniqueList([
        ...(linkedFactIdsByEvidenceId.get(String(item.id || "").trim()) || []),
      ]),
    })),
  };
};

const BLOCKING_REPAIR_PATTERNS = [
  /meta\/scaffolded/i,
  /does not resolve to an evidence item id/i,
  /not linked back to the fact/i,
  /not linked to any canonical fact/i,
  /missing evidencerefs even though evidence links to it/i,
  /does not appear semantically related/i,
  /misclassified as a risk/i,
];

const hasBlockingTemplateIssues = (issues = []) =>
  (issues || []).some((issue) =>
    BLOCKING_REPAIR_PATTERNS.some((pattern) => pattern.test(String(issue || "")))
  );

const detectTemplateRepairIssues = (payload = {}, storyPacket = {}) => {
  const issues = [];
  const title = String(payload.title || "").trim();
  const subtitle = String(payload.subtitle || "").trim();
  const story = String(storyPacket?.canonicalStory || payload.authoringNotes || "").trim();
  const desiredRelief = String(payload.desiredRelief || "").trim();

  if (
    [title, subtitle].some((text) => /cool/i.test(text)) &&
    /heat/i.test(story) &&
    !/cool/i.test(story)
  ) {
    issues.push(
      "The title or subtitle references cooling, but the canonical story is about heating problems."
    );
  }

  if (titleLooksGeneric(title)) {
    issues.push("The title is generic and should be replaced with a story-specific title.");
  }

  const allOpenings = [
    payload.interviewBlueprint?.plaintiff?.opening,
    payload.interviewBlueprint?.defendant?.opening,
  ].filter(Boolean);
  if (allOpenings.some((value) => META_SCAFFOLDING_PATTERN.test(String(value)))) {
    issues.push("Interview blueprint openings contain meta/scaffolded text instead of party voice.");
  }

  (payload.canonicalFacts || []).forEach((fact, index) => {
    (fact.claims || []).forEach((claim) => {
      if (META_SCAFFOLDING_PATTERN.test(String(claim.claimedDetail || ""))) {
        issues.push(
          `canonicalFacts[${index}] contains meta/scaffolded claim text for ${claim.party}.`
        );
      }
    });

    if (fact.kind === "risk" && isRepairInactionFact(fact)) {
      issues.push(
        `canonicalFacts[${index}] is misclassified as a risk even though it describes ignored repairs or landlord inaction.`
      );
    }
  });

  const evidenceItems = payload.evidenceItems || [];
  const evidenceById = new Map(
    evidenceItems.map((item) => [String(item.id || "").trim(), item])
  );
  const evidenceLinkedFactIds = new Set(
    evidenceItems.flatMap((item) => (item.linkedFactIds || []).map((factId) => String(factId)))
  );

  evidenceItems.forEach((item, index) => {
    if (!(item.linkedFactIds || []).length) {
      issues.push(`evidenceItems[${index}] is not linked to any canonical fact.`);
    }
  });

  (payload.canonicalFacts || []).forEach((fact, index) => {
    const factId = String(fact.factId || "");
    if ((fact.evidenceRefs || []).length === 0 && evidenceLinkedFactIds.has(factId)) {
      issues.push(`canonicalFacts[${index}] is missing evidenceRefs even though evidence links to it.`);
    }

    (fact.evidenceRefs || []).forEach((ref) => {
      const evidenceItem = evidenceById.get(String(ref || "").trim());

      if (!evidenceItem) {
        issues.push(`canonicalFacts[${index}] references evidenceRef "${ref}" that does not resolve to an evidence item id.`);
        return;
      }

      if (
        Array.isArray(evidenceItem.linkedFactIds) &&
        evidenceItem.linkedFactIds.length > 0 &&
        !evidenceItem.linkedFactIds.map((id) => String(id)).includes(factId)
      ) {
        issues.push(
          `canonicalFacts[${index}] references evidence "${evidenceItem.label}" but that evidence is not linked back to the fact.`
        );
        return;
      }

      const factCorpus = [
        fact.label || "",
        fact.canonicalDetail || "",
        ...(fact.discoverability?.keywords || []),
      ].join(" ");
      const evidenceCorpus = [evidenceItem.label || "", evidenceItem.detail || ""].join(" ");

      if (
        countSharedEvidenceTokens(factCorpus, evidenceCorpus) === 0 &&
        String(evidenceItem.type || "").trim() !== "witness"
      ) {
        issues.push(
          `canonicalFacts[${index}] references evidence "${evidenceItem.label}" that does not appear semantically related.`
        );
      }
    });
  });

  const reliefAmounts = extractMoneyValues(desiredRelief);
  const storyAmounts = extractMoneyValues(story);
  const factAmounts = (payload.canonicalFacts || []).flatMap((fact) =>
    extractMoneyValues(fact.canonicalDetail || "")
  );
  const distinctAmounts = uniqueList([...reliefAmounts, ...storyAmounts, ...factAmounts]);

  if (distinctAmounts.length >= 3) {
    issues.push(
      "There are multiple distinct money amounts across desired relief, canonical story, and facts; verify the deposit and damage amounts are consistent."
    );
  }

  if (
    /full security deposit/i.test(desiredRelief) &&
    /\bhas not received (her|his|their) deposit\b/i.test(story) &&
    factAmounts.some((amount) => amount && !reliefAmounts.includes(amount))
  ) {
    issues.push(
      "The story says the plaintiff has not received the deposit, but at least one fact introduces a different deposit or damages amount that may conflict."
    );
  }

  const factCountWithoutEvidence = (payload.canonicalFacts || []).filter((fact) => {
    const factId = String(fact.factId || "");
    return !evidenceLinkedFactIds.has(factId) && !(fact.evidenceRefs || []).length;
  }).length;
  if (factCountWithoutEvidence >= 3 && evidenceItems.length > 0) {
    issues.push("Too many canonical facts are disconnected from the available evidence graph.");
  }

  return uniqueList(issues);
};

const hasUsableCanonicalFacts = (payload = {}) =>
  Array.isArray(payload.canonicalFacts) &&
  payload.canonicalFacts.some(
    (fact) =>
      String(fact?.canonicalDetail || "").trim() &&
      Array.isArray(fact?.claims) &&
      fact.claims.some((claim) => claim.party === "plaintiff") &&
      fact.claims.some((claim) => claim.party === "defendant")
  );

const withCanonicalStoryNote = (payload = {}, storyPacket = {}) => {
  if (!storyPacket?.canonicalStory) {
    return payload;
  }

  return {
    ...payload,
    authoringNotes: uniqueList([
      payload.authoringNotes,
      `Canonical story: ${String(storyPacket.canonicalStory).trim()}`,
    ]).join("\n\n"),
  };
};

const emitGenerationProgress = async (onProgress, stage, result, extra = {}) => {
  if (typeof onProgress !== "function") {
    return;
  }

  await onProgress({
    stage,
    label: GENERATION_STAGE_LABELS[stage] || stage,
    result,
    ...extra,
  });
};

const normalizeEvidenceType = (value = "") => {
  const normalized = String(value || "")
    .trim()
    .toLowerCase();

  if (ALLOWED_EVIDENCE_TYPES.has(normalized)) {
    return normalized;
  }

  if (["video", "image", "screenshot"].includes(normalized)) {
    return "photo";
  }
  if (["email", "sms", "chat", "text"].includes(normalized)) {
    return "message";
  }
  if (["bill", "statement", "receipt"].includes(normalized)) {
    return "invoice";
  }
  if (["filing", "form", "contract", "lease"].includes(normalized)) {
    return "document";
  }

  return "other";
};

const normalizeClaims = (claims = []) =>
  (Array.isArray(claims) ? claims : []).map((claim) => ({
    party: ["plaintiff", "defendant"].includes(normalizeTemplateParty(claim.party))
      ? normalizeTemplateParty(claim.party)
      : "plaintiff",
    claimedDetail: sanitizeClaimText(claim.claimedDetail),
    stance: ["admits", "denies", "distorts", "omits"].includes(claim.stance)
      ? claim.stance
      : "admits",
    confidence:
      typeof claim.confidence === "number"
        ? Math.max(0, Math.min(1, claim.confidence))
        : 0.75,
    accessLevel: ["direct", "partial", "hearsay"].includes(claim.accessLevel)
      ? claim.accessLevel
      : "direct",
    deceptionProfile: String(claim.deceptionProfile || "").trim(),
    keywords: Array.isArray(claim.keywords)
      ? claim.keywords.map((item) => String(item).trim()).filter(Boolean)
      : [],
  }));

const buildFallbackClaimText = ({ party, canonicalDetail, kind }) => {
  const detail = String(canonicalDetail || "").trim();

  if (!detail) {
    return party === "defendant"
      ? "I do not agree with that version of events."
      : "That is what happened from my side.";
  }

  if (party === "plaintiff") {
    return detail;
  }

  if (kind === "dispute") {
    return "I do not agree with that version of events.";
  }

  if (kind === "risk") {
    return "That leaves out my side of what happened.";
  }

  return "That is not the whole story from my side.";
};

const ensurePartyCoverage = (fact) => {
  const normalized = normalizeClaims(fact.claims).filter(
    (claim) => !isLowQualityClaimText(claim.claimedDetail)
  );
  const parties = normalized.map((claim) => claim.party);

  if (!parties.includes("plaintiff")) {
    normalized.unshift({
      party: "plaintiff",
      claimedDetail: isDocumentationGapFact(fact)
        ? buildDocumentationGapClaim({
            party: "plaintiff",
            canonicalDetail: String(fact.canonicalDetail || "").trim(),
          })
        : buildFallbackClaimText({
            party: "plaintiff",
            canonicalDetail: String(fact.canonicalDetail || "").trim(),
            kind: fact.kind,
          }),
      stance: "admits",
      confidence: 0.7,
      accessLevel: "direct",
      deceptionProfile: "generic",
      keywords: [],
    });
  }

  if (!parties.includes("defendant")) {
    normalized.push({
      party: "defendant",
      claimedDetail: isDocumentationGapFact(fact)
        ? buildDocumentationGapClaim({
            party: "defendant",
            canonicalDetail: String(fact.canonicalDetail || "").trim(),
          })
        : buildFallbackClaimText({
            party: "defendant",
            canonicalDetail: String(fact.canonicalDetail || "").trim(),
            kind: fact.kind,
          }),
      stance: "distorts",
      confidence: 0.7,
      accessLevel: "partial",
      deceptionProfile: "generic",
      keywords: [],
    });
  }

  return normalized;
};

const normalizeBlueprintSide = (value = {}) => ({
  opening: sanitizeClaimText(normalizeClientIntakeStatement(value.opening)),
  posture: String(value.posture || "").trim(),
  priorityFactIds: Array.isArray(value.priorityFactIds)
    ? value.priorityFactIds.map((item) => String(item).trim()).filter(Boolean)
    : [],
  suggestedQuestions: Array.isArray(value.suggestedQuestions)
    ? value.suggestedQuestions.map((item) => String(item).trim()).filter(Boolean)
    : [],
});

const normalizeBlueprintPatchSide = (value = {}) => {
  const normalized = {};

  if (typeof value.opening === "string" && value.opening.trim()) {
    normalized.opening = sanitizeClaimText(
      normalizeClientIntakeStatement(value.opening)
    );
  }
  if (typeof value.posture === "string" && value.posture.trim()) {
    normalized.posture = String(value.posture).trim();
  }
  if (Array.isArray(value.priorityFactIds)) {
    normalized.priorityFactIds = value.priorityFactIds
      .map((item) => String(item).trim())
      .filter(Boolean);
  }
  if (Array.isArray(value.suggestedQuestions)) {
    normalized.suggestedQuestions = value.suggestedQuestions
      .map((item) => String(item).trim())
      .filter(Boolean);
  }

  return normalized;
};

const normalizeProfileScalar = (value, fallback) => {
  const raw =
    typeof value === "number" && Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : fallback;

  // Pull extreme/generated values back toward believable ranges.
  const softened =
    raw >= 0.95 ? 0.85 : raw <= 0.05 ? 0.15 : raw;

  return Math.round(softened * 20) / 20;
};

const normalizePartyProfile = (value = {}, role) => ({
  role,
  occupation: String(value.occupation || "").trim(),
  educationOrTraining: String(value.educationOrTraining || "").trim(),
  communicationStyle: [
    "plain",
    "precise",
    "guarded",
    "rambling",
    "combative",
    "measured",
  ].includes(value.communicationStyle)
    ? value.communicationStyle
    : "plain",
  intelligence: normalizeProfileScalar(value.intelligence, 0.5),
  memoryDiscipline: normalizeProfileScalar(value.memoryDiscipline, 0.5),
  honesty: normalizeProfileScalar(value.honesty, 0.7),
  emotionalControl: normalizeProfileScalar(value.emotionalControl, 0.5),
  speechDeterminism: normalizeProfileScalar(value.speechDeterminism, 0.5),
  backgroundNotes: Array.isArray(value.backgroundNotes)
    ? value.backgroundNotes.map((item) => String(item).trim()).filter(Boolean)
    : [],
});

const normalizeGeneratedPayload = (payload, categorySlug, complexity) => {
  const normalizedPayload = enrichTemplateForGameplay({
    ...payload,
    sourceType: "generated",
    status: "active",
    title: String(payload.title || "").trim(),
    subtitle: String(payload.subtitle || "").trim(),
    openingStatement: normalizeClientIntakeStatement(payload.openingStatement),
    plaintiffName: String(payload.plaintiffName || payload.clientName || "").trim(),
    defendantName: String(payload.defendantName || payload.opponentName || "").trim(),
    primaryCategory: payload.primaryCategory || categorySlug,
    complexity,
    secondaryCategories: Array.isArray(payload.secondaryCategories)
      ? payload.secondaryCategories.map((item) => String(item).trim()).filter(Boolean)
      : [],
    legalTags:
      Array.isArray(payload.legalTags) &&
      payload.legalTags.map((item) => String(item).trim()).filter(Boolean).length > 0
        ? payload.legalTags.map((item) => String(item).trim()).filter(Boolean)
        : categoryLegalTagDefaults[categorySlug] || ["records", "evidence", "credibility"],
    partyProfiles: {
      plaintiff: normalizePartyProfile(payload.partyProfiles?.plaintiff, "plaintiff"),
      defendant: normalizePartyProfile(payload.partyProfiles?.defendant, "defendant"),
    },
    canonicalFacts: Array.isArray(payload.canonicalFacts)
      ? payload.canonicalFacts.map((fact, index) => ({
          factId: String(fact.factId || `fact-${index + 1}`).trim(),
          label: String(fact.label || `Fact ${index + 1}`).trim(),
          kind: inferGeneratedFactKind(fact),
          truthStatus: ["verified", "probable", "uncertain"].includes(fact.truthStatus)
            ? fact.truthStatus
            : "verified",
          canonicalDetail: String(fact.canonicalDetail || "").trim(),
          discoverability: {
            keywords: Array.isArray(fact.discoverability?.keywords)
              ? fact.discoverability.keywords.map((item) => String(item).trim()).filter(Boolean)
              : [],
            phase: ["interview", "courtroom"].includes(fact.discoverability?.phase)
              ? fact.discoverability.phase
              : "interview",
            priority:
              typeof fact.discoverability?.priority === "number"
                ? Math.max(1, Math.min(5, fact.discoverability.priority))
                : 3,
          },
          evidenceRefs: Array.isArray(fact.evidenceRefs)
            ? fact.evidenceRefs.map((item) => String(item).trim()).filter(Boolean)
            : [],
          followUpQuestions: Array.isArray(fact.followUpQuestions)
            ? fact.followUpQuestions.map((item) => String(item).trim()).filter(Boolean)
            : [],
          claims: ensurePartyCoverage({
            ...fact,
            kind: inferGeneratedFactKind(fact),
            claims: normalizeClaims(fact.claims).map((claim) => ({
              ...claim,
              claimedDetail:
                isDocumentationGapFact(fact) &&
                LEGAL_CONCLUSION_PATTERN.test(String(claim.claimedDetail || ""))
                  ? buildDocumentationGapClaim({
                      party: normalizeTemplateParty(claim.party),
                      canonicalDetail: fact.canonicalDetail,
                    })
                  : claim.claimedDetail,
            })),
          }),
        }))
      : [],
    evidenceItems: Array.isArray(payload.evidenceItems)
      ? payload.evidenceItems.map((item, index) => ({
          id: String(item.id || `evidence-${index + 1}`).trim(),
          label: String(item.label || `Evidence ${index + 1}`).trim(),
          detail: String(item.detail || "").trim(),
          type: normalizeEvidenceType(item.type),
          availabilityStatus:
            normalizeEvidenceAvailabilityStatus(item.availabilityStatus) || "unknown",
          holderSide: normalizeEvidenceHolderSide(item.holderSide) || "unknown",
          linkedFactIds: Array.isArray(item.linkedFactIds)
            ? item.linkedFactIds.map((factId) => String(factId).trim()).filter(Boolean)
            : [],
          followUpQuestions: Array.isArray(item.followUpQuestions)
            ? item.followUpQuestions.map((value) => String(value).trim()).filter(Boolean)
            : [],
        }))
      : [],
    interviewBlueprint: {
      plaintiff: normalizeBlueprintSide(
        payload.interviewBlueprint?.plaintiff || payload.interviewBlueprint?.client
      ),
      defendant: normalizeBlueprintSide(
        payload.interviewBlueprint?.defendant || payload.interviewBlueprint?.opponent
      ),
    },
  });

  return reconcileEvidenceGraph(normalizedPayload);
};

const mergeInterviewPlanningPayload = (payload, plan = {}) => {
  const factPatchMap = new Map(
    (Array.isArray(plan.canonicalFacts) ? plan.canonicalFacts : [])
      .filter((item) => item?.factId)
      .map((item) => [String(item.factId).trim(), item])
  );
  const evidencePatchMap = new Map(
    (Array.isArray(plan.evidenceItems) ? plan.evidenceItems : [])
      .filter((item) => item?.id)
      .map((item) => [String(item.id).trim(), item])
  );

  return enrichTemplateForGameplay({
    ...payload,
    canonicalFacts: (payload.canonicalFacts || []).map((fact) => {
      const patch = factPatchMap.get(fact.factId) || {};
      const truthStatus = ["verified", "probable", "uncertain"].includes(patch.truthStatus)
        ? patch.truthStatus
        : fact.truthStatus;

      return {
        ...fact,
        truthStatus,
        followUpQuestions: Array.isArray(patch.followUpQuestions)
          ? patch.followUpQuestions.map((item) => String(item).trim()).filter(Boolean)
          : fact.followUpQuestions,
      };
    }),
    evidenceItems: (payload.evidenceItems || []).map((item) => {
      const patch = evidencePatchMap.get(item.id) || {};

      return {
        ...item,
        availabilityStatus:
          normalizeEvidenceAvailabilityStatus(patch.availabilityStatus) ||
          item.availabilityStatus ||
          "unknown",
        holderSide:
          normalizeEvidenceHolderSide(patch.holderSide) ||
          item.holderSide ||
          "unknown",
        followUpQuestions: Array.isArray(patch.followUpQuestions)
          ? patch.followUpQuestions.map((value) => String(value).trim()).filter(Boolean)
          : item.followUpQuestions,
      };
    }),
    interviewBlueprint: {
      plaintiff: {
        ...(payload.interviewBlueprint?.plaintiff ||
          payload.interviewBlueprint?.client ||
          {}),
        ...normalizeBlueprintPatchSide(
          plan.interviewBlueprint?.plaintiff || plan.interviewBlueprint?.client
        ),
      },
      defendant: {
        ...(payload.interviewBlueprint?.defendant ||
          payload.interviewBlueprint?.opponent ||
          {}),
        ...normalizeBlueprintPatchSide(
          plan.interviewBlueprint?.defendant || plan.interviewBlueprint?.opponent
        ),
      },
    },
    partyProfiles: {
      plaintiff: normalizePartyProfile(
        plan.partyProfiles?.plaintiff || payload.partyProfiles?.plaintiff || {},
        "plaintiff"
      ),
      defendant: normalizePartyProfile(
        plan.partyProfiles?.defendant || payload.partyProfiles?.defendant || {},
        "defendant"
      ),
    },
  });
};

export const generateCaseTemplatePayload = async ({
  categorySlug,
  complexity = 2,
  prompt = "",
  userId = "system",
  model = DEFAULT_GENERATION_MODEL,
  onProgress,
}) => {
  const category = getCategoryBySlug(categorySlug) || getCategoryBySlug(DEFAULT_CATEGORY_SLUG);
  const initialStoryPacket = await requestStructuredCompletion({
    userId,
    model,
    temperature: 0.95,
    maxTokens: 4000,
    retryAttempts: 2,
    throwOnError: true,
    systemPrompt:
      "You generate canonical legal case stories for a courtroom simulation app. This is phase 1 of 6. Output valid JSON only. Prioritize coherence, realism, and concrete event detail over schema cleverness.",
    userPrompt: JSON.stringify(buildCanonicalStoryPrompt({ category, complexity, prompt })),
  });

  if (!initialStoryPacket) {
    throw new Error(
      "Case generation failed because the model returned no canonical story packet."
    );
  }
  await emitGenerationProgress(onProgress, "story", initialStoryPacket);

  const expandedStoryPacket = await requestStructuredCompletion({
    userId,
    model,
    temperature: 0.7,
    maxTokens: 4500,
    retryAttempts: 2,
    throwOnError: true,
    systemPrompt:
      "You expand legal case stories into more concrete gameplay-ready story packets. This is phase 2 of 6. Output valid JSON only. Add useful specific details while preserving the same underlying world.",
    userPrompt: JSON.stringify(
      buildSpecificityExpansionPrompt({
        category,
        complexity,
        prompt,
        storyPacket: initialStoryPacket,
      })
    ),
  });

  const storyPacket = expandedStoryPacket || initialStoryPacket;
  await emitGenerationProgress(onProgress, "details", storyPacket);

  const reviewedStoryPacket = await requestStructuredCompletion({
    userId,
    model,
    temperature: 0.25,
    maxTokens: 4500,
    retryAttempts: 2,
    systemPrompt:
      "You review expanded legal case stories for plausibility and consistency. This is phase 3 of 6. Output valid JSON only. Keep useful specifics, but repair contradictions and implausible details.",
    userPrompt: JSON.stringify(
      buildStoryPlausibilityReviewPrompt({
        category,
        complexity,
        prompt,
        storyPacket,
      })
    ),
  });

  const finalStoryPacket =
    reviewedStoryPacket && typeof reviewedStoryPacket === "object"
      ? reviewedStoryPacket
      : storyPacket;
  await emitGenerationProgress(onProgress, "plausibility", finalStoryPacket);

  const templateDraft = await requestStructuredCompletion({
    userId,
    model,
    temperature: 0.55,
    maxTokens: 5000,
    retryAttempts: 2,
    throwOnError: true,
    systemPrompt:
      "You convert canonical legal case stories into structured gameplay templates. This is phase 4 of 6. Output valid JSON only. Be faithful to the story packet and keep facts, claims, and evidence consistent with it.",
    userPrompt: JSON.stringify(
      buildTemplateFromStoryPrompt({
        category,
        complexity,
        prompt,
        storyPacket: finalStoryPacket,
      })
    ),
  });

  if (!templateDraft) {
    throw new Error(
      "Case generation failed because the model returned no structured template draft."
    );
  }
  await emitGenerationProgress(onProgress, "template", templateDraft);

  let payload = withCanonicalStoryNote(
    normalizeGeneratedPayload(templateDraft, category.slug, complexity),
    finalStoryPacket
  );

  if (!hasUsableCanonicalFacts(payload)) {
    throw new Error(
      "Case generation failed because the structured template draft did not contain usable canonical facts."
    );
  }

  let detectedIssues = detectTemplateRepairIssues(payload, finalStoryPacket);
  if (detectedIssues.length > 0) {
    let repairAttempts = 0;

    while (detectedIssues.length > 0 && repairAttempts < 2) {
      repairAttempts += 1;
      const repairedTemplate = await requestStructuredCompletion({
        userId,
        model,
        temperature: 0.25,
        maxTokens: 5000,
        retryAttempts: 2,
        systemPrompt:
          "You repair generated legal case templates before gameplay metadata is added. This is phase 5 of 6. Output valid JSON only. Fix the detected issues while staying faithful to the canonical story.",
        userPrompt: JSON.stringify(
          buildTemplateRepairPrompt({
            category,
            complexity,
            prompt,
            storyPacket: finalStoryPacket,
            templateDraft: payload,
            detectedIssues,
          })
        ),
      });

      if (repairedTemplate && typeof repairedTemplate === "object") {
        const repairedPayload = withCanonicalStoryNote(
          normalizeGeneratedPayload(repairedTemplate, category.slug, complexity),
          finalStoryPacket
        );

        if (hasUsableCanonicalFacts(repairedPayload)) {
          payload = repairedPayload;
        }
      }

      const remainingIssues = detectTemplateRepairIssues(payload, finalStoryPacket);
      if (
        remainingIssues.length === detectedIssues.length &&
        remainingIssues.every((issue, index) => issue === detectedIssues[index])
      ) {
        detectedIssues = remainingIssues;
        break;
      }

      detectedIssues = remainingIssues;
      if (!hasBlockingTemplateIssues(detectedIssues)) {
        break;
      }
    }

    await emitGenerationProgress(onProgress, "repair", payload, {
      detectedIssues,
      repairAttempts,
    });

    if (hasBlockingTemplateIssues(detectedIssues)) {
      throw new Error(
        `Case generation failed because blocking repair issues remained: ${detectedIssues.join(
          "; "
        )}`
      );
    }
  } else {
    await emitGenerationProgress(onProgress, "repair", payload, {
      detectedIssues: [],
      skipped: true,
    });
  }

  const interviewPlan = await requestStructuredCompletion({
    userId,
    model,
    temperature: 0.4,
    maxTokens: 5000,
    retryAttempts: 2,
    systemPrompt:
      "You refine legal simulation cases into interview-ready templates. This is phase 6 of 6. Output valid JSON only. Preserve the underlying dispute, but distinguish confirmed proof from leads, missing records, and disputed evidence.",
    userPrompt: JSON.stringify(
      buildInterviewPlanningPrompt({
        category,
        complexity,
        prompt,
        basePayload: payload,
      })
    ),
  });

  if (interviewPlan && typeof interviewPlan === "object") {
    const plannedPayload = mergeInterviewPlanningPayload(payload, interviewPlan);

    if (hasUsableCanonicalFacts(plannedPayload)) {
      payload = plannedPayload;
    }
  }

  payload = finalizeTemplatePresentation(payload, category.slug, finalStoryPacket);
  const finalIssues = detectTemplateRepairIssues(payload, finalStoryPacket);
  if (hasBlockingTemplateIssues(finalIssues)) {
    throw new Error(
      `Case generation failed final verification because blocking issues remained: ${finalIssues.join(
        "; "
      )}`
    );
  }
  await emitGenerationProgress(onProgress, "interview", payload, {
    interviewPlan,
    finalIssues,
  });

  payload.slug =
    payload.slug?.trim() ||
    `${category.slug}-${slugify(payload.title || "generated-case")}-${Date.now()}`;

  const errors = validateCaseTemplatePayload(payload);
  if (errors.length > 0) {
    throw new Error(`Generated case template was invalid: ${errors.join(", ")}`);
  }

  await emitGenerationProgress(onProgress, "complete", payload);

  return payload;
};

export const createGeneratedCaseTemplate = async (options) => {
  const payload = await generateCaseTemplatePayload(options);
  return CaseTemplate.create(payload);
};
