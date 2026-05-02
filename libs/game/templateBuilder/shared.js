import "server-only";

import { normalizeTemplateParty } from "../templateInterview";
import { LEGAL_CASE_CATEGORIES, getCategoryBySlug } from "../categories";
import {
  MONEY_PATTERN,
  buildDepositCaseTitle,
  extractMoneyValues,
} from "./titleUtils";

export const isFastGenerationProfile = (value = "") =>
  ["fast", "rebalance"].includes(String(value || "").trim().toLowerCase());

export const categoryLegalTagDefaults = {
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

export const ALLOWED_EVIDENCE_TYPES = new Set([
  "document",
  "photo",
  "message",
  "invoice",
  "witness",
  "record",
  "other",
]);

export const uniqueList = (items = []) =>
  [...new Set((items || []).map((item) => String(item || "").trim()).filter(Boolean))];
export const CLAIM_MATCH_STOPWORDS = new Set([
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
export const normalizeLookupKey = (value = "") =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

export const normalizeCategorySlug = (value = "", fallback = "") => {
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

export const normalizeClientIntakeStatement = (value = "") => {
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

export const sanitizeClaimText = (value = "") => {
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

export const isLowQualityClaimText = (value = "") => {
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

export const CROSS_CASE_CLAIM_GROUPS = [
  ["landlord", "tenant", "apartment", "deposit", "move-out", "property management"],
  ["checkout", "cashier", "register", "store", "shoplifting", "receipt", "charger"],
  ["employer", "termination", "shift", "manager", "payroll", "workplace"],
];

export const isCrossCaseContaminatedClaim = ({ claimText = "", fact = {}, canonicalStory = "" }) => {
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

export const DOCUMENTATION_GAP_PATTERN =
  /\b(itemized|itemised|documentation|documented|breakdown|notice|receipt|invoice|record|records|list)\b/i;
export const OMISSION_PATTERN =
  /\b(no|not|never|without|missing|failed to|did not|didn't|wasn't|weren't|has not|have not)\b/i;
export const LEGAL_CONCLUSION_PATTERN =
  /\b(required to|entitled to|violat(?:e|ed|ing)|obligated to|duty to|must provide|should provide)\b/i;
export const REPAIR_INACTION_PATTERN =
  /\b(repair|heater|heating|heat|leak|leaking|mold|mould|rodent|rats|mice|damp|plumbing)\b/i;
export const LANDLORD_NONRESPONSE_PATTERN =
  /\b(no action|no response|ignored|did not respond|didn't respond|failed to fix|never fixed|refused to fix|unaddressed)\b/i;

export const isDocumentationGapFact = (fact = {}) => {
  const corpus = [
    fact.label || "",
    fact.canonicalDetail || "",
    ...(fact.discoverability?.keywords || []),
  ].join(" ");

  return DOCUMENTATION_GAP_PATTERN.test(corpus) && OMISSION_PATTERN.test(corpus);
};

export const isRepairInactionFact = (fact = {}) => {
  const corpus = [
    fact.label || "",
    fact.canonicalDetail || "",
    ...(fact.discoverability?.keywords || []),
  ].join(" ");

  return REPAIR_INACTION_PATTERN.test(corpus) && LANDLORD_NONRESPONSE_PATTERN.test(corpus);
};

export const inferGeneratedFactKind = (fact = {}) => {
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

export const buildDocumentationGapClaim = ({ party, canonicalDetail = "" }) => {
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

export const normalizeEvidenceType = (value = "") => {
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

export const normalizeClaims = (claims = []) =>
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

export const buildFallbackClaimText = ({ party, canonicalDetail, kind }) => {
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

export const tokenizeClaimMatchText = (value = "") =>
  uniqueList(
    normalizeLookupKey(value)
      .split(" ")
      .filter((token) => token.length > 3 && !CLAIM_MATCH_STOPWORDS.has(token))
  );

export const scoreClaimMatch = (item = {}, fact = {}) => {
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

export const ensurePartyCoverage = (fact, canonicalStory = "") => {
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

export const normalizeBlueprintSide = (value = {}) => ({
  opening: sanitizeClaimText(normalizeClientIntakeStatement(value.opening)),
  posture: String(value.posture || "").trim(),
  priorityFactIds: Array.isArray(value.priorityFactIds)
    ? value.priorityFactIds.map((item) => String(item).trim()).filter(Boolean)
    : [],
  suggestedQuestions: Array.isArray(value.suggestedQuestions)
    ? value.suggestedQuestions.map((item) => String(item).trim()).filter(Boolean)
    : [],
});

export const normalizeBlueprintPatchSide = (value = {}) => {
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

export const normalizeProfileScalar = (value, fallback) => {
  const raw =
    typeof value === "number" && Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : fallback;

  const softened = raw >= 0.95 ? 0.85 : raw <= 0.05 ? 0.15 : raw;
  return Math.round(softened * 20) / 20;
};

export const normalizePartyProfile = (value = {}, role) => ({
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

export const titleLooksGeneric = (title = "") => {
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

export const categoryTitleFallbacks = {
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

export const buildInterestingTitle = ({ title, subtitle, categorySlug, story = "", overview = "" }) => {
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

export const finalizeTemplatePresentation = (payload = {}, categorySlug, canonicalStory = "") => {
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

export const META_SCAFFOLDING_PATTERN =
  /\b(they are going to dispute this and say it does not prove my side|modeled claim|modelled claim|pending refinement|schema|i know they may use this against me|i know this point could be used against me|from my side, that point is being framed against me|my side is that)\b/i;

export { MONEY_PATTERN, buildDepositCaseTitle, extractMoneyValues };
