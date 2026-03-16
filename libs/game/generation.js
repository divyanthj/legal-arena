import "server-only";

import CaseTemplate from "@/models/CaseTemplate";
import { requestStructuredCompletion } from "@/libs/gpt";
import { DEFAULT_CATEGORY_SLUG, getCategoryBySlug } from "./categories";
import { validateCaseTemplatePayload } from "./templates";

const DEFAULT_GENERATION_MODEL =
  process.env.OPENAI_GENERATION_MODEL || "gpt-4o-mini";

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
    .replace(/\bfrom the modeled claims\b/gi, "")
    .replace(/\bmodeled claims?\b/gi, "what I remember")
    .replace(/\bmodelled claims?\b/gi, "what I remember")
    .replace(/\bclient account pending refinement\b/gi, "I need to explain that more clearly")
    .replace(/\bthe client alleges\b/gi, "I said")
    .replace(/\bthe client\b/gi, "I")
    .replace(/\bthe opponent\b/gi, "they")
    .replace(/\bI don't have (a|any) (modeled|modelled) claim here\b/gi, "I do not remember the exact detail")
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

const buildGenerationPrompt = ({ category, complexity, prompt }) => ({
  task: "Generate a legal case template for a courtroom simulation app.",
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
      "Each canonical fact must include both a client claim and an opponent claim.",
      "At least one canonical fact should be a risk or disputed point.",
      "Evidence items should correspond to the canonical facts.",
      "Write claims in natural spoken language that a client or opponent would actually say.",
      "The openingStatement is not courtroom advocacy. It is the client's first intake-style explanation to their lawyer in plain first-person language.",
      "Do not start openingStatement with phrases like 'Your Honor', 'Your Honour', 'May it please the court', 'counsel', or other courtroom formalities.",
      "Do not use meta phrases like 'modeled claims', 'client account pending refinement', 'the client alleges', or other schema-ish wording in any claim text.",
      "Title and subtitle must feel like a polished courtroom game mission, not a generic case caption.",
      "Avoid boring titles like 'State v. Smith', 'Contract Dispute Case', 'Marital Asset Dispute', or other plain docket-style names.",
      "Prefer short, vivid, memorable titles in the style of 'Security Deposit Showdown', 'The Vanishing Invoice', or 'Midnight Tow Trouble'.",
      "Use the subtitle to explain the concrete dispute in one crisp sentence.",
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
    clientName: "string",
    opponentName: "string",
    legalTags: ["string"],
    authoringNotes: "string",
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
        claims: [
          {
            party: "client|opponent",
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
        linkedFactIds: ["string"],
      },
    ],
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
    /^marital asset dispute/,
    /^contract dispute/,
    /^business dispute/,
    /^criminal case/,
    /^civil case/,
    /^property dispute/,
    /^employment dispute/,
    /^administrative dispute/,
    /^consumer dispute/,
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

const buildInterestingTitle = ({ title, subtitle, categorySlug }) => {
  if (!titleLooksGeneric(title)) {
    return String(title || "").trim();
  }

  const fallback = categoryTitleFallbacks[categorySlug] || "Docket Under Fire";
  const subtitleText = String(subtitle || "").trim().toLowerCase();

  if (subtitleText.includes("deposit")) return "Deposit Day Reckoning";
  if (subtitleText.includes("invoice")) return "The Missing Final Payment";
  if (subtitleText.includes("burglary")) return "Burglary Before Dawn";
  if (subtitleText.includes("towed") || subtitleText.includes("tow")) return "Tow Lot Twist";
  if (subtitleText.includes("lease")) return "Leasehold Lockup";
  if (subtitleText.includes("fired") || subtitleText.includes("termination")) return "Termination Tangle";

  return fallback;
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
    party: claim.party === "opponent" ? "opponent" : "client",
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
  if (party === "client") {
    if (kind === "risk") {
      return `I know they may use this against me: ${canonicalDetail}`;
    }

    return canonicalDetail;
  }

  if (kind === "risk") {
    return `They will say this hurts my position: ${canonicalDetail}`;
  }

  return `They are going to dispute this and say it does not prove my side: ${canonicalDetail}`;
};

const ensurePartyCoverage = (fact) => {
  const normalized = normalizeClaims(fact.claims).filter(
    (claim) => !isLowQualityClaimText(claim.claimedDetail)
  );
  const parties = normalized.map((claim) => claim.party);

  if (!parties.includes("client")) {
    normalized.unshift({
      party: "client",
      claimedDetail: buildFallbackClaimText({
        party: "client",
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

  if (!parties.includes("opponent")) {
    normalized.push({
      party: "opponent",
      claimedDetail: buildFallbackClaimText({
        party: "opponent",
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

const normalizeGeneratedPayload = (payload, categorySlug, complexity) => ({
  ...payload,
  sourceType: "generated",
  status: "active",
  title: buildInterestingTitle({
    title: payload.title,
    subtitle: payload.subtitle,
    categorySlug,
  }),
  subtitle: String(payload.subtitle || "").trim(),
  openingStatement: normalizeClientIntakeStatement(payload.openingStatement),
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
  canonicalFacts: Array.isArray(payload.canonicalFacts)
    ? payload.canonicalFacts.map((fact, index) => ({
        factId: String(fact.factId || `fact-${index + 1}`).trim(),
        label: String(fact.label || `Fact ${index + 1}`).trim(),
        kind: ["timeline", "supporting", "risk", "dispute", "evidence"].includes(
          fact.kind
        )
          ? fact.kind
          : "supporting",
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
        claims: ensurePartyCoverage(fact),
      }))
    : [],
  evidenceItems: Array.isArray(payload.evidenceItems)
    ? payload.evidenceItems.map((item, index) => ({
        id: String(item.id || `evidence-${index + 1}`).trim(),
        label: String(item.label || `Evidence ${index + 1}`).trim(),
        detail: String(item.detail || "").trim(),
        type: normalizeEvidenceType(item.type),
        linkedFactIds: Array.isArray(item.linkedFactIds)
          ? item.linkedFactIds.map((factId) => String(factId).trim()).filter(Boolean)
          : [],
      }))
    : [],
});

export const generateCaseTemplatePayload = async ({
  categorySlug,
  complexity = 2,
  prompt = "",
  userId = "system",
  model = DEFAULT_GENERATION_MODEL,
}) => {
  const category = getCategoryBySlug(categorySlug) || getCategoryBySlug(DEFAULT_CATEGORY_SLUG);
  const aiResult = await requestStructuredCompletion({
    userId,
    model,
    temperature: 0.9,
    maxTokens: 2200,
    throwOnError: true,
    systemPrompt:
      "You generate structured legal simulation cases. Output valid JSON only. Keep cases realistic, internally consistent, and grounded in ordinary evidence and witness behavior.",
    userPrompt: JSON.stringify(buildGenerationPrompt({ category, complexity, prompt })),
  });

  if (!aiResult) {
    throw new Error("Case generation is unavailable. Check OPENAI_API_KEY.");
  }

  const payload = normalizeGeneratedPayload(aiResult, category.slug, complexity);

  payload.slug =
    payload.slug?.trim() ||
    `${category.slug}-${slugify(payload.title || "generated-case")}-${Date.now()}`;

  const errors = validateCaseTemplatePayload(payload);
  if (errors.length > 0) {
    throw new Error(`Generated case template was invalid: ${errors.join(", ")}`);
  }

  return payload;
};

export const createGeneratedCaseTemplate = async (options) => {
  const payload = await generateCaseTemplatePayload(options);
  return CaseTemplate.create(payload);
};
