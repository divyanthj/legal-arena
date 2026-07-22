import "server-only";

import connectMongo from "@/libs/mongoose";
import CaseSession from "@/models/CaseSession";
import CaseTemplate from "@/models/CaseTemplate";
import User from "@/models/User";
import { LAWBOOK_VERSION, getLawbookRules } from "@/data/legalArenaLawbook";
import { listCategoryOptions } from "./templates";
import {
  buildInterviewSubjectForSide,
  buildMissingEvidenceNotesForSide,
  buildSuggestedQuestionsForSide,
  cleanPartyClaimText,
  enrichTemplateForGameplay,
  getSideOpeningStatement,
  normalizeTemplateParty,
} from "./templateInterview";
import {
  buildJudgeProfile,
  buildSessionTemplateSnapshot,
  getCanonicalStoryWorld,
} from "./storyWorld";
import {
  buildDynamicCaseTemplateSnapshot,
  generateDynamicCaseState,
} from "./dynamicCase";
import { buildCaseCountry } from "./countries";
import {
  buildPublicLeaderboardEntry,
  ensureUserProfile,
  getEligibleComplexityForCategory,
  normalizeProgression,
} from "./progression";
import { DEFAULT_CATEGORY_SLUG } from "./categories";
import { getNegotiationProfile } from "./negotiationProfile.mjs";
import {
  ensureStoredDashboardEncouragementNote,
  ensureStoredLawyerProfileSummary,
} from "./profileSummary";
import { normalizeOnboarding } from "./onboarding";
import { sanitizeFactSheet } from "./factSheetSanitizer";
import { ensureClientMemory, rebuildFactSheetFromTranscript } from "./engine";
import { generateClientMemoryExcerpt } from "./clientMemory";
import {
  appendUsageEntriesToCaseSession,
  createUsageCollector,
} from "./sessionUsage";
import { buildPublicWitnessPayload } from "./witnesses";

const toPlain = (doc) => (doc?.toJSON ? doc.toJSON() : doc);
const stripUsageEntries = (usage = {}) => {
  if (!usage || typeof usage !== "object") {
    return usage;
  }

  return ["intake", "courtroom", "settlement", "total"].reduce((result, key) => {
    const bucket = usage[key];

    if (!bucket || typeof bucket !== "object") {
      result[key] = bucket || {};
      return result;
    }

    const { entries, ...totals } = bucket;
    result[key] = totals;
    return result;
  }, {});
};

const getPlayerLevelFromProgression = (progression = {}) =>
  Math.max(1, Math.floor((Number(progression.overallXp) || 0) / 250) + 1);

const getDynamicComplexityCapForPlayerLevel = (playerLevel = 1) => {
  const level = Math.max(1, Number(playerLevel) || 1);

  if (level <= 2) return 1;
  if (level <= 5) return 2;
  if (level <= 8) return 3;
  if (level <= 12) return 4;
  return 5;
};

const getEffectiveDynamicComplexity = ({
  progression,
  categorySlug = DEFAULT_CATEGORY_SLUG,
  requestedComplexity = 1,
} = {}) => {
  const normalizedProgression = normalizeProgression(progression);
  const eligibleComplexity = getEligibleComplexityForCategory(
    normalizedProgression,
    categorySlug
  );
  const playerLevel = getPlayerLevelFromProgression(normalizedProgression);
  const playerLevelCap = getDynamicComplexityCapForPlayerLevel(playerLevel);
  const requested = Math.max(1, Math.min(5, Number(requestedComplexity) || 1));
  const capableComplexity = Math.min(eligibleComplexity, playerLevelCap);
  const challengeComplexityCap = Math.min(5, capableComplexity + 1);

  return {
    complexity: Math.min(requested, challengeComplexityCap),
    eligibleComplexity,
    playerLevel,
    playerLevelCap,
    capableComplexity,
    challengeComplexityCap,
  };
};
const factSheetHasVisibleContent = (factSheet = {}) =>
  [
    "summary",
    "theory",
    "desiredRelief",
    "timeline",
    "supportingFacts",
    "risks",
    "knownFacts",
    "knownClaims",
    "disputedFacts",
    "corroboratedFacts",
    "sourceLinks",
    "missingEvidence",
    "openQuestions",
  ].some((field) => Array.isArray(factSheet?.[field]) && factSheet[field].length > 0);

const coerceSettlementTermRows = (terms = []) => {
  const rowTerms = (Array.isArray(terms) ? terms : [])
    .map((term) => ({
      label: String(term?.label || term?.[0] || "").trim(),
      value: String(term?.value || term?.[1] || "").trim(),
    }))
    .filter((term) => term.label && term.value);

  if (rowTerms.length) {
    return rowTerms.slice(0, 8);
  }

  const labels = [
    "Settlement Amount",
    "Payment Timeline",
    "Corrective Work",
    "Release Terms",
    "Costs",
    "Fault",
  ];
  const inferLabel = (value = "") => {
    if (/\$|payment|pay|amount|refund|return|balance/i.test(value)) return "Settlement Amount";
    if (/day|week|month|deadline|within|timeline|date|prompt/i.test(value)) return "Payment Timeline";
    if (/punch|credit|repair|corrective|work|perform|complete/i.test(value)) return "Corrective Work";
    if (/future|relationship|release|waive|claim|dismiss/i.test(value)) return "Release Terms";
    if (/cost|fee|fees|interest/i.test(value)) return "Costs";
    if (/fault|admission|liability/i.test(value)) return "Fault";
    return "Settlement Amount";
  };
  const byLabel = new Map();

  for (const term of Array.isArray(terms) ? terms : []) {
    const text = String(term || "").replace(/\s+/g, " ").trim();
    if (!text) continue;

    const [rawLabel, ...rawValueParts] = text.split(":");
    const parsedLabel =
      rawValueParts.length && labels.includes(rawLabel.trim())
        ? rawLabel.trim()
        : inferLabel(text);
    const value =
      rawValueParts.length && labels.includes(rawLabel.trim())
        ? rawValueParts.join(":").trim()
        : text;

    if (!byLabel.has(parsedLabel) && value) {
      byLabel.set(parsedLabel, value);
    }
  }

  return Array.from(byLabel.entries()).map(([label, value]) => ({ label, value }));
};

const DEFAULT_PLAYER_SIDE = "client";
const OPPOSING_SIDE = {
  client: "opponent",
  opponent: "client",
};
const MONGO_ID_PATTERN = /^[a-f0-9]{24}$/i;

const unavailableProofAnswerPattern =
  /\b(no|nope|not really|never|none|do not have|don't have|does not exist|doesn't exist|did not|didn't|cannot|can't|not available|unavailable|not shown|not provided|not produced|not in hand)\b/i;
const confirmedProofAnswerPattern =
  /\b(yes|yeah|yep|i have|i had|have some|have those|sent|shared|provided|produced|showed|shown|kept|saved|attached|documented)\b/i;

const cleanUnavailablePrefix = (value = "") =>
  String(value || "").replace(/^unavailable:\s*/i, "");

const transcriptHasUnavailableAnswerFor = (transcript = [], matcher) => {
  for (let index = 0; index < transcript.length - 1; index += 1) {
    const questionEntry = transcript[index];
    const answerEntry = transcript[index + 1];

    if (questionEntry?.role !== "player" || answerEntry?.role !== "party") {
      continue;
    }

    const question = String(questionEntry.text || "");
    const answer = String(answerEntry.text || "");

    if (matcher(question, answer) && unavailableProofAnswerPattern.test(answer)) {
      return true;
    }
  }

  return false;
};

const transcriptHasConfirmedAnswerFor = (transcript = [], matcher) => {
  for (let index = 0; index < transcript.length - 1; index += 1) {
    const questionEntry = transcript[index];
    const answerEntry = transcript[index + 1];

    if (questionEntry?.role !== "player" || answerEntry?.role !== "party") {
      continue;
    }

    const question = String(questionEntry.text || "");
    const answer = String(answerEntry.text || "");

    if (matcher(question, answer) && confirmedProofAnswerPattern.test(answer)) {
      return true;
    }
  }

  return false;
};

const transcriptShowsOpponentControlsProof = ({
  transcript = [],
  matcher,
  opponentPartyName = "",
}) => {
  const normalizedOpponent = String(opponentPartyName || "").trim().toLowerCase();

  for (let index = 0; index < transcript.length - 1; index += 1) {
    const questionEntry = transcript[index];
    const answerEntry = transcript[index + 1];

    if (questionEntry?.role !== "player" || answerEntry?.role !== "party") {
      continue;
    }

    const question = String(questionEntry.text || "");
    const answer = String(answerEntry.text || "");
    const lowerAnswer = answer.toLowerCase();
    const mentionsOpponent =
      (normalizedOpponent && lowerAnswer.includes(normalizedOpponent)) ||
      /\b(other side|opposing side|landlord|property manager|management|they would have|they should have|would have those|should have those)\b/i.test(
        answer
      );

    if (matcher(question, answer) && mentionsOpponent) {
      return true;
    }
  }

  return false;
};

const cleanOpeningText = (value = "") =>
  String(value || "")
    .replace(/\s+/g, " ")
    .replace(/^(your\s+honou?r|judge|court)\s*[:,.-]?\s*/i, "")
    .trim();

const splitOpeningSentences = (value = "") =>
  cleanOpeningText(value)
    .split(/(?<=[.!?])\s+/)
    .map((item) => item.trim())
    .filter(Boolean);

const uniqueOpeningNotes = (items = []) => {
  const seen = new Set();

  return items
    .map((item) => String(item || "").trim())
    .filter(Boolean)
    .filter((item) => {
      const key = item.toLowerCase();
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
};

const buildTheorySeedFromOpening = (opening = "") => {
  const text = cleanOpeningText(opening);

  if (!text) {
    return [];
  }

  if (/\bsecurity deposit|deposit\b/i.test(text)) {
    if (/\b(withheld|kept|deduct|deduction|deductions|charged|charges)\b/i.test(text)) {
      return ["Deposit withholding appears unsupported by documented damage."];
    }

    return ["Deposit return turns on whether deductions were justified."];
  }

  if (/\b(invoice|unpaid|final payment|balance|payment)\b/i.test(text)) {
    if (/\b(site|work|project|completed|launched|delivered)\b/i.test(text)) {
      return ["Completed work supports the requested payment."];
    }

    return ["Payment claim turns on the agreement and performance record."];
  }

  if (/\bnotice|deadline|terminated|evict|eviction\b/i.test(text)) {
    return ["Notice and timing will likely control the dispute."];
  }

  return [];
};

const buildTimelineSeedsFromOpening = (opening = "") => {
  const sentences = splitOpeningSentences(opening);
  const notes = [];

  sentences.forEach((sentence) => {
    const amounts = sentence.match(/\$[\d,]+(?:\.\d{2})?/g) || [];

    if (/\bsecurity deposit|deposit\b/i.test(sentence) && /\bpaid\b/i.test(sentence)) {
      if (/\b(got back|returned|refund|refunded)\b/i.test(sentence) && amounts.length >= 2) {
        notes.push(`Security deposit paid (${amounts[0]}); partial return received (${amounts[1]}).`);
        return;
      }

      notes.push(amounts[0] ? `Security deposit paid (${amounts[0]}).` : "Security deposit paid.");
      return;
    }

    if (/\b(cleaned|cleaning)\b/i.test(sentence) && /\bmoved out|move-?out|keys?\b/i.test(sentence)) {
      notes.push("Move-out: apartment cleaned before surrender.");
      return;
    }

    if (/\blandlord\b/i.test(sentence) && /\b(charged|deducted|kept|withheld)\b/i.test(sentence)) {
      notes.push("Landlord asserted cleaning or repair deductions.");
      return;
    }

    if (/\b(records?|receipts?|invoices?|breakdown)\b/i.test(sentence) && /\b(thin|unclear|not clearly|missing|unsupported)\b/i.test(sentence)) {
      notes.push("Deduction records received but appear thin.");
      return;
    }

    if (/\b(invoice|final payment|balance)\b/i.test(sentence) && /\b(sent|issued|unpaid|not paid|withheld)\b/i.test(sentence)) {
      notes.push("Payment dispute arose after invoice or balance request.");
      return;
    }

    if (/\b(site|project|work)\b/i.test(sentence) && /\b(live|launched|completed|delivered)\b/i.test(sentence)) {
      notes.push("Work reached launch or completion point.");
      return;
    }

    if (/\bnotice\b/i.test(sentence) && /\b(gave|sent|received|deadline)\b/i.test(sentence)) {
      notes.push("Notice or deadline became part of the timeline.");
    }
  });

  return uniqueOpeningNotes(notes).slice(0, 4);
};

export const buildInitialFactSheetFromOpening = ({
  openingStatement = "",
  factSheet = {},
  replaceExisting = false,
} = {}) => {
  const currentFactSheet = sanitizeFactSheet(factSheet || {});
  const theorySeed = buildTheorySeedFromOpening(openingStatement);
  const timelineSeed = buildTimelineSeedsFromOpening(openingStatement);
  const theory = (!replaceExisting && currentFactSheet.theory?.length) || !theorySeed.length
    ? currentFactSheet.theory
    : theorySeed;
  const timeline = (!replaceExisting && currentFactSheet.timeline?.length) || !timelineSeed.length
    ? currentFactSheet.timeline
    : timelineSeed;

  return sanitizeFactSheet({
    ...currentFactSheet,
    theory,
    timeline,
  });
};

const refineFactSheetFromTranscript = ({
  factSheet,
  transcript = [],
  playerSide,
  opponentPartyName = "",
}) => {
  const next = {
    ...factSheet,
    supportingFacts: [...(factSheet.supportingFacts || [])],
    disputedFacts: [...(factSheet.disputedFacts || [])],
    missingEvidence: [...(factSheet.missingEvidence || [])],
  };

  const isPlaintiffSide = playerSide === "client";
  const invoiceMatcher = (question = "", answer = "") =>
    /\b(invoice|invoices|receipt|receipts)\b/i.test(`${question} ${answer}`) &&
    /\b(deduction|deductions|charge|charges)\b/i.test(`${question} ${answer}`);
  const moveOutPhotoMatcher = (question = "", answer = "") =>
    /\b(photo|photos|picture|pictures)\b/i.test(`${question} ${answer}`) &&
    /\b(clean|cleaning|move-?out|surrender|turnover)\b/i.test(`${question} ${answer}`);
  const moveOutTextMatcher = (question = "", answer = "") =>
    /\b(email|emails|text|texts|message|messages)\b/i.test(`${question} ${answer}`) &&
    /\b(move-?out|surrender|turnover|returning the keys|key return|instructions)\b/i.test(
      `${question} ${answer}`
    );
  const opponentControlledPlaintiffMissing = (item = "") =>
    isPlaintiffSide &&
    (/\bitemized deduction letter\b/i.test(item) ||
      /\bmove-?out inspection report\b/i.test(item) ||
      /\bmove-?in checklist\b/i.test(item) ||
      /\bmove-?out checklist|inspection form\b/i.test(item));

  next.missingEvidence = next.missingEvidence.flatMap((item) => {
    const lower = String(item || "").toLowerCase();

    if (
      /\bmove-?out photos after cleaning\b/i.test(lower) &&
      transcriptHasUnavailableAnswerFor(transcript, moveOutPhotoMatcher)
    ) {
      return [`Unavailable: ${cleanUnavailablePrefix(item)}`];
    }

    if (
      /\btext messages? with move-?out instructions\b/i.test(lower) &&
      transcriptHasConfirmedAnswerFor(transcript, moveOutTextMatcher)
    ) {
      next.corroboratedFacts = [
        ...(next.corroboratedFacts || []),
        "Text messages with move-out instructions.",
      ];
      return [];
    }

    if (
      isPlaintiffSide &&
      /\binvoices? or receipts? supporting each deduction\b/i.test(lower) &&
      transcriptShowsOpponentControlsProof({
        transcript,
        matcher: invoiceMatcher,
        opponentPartyName,
      })
    ) {
      const opponent = opponentPartyName || "Other side";
      next.supportingFacts.push(
        `${opponent} has not provided invoices or receipts supporting each deduction.`
      );
      next.disputedFacts.push(
        `Whether ${opponent} can support each deduction with invoices or receipts.`
      );
      return [];
    }

    if (opponentControlledPlaintiffMissing(item)) {
      const opponent = opponentPartyName || "Other side";
      const proof = cleanUnavailablePrefix(item).replace(/\.+$/g, "").toLowerCase();
      next.supportingFacts.push(`${opponent} has not provided ${proof}.`);
      next.disputedFacts.push(`Whether ${opponent} can support its position with ${proof}.`);
      return [];
    }

    return [item];
  });

  return sanitizeFactSheet(next);
};

const slugify = (value = "") =>
  String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);

const buildCaseSessionSlug = (title = "", id = "") => {
  const base = slugify(title) || "case";
  const suffix = String(id || "").slice(-6).toLowerCase();

  return suffix ? `${base}-${suffix}` : base;
};

export const applyClientMemoryOpeningToCaseSession = (
  caseSession,
  clientMemory = caseSession?.clientMemory,
  clientMemoryExcerpt = caseSession?.clientMemoryExcerpt
) => {
  const opening = String(clientMemoryExcerpt || "").trim();

  if (!caseSession || !opening) {
    return false;
  }

  const transcript = caseSession.interviewTranscript || [];
  const firstPartyEntry = transcript.find((entry) => entry?.role === "party" || entry?.role === "client");
  const hasPlayerQuestions = transcript.some((entry) => entry?.role === "player");

  if (caseSession.premise) {
    caseSession.premise.openingStatement = opening;
  }

  if (firstPartyEntry) {
    firstPartyEntry.text = opening;
  }

  caseSession.factSheet = buildInitialFactSheetFromOpening({
    openingStatement: opening,
    factSheet: caseSession.factSheet || {},
    replaceExisting: !hasPlayerQuestions,
  });

  caseSession.markModified?.("premise");
  caseSession.markModified?.("interviewTranscript");
  caseSession.markModified?.("factSheet");
  return true;
};

const ensureCaseSessionSlug = (caseSession) => {
  if (!caseSession || String(caseSession.slug || "").trim()) {
    return false;
  }

  const sourceId = caseSession._id || caseSession.id;

  if (!sourceId) {
    return false;
  }

  caseSession.slug = buildCaseSessionSlug(caseSession.title, sourceId);
  return true;
};

const persistCaseSessionSlug = async (caseSession) => {
  if (!caseSession?.slug || !caseSession?._id) {
    return;
  }

  await CaseSession.updateOne(
    { _id: caseSession._id },
    { $set: { slug: caseSession.slug } }
  );
};

const buildCaseLookupQuery = ({ userId, caseId }) => {
  const normalizedCaseId = String(caseId || "").trim();

  if (!normalizedCaseId) {
    return { userId, _id: null };
  }

  if (!MONGO_ID_PATTERN.test(normalizedCaseId)) {
    return { userId, slug: normalizedCaseId };
  }

  return {
    userId,
    $or: [{ _id: normalizedCaseId }, { slug: normalizedCaseId }],
  };
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
    .replace(/\s{2,}/g, " ")
    .trim();
};

const getPlayerSide = (caseSession) =>
  caseSession?.playerSide === "opponent" ? "opponent" : DEFAULT_PLAYER_SIDE;

const getOpposingSide = (side) => OPPOSING_SIDE[side] || DEFAULT_PLAYER_SIDE;
const getTemplatePartyForSessionSide = (side) =>
  normalizeTemplateParty(side === "opponent" ? "defendant" : "plaintiff");

const getPartyName = (template, side) =>
  side === "opponent" ? template.opponentName : template.clientName;

const getSideLabel = (side) => (side === "opponent" ? "Defendant" : "Plaintiff");

const buildOverviewForSide = (template, side) => {
  if (side === "client") {
    return template.overview;
  }

  const requestedRelief = String(template.desiredRelief || "").trim();

  return requestedRelief
    ? `${template.opponentName} is defending against ${template.clientName}'s request for ${requestedRelief.charAt(0).toLowerCase()}${requestedRelief.slice(
        1
      )}`
    : `${template.opponentName} is defending against ${template.clientName}'s claims in ${template.courtName}.`;
};

const buildDesiredReliefForSide = (template, side) => {
  if (side === "client") {
    return template.desiredRelief;
  }

  return `Deny or materially reduce ${template.clientName}'s requested relief.`;
};

const buildStarterTheoryForSide = (template, side) => {
  if (side === "client") {
    return template.starterTheory;
  }

  return `${template.opponentName} should prevail because ${template.clientName} has not proven the facts needed for the requested relief.`;
};

const buildOpeningStatementForSide = (template, side) => {
  const interviewOpening = getSideOpeningStatement(template, side);

  if (interviewOpening) {
    return normalizeClientIntakeStatement(interviewOpening);
  }

  if (side === "client") {
    return normalizeClientIntakeStatement(template.openingStatement);
  }

  const prioritizedFacts = (template.canonicalFacts || [])
    .slice()
    .sort(
      (left, right) =>
        (right.discoverability?.priority || 0) - (left.discoverability?.priority || 0)
    );

  const claim =
    prioritizedFacts
      .map((fact) =>
        (fact.claims || []).find(
          (item) => item.party === getTemplatePartyForSessionSide(side)
        )
      )
      .find((item) => item?.claimedDetail) || null;

  if (claim) {
    const detail = cleanPartyClaimText(claim.claimedDetail);

    if (detail) {
      return detail;
    }
  }

  return `${template.opponentName} disputes ${template.clientName}'s request for relief and wants the court to reject or reduce it.`;
};

const getTemplateSlugFromSession = (caseSession) =>
  caseSession.templateSlug || caseSession.scenarioId || "";

const applyTemplateMetadataToSession = (caseSession, template) => {
  if (!caseSession || !template) {
    return false;
  }

  let changed = false;

  if (!caseSession.title && template.title) {
    caseSession.title = template.title;
    changed = true;
  }
  if (!caseSession.practiceArea && template.practiceArea) {
    caseSession.practiceArea = template.practiceArea;
    changed = true;
  }
  if (!caseSession.primaryCategory) {
    caseSession.primaryCategory = template.primaryCategory || DEFAULT_CATEGORY_SLUG;
    changed = true;
  }
  if (!caseSession.complexity) {
    caseSession.complexity = template.complexity || 1;
    changed = true;
  }
  if (!caseSession.templateSlug && template.slug) {
    caseSession.templateSlug = template.slug;
    changed = true;
  }
  if (!caseSession.scenarioId && template.slug) {
    caseSession.scenarioId = template.slug;
    changed = true;
  }

  return changed;
};

const defaultOpenQuestions = (template, side) =>
  buildSuggestedQuestionsForSide(template, side);

const getActiveCompletedCooldowns = async (userId) => {
  const completedSessions = await CaseSession.find({
    userId,
    status: { $in: ["verdict", "settled"] },
  })
    .select("caseTemplateId")
    .sort({ updatedAt: -1 });

  const completedTemplateLocks = new Map();

  completedSessions.forEach((session) => {
    const templateId = String(session.caseTemplateId || "");

    if (templateId) {
      completedTemplateLocks.set(templateId, true);
    }
  });

  return completedTemplateLocks;
};

const getTemplateAvailability = ({
  template,
  progression,
  completionCooldownEndsAt = null,
}) => {
  const eligibleComplexity = getEligibleComplexityForCategory(
    progression,
    template.primaryCategory
  );
  const completionLockActive = Boolean(completionCooldownEndsAt);
  const unlockedByProgression = template.complexity <= eligibleComplexity;

  if (completionLockActive) {
    return {
      visible: false,
      unlocked: false,
      cooldownEndsAt: null,
      unlockReason: "Case completed.",
      blockReason: "This case has already been completed.",
    };
  }

  if (!unlockedByProgression) {
    return {
      visible: true,
      unlocked: false,
      cooldownEndsAt: null,
      unlockReason: `Unlock ${template.primaryCategory} complexity ${template.complexity} by completing more cases in that category.`,
      blockReason: "This case is locked until you gain more experience in that category.",
    };
  }

  return {
    visible: true,
    unlocked: true,
    cooldownEndsAt: null,
    unlockReason: "Available for your current specialization level.",
    blockReason: "",
  };
};

const buildTemplateCard = ({
  template,
  progression,
  completionCooldownEndsAt = null,
}) => {
  const availability = getTemplateAvailability({
    template,
    progression,
    completionCooldownEndsAt,
  });

  return {
    id: template.id,
    slug: template.slug,
    createdAt: template.createdAt,
    updatedAt: template.updatedAt,
    title: template.title,
    subtitle: template.subtitle,
    overview: template.overview,
    courtName: template.courtName,
    clientName: template.plaintiffName || template.clientName,
    opponentName: template.defendantName || template.opponentName,
    plaintiffName: template.plaintiffName || template.clientName,
    defendantName: template.defendantName || template.opponentName,
    practiceArea: template.practiceArea,
    primaryCategory: template.primaryCategory,
    secondaryCategories: template.secondaryCategories || [],
    complexity: template.complexity,
    sourceType: template.sourceType,
    legalTags: template.legalTags || [],
    unlocked: availability.unlocked,
    cooldownEndsAt: availability.cooldownEndsAt
      ? availability.cooldownEndsAt.toISOString()
      : null,
    unlockReason: availability.unlockReason,
  };
};

export const buildCasePayload = (caseSession, templateOverride = null) => {
  const courtroomWitnesses = buildPublicWitnessPayload(caseSession);
  const plainCase = toPlain(caseSession);
  const rawTemplateSource =
    templateOverride ||
    plainCase.caseTemplateId ||
    plainCase.template ||
    plainCase.templateSnapshot ||
    null;
  const templateSource =
    rawTemplateSource && (rawTemplateSource.title || rawTemplateSource.overview)
      ? rawTemplateSource
      : plainCase.templateSnapshot || null;
  const template = templateSource ? enrichTemplateForGameplay(toPlain(templateSource)) : null;
  const templateSlug = getTemplateSlugFromSession(plainCase);
  const playerSide = getPlayerSide(plainCase);
  const opponentSide = getOpposingSide(playerSide);
  const playerPartyName = template ? getPartyName(template, playerSide) : "";
  const opponentPartyName = template ? getPartyName(template, opponentSide) : "";
  const playerSideLabel = getSideLabel(playerSide);
  const opponentSideLabel = getSideLabel(opponentSide);
  const playerInterviewSubject = template
    ? buildInterviewSubjectForSide(
        template,
        playerSide === "opponent" ? "defendant" : "plaintiff"
      )
    : null;
  const opponentInterviewSubject = template
    ? buildInterviewSubjectForSide(
        template,
        opponentSide === "opponent" ? "defendant" : "plaintiff"
      )
    : null;
  const activeIntakeRebuild =
    plainCase.status === "interview" && template && !factSheetHasVisibleContent(plainCase.factSheet)
      ? rebuildFactSheetFromTranscript({ caseSession: plainCase, template })
      : null;
  const factSheet = refineFactSheetFromTranscript({
    factSheet: sanitizeFactSheet(plainCase.factSheet || activeIntakeRebuild || {}),
    transcript: plainCase.interviewTranscript || [],
    playerSide,
    opponentPartyName,
  });
  const clientMemoryExcerpt = String(plainCase.clientMemoryExcerpt || "").trim();
  const settlement = plainCase.settlement || {};
  const settlementTranscript = Array.isArray(settlement.transcript)
    ? settlement.transcript
    : [];
  const latestOpponentTerms =
    [...settlementTranscript]
      .reverse()
      .find((entry) => entry?.role === "opponent" && entry?.terms?.length)
      ?.terms || coerceSettlementTermRows(settlement.currentTerms || []);
  const latestViewerTerms =
    [...settlementTranscript]
      .reverse()
      .find((entry) => entry?.role === "player" && entry?.terms?.length)
      ?.terms || [];

  return {
    ...plainCase,
    negotiationProfile: getNegotiationProfile(plainCase),
    courtroomWitnesses,
    settlement: {
      ...settlement,
      transcript: settlementTranscript,
      latestOpponentTerms,
      latestViewerTerms,
    },
    usage: stripUsageEntries(plainCase.usage),
    factSheet,
    slug:
      plainCase.slug ||
      buildCaseSessionSlug(plainCase.title, plainCase.id || plainCase._id || ""),
    playerSide,
    opponentSide,
    playerSideLabel,
    opponentSideLabel,
    playerPartyName,
    opponentPartyName,
    playerInterviewSubjectName: playerInterviewSubject?.name || playerPartyName,
    playerInterviewSubjectRole: playerInterviewSubject?.role || "",
    opponentInterviewSubjectName: opponentInterviewSubject?.name || opponentPartyName,
    opponentInterviewSubjectRole: opponentInterviewSubject?.role || "",
    clientMemoryExcerpt,
    plaintiffName: template?.clientName || plainCase.premise?.clientName || "",
    defendantName: template?.opponentName || plainCase.premise?.opponentName || "",
    scenarioId: templateSlug,
    templateSlug,
    template: template
      ? {
          id: template.id,
          slug: template.slug,
          title: template.title,
          subtitle: template.subtitle,
          courtName: template.courtName,
          clientName: template.clientName,
          opponentName: template.opponentName,
          plaintiffName: template.clientName,
          defendantName: template.opponentName,
          overview: template.overview,
          practiceArea: template.practiceArea,
          primaryCategory: template.primaryCategory,
          secondaryCategories: template.secondaryCategories || [],
          complexity: template.complexity,
          sourceType: template.sourceType,
          canonicalFacts: (template.canonicalFacts || []).map((fact) => ({
            factId: fact.factId,
            label: fact.label,
            canonicalDetail: fact.canonicalDetail,
          })),
        }
      : null,
    scenario: template
      ? {
          id: template.id,
          title: template.title,
          subtitle: template.subtitle,
          courtName: template.courtName,
          clientName: template.clientName,
          opponentName: template.opponentName,
          plaintiffName: template.clientName,
          defendantName: template.opponentName,
          overview: template.overview,
          practiceArea: template.practiceArea,
        }
      : null,
    lawbook: getLawbookRules(),
  };
};

export const buildPublicCasePayload = (caseSession, templateOverride = null) => {
  const payload = buildCasePayload(caseSession, templateOverride);
  const publicPayload = { ...payload };
  delete publicPayload.canonicalStory;
  delete publicPayload.templateSnapshot;
  delete publicPayload.caseTemplateId;
  delete publicPayload.clientMemory;
  delete publicPayload.usage;
  delete publicPayload.lawbook;

  return {
    ...publicPayload,
    template: payload.template
      ? {
          id: payload.template.id,
          slug: payload.template.slug,
          title: payload.template.title,
          subtitle: payload.template.subtitle,
          courtName: payload.template.courtName,
          clientName: payload.template.clientName,
          opponentName: payload.template.opponentName,
          plaintiffName: payload.template.plaintiffName,
          defendantName: payload.template.defendantName,
          overview: payload.template.overview,
          practiceArea: payload.template.practiceArea,
          primaryCategory: payload.template.primaryCategory,
          secondaryCategories: payload.template.secondaryCategories || [],
          complexity: payload.template.complexity,
          sourceType: payload.template.sourceType,
        }
      : null,
  };
};

export const listScenarioOptions = async (userId, userProfile = null) => {
  await connectMongo();

  const user = await ensureUserProfile(userId, userProfile);
  const progression = normalizeProgression(user?.progression);
  const [templates, completedCooldowns] = await Promise.all([
    CaseTemplate.find({ status: "active" }).sort({
      primaryCategory: 1,
      complexity: 1,
      createdAt: -1,
    }),
    getActiveCompletedCooldowns(userId),
  ]);

  return templates.flatMap((templateDocument) => {
    const template = toPlain(templateDocument);
    const availability = getTemplateAvailability({
      template,
      progression,
      completionCooldownEndsAt:
        completedCooldowns.get(String(templateDocument._id)) || null,
    });

    if (!availability.visible) {
      return [];
    }

    return [
      buildTemplateCard({
        template,
        progression,
        completionCooldownEndsAt:
          completedCooldowns.get(String(templateDocument._id)) || null,
      }),
    ];
  });
};

export const createCaseSession = async ({
  userId,
  userProfile = null,
  caseSessionId = null,
  caseTemplateId,
  categorySlug = DEFAULT_CATEGORY_SLUG,
  complexity = 1,
  countryCode = "US",
  freeGameplayCampaignAccess = null,
  continuationOfCaseId = null,
}) => {
  await connectMongo();

  if (!caseTemplateId) {
    const caseCountry = buildCaseCountry(countryCode, { fallback: true });
    const user = await ensureUserProfile(userId, userProfile);
    const progression = normalizeProgression(user?.progression);
    const requestedCategorySlug = categorySlug || DEFAULT_CATEGORY_SLUG;
    const dynamicDifficulty = getEffectiveDynamicComplexity({
      progression,
      categorySlug: requestedCategorySlug,
      requestedComplexity: complexity,
    });
    const usageCollector = createUsageCollector("intake");
    const dynamicCase = await generateDynamicCaseState({
      categorySlug: requestedCategorySlug,
      complexity: dynamicDifficulty.complexity,
      playerLevel: dynamicDifficulty.playerLevel,
      userId,
      onUsage: usageCollector.record,
      countryCode: caseCountry.code,
    });
    const template = buildDynamicCaseTemplateSnapshot(dynamicCase);
    template.dynamicDifficulty = dynamicDifficulty;
    const playerSide = Math.random() < 0.5 ? "client" : "opponent";
    const representedParty = getPartyName(template, playerSide);
    const representedStory =
      playerSide === "opponent"
        ? dynamicCase.defendantStory
        : dynamicCase.plaintiffStory;
    const openingStatement =
      playerSide === "opponent"
        ? dynamicCase.defendantOpeningStatement
        : dynamicCase.plaintiffOpeningStatement;
    const starterQuestions =
      playerSide === "opponent"
        ? dynamicCase.starterQuestions?.defendant || []
        : dynamicCase.starterQuestions?.plaintiff || [];
    const desiredRelief = buildDesiredReliefForSide(template, playerSide);

    const caseSession = new CaseSession({
      ...(caseSessionId ? { _id: caseSessionId } : {}),
      userId,
      title: dynamicCase.title,
      templateSlug: template.slug,
      scenarioId: template.slug,
      practiceArea: dynamicCase.practiceArea,
      primaryCategory: dynamicCase.primaryCategory,
      negotiationProfile: getNegotiationProfile(dynamicCase),
      complexity: dynamicCase.complexity,
      caseCountry,
      playerSide,
      status: "interview",
      playerImage: user?.image || "",
      freeGameplayCampaignAccess: freeGameplayCampaignAccess || undefined,
      continuationOfCaseId: continuationOfCaseId || undefined,
      lawbookVersion: LAWBOOK_VERSION,
      maxCourtRounds: Math.max(3, dynamicCase.complexity + 1),
      templateSnapshot: template,
      canonicalStory: template.canonicalStory,
      clientMemory: {
        clientStory: representedStory,
        memoryClaims: [],
      },
      clientMemoryExcerpt: openingStatement,
      premise: {
        clientName: dynamicCase.plaintiffName,
        opponentName: dynamicCase.defendantName,
        courtName: dynamicCase.courtName,
        overview: buildOverviewForSide(template, playerSide),
        desiredRelief,
        openingStatement,
      },
      interviewTranscript: [
        {
          role: "party",
          speaker: representedParty,
          text: openingStatement,
          sourceType: "claim",
          relatedFactIds: [],
        },
      ],
      factSheet: buildInitialFactSheetFromOpening({
        openingStatement,
        factSheet: {
          summary: [],
          timeline: [],
          supportingFacts: [],
          risks: [],
          theory: [],
          desiredRelief: [],
          openQuestions: starterQuestions,
          knownFacts: [],
          knownClaims: [],
          disputedFacts: [],
          corroboratedFacts: [],
          sourceLinks: [],
          missingEvidence: [],
          discoveredFactIds: [],
          discoveredClaimIds: [],
          discoveredEvidenceIds: [],
          ready: false,
        },
      }),
      score: {
        player: 0,
        opponent: 0,
        roundsCompleted: 0,
        lastBenchSignal: "",
        highlights: [],
        weaknesses: [],
      },
      verdict: {
        winner: "",
        summary: "",
        highlights: [],
        concerns: [],
        finalScore: {
          player: 0,
          opponent: 0,
        },
      },
    });

    ensureCaseSessionSlug(caseSession);
    caseSession.judgeProfile = buildJudgeProfile({
      caseSessionId: caseSession._id || caseSession.id || caseSession.slug,
      complexity: dynamicCase.complexity,
    });
    appendUsageEntriesToCaseSession(caseSession, usageCollector.entries);
    await caseSession.save();

    return buildCasePayload(caseSession, template);
  }

  const templateDocument = await CaseTemplate.findOne({
    _id: caseTemplateId,
    status: "active",
  });

  if (!templateDocument) {
    throw new Error("Case template not found");
  }

  const template = enrichTemplateForGameplay(toPlain(templateDocument));
  const templateSnapshot = buildSessionTemplateSnapshot(template);
  const canonicalStory = getCanonicalStoryWorld(template);

  const user = await ensureUserProfile(userId, userProfile);
  const progression = normalizeProgression(user?.progression);
  const completedCooldowns = await getActiveCompletedCooldowns(userId);
  const availability = getTemplateAvailability({
    template,
    progression,
    completionCooldownEndsAt:
      completedCooldowns.get(String(templateDocument._id)) || null,
  });
  const playerSide = Math.random() < 0.5 ? "client" : "opponent";
  const openingStatement = buildOpeningStatementForSide(template, playerSide);
  const playerInterviewSubject = buildInterviewSubjectForSide(
    template,
    playerSide === "opponent" ? "defendant" : "plaintiff"
  );
  const desiredRelief = buildDesiredReliefForSide(template, playerSide);

  if (!availability.unlocked) {
    throw new Error(availability.blockReason);
  }

  const caseSession = new CaseSession({
    ...(caseSessionId ? { _id: caseSessionId } : {}),
    userId,
    title: template.title,
    caseTemplateId: templateDocument._id,
    templateSlug: template.slug,
    scenarioId: template.slug,
    practiceArea: template.practiceArea,
    primaryCategory: template.primaryCategory,
    negotiationProfile: getNegotiationProfile(template),
    complexity: template.complexity,
    playerSide,
    status: "interview",
    playerImage: user?.image || "",
    freeGameplayCampaignAccess: freeGameplayCampaignAccess || undefined,
    continuationOfCaseId: continuationOfCaseId || undefined,
    lawbookVersion: LAWBOOK_VERSION,
    maxCourtRounds: Math.max(3, template.complexity + 1),
    templateSnapshot,
    canonicalStory,
    premise: {
      clientName: template.clientName,
      opponentName: template.opponentName,
      courtName: template.courtName,
      overview: buildOverviewForSide(template, playerSide),
      desiredRelief,
      openingStatement,
    },
    interviewTranscript: [
      {
        role: "party",
        speaker: playerInterviewSubject.name || getPartyName(template, playerSide),
        text: openingStatement,
        sourceType: "claim",
        relatedFactIds: [],
      },
    ],
    factSheet: buildInitialFactSheetFromOpening({
      openingStatement,
      factSheet: {
        summary: [],
        timeline: [],
        supportingFacts: [],
        risks: [],
        theory: [],
        desiredRelief: [],
        openQuestions: defaultOpenQuestions(template, playerSide),
        knownFacts: [],
        knownClaims: [],
        disputedFacts: [],
        corroboratedFacts: [],
        sourceLinks: [],
        missingEvidence: [],
        discoveredFactIds: [],
        discoveredClaimIds: [],
        discoveredEvidenceIds: [],
        ready: false,
      },
    }),
    score: {
      player: 0,
      opponent: 0,
      roundsCompleted: 0,
      lastBenchSignal: "",
      highlights: [],
      weaknesses: [],
    },
    verdict: {
      winner: "",
      summary: "",
      highlights: [],
      concerns: [],
      finalScore: {
        player: 0,
        opponent: 0,
      },
    },
  });

  ensureCaseSessionSlug(caseSession);
  caseSession.judgeProfile = buildJudgeProfile({
    caseSessionId: caseSession._id || caseSession.id || caseSession.slug,
    complexity: template.complexity,
  });
  const usageCollector = createUsageCollector("intake");
  const clientMemoryResult = await ensureClientMemory({
    caseSession,
    template,
    playerSide,
    userId,
    onUsage: usageCollector.record,
  });
  if (clientMemoryResult.clientMemory) {
    caseSession.clientMemory = clientMemoryResult.clientMemory;
    caseSession.markModified?.("clientMemory");
    caseSession.clientMemoryExcerpt = await generateClientMemoryExcerpt({
      clientMemory: clientMemoryResult.clientMemory,
      partyName: getPartyName(template, playerSide),
      playerSide,
      fallback: openingStatement,
      userId,
      onUsage: usageCollector.record,
    });
    applyClientMemoryOpeningToCaseSession(
      caseSession,
      clientMemoryResult.clientMemory,
      caseSession.clientMemoryExcerpt
    );
  }
  appendUsageEntriesToCaseSession(caseSession, usageCollector.entries);
  await caseSession.save();

  return buildCasePayload(caseSession, template);
};

export const listCaseSessionsForUser = async (userId) => {
  await connectMongo();

  const cases = await CaseSession.find({ userId, status: { $ne: "exited" } })
    .populate("caseTemplateId")
    .sort({ updatedAt: -1 });

  const missingTemplateSlugs = [
    ...new Set(
      cases
        .filter((caseSession) => !caseSession.caseTemplateId)
        .map((caseSession) => getTemplateSlugFromSession(caseSession))
        .filter(Boolean)
    ),
  ];
  const fallbackTemplates = missingTemplateSlugs.length
    ? await CaseTemplate.find({ slug: { $in: missingTemplateSlugs } })
    : [];
  const fallbackMap = new Map(
    fallbackTemplates.map((template) => [template.slug, toPlain(template)])
  );

  const sessionsNeedingSlug = cases.filter((caseSession) => ensureCaseSessionSlug(caseSession));

  if (sessionsNeedingSlug.length > 0) {
    await Promise.all(
      sessionsNeedingSlug.map((caseSession) => persistCaseSessionSlug(caseSession))
    );
  }

  return cases.map((caseSession) => {
    const template =
      toPlain(caseSession.caseTemplateId) ||
      fallbackMap.get(getTemplateSlugFromSession(caseSession)) ||
      null;

    return buildCasePayload(caseSession, template);
  });
};

export const getCaseSessionForUser = async ({ userId, caseId }) => {
  await connectMongo();

  const caseSession = await CaseSession.findOne(
    buildCaseLookupQuery({ userId, caseId })
  ).populate("caseTemplateId");

  const fallbackTemplate =
    caseSession && !caseSession.caseTemplateId
      ? await CaseTemplate.findOne({ slug: getTemplateSlugFromSession(caseSession) })
      : null;

  if (caseSession && ensureCaseSessionSlug(caseSession)) {
    await persistCaseSessionSlug(caseSession);
  }

  if (caseSession && !String(caseSession.playerImage || "").trim()) {
    const user = await User.findById(userId).select("image");
    if (user?.image) {
      caseSession.playerImage = user.image;
      await caseSession.save();
    }
  }

  return caseSession
    ? buildCasePayload(
        caseSession,
        toPlain(caseSession.caseTemplateId) || toPlain(fallbackTemplate)
      )
    : null;
};

export const getCaseSessionDocumentForUser = async ({ userId, caseId }) => {
  await connectMongo();

  const caseSession = await CaseSession.findOne(
    buildCaseLookupQuery({ userId, caseId })
  ).populate("caseTemplateId");

  if (!caseSession) {
    return null;
  }

  const slugChanged = ensureCaseSessionSlug(caseSession);
  let playerImageChanged = false;

  if (!String(caseSession.playerImage || "").trim()) {
    const user = await User.findById(userId).select("image");
    if (user?.image) {
      caseSession.playerImage = user.image;
      playerImageChanged = true;
    }
  }

  if (!caseSession.caseTemplateId) {
    const fallbackTemplate = await CaseTemplate.findOne({
      slug: getTemplateSlugFromSession(caseSession),
    });

    if (fallbackTemplate) {
      caseSession.caseTemplateId = fallbackTemplate._id;
      applyTemplateMetadataToSession(caseSession, fallbackTemplate);
    }
  }

  if (caseSession.caseTemplateId) {
    const hydratedTemplate =
      caseSession.caseTemplateId.slug
        ? caseSession.caseTemplateId
        : await CaseTemplate.findById(caseSession.caseTemplateId);

    if (hydratedTemplate) {
      const changed = applyTemplateMetadataToSession(caseSession, hydratedTemplate);

      if (changed || !caseSession.caseTemplateId.slug) {
        await caseSession.save();
        await caseSession.populate("caseTemplateId");
      }
    }
  }

  if (slugChanged) {
    await persistCaseSessionSlug(caseSession);
  }

  if (playerImageChanged) {
    await caseSession.save();
  }

  return caseSession;
};

export const exitCaseSessionForUser = async ({ userId, caseId }) => {
  await connectMongo();

  const caseSession = await CaseSession.findOne(
    buildCaseLookupQuery({ userId, caseId })
  ).populate("caseTemplateId");

  if (!caseSession) {
    return null;
  }

  ensureCaseSessionSlug(caseSession);

  if (caseSession.status === "interview") {
    caseSession.status = "exited";
    caseSession.exitedAt = new Date();
    await caseSession.save();

    return caseSession;
  }

  if (caseSession.status === "courtroom") {
    caseSession.status = "verdict";
    caseSession.completedAt = caseSession.completedAt || new Date();
    caseSession.verdict = {
      ...(caseSession.verdict || {}),
      winner: "opponent",
      summary:
        "You quit during court, so the court enters judgment for the other side.",
      highlights: [],
      concerns: ["You ended the courtroom phase before the case was complete."],
      finalScore: {
        player: caseSession.score?.player || 0,
        opponent: caseSession.score?.opponent || 0,
      },
    };
    await caseSession.save();

    try {
      const { evaluateCompletedCase } = await import("@/libs/game/awards/service");
      await evaluateCompletedCase({ caseSession });
    } catch (awardError) {
      console.error("Post-forfeit award evaluation failed", awardError);
    }

    return caseSession;
  }

  if (caseSession.status === "verdict") {
    throw new Error("This case already has a final verdict.");
  }

  throw new Error("Only intake or courtroom cases can be quit.");
};

export const listDashboardDataForUser = async (userId, userProfile = null) => {
  const [cases, templates, user] = await Promise.all([
    listCaseSessionsForUser(userId),
    listScenarioOptions(userId, userProfile),
    ensureUserProfile(userId, userProfile),
  ]);
  const latestVerdict = cases.find((caseSession) =>
    ["verdict", "settled"].includes(caseSession.status)
  );
  const dashboardEncouragementNote = await ensureStoredDashboardEncouragementNote({
    user,
    latestVerdict: latestVerdict
      ? {
          title: latestVerdict.title,
          category: latestVerdict.primaryCategory,
          complexity: latestVerdict.complexity,
          outcome:
            latestVerdict.status === "settled"
              ? "settled"
              : latestVerdict.verdict?.winner || "",
          summary:
            latestVerdict.status === "settled"
              ? latestVerdict.settlement?.outcomeSummary || ""
              : latestVerdict.verdict?.summary || "",
          highlights:
            latestVerdict.status === "settled"
              ? latestVerdict.settlement?.finalTerms?.slice(0, 2) || []
              : latestVerdict.verdict?.highlights?.slice(0, 2) || [],
        }
      : null,
  });

  return {
    cases,
    templates,
    categories: listCategoryOptions(),
    onboarding: normalizeOnboarding(user?.onboarding),
    progression: normalizeProgression(user?.progression),
    dashboardEncouragementNote,
  };
};

export const getPublicPlayerProfile = async (
  playerId,
  { canViewFullArchive = false } = {}
) => {
  await connectMongo();

  const user = await User.findById(playerId);

  if (!user) {
    return null;
  }

  const hydratedUser = await ensureUserProfile(playerId);
  const cases = await CaseSession.find({
    userId: playerId,
    status: canViewFullArchive ? { $ne: "exited" } : { $in: ["verdict", "settled"] },
  })
    .populate("caseTemplateId")
    .sort({ updatedAt: -1 });

  const missingTemplateSlugs = [
    ...new Set(
      cases
        .filter((caseSession) => !caseSession.caseTemplateId)
        .map((caseSession) => getTemplateSlugFromSession(caseSession))
        .filter(Boolean)
    ),
  ];
  const fallbackTemplates = missingTemplateSlugs.length
    ? await CaseTemplate.find({ slug: { $in: missingTemplateSlugs } })
    : [];
  const fallbackMap = new Map(
    fallbackTemplates.map((template) => [template.slug, toPlain(template)])
  );

  const sessionsNeedingSlug = cases.filter((caseSession) => ensureCaseSessionSlug(caseSession));

  if (sessionsNeedingSlug.length > 0) {
    await Promise.all(
      sessionsNeedingSlug.map((caseSession) => persistCaseSessionSlug(caseSession))
    );
  }

  const publicCases = cases.map((caseSession) => {
    const template =
      toPlain(caseSession.caseTemplateId) ||
      fallbackMap.get(getTemplateSlugFromSession(caseSession)) ||
      null;

    const payload = canViewFullArchive
      ? buildCasePayload(caseSession, template)
      : buildPublicCasePayload(caseSession, template);

    // Country selection was introduced after the first matters were completed.
    // Keep those legacy profile records visible as U.S. matters without mutating
    // their stored sessions. New and ongoing matters retain their locked country.
    return {
      ...payload,
      caseCountry: buildCaseCountry(
        payload.caseCountry?.code || template?.caseCountry?.code,
        { fallback: true }
      ),
    };
  });

  const lawyerProfileSummary = await ensureStoredLawyerProfileSummary({
    user: hydratedUser,
    cases: publicCases,
  });
  let awards = null;
  try {
    const { getPlayerAwardsProfile } = await import("@/libs/game/awards/service");
    awards = await getPlayerAwardsProfile(playerId, { owner: canViewFullArchive });
  } catch (error) {
    console.error("Lawyer award profile could not be loaded", error);
  }

  return {
    player: {
      ...buildPublicLeaderboardEntry(hydratedUser),
      joinedAt: hydratedUser.createdAt,
      updatedAt: hydratedUser.updatedAt,
      lastGameplayResetAt: hydratedUser.lastGameplayResetAt
        ? new Date(hydratedUser.lastGameplayResetAt).toISOString()
        : null,
      gameplayResetAvailableAt: hydratedUser.lastGameplayResetAt
        ? new Date(
            new Date(hydratedUser.lastGameplayResetAt).getTime() +
              7 * 24 * 60 * 60 * 1000
          ).toISOString()
        : null,
      lawyerProfileSummary,
      categoryStats: normalizeProgression(hydratedUser.progression).categoryStats,
    },
    cases: publicCases,
    awards,
  };
};
