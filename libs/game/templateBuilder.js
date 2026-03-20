import "server-only";

import { requestStructuredCompletion } from "@/libs/gpt";
import {
  enrichTemplateForGameplay,
  normalizeTemplateParty,
  normalizeEvidenceAvailabilityStatus,
  normalizeEvidenceHolderSide,
} from "./templateInterview";
import { validateCaseTemplatePayload } from "./templates";
import { LEGAL_CASE_CATEGORIES, getCategoryBySlug } from "./categories";

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
const CLAIM_MATCH_STOPWORDS = new Set([
  "about",
  "after",
  "again",
  "because",
  "being",
  "between",
  "claim",
  "condition",
  "could",
  "detail",
  "during",
  "exact",
  "general",
  "generally",
  "issue",
  "lease",
  "major",
  "minor",
  "other",
  "over",
  "side",
  "story",
  "tenant",
  "there",
  "their",
  "them",
  "they",
  "this",
  "unit",
  "when",
  "what",
  "which",
  "with",
]);
const normalizeLookupKey = (value = "") =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const normalizeCategorySlug = (value = "", fallback = "") => {
  const raw = String(value || "").trim();

  if (!raw) {
    return fallback;
  }

  if (getCategoryBySlug(raw)) {
    return raw;
  }

  const normalized = normalizeLookupKey(raw);
  const byTitle = LEGAL_CASE_CATEGORIES.find(
    (category) => normalizeLookupKey(category.title) === normalized
  );

  if (byTitle) {
    return byTitle.slug;
  }

  const slugLike = raw
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  if (getCategoryBySlug(slugLike)) {
    return slugLike;
  }

  return fallback;
};

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

const CROSS_CASE_CLAIM_GROUPS = [
  ["landlord", "tenant", "apartment", "deposit", "move-out", "property management"],
  ["checkout", "cashier", "register", "store", "shoplifting", "receipt", "charger"],
  ["employer", "termination", "shift", "manager", "payroll", "workplace"],
];

const isCrossCaseContaminatedClaim = ({ claimText = "", fact = {}, canonicalStory = "" }) => {
  const claim = String(claimText || "").trim().toLowerCase();
  if (!claim) {
    return false;
  }

  const corpus = [
    fact.label || "",
    fact.canonicalDetail || "",
    ...(fact.discoverability?.keywords || []),
    canonicalStory || "",
  ]
    .join(" ")
    .toLowerCase();

  return CROSS_CASE_CLAIM_GROUPS.some((terms) => {
    const claimHits = terms.filter((term) => claim.includes(term));
    if (claimHits.length === 0) {
      return false;
    }

    const corpusHits = terms.filter((term) => corpus.includes(term));
    return corpusHits.length === 0;
  });
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

    return "I never got a proper itemized list or comparable documentation from the landlord.";
  }

  return "I do not agree that I failed to provide a proper itemized list or comparable documentation.";
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
  const loweredDetail = detail.toLowerCase();

  if (!detail) {
    return party === "defendant"
      ? "My position is that the situation was more serious than the other side describes."
      : "That is what happened from my side.";
  }

  if (party === "plaintiff") {
    if (kind === "risk") {
      return `I know one weakness in my case is that ${detail.charAt(0).toLowerCase()}${detail.slice(1)}`;
    }

    if (/\bmove-in checklist|condition form|baseline condition\b/i.test(detail)) {
      return "I do not have a signed move-in checklist or baseline condition form showing exactly what the apartment looked like at the start.";
    }

    if (/\bphotos?\b/i.test(detail) && /\bmove-out|before leaving|phone\b/i.test(detail)) {
      return "I took photos before I left because I wanted to show the apartment's general condition at move-out.";
    }

    if (/\bbody camera|report|officer|contemporaneous note|exact words\b/i.test(detail)) {
      return "I do not know whether any officer report, body-camera footage, or note captured the exact words that were used.";
    }

    return detail;
  }

  if (/\bsecurity deposit\b/i.test(detail) && /\bpaid\b/i.test(detail)) {
    return "I do not dispute the lease or that Erica paid a $1,200 security deposit at move-in.";
  }

  if (/\bnotice\b/i.test(detail) && /\bmove out|lease end|vacate\b/i.test(detail)) {
    return "I do not dispute that Erica gave notice and moved out at the end of the lease term.";
  }

  if (/\bkeys?\b/i.test(detail) && /\breturned|possession\b/i.test(detail)) {
    return "I do not dispute that Erica returned the keys and surrendered possession when the tenancy ended.";
  }

  if (/\bphotos?\b/i.test(detail) && /\bmove-out|before leaving|phone\b/i.test(detail)) {
    return "I understand Erica took move-out photos, but I do not think they show every issue I later observed.";
  }

  if (/\bitemized|itemised|accounting|deduction statement|written accounting\b/i.test(detail)) {
    return "My position is that I explained the deductions, even if Erica says the written accounting was not detailed enough.";
  }

  if (/\breceipts?|invoices?|work orders?|records?\b/i.test(detail)) {
    return "I believe the work was real and necessary, even if the paperwork is incomplete or no longer available.";
  }

  if (/\breceipt|scanned|register|checkout|paid\b/i.test(detail)) {
    return "My position is that the charger was not included in the completed purchase at the register.";
  }

  if (/\bpolice|officer|incident report|citation|arrest\b/i.test(detail)) {
    return "My position is that police responded after the store owner reported the unpaid item and started a low-level theft case.";
  }

  if (/\bforce|damage|violence|nonviolent\b/i.test(detail)) {
    return "I am not claiming Marcus used force or caused damage; the issue is whether he intentionally left without paying.";
  }

  if (/\blow value|less than twenty dollars|small alleged theft\b/i.test(detail)) {
    return "The item was low in value, but my position is that the small amount does not resolve the intent question.";
  }

  if (kind === "dispute") {
    if (/\bscan|counter|receipt|paid\b/i.test(detail)) {
      return "My position is that Marcus did not actually present the charger for scanning before he paid and left.";
    }

    if (/\bdeny|offered to pay|surprised|first words\b/i.test(detail)) {
      return "My position is that Marcus's first response outside was inconsistent with an innocent mistake.";
    }

    if (/\bintent|mistake|knowledge|state of mind\b/i.test(detail)) {
      return "My position is that Marcus knew the charger had not been paid for when he left the store.";
    }

    if (/\bclean(?:ing)?\b/i.test(detail)) {
      return "My position is that the apartment needed more than ordinary turnover cleaning after move-out.";
    }

    if (/\bwall\b/i.test(detail) && /\bhole|paint|patch\b/i.test(detail)) {
      return "My position is that the wall condition went beyond minor ordinary wear and required patching or paint work.";
    }

    if (/\brepaint|paint\b/i.test(detail)) {
      return "My position is that the repainting was tied to the condition of the unit, not just routine turnover.";
    }

    if (/\bwear and tear|ordinary\b/i.test(detail) || /\bmove-out condition\b/i.test(detail)) {
      return "My position is that the apartment was not left in ordinary move-out condition.";
    }

    return "My position is that the apartment needed more work after move-out than the tenant now admits.";
  }

  if (kind === "risk") {
    return "I think that point leaves out context from my side, even if I may not have every record to prove it cleanly.";
  }

  if (/\bno unpaid rent|no lease violations|narrow dispute\b/i.test(loweredDetail)) {
    return "From my side, this dispute is mainly about the unit's condition and the deposit, not unpaid rent or other violations.";
  }

  return "I agree with the basic sequence, but I do not agree with the other side's interpretation of what it shows.";
};

const tokenizeClaimMatchText = (value = "") =>
  uniqueList(
    normalizeLookupKey(value)
      .split(" ")
      .filter((token) => token.length > 3 && !CLAIM_MATCH_STOPWORDS.has(token))
  );

const scoreClaimMatch = (item = {}, fact = {}) => {
  const label = normalizeLookupKey(item?.label || "");
  const detail = normalizeLookupKey(item?.detail || "");
  const targetLabel = normalizeLookupKey(fact.label || "");
  const targetDetail = normalizeLookupKey(fact.canonicalDetail || "");
  const keywordText = Array.isArray(fact.discoverability?.keywords)
    ? fact.discoverability.keywords.join(" ")
    : "";
  const targetTokens = new Set(
    tokenizeClaimMatchText([targetLabel, targetDetail, keywordText].join(" "))
  );
  const labelTokens = tokenizeClaimMatchText(label);
  const detailTokens = tokenizeClaimMatchText(detail);
  const overlap = [...new Set([...labelTokens, ...detailTokens])].filter((token) =>
    targetTokens.has(token)
  ).length;

  let score = overlap;

  if (label && targetLabel && (targetLabel.includes(label) || label.includes(targetLabel))) {
    score += 6;
  }

  if (label && targetDetail && (targetDetail.includes(label) || label.includes(targetDetail))) {
    score += 3;
  }

  if (
    detail &&
    targetDetail &&
    (targetDetail.includes(detail.slice(0, Math.min(detail.length, 40))) || detail.includes(targetLabel))
  ) {
    score += 2;
  }

  return score;
};

const ensurePartyCoverage = (fact, canonicalStory = "") => {
  const normalized = normalizeClaims(fact.claims).filter(
    (claim) =>
      !isLowQualityClaimText(claim.claimedDetail) &&
      !isCrossCaseContaminatedClaim({
        claimText: claim.claimedDetail,
        fact,
        canonicalStory,
      })
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

  const softened = raw >= 0.95 ? 0.85 : raw <= 0.05 ? 0.15 : raw;
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
    /^deposit kept\b/,
    /^deposit withheld\b/,
    /^security deposit withheld\b/,
    /^deposit returned\b/,
    /^deposit dispute\b/,
    /^deposit kept for\b/,
    /^deposit withheld for\b/,
    /^security deposit not returned\b/,
    /^security deposit kept\b/,
    /^security deposit withheld\b/,
    /\blease agreement\b/,
    /\blease dispute\b/,
    /\bhabitability issues?\b/,
    /\bcase$/,
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

const buildDepositCaseTitle = (corpus = "") => {
  const moneyValues = extractMoneyValues(corpus);
  const likelyWithheldAmount =
    moneyValues.find((value) => value && value !== "1200") || moneyValues[0] || "";

  if (likelyWithheldAmount) {
    return `The $${likelyWithheldAmount} Deposit Fight`;
  }

  return "The Deposit Fight";
};

const buildInterestingTitle = ({ title, subtitle, categorySlug, story = "", overview = "" }) => {
  if (!titleLooksGeneric(title)) {
    return String(title || "").trim();
  }

  const fallback = categoryTitleFallbacks[categorySlug] || "Docket Under Fire";
  const corpus = [subtitle || "", story || "", overview || ""].join(" ").trim().toLowerCase();

  if (corpus.includes("deposit")) return buildDepositCaseTitle(corpus);
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

const finalizeTemplatePresentation = (payload = {}, categorySlug, canonicalStory = "") => {
  const nextTitle = buildInterestingTitle({
    title: payload.title,
    subtitle: payload.subtitle,
    categorySlug,
    story: canonicalStory,
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

const isDocumentationEvidenceType = (value = "") =>
  ["invoice", "record", "document", "message"].includes(
    String(value || "")
      .trim()
      .toLowerCase()
  );

const shouldSkipSemanticEvidenceMismatch = (fact = {}, evidenceItem = {}) => {
  const factKind = String(fact.kind || "").trim().toLowerCase();
  const factCorpus = [
    fact.label || "",
    fact.canonicalDetail || "",
    ...(fact.discoverability?.keywords || []),
  ].join(" ");
  const evidenceType = String(evidenceItem.type || "")
    .trim()
    .toLowerCase();

  if (evidenceType === "witness") {
    return true;
  }

  if (["risk", "evidence"].includes(factKind)) {
    return true;
  }

  if (isDocumentationGapFact(fact) && isDocumentationEvidenceType(evidenceType)) {
    return true;
  }

  if (
    /\b(proof gap|proof-gaps|missing|uncertain|unclear|incomplete|availability|documentation|invoice|receipt|work order|records?)\b/i.test(
      factCorpus
    ) &&
    isDocumentationEvidenceType(evidenceType)
  ) {
    return true;
  }

  return false;
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

const detectTemplateRepairIssues = (payload = {}, canonicalStory = "") => {
  const issues = [];
  const title = String(payload.title || "").trim();
  const subtitle = String(payload.subtitle || "").trim();
  const desiredRelief = String(payload.desiredRelief || "").trim();
  const story = String(canonicalStory || payload.authoringNotes || "").trim();

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

      if (
        isCrossCaseContaminatedClaim({
          claimText: claim.claimedDetail,
          fact,
          canonicalStory,
        })
      ) {
        issues.push(
          `canonicalFacts[${index}] contains claim text for ${claim.party} that appears to belong to a different case domain.`
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
        !shouldSkipSemanticEvidenceMismatch(fact, evidenceItem) &&
        countSharedEvidenceTokens(factCorpus, evidenceCorpus) === 0
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

const withCanonicalStoryNote = (payload = {}, canonicalStory = "") => {
  if (!canonicalStory) {
    return payload;
  }

  const existingNotes = String(payload.authoringNotes || "")
    .replace(/\n*\s*Canonical story:\s[\s\S]*$/i, "")
    .trim();

  return {
    ...payload,
    authoringNotes: uniqueList([
      existingNotes,
      `Canonical story: ${String(canonicalStory).trim()}`,
    ]).join("\n\n"),
  };
};

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
    primaryCategory: normalizeCategorySlug(payload.primaryCategory, categorySlug),
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
          }, payload.authoringNotes || ""),
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

const baseTemplateOutputSchema = {
  title: "string",
  subtitle: "string",
  overview: "string",
  desiredRelief: "string",
  openingStatement: "string",
  starterTheory: "string",
  practiceArea: "string",
  primaryCategory: "string",
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
};

const factInventoryOutputSchema = {
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
      followUpQuestions: ["string"],
    },
  ],
};

const buildCompactStoryContext = (artifact = {}) => ({
  categorySlug: String(artifact?.categorySlug || "").trim(),
  complexity: Number(artifact?.complexity || 1),
  canonicalStoryPacket: artifact?.canonicalStoryPacket
    ? {
        title: artifact.canonicalStoryPacket.title,
        subtitle: artifact.canonicalStoryPacket.subtitle,
        overview: artifact.canonicalStoryPacket.overview,
        desiredRelief: artifact.canonicalStoryPacket.desiredRelief,
        openingStatement: artifact.canonicalStoryPacket.openingStatement,
        starterTheory: artifact.canonicalStoryPacket.starterTheory,
        practiceArea: artifact.canonicalStoryPacket.practiceArea,
        courtName: artifact.canonicalStoryPacket.courtName,
        plaintiffName: artifact.canonicalStoryPacket.plaintiffName,
        defendantName: artifact.canonicalStoryPacket.defendantName,
        legalTags: artifact.canonicalStoryPacket.legalTags,
        authoringNotes: artifact.canonicalStoryPacket.authoringNotes,
        canonicalStory: artifact.canonicalStoryPacket.canonicalStory,
        storyBeats: artifact.canonicalStoryPacket.storyBeats,
        settledFacts: artifact.canonicalStoryPacket.settledFacts,
        disputedIssues: artifact.canonicalStoryPacket.disputedIssues,
        likelyEvidence: artifact.canonicalStoryPacket.likelyEvidence,
        missingOrUncertainRecords: artifact.canonicalStoryPacket.missingOrUncertainRecords,
        plaintiffPressurePoints: artifact.canonicalStoryPacket.plaintiffPressurePoints,
        defendantPressurePoints: artifact.canonicalStoryPacket.defendantPressurePoints,
      }
    : null,
  plaintiffDetailedStory: artifact?.plaintiffDetailedStory
    ? {
        side: artifact.plaintiffDetailedStory.side,
        narrative: artifact.plaintiffDetailedStory.narrative,
        intakeOpening: artifact.plaintiffDetailedStory.intakeOpening,
        timelineDetails: artifact.plaintiffDetailedStory.timelineDetails,
        claimedFacts: artifact.plaintiffDetailedStory.claimedFacts,
        evidenceReferences: artifact.plaintiffDetailedStory.evidenceReferences,
        proofGaps: artifact.plaintiffDetailedStory.proofGaps,
        witnessHooks: artifact.plaintiffDetailedStory.witnessHooks,
      }
    : null,
  defendantDetailedStory: artifact?.defendantDetailedStory
    ? {
        side: artifact.defendantDetailedStory.side,
        narrative: artifact.defendantDetailedStory.narrative,
        intakeOpening: artifact.defendantDetailedStory.intakeOpening,
        timelineDetails: artifact.defendantDetailedStory.timelineDetails,
        claimedFacts: artifact.defendantDetailedStory.claimedFacts,
        evidenceReferences: artifact.defendantDetailedStory.evidenceReferences,
        proofGaps: artifact.defendantDetailedStory.proofGaps,
        witnessHooks: artifact.defendantDetailedStory.witnessHooks,
      }
    : null,
});

const buildFactInventoryPrompt = ({ storyContext, category, complexity, prompt }) => ({
  task: "Extract the proposition inventory for a legal simulation template from a canonical story and two side-specific branch stories.",
  requirements: {
    category: category.slug,
    categoryTitle: category.title,
    complexity,
    additionalPrompt: prompt || "",
    rules: [
      "Use the canonical story as the truth anchor.",
      "Use the plaintiff and defendant detailed stories to identify what is disputed, emphasized, omitted, or uncertain.",
      "Output factual propositions, not legal slogans.",
      "Do not include claims yet. Do not include evidence refs yet.",
      "Keep follow-up questions brief and practical.",
      "Classify supporting, dispute, risk, and evidence-oriented proof-gap points carefully.",
      "If a point is a missing receipt, missing itemization, missing notice, or similar gap, model it as supporting or evidence-related proof-gap rather than automatic corroboration.",
    ],
  },
  storyContext,
  outputSchema: factInventoryOutputSchema,
});

const buildEvidenceInventoryPrompt = ({
  storyContext,
  factInventory,
  category,
  complexity,
  prompt,
}) => ({
  task: "Build the evidence inventory for a legal simulation template from the story artifact and proposition inventory.",
  requirements: {
    category: category.slug,
    categoryTitle: category.title,
    complexity,
    additionalPrompt: prompt || "",
    rules: [
      "Derive evidence items from the canonical story and both branch stories.",
      "Include documents, messages, photos, invoices, witnesses, records, and missing or contested proof where appropriate.",
      "Link each evidence item to the relevant fact ids.",
      "Use realistic availability statuses such as confirmed, mentioned, unknown, missing, or contested.",
    ],
  },
  storyContext,
  factInventory,
  outputSchema: {
    evidenceItems: baseTemplateOutputSchema.evidenceItems,
  },
});

const claimStanceFromBranch = (value = "", factKind = "") => {
  const normalized = String(value || "").trim().toLowerCase();

  if (normalized === "emphasizes") return "admits";
  if (normalized === "contests") return "denies";
  if (normalized === "omits") return "omits";
  if (normalized === "uncertain") return factKind === "dispute" ? "denies" : "omits";

  return factKind === "dispute" ? "denies" : "admits";
};

const pickMatchingClaimedFact = (claimedFacts = [], fact = {}) => {
  let best = null;
  let bestScore = 0;

  (Array.isArray(claimedFacts) ? claimedFacts : []).forEach((item) => {
    const score = scoreClaimMatch(item, fact);
    if (score > bestScore) {
      best = item;
      bestScore = score;
    }
  });

  return bestScore >= 4 ? best : null;
};

const buildClaimFromSideStory = (side, fact, sideStory = {}) => {
  const matched = pickMatchingClaimedFact(sideStory.claimedFacts, fact);
  const factKind = String(fact.kind || "").trim().toLowerCase();
  const directKeywords = Array.isArray(fact.discoverability?.keywords)
    ? fact.discoverability.keywords.slice(0, 5)
    : [];

  if (matched?.detail) {
    const claimText = sanitizeClaimText(matched.detail);
    const shouldFallback =
      !claimText ||
      isLowQualityClaimText(claimText) ||
      isCrossCaseContaminatedClaim({
        claimText,
        fact,
        canonicalStory: sideStory?.narrative || "",
      });

    return {
      party: side,
      claimedDetail:
        !shouldFallback
          ? claimText
          : sanitizeClaimText(
              buildFallbackClaimText({
                party: side,
                canonicalDetail: fact.canonicalDetail,
                kind: factKind,
              })
            ),
      stance: claimStanceFromBranch(matched.stance, factKind),
      confidence: matched.stance === "uncertain" ? 0.72 : 0.86,
      accessLevel: matched.stance === "uncertain" || factKind === "risk" ? "partial" : "direct",
      deceptionProfile:
        side === "plaintiff"
          ? "first-person account with advocacy framing"
          : matched.stance === "uncertain"
            ? "guarded account with selective certainty"
            : "defensive framing tied to the file",
      keywords: directKeywords,
    };
  }

  return {
    party: side,
    claimedDetail: sanitizeClaimText(
      buildFallbackClaimText({
        party: side,
        canonicalDetail: fact.canonicalDetail,
        kind: factKind,
      })
    ),
    stance: factKind === "dispute" && side === "defendant" ? "denies" : "admits",
    confidence: 0.74,
    accessLevel: factKind === "risk" ? "partial" : "direct",
    deceptionProfile: side === "plaintiff" ? "generic plaintiff framing" : "generic defense framing",
    keywords: directKeywords,
  };
};

const factPriorityScore = (fact = {}) => {
  const kind = String(fact.kind || "").trim().toLowerCase();
  const weights = {
    dispute: 5,
    evidence: 4,
    timeline: 3,
    supporting: 2,
    risk: 1,
  };

  return weights[kind] || 0;
};

const buildDeterministicInterviewBlueprint = (facts = [], storyContext = {}) => {
  const plaintiffStory = storyContext?.plaintiffDetailedStory || {};
  const defendantStory = storyContext?.defendantDetailedStory || {};
  const sortedFactIds = [...facts]
    .sort((left, right) => factPriorityScore(right) - factPriorityScore(left))
    .map((fact) => fact.factId)
    .filter(Boolean);
  const plaintiffQuestions = uniqueList(
    facts.flatMap((fact) => fact.followUpQuestions || [])
  ).slice(0, 14);
  const defendantQuestions = uniqueList(
    [...facts].reverse().flatMap((fact) => fact.followUpQuestions || [])
  ).slice(0, 14);

  return {
    plaintiff: {
      opening:
        sanitizeClaimText(
          normalizeClientIntakeStatement(
            plaintiffStory.intakeOpening ||
              storyContext?.canonicalStoryPacket?.openingStatement ||
              ""
          )
        ) || "I want to explain why I believe the deductions were not justified.",
      posture:
        "Cooperative and motivated to explain her side; stronger on lived experience than on paperwork precision.",
      priorityFactIds: sortedFactIds.slice(0, 12),
      suggestedQuestions: plaintiffQuestions,
    },
    defendant: {
      opening:
        sanitizeClaimText(
          normalizeClientIntakeStatement(
            defendantStory.intakeOpening ||
              "Management's position is that the deductions were based on the apartment's condition after move-out."
          )
        ) || "Management's position is that the deductions were justified.",
      posture:
        "Measured and guarded; likely to rely on office process and available records rather than broad concessions.",
      priorityFactIds: sortedFactIds.slice(0, 12),
      suggestedQuestions: defendantQuestions,
    },
  };
};

const buildDeterministicPartyProfiles = (storyContext = {}) => ({
  plaintiff: {
    role: "plaintiff",
    occupation: "Former residential tenant",
    educationOrTraining: "No specialized legal training",
    communicationStyle: "plain",
    intelligence: 0.8,
    memoryDiscipline: 0.75,
    honesty: 0.85,
    emotionalControl: 0.75,
    speechDeterminism: 0.75,
    backgroundNotes: uniqueList([
      "Primary firsthand witness to move-in, move-out, and follow-up communications.",
      ...(storyContext?.plaintiffDetailedStory?.proofGaps || []).slice(0, 2),
      ...(storyContext?.canonicalStoryPacket?.plaintiffPressurePoints || []).slice(0, 2),
    ]),
  },
  defendant: {
    role: "defendant",
    occupation: "Property management company",
    educationOrTraining: "Residential leasing and turnover management experience",
    communicationStyle: "guarded",
    intelligence: 0.8,
    memoryDiscipline: 0.75,
    honesty: 0.75,
    emotionalControl: 0.8,
    speechDeterminism: 0.75,
    backgroundNotes: uniqueList([
      "Likely represented through a manager or staff member rather than an individual tenant.",
      ...(storyContext?.defendantDetailedStory?.proofGaps || []).slice(0, 2),
      ...(storyContext?.canonicalStoryPacket?.defendantPressurePoints || []).slice(0, 2),
    ]),
  },
});

const buildClaimsAndMetaPrompt = ({
  storyContext,
  factInventory,
  category,
  complexity,
}) => {
  const canonical = storyContext?.canonicalStoryPacket || {};
  const plaintiffStory = storyContext?.plaintiffDetailedStory || {};
  const defendantStory = storyContext?.defendantDetailedStory || {};
  const facts = Array.isArray(factInventory?.canonicalFacts) ? factInventory.canonicalFacts : [];

  return {
    title: String(canonical.title || "").trim(),
    subtitle: String(canonical.subtitle || "").trim(),
    overview: String(canonical.overview || "").trim(),
    desiredRelief: String(canonical.desiredRelief || "").trim(),
    openingStatement: String(
      canonical.openingStatement || plaintiffStory.intakeOpening || ""
    ).trim(),
    starterTheory: String(canonical.starterTheory || "").trim(),
    practiceArea: String(canonical.practiceArea || "").trim(),
    primaryCategory: category.slug,
    secondaryCategories: Array.isArray(canonical.secondaryCategories)
      ? canonical.secondaryCategories.map((item) => String(item).trim()).filter(Boolean)
      : [],
    complexity,
    courtName: String(canonical.courtName || "").trim(),
    plaintiffName: String(canonical.plaintiffName || "").trim(),
    defendantName: String(canonical.defendantName || "").trim(),
    legalTags: Array.isArray(canonical.legalTags)
      ? canonical.legalTags.map((item) => String(item).trim()).filter(Boolean)
      : [],
    authoringNotes: String(canonical.authoringNotes || "").trim(),
    partyProfiles: buildDeterministicPartyProfiles(storyContext),
    interviewBlueprint: buildDeterministicInterviewBlueprint(facts, storyContext),
    claimsByFact: facts.map((fact) => ({
      factId: fact.factId,
      claims: [
        buildClaimFromSideStory("plaintiff", fact, plaintiffStory),
        buildClaimFromSideStory("defendant", fact, defendantStory),
      ],
    })),
  };
};

const buildTemplateAssemblyPrompt = ({
  factInventory,
  evidenceInventory,
  claimsAndMeta,
}) => {
  const claimsByFactMap = new Map(
    (Array.isArray(claimsAndMeta?.claimsByFact) ? claimsAndMeta.claimsByFact : [])
      .filter((item) => item?.factId)
      .map((item) => [String(item.factId).trim(), item.claims || []])
  );
  const evidenceItems = Array.isArray(evidenceInventory?.evidenceItems)
    ? evidenceInventory.evidenceItems
    : [];
  const evidenceByFactId = new Map();

  evidenceItems.forEach((item) => {
    (item.linkedFactIds || []).forEach((factId) => {
      const key = String(factId || "").trim();
      if (!key) {
        return;
      }

      if (!evidenceByFactId.has(key)) {
        evidenceByFactId.set(key, []);
      }
      evidenceByFactId.get(key).push(String(item.id || "").trim());
    });
  });

  return {
    ...claimsAndMeta,
    canonicalFacts: (Array.isArray(factInventory?.canonicalFacts)
      ? factInventory.canonicalFacts
      : []
    ).map((fact) => ({
      ...fact,
      evidenceRefs: uniqueList(evidenceByFactId.get(String(fact.factId || "").trim()) || []),
      claims: claimsByFactMap.get(String(fact.factId || "").trim()) || [],
    })),
    evidenceItems,
  };
};

const repairTemplateDeterministically = (payload = {}, canonicalStory = "", categorySlug = "") => {
  const normalizedPayload = {
    ...payload,
    interviewBlueprint: {
      plaintiff: normalizeBlueprintSide(payload.interviewBlueprint?.plaintiff || {}),
      defendant: normalizeBlueprintSide(payload.interviewBlueprint?.defendant || {}),
    },
  };
  const facts = Array.isArray(normalizedPayload.canonicalFacts) ? normalizedPayload.canonicalFacts : [];
  const evidenceItems = Array.isArray(normalizedPayload.evidenceItems)
    ? normalizedPayload.evidenceItems
    : [];
  const evidenceById = new Map(
    evidenceItems
      .filter((item) => String(item?.id || "").trim())
      .map((item) => [String(item.id).trim(), { ...item, linkedFactIds: uniqueList(item.linkedFactIds || []) }])
  );
  const factIds = new Set(
    facts.map((fact) => String(fact?.factId || "").trim()).filter(Boolean)
  );

  const repairedFacts = facts.map((fact) => {
    const factId = String(fact.factId || "").trim();
    const cleanedEvidenceRefs = uniqueList(
      (fact.evidenceRefs || []).filter((ref) => {
        const evidenceItem = evidenceById.get(String(ref || "").trim());
        if (!evidenceItem) {
          return false;
        }

        const factCorpus = [
          fact.label || "",
          fact.canonicalDetail || "",
          ...(fact.discoverability?.keywords || []),
        ].join(" ");
        const evidenceCorpus = [evidenceItem.label || "", evidenceItem.detail || ""].join(" ");

        return (
          shouldSkipSemanticEvidenceMismatch(fact, evidenceItem) ||
          countSharedEvidenceTokens(factCorpus, evidenceCorpus) > 0
        );
      })
    );

    cleanedEvidenceRefs.forEach((ref) => {
      const evidenceItem = evidenceById.get(ref);
      if (evidenceItem) {
        evidenceItem.linkedFactIds = uniqueList([...(evidenceItem.linkedFactIds || []), factId]);
      }
    });

    return {
      ...fact,
      kind:
        String(fact.kind || "").trim().toLowerCase() === "risk" && isRepairInactionFact(fact)
          ? "supporting"
          : fact.kind,
      claims: ensurePartyCoverage({
        ...fact,
        claims: normalizeClaims(fact.claims).map((claim) => ({
          ...claim,
          claimedDetail: isCrossCaseContaminatedClaim({
            claimText: claim.claimedDetail,
            fact,
            canonicalStory,
          })
            ? (isDocumentationGapFact(fact)
                ? buildDocumentationGapClaim({
                    party: normalizeTemplateParty(claim.party),
                    canonicalDetail: fact.canonicalDetail,
                  })
                : buildFallbackClaimText({
                    party: normalizeTemplateParty(claim.party),
                    canonicalDetail: fact.canonicalDetail,
                    kind: fact.kind,
                  }))
            : sanitizeClaimText(claim.claimedDetail),
        })),
      }, canonicalStory),
      evidenceRefs: cleanedEvidenceRefs,
    };
  });

  const repairedEvidenceItems = [...evidenceById.values()]
    .map((item) => ({
      ...item,
      linkedFactIds: uniqueList((item.linkedFactIds || []).filter((factId) => factIds.has(String(factId)))),
    }))
    .filter((item) => (item.linkedFactIds || []).length > 0);

  return finalizeTemplatePresentation(
    {
      ...normalizedPayload,
      canonicalFacts: repairedFacts,
      evidenceItems: repairedEvidenceItems,
    },
    categorySlug,
    canonicalStory
  );
};

const buildInterviewPlanningPrompt = ({ basePayload, category, complexity, prompt }) => ({
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
      "Keep party profile numbers realistic and differentiated.",
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
    interviewBlueprint: baseTemplateOutputSchema.interviewBlueprint,
    partyProfiles: baseTemplateOutputSchema.partyProfiles,
  },
});

const emitBuilderProgress = async (onProgress, result, extra = {}) => {
  if (typeof onProgress !== "function") {
    return;
  }

  await onProgress({
    stage: extra.stage || "template",
    label:
      extra.label ||
      (extra.stage === "repair"
        ? "Repairing template"
        : extra.stage === "interview"
          ? "Planning interview"
          : "Building template"),
    result,
    ...extra,
  });
};

const getTemplateTokenBudget = (complexity = 1) => {
  const normalized = Math.max(1, Math.min(5, Number(complexity) || 1));
  const budgets = {
    1: {
      factInventory: 3500,
      evidenceInventory: 3500,
      claimsAndMeta: 4500,
      templateDraft: 7000,
      repair: 7000,
      interview: 3500,
    },
    2: {
      factInventory: 4000,
      evidenceInventory: 4000,
      claimsAndMeta: 5000,
      templateDraft: 8000,
      repair: 8000,
      interview: 4000,
    },
    3: {
      factInventory: 5000,
      evidenceInventory: 5000,
      claimsAndMeta: 6000,
      templateDraft: 9000,
      repair: 9000,
      interview: 5000,
    },
    4: {
      factInventory: 6000,
      evidenceInventory: 6000,
      claimsAndMeta: 7000,
      templateDraft: 10000,
      repair: 10000,
      interview: 6000,
    },
    5: {
      factInventory: 7000,
      evidenceInventory: 7000,
      claimsAndMeta: 8000,
      templateDraft: 12000,
      repair: 12000,
      interview: 7000,
    },
  };

  return budgets[normalized];
};

export const buildTemplateFromStoryArtifact = async ({
  artifact,
  category,
  complexity,
  prompt = "",
  userId = "system",
  model,
  onUsage,
  onProgress,
}) => {
  const canonicalStory = String(artifact?.canonicalStoryPacket?.canonicalStory || "").trim();
  const tokenBudget = getTemplateTokenBudget(complexity);
  const storyContext = buildCompactStoryContext(artifact);

  const factInventory = await requestStructuredCompletion({
    userId,
    model,
    temperature: 0.35,
    maxTokens: tokenBudget.factInventory,
    retryAttempts: 1,
    usageLabel: "template.factInventory",
    onUsage,
    throwOnError: true,
    systemPrompt:
      "You extract proposition inventories for legal simulation templates. Output valid JSON only. Use the canonical story as truth and branch stories as party perspective inputs.",
    userPrompt: JSON.stringify(
      buildFactInventoryPrompt({
        storyContext,
        category,
        complexity,
        prompt,
      })
    ),
  });
  await emitBuilderProgress(onProgress, factInventory, {
    stage: "template",
    substep: "Extracting proposition inventory",
    artifactId: artifact?.id,
  });

  const evidenceInventory = await requestStructuredCompletion({
    userId,
    model,
    temperature: 0.3,
    maxTokens: tokenBudget.evidenceInventory,
    retryAttempts: 1,
    usageLabel: "template.evidenceInventory",
    onUsage,
    throwOnError: true,
    systemPrompt:
      "You build evidence inventories for legal simulation templates. Output valid JSON only. Link evidence to fact ids and use realistic availability statuses.",
    userPrompt: JSON.stringify(
      buildEvidenceInventoryPrompt({
        storyContext,
        factInventory,
        category,
        complexity,
        prompt,
      })
    ),
  });
  await emitBuilderProgress(onProgress, evidenceInventory, {
    stage: "template",
    substep: "Building evidence inventory",
    artifactId: artifact?.id,
  });

  const claimsAndMeta = buildClaimsAndMetaPrompt({
    storyContext,
    factInventory,
    evidenceInventory,
    category,
    complexity,
    prompt,
  });
  await emitBuilderProgress(onProgress, claimsAndMeta, {
    stage: "template",
    substep: "Building side claims and metadata",
    artifactId: artifact?.id,
  });

  const templateDraft = buildTemplateAssemblyPrompt({
    storyContext,
    factInventory,
    evidenceInventory,
    claimsAndMeta,
    category,
    complexity,
    prompt,
  });
  artifact.templateDraft = templateDraft;
  await artifact.save();
  await emitBuilderProgress(onProgress, templateDraft, {
    stage: "template",
    substep: "Assembling template draft",
    artifactId: artifact?.id,
  });

  let payload = withCanonicalStoryNote(
    normalizeGeneratedPayload(templateDraft, category.slug, complexity),
    canonicalStory
  );

  if (!hasUsableCanonicalFacts(payload)) {
    throw new Error(
      "Case generation failed because the template builder did not produce usable canonical facts."
    );
  }

  let detectedIssues = detectTemplateRepairIssues(payload, canonicalStory);
  artifact.templateRepairIssues = detectedIssues;
  await artifact.save();

  if (detectedIssues.length > 0) {
    payload = withCanonicalStoryNote(
      repairTemplateDeterministically(payload, canonicalStory, category.slug),
      canonicalStory
    );
    detectedIssues = detectTemplateRepairIssues(payload, canonicalStory);
    artifact.templateRepairIssues = detectedIssues;
    artifact.templateDraft = payload;
    await artifact.save();
  }

  await emitBuilderProgress(onProgress, payload, {
    stage: "repair",
    label: "Repairing template",
    detectedIssues,
    artifactId: artifact?.id,
  });

  if (hasBlockingTemplateIssues(detectedIssues)) {
    throw new Error(
      `Case generation failed because blocking template issues remained: ${detectedIssues.join(
        "; "
      )}`
    );
  }

  const interviewPlan = await requestStructuredCompletion({
    userId,
    model,
    temperature: 0.35,
    maxTokens: tokenBudget.interview,
    retryAttempts: 1,
    usageLabel: "template.interview",
    onUsage,
    throwOnError: true,
    systemPrompt:
      "You refine legal simulation cases into interview-ready templates. Output valid JSON only. Preserve the dispute but distinguish confirmed proof from leads, missing records, and disputed evidence.",
    userPrompt: JSON.stringify(
      buildInterviewPlanningPrompt({
        basePayload: payload,
        category,
        complexity,
        prompt,
      })
    ),
  });

  if (interviewPlan && typeof interviewPlan === "object") {
    const plannedPayload = mergeInterviewPlanningPayload(payload, interviewPlan);

    if (hasUsableCanonicalFacts(plannedPayload)) {
      payload = plannedPayload;
    }
  }

  payload = finalizeTemplatePresentation(payload, category.slug, canonicalStory);
  const finalIssues = detectTemplateRepairIssues(payload, canonicalStory);
  if (hasBlockingTemplateIssues(finalIssues)) {
    throw new Error(
      `Case generation failed final verification because blocking issues remained: ${finalIssues.join(
        "; "
      )}`
    );
  }

  const errors = validateCaseTemplatePayload(payload);
  if (errors.length > 0) {
    throw new Error(`Generated case template was invalid: ${errors.join(", ")}`);
  }

  artifact.templateDraft = payload;
  artifact.templateRepairIssues = finalIssues;
  await artifact.save();

  await emitBuilderProgress(onProgress, payload, {
    stage: "interview",
    label: "Planning interview",
    interviewPlan,
    finalIssues,
    artifactId: artifact?.id,
  });

  return payload;
};
