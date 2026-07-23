import "server-only";

import mongoose from "mongoose";
import connectMongo from "@/libs/mongoose";
import Challenge from "@/models/Challenge";
import CaseTemplate from "@/models/CaseTemplate";
import User from "@/models/User";
import { LAWBOOK_VERSION, getLawbookRules } from "@/data/legalArenaLawbook";
import {
  sendChallengeAcceptedEmail,
  sendChallengeInviteEmail,
} from "@/libs/emailSender";
import {
  assessCaseSuccessChance,
  continueInterview,
  ensureClientMemory,
  finalizeFactSheetInput,
  evaluateCourtAdjournment,
  lockAssessmentForCourt,
  runCourtroomRound,
  runPvpCourtroomTimeoutVerdict,
} from "./engine";
import {
  getAdjournmentRemaining,
  getAdjournmentRound,
  hasAdjournmentRequestForRound,
  recordAdjournmentDecision,
  resolveActiveAdjournment,
} from "./adjournment";
import {
  buildDesiredReliefForSide,
  buildOverviewForSide,
  buildSummaryForSide,
  getOpposingSide,
  getPartyName,
  mergeFactSheet,
  normalizeFactSheetPatch,
  uniqueList,
} from "./engine/shared";
import {
  applyChallengeVerdictToPvpProgression,
  applySettlementToProgression,
  ensureUserProfile,
  getEligibleComplexityForCategory,
  normalizeProgression,
} from "./progression";
import { getNegotiationProfile } from "./negotiationProfile.mjs";
import { buildInitialFactSheetFromOpening, listScenarioOptions } from "./store";
import {
  buildDynamicCaseTemplateSnapshot,
  generateDynamicCaseState,
} from "./dynamicCase";
import { buildCaseCountry } from "./countries";
import { DEFAULT_CATEGORY_SLUG } from "./categories";
import {
  buildJudgeProfile,
  buildSessionTemplateSnapshot,
  getCanonicalStoryWorld,
} from "./storyWorld";
import {
  buildInterviewSubjectForSide,
  buildSuggestedQuestionsForSide,
  enrichTemplateForGameplay,
  getSideOpeningStatement,
} from "./templateInterview";
import { generateClientMemoryExcerpt } from "./clientMemory";
import {
  buildMemoryClaimFactSheetPatch,
  normalizeMemoryClaims,
} from "./memoryClaims";
import {
  clampMood,
  applyPrivateClientHuddleMood,
  generateOpeningSettlementMessage,
  getSettlementOfferSignature,
  getSettlementCooldownState,
  normalizeSettlement,
  MAX_SETTLEMENT_PUBLIC_EXCHANGES,
  previewSettlementDraftForClient,
  extractSettlementTermsFromMessage,
} from "./settlement";
import { hasClientSettlementAuthority } from "./settlementAuthority";
import { buildPublicCurrentEventInspiration } from "./currentEvents";

const MONGO_ID_PATTERN = /^[a-f0-9]{24}$/i;
const CHALLENGE_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000;
const COURTROOM_RESPONSE_TIMEOUT_MS = 24 * 60 * 60 * 1000;
const COURTROOM_TIMEOUT_FINALIZING_STALE_MS = 30 * 60 * 1000;

const toPlain = (doc) => (doc?.toJSON ? doc.toJSON() : doc);
const toObjectIdString = (value) => String(value?._id || value?.id || value || "");
const isSameId = (left, right) => toObjectIdString(left) === toObjectIdString(right);

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

const getEffectivePvpDynamicComplexity = ({
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
    playerLevel,
  };
};

const slugify = (value = "") =>
  String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);

const buildChallengeSlug = (title = "", id = "") => {
  const base = slugify(title) || "challenge";
  const suffix = String(id || "").slice(-6).toLowerCase();
  return suffix ? `${base}-${suffix}` : base;
};

const applyClientMemoryOpeningToParticipant = (
  challenge,
  participant,
  clientMemory,
  clientMemoryExcerpt = participant?.clientMemoryExcerpt
) => {
  const opening = String(clientMemoryExcerpt || "").trim();

  if (!participant || !opening) {
    return false;
  }

  const transcript = participant.interviewTranscript || [];
  const firstPartyEntry = transcript.find((entry) => entry?.role === "party" || entry?.role === "client");
  const previousOpening = firstPartyEntry?.text || "";
  const hasPlayerQuestions = transcript.some((entry) => entry?.role === "player");

  if (firstPartyEntry) {
    firstPartyEntry.text = opening;
  }

  const factSheet = participant.factSheet?.toObject
    ? participant.factSheet.toObject()
    : participant.factSheet || {};
  if (Array.isArray(factSheet.supportingFacts) && previousOpening) {
    factSheet.supportingFacts = factSheet.supportingFacts.map((item) =>
      item === previousOpening ? opening : item
    );
  }
  participant.factSheet = buildInitialFactSheetFromOpening({
    openingStatement: opening,
    factSheet,
    replaceExisting: !hasPlayerQuestions,
  });

  return Boolean(firstPartyEntry);
};

const uniqueTextList = (items = []) => {
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

const blankFactSheet = (template, side, openingStatement = "") =>
  buildInitialFactSheetFromOpening({
    openingStatement,
    factSheet: {
      summary: uniqueTextList([buildSummaryForSide(template, side)]),
      timeline: [],
      supportingFacts: uniqueTextList([
        buildOverviewForSide(template, side),
        openingStatement,
      ]),
      risks: [],
      theory: [],
      desiredRelief: uniqueTextList([buildDesiredReliefForSide(template, side)]),
      openQuestions: buildSuggestedQuestionsForSide(template, side),
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
  });

const seededFactSheetFields = [
  "summary",
  "timeline",
  "supportingFacts",
  "risks",
  "theory",
  "desiredRelief",
  "knownFacts",
  "knownClaims",
  "disputedFacts",
  "corroboratedFacts",
  "missingEvidence",
];

const hasSeededFactSheetContent = (factSheet = {}) =>
  seededFactSheetFields.some(
    (field) => Array.isArray(factSheet?.[field]) && factSheet[field].length > 0
  );

const templateForChallenge = (challenge) =>
  challenge.templateSnapshot || {
    title: challenge.title,
    slug: challenge.templateSlug,
    overview: challenge.premise?.overview || "",
    desiredRelief: challenge.premise?.desiredRelief || "",
    starterTheory: "",
    practiceArea: challenge.practiceArea,
    primaryCategory: challenge.primaryCategory,
    negotiationProfile: getNegotiationProfile(challenge),
    complexity: challenge.complexity,
    courtName: challenge.premise?.courtName || "",
    clientName: challenge.premise?.clientName || "Client",
    opponentName: challenge.premise?.opponentName || "Opponent",
  };

const getParticipantOpeningStatement = (challenge, participant) =>
  (participant.interviewTranscript || []).find((entry) => entry.role === "party")
    ?.text || buildOpeningStatementForSide(templateForChallenge(challenge), participant.side);

const seedParticipantFactSheetIfEmpty = (challenge, participant) => {
  if (!participant || hasSeededFactSheetContent(participant.factSheet)) {
    return false;
  }

  const currentFactSheet = participant.factSheet?.toObject
    ? participant.factSheet.toObject()
    : participant.factSheet || {};
  const seededFactSheet = blankFactSheet(
    templateForChallenge(challenge),
    participant.side,
    getParticipantOpeningStatement(challenge, participant)
  );

  participant.factSheet = {
    ...seededFactSheet,
    ...currentFactSheet,
    summary: uniqueTextList([
      ...seededFactSheet.summary,
      ...(currentFactSheet.summary || []),
    ]),
    supportingFacts: uniqueTextList([
      ...seededFactSheet.supportingFacts,
      ...(currentFactSheet.supportingFacts || []),
    ]),
    theory: uniqueTextList([
      ...seededFactSheet.theory,
      ...(currentFactSheet.theory || []),
    ]),
    desiredRelief: uniqueTextList([
      ...seededFactSheet.desiredRelief,
      ...(currentFactSheet.desiredRelief || []),
    ]),
    openQuestions:
      currentFactSheet.openQuestions?.length > 0
        ? currentFactSheet.openQuestions
        : seededFactSheet.openQuestions,
    ready: Boolean(currentFactSheet.ready),
  };

  return true;
};

const seedChallengeFactSheetsIfNeeded = (challenge) =>
  (challenge.participants || []).reduce(
    (changed, participant) => seedParticipantFactSheetIfEmpty(challenge, participant) || changed,
    false
  );

const buildTranscriptBackfillPatch = () => normalizeFactSheetPatch({});

const factSheetBackfillFields = [
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
  "discoveredFactIds",
  "discoveredClaimIds",
  "discoveredEvidenceIds",
];

const backfillParticipantFactSheetFromTranscript = (challenge, participant) => {
  if (!participant?.interviewTranscript?.length) {
    return false;
  }

  const patch = buildTranscriptBackfillPatch(participant.interviewTranscript);
  const hasPatch = factSheetBackfillFields.some((field) => patch[field]?.length > 0);
  if (!hasPatch) {
    return false;
  }

  const currentFactSheet = participant.factSheet?.toObject
    ? participant.factSheet.toObject()
    : participant.factSheet || {};
  const nextFactSheet = mergeFactSheet(
    currentFactSheet,
    patch,
    templateForChallenge(challenge),
    {
      playerSide: participant.side,
    }
  );
  const changed = factSheetBackfillFields.some((field) => {
    const before = uniqueList(currentFactSheet[field] || []);
    const after = uniqueList(nextFactSheet[field] || []);
    return after.length > before.length;
  });

  if (!changed) {
    return false;
  }

  setParticipantFactSheet(challenge, participant, nextFactSheet);
  return true;
};

const backfillChallengeFactSheetsFromTranscript = (challenge) =>
  (challenge.participants || []).reduce(
    (changed, participant) =>
      backfillParticipantFactSheetFromTranscript(challenge, participant) || changed,
    false
  );

const advanceChallengeToCourtIfPlaintiffReady = (challenge) => {
  if (challenge?.status !== "active") {
    return false;
  }

  if (
    challenge.adjournment?.active &&
    !(challenge.participants || []).every(
      (participant) =>
        participant.status === "ready" || Boolean(participant.factSheet?.ready)
    )
  ) {
    return false;
  }

  const plaintiffParticipant = (challenge.participants || []).find(
    (participant) => participant.side === "client"
  );
  const plaintiffReady =
    plaintiffParticipant?.status === "ready" ||
    Boolean(plaintiffParticipant?.factSheet?.ready);

  if (!plaintiffReady) {
    return false;
  }

  if (challenge.adjournment?.active) resolveActiveAdjournment(challenge);
  challenge.status = "courtroom";
  const now = new Date();
  challenge.courtroomLastActivityAt = now;
  challenge.courtroomDeadlineAt = getCourtroomDeadlineFrom(now);
  challenge.courtroomTimeoutFinalizingAt = null;
  appendOpenRoundIfNeeded(challenge);
  return true;
};

const normalizeChallengeForRead = (challenge) => {
  let changed = false;

  changed = ensureChallengeSlug(challenge) || changed;
  changed = updateExpiredChallenge(challenge) || changed;
  changed = syncChallengeSettlementIntentFields(challenge) || changed;
  changed = syncChallengeSettlementTerminalStage(challenge) || changed;
  changed = syncChallengeSettlementMoodFailure(challenge) || changed;
  changed = syncChallengeSettlementNegotiationTurnFields(challenge) || changed;
  changed = seedChallengeFactSheetsIfNeeded(challenge) || changed;
  changed = backfillChallengeFactSheetsFromTranscript(challenge) || changed;
  changed = advanceChallengeToCourtIfPlaintiffReady(challenge) || changed;
  changed = ensureChallengeCourtroomTimer(challenge) || changed;

  return changed;
};

const normalizeClientIntakeStatement = (value = "") =>
  String(value || "")
    .trim()
    .replace(/^\s*your honou?r[:,]?\s*/i, "")
    .replace(/^\s*may it please the court[:,]?\s*/i, "")
    .replace(/^\s*counsel[:,]?\s*/i, "")
    .replace(/\s{2,}/g, " ")
    .trim();

const buildOpeningStatementForSide = (template, side) => {
  const interviewOpening = getSideOpeningStatement(template, side);
  if (interviewOpening) {
    return normalizeClientIntakeStatement(interviewOpening);
  }

  if (side === "client") {
    return normalizeClientIntakeStatement(template.openingStatement);
  }

  return `${template.opponentName} disputes ${template.clientName}'s request for relief and wants the court to reject or reduce it.`;
};

const getChallengeLookupQuery = ({ userId, challengeId }) => {
  const normalizedChallengeId = String(challengeId || "").trim();

  if (!normalizedChallengeId) {
    return { _id: null };
  }

  const participantFilter = { "participants.userId": userId };
  const identityFilter = MONGO_ID_PATTERN.test(normalizedChallengeId)
    ? {
        $or: [{ _id: normalizedChallengeId }, { slug: normalizedChallengeId }],
      }
    : { slug: normalizedChallengeId };

  return { ...participantFilter, ...identityFilter };
};

const ensureChallengeSlug = (challenge) => {
  if (!challenge || String(challenge.slug || "").trim()) {
    return false;
  }

  challenge.slug = buildChallengeSlug(challenge.title, challenge._id || challenge.id);
  return true;
};

const getParticipant = (challenge, userId) =>
  (challenge.participants || []).find((participant) =>
    isSameId(participant.userId, userId)
  ) || null;

const getOtherParticipant = (challenge, userId) =>
  (challenge.participants || []).find(
    (participant) => !isSameId(participant.userId, userId)
  ) || null;

const hasPendingSettlementIntent = (settlement = {}) =>
  settlement.intentPending === true ||
  settlement.intentStatus === "pending" ||
  settlement.status === "proposed";

const hasPendingSettlementIntentFromUser = (settlement = {}, userId) => {
  if (!hasPendingSettlementIntent(settlement)) {
    return false;
  }

  return isSameId(settlement.intentSenderUserId || settlement.proposedByUserId, userId);
};

const getClearedSettlementIntentFields = () => ({
  "settlement.intentPending": false,
  "settlement.intentStatus": "none",
  "settlement.intentSenderUserId": null,
  "settlement.intentSenderSide": "",
  "settlement.intentReceiverUserId": null,
  "settlement.intentReceiverSide": "",
  "settlement.intentMessage": "",
  "settlement.intentSentAt": null,
  "settlement.intentResponse": "",
  "settlement.intentRespondedAt": null,
  "settlement.proposedByUserId": null,
  "settlement.proposedBySide": "",
  "settlement.proposalMessage": "",
  "settlement.proposedAt": null,
});

const clearSettlementIntentState = (settlement) => {
  if (!settlement) {
    return false;
  }

  let changed = false;
  const setValue = (key, value, same = (left, right) => left === right) => {
    if (same(settlement[key], value)) {
      return;
    }

    settlement[key] = value;
    changed = true;
  };

  setValue("intentPending", false);
  setValue("intentStatus", "none");
  setValue("intentSenderUserId", null, isSameId);
  setValue("intentSenderSide", "");
  setValue("intentReceiverUserId", null, isSameId);
  setValue("intentReceiverSide", "");
  setValue("intentMessage", "");
  setValue("intentSentAt", null, (left, right) => String(left || "") === String(right || ""));
  setValue("intentResponse", "");
  setValue("intentRespondedAt", null, (left, right) => String(left || "") === String(right || ""));
  setValue("proposedByUserId", null, isSameId);
  setValue("proposedBySide", "");
  setValue("proposalMessage", "");
  setValue("proposedAt", null, (left, right) => String(left || "") === String(right || ""));

  return changed;
};

const syncChallengeSettlementIntentFields = (challenge) => {
  const settlement = challenge?.settlement;
  if (!settlement || settlement.status !== "proposed") {
    return false;
  }

  const senderUserId = settlement.intentSenderUserId || settlement.proposedByUserId;
  if (!senderUserId) {
    return false;
  }

  const sender = getParticipant(challenge, senderUserId);
  const receiver = getOtherParticipant(challenge, senderUserId);
  const sentAt = settlement.intentSentAt || settlement.proposedAt || new Date();
  let changed = false;

  const setValue = (key, value, same = (left, right) => left === right) => {
    if (same(settlement[key], value)) {
      return;
    }

    settlement[key] = value;
    changed = true;
  };

  setValue("intentPending", true);
  setValue("intentStatus", "pending");
  setValue("intentSenderUserId", senderUserId, isSameId);
  setValue("intentSenderSide", settlement.intentSenderSide || sender?.side || settlement.proposedBySide || "");
  if (receiver?.userId) {
    setValue("intentReceiverUserId", receiver.userId, isSameId);
    setValue("intentReceiverSide", settlement.intentReceiverSide || receiver.side || "");
  }
  setValue("intentMessage", settlement.intentMessage || settlement.proposalMessage || "");
  setValue(
    "intentSentAt",
    sentAt,
    (left, right) => String(left || "") === String(right || "")
  );
  setValue("intentResponse", "");
  setValue("intentRespondedAt", null);

  if (changed) {
    challenge.markModified?.("settlement");
  }

  return changed;
};

const syncChallengeSettlementNegotiationTurnFields = (challenge) => {
  const settlement = challenge?.settlement;
  if (!settlement || settlement.status !== "active") {
    return false;
  }

  const latestPlayerMessage = Array.isArray(settlement.transcript)
    ? [...settlement.transcript]
        .reverse()
        .find((entry) => entry?.role === "player" && entry?.userId)
    : null;

  if (!latestPlayerMessage?.userId) {
    return false;
  }

  const sender = getParticipant(challenge, latestPlayerMessage.userId);
  const receiver = getOtherParticipant(challenge, latestPlayerMessage.userId);
  if (!sender || !receiver) {
    return false;
  }

  let changed = false;
  const setValue = (key, value, same = isSameId) => {
    if (same(settlement[key], value)) {
      return;
    }

    settlement[key] = value;
    changed = true;
  };

  setValue("latestNegotiationMessageUserId", sender.userId);
  setValue("latestNegotiationMessageSide", sender.side, (left, right) => left === right);
  setValue("awaitingNegotiationResponseUserId", sender.userId);
  setValue("negotiationTurnUserId", receiver.userId);
  setValue("negotiationTurnSide", receiver.side, (left, right) => left === right);
  setValue(
    "latestNegotiationMessageAt",
    latestPlayerMessage.createdAt || new Date(),
    (left, right) => String(left || "") === String(right || "")
  );

  if (changed) {
    challenge.markModified?.("settlement");
  }

  return changed;
};

const getSettlementFailureParticipantForMoodKey = (challenge, moodKey) => {
  const failedSide = moodKey === "opponent" ? "opponent" : "client";
  return (
    (challenge.participants || []).find((participant) => participant.side === failedSide) ||
    null
  );
};

const syncChallengeSettlementMoodFailure = (challenge) => {
  const settlement = challenge?.settlement;
  if (
    !settlement ||
    settlement.accepted ||
    settlement.resolution === "settled" ||
    settlement.resolution === "failed" ||
    ["settled", "failed", "rejected"].includes(settlement.status)
  ) {
    return false;
  }

  const playerMood = Number(settlement.moods?.player);
  const opponentMood = Number(settlement.moods?.opponent);
  const failedMoodKey =
    Number.isFinite(playerMood) && playerMood <= -100
      ? "player"
      : Number.isFinite(opponentMood) && opponentMood <= -100
      ? "opponent"
      : "";

  if (!failedMoodKey) {
    return false;
  }

  const failedParticipant = getSettlementFailureParticipantForMoodKey(
    challenge,
    failedMoodKey
  );
  const endedAt = settlement.endedAt || settlement.resolvedAt || new Date();

  challenge.status = "active";
  settlement.status = "failed";
  settlement.resolved = true;
  settlement.resolution = "failed";
  settlement.resolvedAt = endedAt;
  settlement.accepted = false;
  settlement.acceptedAt = null;
  settlement.acceptedByUserId = null;
  settlement.acceptedBySide = "";
  settlement.endedNegotiations = true;
  settlement.endedByUserId = failedParticipant?.userId || null;
  settlement.endedBySide = failedParticipant?.side || "";
  settlement.endedAt = endedAt;
  settlement.failureReason =
    settlement.failureReason ||
    "Negotiations broke down because a client wants to walk out.";
  settlement.awaitingNegotiationResponseUserId = null;
  settlement.negotiationTurnUserId = null;
  settlement.negotiationTurnSide = "";
  clearSettlementIntentState(settlement);

  challenge.markModified?.("settlement");
  return true;
};

const syncChallengeSettlementTerminalStage = (challenge) => {
  const settlement = challenge?.settlement;
  if (!settlement) {
    return false;
  }

  const failed = Boolean(
    settlement.resolution === "failed" || settlement.status === "failed"
  );
  const rejected = Boolean(
    settlement.resolution === "rejected" || settlement.status === "rejected"
  );

  if (!failed && !rejected) {
    return false;
  }

  let changed = false;
  if (challenge.status === "settlement") {
    challenge.status = "active";
    changed = true;
  }

  changed = clearSettlementIntentState(settlement) || changed;

  if (settlement.awaitingNegotiationResponseUserId) {
    settlement.awaitingNegotiationResponseUserId = null;
    changed = true;
  }
  if (settlement.negotiationTurnUserId) {
    settlement.negotiationTurnUserId = null;
    changed = true;
  }
  if (settlement.negotiationTurnSide) {
    settlement.negotiationTurnSide = "";
    changed = true;
  }

  if (changed) {
    challenge.markModified?.("settlement");
  }

  return changed;
};

const getParticipantLabel = (challenge, userId) =>
  isSameId(challenge.initiatorId, userId) ? "initiator" : "challenged";

const markParticipantsModified = (challenge) => {
  if (typeof challenge?.markModified === "function") {
    challenge.markModified("participants");
  }
};

const markCourtroomRoundsModified = (challenge) => {
  if (typeof challenge?.markModified === "function") {
    challenge.markModified("courtroomRounds");
  }
};

const getCourtroomDeadlineFrom = (date = new Date()) =>
  new Date(date.getTime() + COURTROOM_RESPONSE_TIMEOUT_MS);

const resetChallengeCourtroomTimer = (challenge, now = new Date()) => {
  if (!challenge || challenge.status !== "courtroom") {
    return false;
  }

  challenge.courtroomLastActivityAt = now;
  challenge.courtroomDeadlineAt = getCourtroomDeadlineFrom(now);
  challenge.courtroomTimeoutFinalizingAt = null;
  return true;
};

const pauseChallengeForAdjournment = (challenge) => {
  challenge.status = "active";
  challenge.courtroomLastActivityAt = null;
  challenge.courtroomDeadlineAt = null;
  challenge.courtroomTimeoutStartedAt = null;
  challenge.courtroomTimedOutAt = null;
  challenge.courtroomTimeoutFinalizingAt = null;
  challenge.maxCourtRounds += 1;

  (challenge.participants || []).forEach((participant) => {
    participant.status = "active";
    participant.readyAt = null;
    if (participant.factSheet) participant.factSheet.ready = false;
    if (participant.caseAssessment) {
      participant.caseAssessment.lockedCourtEntryChance = null;
      participant.caseAssessment.lockedReasons = [];
      participant.caseAssessment.lockedAt = null;
    }
  });
  markParticipantsModified(challenge);
};

const ensureChallengeCourtroomTimer = (challenge) => {
  if (!challenge || challenge.status !== "courtroom") {
    return false;
  }

  if (challenge.courtroomDeadlineAt) {
    return false;
  }

  const lastSubmission = getLastCourtroomSubmission(challenge);
  const lastActivityAt = new Date(
    lastSubmission?.submittedAt || challenge.updatedAt || challenge.acceptedAt || Date.now()
  );
  challenge.courtroomLastActivityAt = lastActivityAt;
  challenge.courtroomDeadlineAt = getCourtroomDeadlineFrom(lastActivityAt);
  return true;
};

const isMongooseVersionConflict = (error) =>
  error?.name === "VersionError" ||
  /No matching document found/i.test(String(error?.message || ""));

const saveReadChangesAndRefresh = async (challenge) => {
  try {
    await challenge.save();
    return challenge;
  } catch (error) {
    if (!isMongooseVersionConflict(error)) {
      throw error;
    }

    return (await Challenge.findById(challenge._id)) || challenge;
  }
};

const setParticipantFactSheet = (challenge, participant, factSheet) => {
  if (typeof participant?.set === "function") {
    participant.set("factSheet", factSheet);
  } else if (participant) {
    participant.factSheet = factSheet;
  }

  markParticipantsModified(challenge);
};

const setParticipantCaseAssessment = (challenge, participant, caseAssessment) => {
  if (typeof participant?.set === "function") {
    participant.set("caseAssessment", caseAssessment);
  } else if (participant) {
    participant.caseAssessment = caseAssessment;
  }

  markParticipantsModified(challenge);
};

const setParticipantClientMemory = (
  challenge,
  participant,
  clientMemory,
  clientMemoryExcerpt = participant?.clientMemoryExcerpt
) => {
  if (typeof participant?.set === "function") {
    participant.set("clientMemory", clientMemory);
    participant.set("clientMemoryExcerpt", clientMemoryExcerpt || "");
  } else if (participant) {
    participant.clientMemory = clientMemory;
    participant.clientMemoryExcerpt = clientMemoryExcerpt || "";
  }

  applyClientMemoryOpeningToParticipant(
    challenge,
    participant,
    clientMemory,
    clientMemoryExcerpt
  );
  markParticipantsModified(challenge);
};

const getParticipantMemoryClaims = (participant) =>
  normalizeMemoryClaims(
    participant?.clientMemory?.memoryClaims || participant?.clientMemory?.claims || [],
    participant?.side || "client"
  );

const syncChallengeMemoryContentions = (challenge) => {
  const participants = challenge?.participants || [];
  if (participants.length < 2) {
    return false;
  }

  return participants.reduce((changed, participant) => {
    const otherParticipant = participants.find((candidate) => candidate !== participant);
    const patch = buildMemoryClaimFactSheetPatch({
      ownClaims: getParticipantMemoryClaims(participant),
      opposingClaims: getParticipantMemoryClaims(otherParticipant),
      side: participant.side,
    });
    const hasPatch = patch.knownClaims.length || patch.disputedFacts.length;

    if (!hasPatch) {
      return changed;
    }

    const currentFactSheet = participant.factSheet?.toObject
      ? participant.factSheet.toObject()
      : participant.factSheet || {};
    const nextFactSheet = mergeFactSheet(
      currentFactSheet,
      patch,
      templateForChallenge(challenge),
      {
        playerSide: participant.side,
      }
    );
    const nextKnown = uniqueList(nextFactSheet.knownClaims || []);
    const nextDisputed = uniqueList(nextFactSheet.disputedFacts || []);
    const didChange =
      nextKnown.length > uniqueList(currentFactSheet.knownClaims || []).length ||
      nextDisputed.length > uniqueList(currentFactSheet.disputedFacts || []).length;

    if (didChange) {
      setParticipantFactSheet(challenge, participant, nextFactSheet);
    }

    return changed || didChange;
  }, false);
};

const userMapForChallenge = async (challenge) => {
  const userIds = [
    challenge.initiatorId,
    challenge.challengedId,
    ...(challenge.participants || []).map((participant) => participant.userId),
  ].map(toObjectIdString).filter(Boolean);

  if (!userIds.length) {
    return new Map();
  }

  const users = await User.find({ _id: { $in: [...new Set(userIds)] } }).select(
    "name email image progression"
  );
  return new Map(users.map((user) => [String(user._id), user]));
};

const getPlayerDisplayName = (user) =>
  user?.name || user?.email?.split("@")[0] || "Counsel";

const getStableChallengePortraitImage = ({ challenge, participant, image = "" }) => {
  const currentImage = String(image || "").trim();

  if (!currentImage || !currentImage.includes("/client-portrait")) {
    return currentImage;
  }

  const challengeRef =
    challenge.slug || buildChallengeSlug(challenge.title, challenge.id || challenge._id);
  return `/api/challenges/${challengeRef}/client-portrait?participantId=${toObjectIdString(
    participant.userId
  )}`;
};

const getStableChallengePortrait = ({ challenge, participant }) => {
  const portrait = participant?.clientPortrait || {};

  return {
    ...portrait,
    image: getStableChallengePortraitImage({
      challenge,
      participant,
      image: portrait.image,
    }),
  };
};

const buildParticipantCaseSession = ({ challenge, participant, otherParticipant }) => {
  const judgedRounds = (challenge.courtroomRounds || []).filter(
    (round) => round.status === "judged"
  );

  return {
    id: challenge.id,
    _id: challenge._id,
    title: challenge.title,
    caseTemplateId: challenge.templateSnapshot,
    templateSnapshot: challenge.templateSnapshot,
    canonicalStory: challenge.canonicalStory,
    templateSlug: challenge.templateSlug,
    scenarioId: challenge.templateSlug,
    practiceArea: challenge.practiceArea,
    primaryCategory: challenge.primaryCategory,
    negotiationProfile: getNegotiationProfile(challenge),
    complexity: challenge.complexity,
    playerSide: participant.side,
    status:
      challenge.status === "courtroom"
        ? "courtroom"
        : challenge.status === "settlement"
        ? "settlement"
        : challenge.status === "settled"
        ? "settled"
        : "interview",
    lawbookVersion: challenge.lawbookVersion,
    maxCourtRounds: challenge.maxCourtRounds,
    judgeProfile: challenge.judgeProfile,
    premise: {
      clientName: challenge.premise?.clientName,
      opponentName: challenge.premise?.opponentName,
      courtName: challenge.premise?.courtName,
      overview: buildOverviewForSide(challenge.templateSnapshot, participant.side),
      desiredRelief: buildDesiredReliefForSide(challenge.templateSnapshot, participant.side),
    },
    interviewTranscript: participant.interviewTranscript || [],
    factSheet: participant.factSheet,
    caseAssessment: participant.caseAssessment,
    clientMemory: participant.clientMemory || null,
    clientPortrait: getStableChallengePortrait({ challenge, participant }),
    opponentPortrait: otherParticipant
      ? getStableChallengePortrait({ challenge, participant: otherParticipant })
      : {},
    settlement: {
      ...(challenge.settlement || {}),
      clientPreview: participant.settlementAssistant?.preview || null,
      clientPreviewUpdatedAt: participant.settlementAssistant?.updatedAt || null,
      clientHuddle: participant.settlementAssistant?.clientHuddle || null,
    },
    adjournment: challenge.adjournment || {},
    courtroomTranscript: judgedRounds.flatMap((round) =>
      (round.submissions || []).map((submission) => ({
        round: round.round,
        speaker: isSameId(submission.userId, participant.userId) ? "player" : "opponent",
        text: submission.text,
        citedFacts: submission.citedFacts || [],
        citedClaimIds: submission.citedClaimIds || [],
        citedRules: submission.citedRules || [],
        judgeNotes: submission.judgeNotes || {},
        createdAt: submission.submittedAt,
      }))
    ),
    score: {
      player: participant.score || 0,
      opponent: otherParticipant?.score || 0,
      roundsCompleted: judgedRounds.length,
      lastBenchSignal: judgedRounds[judgedRounds.length - 1]?.benchSummary || "",
      highlights: [],
      weaknesses: [],
    },
    verdict: {
      winner: "",
      summary: "",
      highlights: [],
      concerns: [],
      finalScore: {
        player: participant.score || 0,
        opponent: otherParticipant?.score || 0,
      },
    },
  };
};

const ensureParticipantClientMemory = async ({ challenge, participant, otherParticipant, userId }) => {
  if (!participant || participant.status !== "active") {
    return false;
  }

  const caseSession = buildParticipantCaseSession({
    challenge,
    participant,
    otherParticipant,
  });
  const result = await ensureClientMemory({
    caseSession,
    template: challenge.templateSnapshot,
    playerSide: participant.side,
    userId,
  });

  if (result.clientMemory && result.created) {
    const clientMemoryExcerpt = await generateClientMemoryExcerpt({
      clientMemory: result.clientMemory,
      partyName: getPartyName(challenge.templateSnapshot, participant.side),
      playerSide: participant.side,
      userId,
    });
    setParticipantClientMemory(
      challenge,
      participant,
      result.clientMemory,
      clientMemoryExcerpt
    );
    syncChallengeMemoryContentions(challenge);
    return true;
  }

  return false;
};

const getOpenRound = (challenge) =>
  (challenge.courtroomRounds || []).find((round) => round.status === "open") ||
  null;

const appendOpenRoundIfNeeded = (challenge) => {
  if (getOpenRound(challenge) || challenge.status !== "courtroom") {
    return false;
  }

  const judgedCount = (challenge.courtroomRounds || []).filter(
    (round) => round.status === "judged"
  ).length;
  if (judgedCount >= challenge.maxCourtRounds) {
    return false;
  }

  challenge.courtroomRounds.push({
    round: judgedCount + 1,
    status: "open",
    submissions: [],
    benchSummary: "",
    judgedAt: null,
  });

  return true;
};

const updateExpiredChallenge = (challenge) => {
  if (
    challenge?.status === "pending" &&
    challenge.expiresAt &&
    new Date(challenge.expiresAt).getTime() < Date.now()
  ) {
    challenge.status = "expired";
    return true;
  }
  return false;
};

export const viewerCanOpenChallenge = async ({ userId, challengeId }) => {
  await connectMongo();
  const challenge = await Challenge.findOne({
    $or: [
      MONGO_ID_PATTERN.test(String(challengeId || "")) ? { _id: challengeId } : null,
      { slug: String(challengeId || "").trim() },
    ].filter(Boolean),
    "participants.userId": userId,
  }).select("_id");

  return Boolean(challenge);
};

export const createChallenge = async ({
  initiatorId,
  initiatorProfile = null,
  challengedId,
  caseTemplateId,
  categorySlug = DEFAULT_CATEGORY_SLUG,
  complexity = 1,
  countryCode = "US",
}) => {
  await connectMongo();

  if (!initiatorId || !challengedId || isSameId(initiatorId, challengedId)) {
    throw new Error("Choose another player to challenge.");
  }

  const [initiator, challenged] = await Promise.all([
    ensureUserProfile(initiatorId, initiatorProfile),
    User.findById(challengedId),
  ]);

  if (!challenged) {
    throw new Error("Challenged player not found.");
  }

  let templateDocument = null;
  let template = null;
  let templateSnapshot = null;
  let canonicalStory = null;
  let currentEventProvenance = null;

  if (caseTemplateId) {
    const availableTemplates = await listScenarioOptions(initiatorId, initiatorProfile);
    const selectedTemplate = availableTemplates.find(
      (option) => isSameId(option.id, caseTemplateId) && option.unlocked
    );

    if (!selectedTemplate) {
      throw new Error("Choose an unlocked case before sending a challenge.");
    }

    templateDocument = await CaseTemplate.findOne({
      _id: caseTemplateId,
      status: "active",
    });

    if (!templateDocument) {
      throw new Error("Case template not found.");
    }

    template = enrichTemplateForGameplay(toPlain(templateDocument));
    templateSnapshot = buildSessionTemplateSnapshot(template);
    canonicalStory = getCanonicalStoryWorld(template);
  } else {
    const caseCountry = buildCaseCountry(countryCode, { fallback: true });
    const progression = normalizeProgression(initiator?.progression);
    const requestedCategorySlug = categorySlug || DEFAULT_CATEGORY_SLUG;
    const dynamicDifficulty = getEffectivePvpDynamicComplexity({
      progression,
      categorySlug: requestedCategorySlug,
      requestedComplexity: complexity,
    });
    const dynamicCase = await generateDynamicCaseState({
      categorySlug: requestedCategorySlug,
      complexity: dynamicDifficulty.complexity,
      playerLevel: dynamicDifficulty.playerLevel,
      userId: initiatorId,
      countryCode: caseCountry.code,
    });
    currentEventProvenance = dynamicCase.currentEventProvenance || null;

    template = buildDynamicCaseTemplateSnapshot(dynamicCase);
    template.dynamicDifficulty = dynamicDifficulty;
    templateSnapshot = template;
    canonicalStory = template.canonicalStory;
  }
  const initiatorSide = Math.random() < 0.5 ? "client" : "opponent";
  const challengedSide = getOpposingSide(initiatorSide);
  const participantInputs = [
    { userId: initiator._id, side: initiatorSide, status: "active" },
    { userId: challenged._id, side: challengedSide, status: "pending" },
  ];
  const participants = participantInputs.map((participant) => {
    const openingStatement = buildOpeningStatementForSide(template, participant.side);
    const interviewSubject = buildInterviewSubjectForSide(
      template,
      participant.side === "opponent" ? "defendant" : "plaintiff"
    );

    return {
      userId: participant.userId,
      side: participant.side,
      status: participant.status,
      score: 0,
      verdict: "",
      factSheet: blankFactSheet(template, participant.side, openingStatement),
      caseAssessment: {},
      interviewTranscript: [
        {
          role: "party",
          speaker: interviewSubject.name || getPartyName(template, participant.side),
          text: openingStatement,
          sourceType: "claim",
          relatedFactIds: [],
        },
      ],
    };
  });

  const challenge = new Challenge({
    initiatorId: initiator._id,
    challengedId: challenged._id,
    sponsorUserId: initiator._id,
    status: "pending",
    title: template.title,
    caseTemplateId: templateDocument?._id || null,
    templateSlug: template.slug,
    practiceArea: template.practiceArea,
    primaryCategory: template.primaryCategory,
    negotiationProfile: getNegotiationProfile(template),
    complexity: template.complexity,
    caseCountry: template.caseCountry || null,
    currentEventProvenance,
    lawbookVersion: LAWBOOK_VERSION,
    maxCourtRounds: Math.max(3, template.complexity + 1),
    templateSnapshot,
    canonicalStory,
    judgeProfile: buildJudgeProfile({
      caseSessionId: `${initiator._id}-${challenged._id}-${Date.now()}`,
      complexity: template.complexity,
    }),
    premise: {
      clientName: template.clientName,
      opponentName: template.opponentName,
      courtName: template.courtName,
      overview: template.overview,
      desiredRelief: template.desiredRelief,
    },
    participants,
    expiresAt: new Date(Date.now() + CHALLENGE_EXPIRY_MS),
  });

  ensureChallengeSlug(challenge);
  await challenge.save();

  try {
    await sendChallengeInviteEmail({
      toUser: challenged,
      fromUser: initiator,
      challenge,
    });
  } catch (error) {
    console.error("challenge invite email failed", error);
  }

  return buildChallengePayload({ challenge, viewerUserId: initiatorId });
};

export const listChallengesForUser = async (userId) => {
  await connectMongo();
  const challenges = await Challenge.find({ "participants.userId": userId }).sort({
    updatedAt: -1,
  });

  const dirtyChallenges = challenges.filter((challenge) => {
    let changed = normalizeChallengeForRead(challenge);
    changed = backfillChallengeCourtroomFeedback(challenge) || changed;
    return changed;
  });

  if (dirtyChallenges.length) {
    await Promise.all(
      dirtyChallenges.map((challenge) => saveReadChangesAndRefresh(challenge))
    );
  }

  return Promise.all(
    challenges.map((challenge) => buildChallengePayload({ challenge, viewerUserId: userId }))
  );
};

export const getChallengeForUser = async ({ userId, challengeId }) => {
  await connectMongo();
  const challenge = await Challenge.findOne(
    getChallengeLookupQuery({ userId, challengeId })
  );

  if (!challenge) {
    return null;
  }

  let changed = normalizeChallengeForRead(challenge);
  changed = (await backfillChallengeCourtroomScores(challenge)) || changed;
  changed = backfillChallengeCourtroomFeedback(challenge) || changed;
  changed = appendOpenRoundIfNeeded(challenge) || changed;
  const participant = getParticipant(challenge, userId);
  const otherParticipant = getOtherParticipant(challenge, userId);
  changed =
    (await ensureParticipantClientMemory({
      challenge,
      participant,
      otherParticipant,
      userId,
    })) || changed;
  changed = syncChallengeMemoryContentions(challenge) || changed;
  if (changed) {
    const latestChallenge = await saveReadChangesAndRefresh(challenge);
    return buildChallengePayload({ challenge: latestChallenge, viewerUserId: userId });
  }

  return buildChallengePayload({ challenge, viewerUserId: userId });
};

export const getChallengeRealtimeVersionForUser = async ({ userId, challengeId }) => {
  await connectMongo();
  const challenge = await Challenge.findOne(
    getChallengeLookupQuery({ userId, challengeId })
  )
    .select({
      _id: 1,
      status: 1,
      updatedAt: 1,
      "settlement.status": 1,
      "settlement.intentPending": 1,
      "settlement.intentStatus": 1,
      "settlement.intentSenderUserId": 1,
      "settlement.intentReceiverUserId": 1,
      "settlement.intentSentAt": 1,
      "settlement.intentRespondedAt": 1,
      "settlement.resolved": 1,
      "settlement.resolution": 1,
      "settlement.resolvedAt": 1,
      "settlement.accepted": 1,
      "settlement.acceptedAt": 1,
      "settlement.acceptedByUserId": 1,
      "settlement.acceptedBySide": 1,
      "settlement.completedAt": 1,
      "settlement.latestNegotiationMessageAt": 1,
      "settlement.latestNegotiationMessageUserId": 1,
      "settlement.awaitingNegotiationResponseUserId": 1,
      "settlement.negotiationTurnUserId": 1,
    })
    .lean();

  if (!challenge) {
    return null;
  }

  const settlement = challenge.settlement || {};

  return {
    id: toObjectIdString(challenge._id),
    status: challenge.status || "",
    updatedAt: challenge.updatedAt || null,
    settlementStatus: settlement.status || "",
    settlementIntentPending: hasPendingSettlementIntent(settlement),
    settlementIntentStatus:
      settlement.intentStatus || (settlement.status === "proposed" ? "pending" : ""),
    settlementIntentSenderUserId: toObjectIdString(settlement.intentSenderUserId),
    settlementIntentReceiverUserId: toObjectIdString(settlement.intentReceiverUserId),
    settlementIntentSentAt: settlement.intentSentAt || null,
    settlementIntentRespondedAt: settlement.intentRespondedAt || null,
    settlementResolved: Boolean(settlement.resolved),
    settlementResolution: settlement.resolution || "",
    settlementResolvedAt: settlement.resolvedAt || null,
    settlementAccepted: Boolean(settlement.accepted),
    settlementAcceptedAt: settlement.acceptedAt || null,
    settlementAcceptedByUserId: toObjectIdString(settlement.acceptedByUserId),
    settlementAcceptedBySide: settlement.acceptedBySide || "",
    settlementCompletedAt: settlement.completedAt || null,
    latestNegotiationMessageAt: settlement.latestNegotiationMessageAt || null,
    latestNegotiationMessageUserId: toObjectIdString(
      settlement.latestNegotiationMessageUserId
    ),
    awaitingNegotiationResponseUserId: toObjectIdString(
      settlement.awaitingNegotiationResponseUserId
    ),
    negotiationTurnUserId: toObjectIdString(settlement.negotiationTurnUserId),
  };
};

export const getChallengeDocumentForUser = async ({ userId, challengeId }) => {
  await connectMongo();
  const challenge = await Challenge.findOne(
    getChallengeLookupQuery({ userId, challengeId })
  );

  if (!challenge) {
    return null;
  }

  let changed = normalizeChallengeForRead(challenge);
  changed = (await backfillChallengeCourtroomScores(challenge)) || changed;
  changed = backfillChallengeCourtroomFeedback(challenge) || changed;
  changed = appendOpenRoundIfNeeded(challenge) || changed;
  if (changed) {
    return saveReadChangesAndRefresh(challenge);
  }

  return challenge;
};

export const acceptChallengeForUser = async ({ userId, challengeId }) => {
  const challenge = await getChallengeDocumentForUser({ userId, challengeId });
  if (!challenge) {
    return null;
  }
  if (!isSameId(challenge.challengedId, userId)) {
    throw new Error("Only the challenged player can accept this challenge.");
  }
  if (challenge.status !== "pending") {
    throw new Error("This challenge is no longer pending.");
  }

  const participant = getParticipant(challenge, userId);
  participant.status = "active";
  challenge.status = "active";
  challenge.acceptedAt = new Date();
  await ensureParticipantClientMemory({
    challenge,
    participant,
    otherParticipant: getOtherParticipant(challenge, userId),
    userId,
  });
  syncChallengeMemoryContentions(challenge);
  await challenge.save();

  try {
    const [challengeSender, acceptedByUser] = await Promise.all([
      User.findById(challenge.initiatorId).select("name email"),
      User.findById(userId).select("name email"),
    ]);

    await sendChallengeAcceptedEmail({
      toUser: challengeSender,
      acceptedByUser,
      challenge,
    });
  } catch (error) {
    console.error("challenge accepted email failed", error);
  }

  return buildChallengePayload({ challenge, viewerUserId: userId });
};

export const declineChallengeForUser = async ({ userId, challengeId }) => {
  const challenge = await getChallengeDocumentForUser({ userId, challengeId });
  if (!challenge) {
    return null;
  }
  if (!isSameId(challenge.challengedId, userId)) {
    throw new Error("Only the challenged player can decline this challenge.");
  }
  if (challenge.status !== "pending") {
    throw new Error("This challenge is no longer pending.");
  }

  const participant = getParticipant(challenge, userId);
  participant.status = "declined";
  challenge.status = "declined";
  challenge.declinedAt = new Date();
  await challenge.save();

  return buildChallengePayload({ challenge, viewerUserId: userId });
};

const applyChallengeInterviewResult = ({ challenge, userId, question, result }) => {
  if (!["active", "courtroom"].includes(challenge.status)) {
    throw new Error("This challenge is not in private intake.");
  }

  const participant = getParticipant(challenge, userId);
  if (!participant || participant.status === "ready") {
    throw new Error("This intake file is already locked.");
  }

  if (result.clientMemory) {
    setParticipantClientMemory(
      challenge,
      participant,
      result.clientMemory,
      result.clientMemoryExcerpt
    );
  } else if (result.clientMemoryExcerpt) {
    if (typeof participant?.set === "function") {
      participant.set("clientMemoryExcerpt", result.clientMemoryExcerpt);
    } else {
      participant.clientMemoryExcerpt = result.clientMemoryExcerpt;
    }
    applyClientMemoryOpeningToParticipant(
      challenge,
      participant,
      participant.clientMemory,
      result.clientMemoryExcerpt
    );
    markParticipantsModified(challenge);
  }

  participant.interviewTranscript.push({
    role: "player",
    speaker: "You",
    text: question,
    sourceType: "question",
    relatedFactIds: [],
  });
  participant.interviewTranscript.push({
    role: "party",
    speaker:
      result.interviewSubjectName ||
      getPartyName(challenge.templateSnapshot, participant.side),
    text: result.partyResponse,
    sourceType: "claim",
    relatedFactIds: result.relatedFactIds || [],
  });
  setParticipantFactSheet(challenge, participant, result.nextFactSheet);
  syncChallengeMemoryContentions(challenge);
  if (result.caseAssessment) {
    setParticipantCaseAssessment(challenge, participant, result.caseAssessment);
  }

  return challenge;
};

export const continueChallengeInterview = async ({ userId, challengeId, question }) => {
  const challenge = await getChallengeDocumentForUser({ userId, challengeId });
  if (!challenge) {
    return null;
  }
  if (!["active", "courtroom"].includes(challenge.status)) {
    throw new Error("This challenge is not in private intake.");
  }

  const participant = getParticipant(challenge, userId);
  const otherParticipant = getOtherParticipant(challenge, userId);
  if (!participant || participant.status === "ready") {
    throw new Error("This intake file is already locked.");
  }
  if (hasPendingSettlementIntentFromUser(challenge.settlement, userId)) {
    const error = new Error(
      "Settlement intent has been sent. Wait for opposing counsel to respond before continuing intake."
    );
    error.status = 409;
    throw error;
  }

  const caseSession = buildParticipantCaseSession({
    challenge,
    participant,
    otherParticipant,
  });
  const result = await continueInterview({ caseSession, question, userId });

  applyChallengeInterviewResult({ challenge, userId, question, result });

  try {
    await challenge.save();
    return buildChallengePayload({ challenge, viewerUserId: userId });
  } catch (error) {
    if (!isMongooseVersionConflict(error)) {
      throw error;
    }

    const freshChallenge = await Challenge.findOne(
      getChallengeLookupQuery({ userId, challengeId })
    );
    if (!freshChallenge) {
      return null;
    }

    applyChallengeInterviewResult({
      challenge: freshChallenge,
      userId,
      question,
      result,
    });
    await freshChallenge.save();
    return buildChallengePayload({ challenge: freshChallenge, viewerUserId: userId });
  }
};

export const markChallengeReady = async ({ userId, challengeId, factSheet }) => {
  const challenge = await getChallengeDocumentForUser({ userId, challengeId });
  if (!challenge) {
    return null;
  }
  if (!["active", "courtroom"].includes(challenge.status)) {
    throw new Error("This challenge is not in private intake.");
  }

  const participant = getParticipant(challenge, userId);
  const otherParticipant = getOtherParticipant(challenge, userId);
  if (hasPendingSettlementIntentFromUser(challenge.settlement, userId)) {
    const error = new Error(
      "Settlement intent has been sent. Wait for opposing counsel to respond before finalizing the fact sheet."
    );
    error.status = 409;
    throw error;
  }
  const finalized = finalizeFactSheetInput({
    factSheet: factSheet || participant.factSheet,
    caseTemplate: challenge.templateSnapshot,
  });

  if (finalized.missing.length) {
    throw new Error(
      `The fact sheet is not ready yet. Add ${finalized.missing.join(", ")}.`
    );
  }

  const participantCase = buildParticipantCaseSession({
    challenge,
    participant,
    otherParticipant,
  });
  let assessmentToLock = participant.caseAssessment;
  if (
    assessmentToLock?.currentSuccessChance === null ||
    assessmentToLock?.currentSuccessChance === undefined
  ) {
    assessmentToLock = await assessCaseSuccessChance({
      userId,
      caseSession: participantCase,
      factSheet: finalized.factSheet,
      previousAssessment: participant.caseAssessment,
    });
  }

  setParticipantFactSheet(challenge, participant, {
    ...finalized.factSheet,
    ready: true,
  });
  setParticipantCaseAssessment(challenge, participant, lockAssessmentForCourt(assessmentToLock));
  participant.status = "ready";
  participant.readyAt = new Date();
  markParticipantsModified(challenge);

  const resumingAdjournment = Boolean(challenge.adjournment?.active);
  const allReady = challenge.participants.every((item) => item.status === "ready");
  const plaintiffReady = participant.side === "client" && !resumingAdjournment;
  if (allReady || plaintiffReady) {
    if (resumingAdjournment) resolveActiveAdjournment(challenge);
    challenge.status = "courtroom";
    resetChallengeCourtroomTimer(challenge);
    appendOpenRoundIfNeeded(challenge);
  }

  await challenge.save();
  return buildChallengePayload({ challenge, viewerUserId: userId });
};

const applyChallengeSettlementProgression = async (challenge) => {
  await Promise.all(
    (challenge.participants || []).map((participant) =>
      applySettlementToProgression({
        userId: participant.userId,
        primaryCategory: challenge.primaryCategory,
        complexity: challenge.complexity,
        finalMoods: challenge.settlement?.moods || {},
        caseTitle: challenge.title,
        outcomeSummary: challenge.settlement?.outcomeSummary || "",
        isPvp: true,
      })
    )
  );
};

const applySettlementResultToChallenge = async ({
  challenge,
  participant,
  result,
}) => {
  const transcript = (result.settlement?.transcript || []).map((entry, index, entries) => {
    if (
      entry.role === "player" &&
      !entry.userId &&
      index === entries.map((item) => item.role).lastIndexOf("player")
    ) {
      return {
        ...entry,
        userId: participant.userId,
        side: participant.side,
        speaker: "You",
      };
    }

    return entry;
  });

  challenge.settlement = {
    ...result.settlement,
    transcript,
  };

  if (result.settled) {
    challenge.status = "settled";
    challenge.completedAt = challenge.completedAt || new Date();
    challenge.participants.forEach((item) => {
      item.verdict = "";
    });
    await applyChallengeSettlementProgression(challenge);
  } else if (result.failed) {
    challenge.status = "settlement";
  } else if (!result.rejected) {
    challenge.status = "settlement";
    if (participant?.status === "active") {
      participant.status = "active";
    }
  }

  if (typeof challenge.markModified === "function") {
    challenge.markModified("settlement");
    challenge.markModified("participants");
  }
};

const isParticipantInPrivateChallengeIntake = ({ challenge, participant }) =>
  ["active", "courtroom"].includes(challenge?.status) &&
  participant?.status === "active";

const getSettlementMoodKeyForChallengeSide = (side) =>
  side === "opponent" ? "opponent" : "player";

const coerceSettlementProposalTerms = (terms = {}) => {
  const entries = Array.isArray(terms)
    ? terms.map((term) => ({
        label: String(term?.label || term?.[0] || "").trim(),
        value: String(term?.value || term?.[1] || "").trim(),
      }))
    : Object.entries(terms || {}).map(([label, value]) => ({
        label: String(label || "").trim(),
        value: String(value || "").trim(),
      }));

  return entries
    .filter((term) => term.label && term.value)
    .slice(0, 8);
};

const flattenSettlementProposalTerms = (terms = []) =>
  coerceSettlementProposalTerms(terms).map((term) => `${term.label}: ${term.value}`);

const normalizeSettlementTermKey = (value = "") =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const normalizeSettlementTermValue = (value = "") =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\b(?:usd|us dollars|dollars)\b/g, "")
    .replace(/[$,]/g, "")
    .replace(/[.;]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();

const getStoredOrParsedSettlementProposalTerms = (entry) => {
  const storedTerms = coerceSettlementProposalTerms(entry?.terms || []);
  if (storedTerms.length) {
    return storedTerms;
  }

  return extractSettlementTermsFromMessage(entry?.text || "");
};

const settlementProposalTermsMatch = (leftTerms = [], rightTerms = []) => {
  const left = coerceSettlementProposalTerms(leftTerms);
  const right = coerceSettlementProposalTerms(rightTerms);

  if (!left.length || left.length !== right.length) {
    return false;
  }

  const rightByLabel = new Map(
    right.map((term) => [
      normalizeSettlementTermKey(term.label),
      normalizeSettlementTermValue(term.value),
    ])
  );

  return left.every((term) => {
    const label = normalizeSettlementTermKey(term.label);
    return (
      label &&
      rightByLabel.has(label) &&
      rightByLabel.get(label) === normalizeSettlementTermValue(term.value)
    );
  });
};

const isSettlementAcceptanceMessage = (message = "") => {
  const text = String(message || "").trim().toLowerCase();
  if (!text) {
    return false;
  }

  const rejectsAcceptance = /\b(?:do not|don't|cannot|can't|will not|won't|not|never)\s+(?:accept|agree|approve|settle)\b|\b(?:reject|rejected|decline|declined|counteroffer|counter offer|counter)\b|\bno deal\b/.test(text);
  const conditionalAcceptance = /\b(?:if|provided that|provided|subject to|as long as|unless|but only|only if|on condition)\b/.test(text);
  const acceptsTerms = /\b(?:we|i|my client|our client)\s+(?:accept|agree|approve|will take|can take)\b|\b(?:accepted|agreed|deal|we have a deal|that works|those terms work|your terms are acceptable|their terms are acceptable)\b/.test(text);

  return acceptsTerms && !rejectsAcceptance && !conditionalAcceptance;
};

const getPvpSettlementRecipientMoodDelta = (message = "") => {
  const text = String(message || "");
  const insultPatterns = [
    /\b(idiot|idiots|moron|morons|stupid|dumb|clown|loser|pathetic|worthless|trash|garbage)\b/i,
    /\b(liar|fraud|cheat|scam|scammer)\b/i,
    /\b(fuck|fucking|shit|bullshit|asshole|bastard|damn)\b/i,
    /\bshut up\b/i,
  ];
  const insultCount = insultPatterns.filter((pattern) => pattern.test(text)).length;
  const concreteSignals = [
    /\$\s?\d+/i,
    /\b\d+\s?(day|days|week|weeks|business days)\b/i,
    /\b(payment|pay|refund|return|release|waive|costs|fault|deadline|timeline|corrective work|scope)\b/i,
  ].filter((pattern) => pattern.test(text)).length;
  const cooperative = /\b(settle|resolve|compromise|offer|agree|agreement|terms|without court|avoid court|mutual|practical)\b/i.test(text);
  const hostile = /\b(never|refuse|threat|destroy|humiliate|liar|fraud|bad faith|walk away|wasting time)\b/i.test(text);

  if (insultCount >= 2) return -70;
  if (insultCount === 1) return -45;
  if (hostile) return concreteSignals > 1 ? -8 : -18;
  if (concreteSignals >= 2 && cooperative) return 14;
  if (concreteSignals >= 2) return 9;
  if (cooperative) return 5;
  return -4;
};

export const startChallengeSettlement = async ({
  userId,
  challengeId,
  message,
  terms = {},
  acceptTerms = false,
}) => {
  const challenge = await getChallengeDocumentForUser({ userId, challengeId });
  if (!challenge) {
    return null;
  }
  const participant = getParticipant(challenge, userId);
  const otherParticipant = getOtherParticipant(challenge, userId);
  if (!participant || !otherParticipant) {
    throw new Error("Challenge participant not found.");
  }
  if (!isParticipantInPrivateChallengeIntake({ challenge, participant })) {
    throw new Error("Settlements can only be opened during private intake.");
  }
  const negotiationProfile = getNegotiationProfile(challenge);
  if (!negotiationProfile.available) {
    throw new Error(negotiationProfile.blockedReason);
  }
  const cooldown = getSettlementCooldownState(challenge.settlement || {});
  if (cooldown.active) {
    const error = new Error("Settlement talks are cooling down after the last rejection.");
    error.status = 429;
    error.cooldownUntil = cooldown.cooldownUntil?.toISOString() || null;
    throw error;
  }
  if (
    challenge.settlement?.status === "proposed" &&
    challenge.settlement?.proposedByUserId &&
    isSameId(challenge.settlement.proposedByUserId, userId)
  ) {
    const error = new Error(
      "Settlement intent has already been sent. Wait for opposing counsel to ask their client."
    );
    error.status = 409;
    throw error;
  }
  if (!hasClientSettlementAuthority(participant.interviewTranscript)) {
    const error = new Error(
      "Ask your client if they are willing to settle this out of court before opening settlement talks."
    );
    error.status = 400;
    throw error;
  }

  const existingSettlementStatus = challenge.settlement?.status || "none";
  const proposedByUserId = challenge.settlement?.proposedByUserId
    ? toObjectIdString(challenge.settlement.proposedByUserId)
    : "";
  const isRespondingToOtherProposal =
    existingSettlementStatus === "proposed" &&
    proposedByUserId &&
    !isSameId(proposedByUserId, userId);

  if (existingSettlementStatus === "proposed" && !isRespondingToOtherProposal) {
    const error = new Error(
      "Settlement intent has already been sent. Wait for opposing counsel to ask their client."
    );
    error.status = 409;
    throw error;
  }

  if (!isRespondingToOtherProposal) {
    const now = new Date();
    const settlementIntentEntry = {
      role: "player",
      userId: participant.userId,
      side: participant.side,
      speaker: "Settlement intent",
      text: message,
      terms: coerceSettlementProposalTerms(terms),
      moodSnapshot: challenge.settlement?.moods || { player: 0, opponent: 0 },
      createdAt: now,
    };
    const updatedChallenge = await Challenge.findOneAndUpdate(
      {
        _id: challenge._id,
        "participants.userId": participant.userId,
        status: { $in: ["active", "courtroom"] },
        $or: [
          { "settlement.status": { $in: ["none", "rejected", "failed"] } },
          { "settlement.status": { $exists: false } },
          { settlement: null },
        ],
      },
      {
        $set: {
          "settlement.status": "proposed",
          "settlement.intentPending": true,
          "settlement.intentStatus": "pending",
          "settlement.intentSenderUserId": participant.userId,
          "settlement.intentSenderSide": participant.side,
          "settlement.intentReceiverUserId": otherParticipant.userId,
          "settlement.intentReceiverSide": otherParticipant.side,
          "settlement.intentMessage": message,
          "settlement.intentSentAt": now,
          "settlement.intentResponse": "",
          "settlement.intentRespondedAt": null,
          "settlement.proposedByUserId": participant.userId,
          "settlement.proposedBySide": participant.side,
          "settlement.proposalMessage": message,
          "settlement.proposedAt": now,
          "settlement.startedAt": now,
          "settlement.resolved": false,
          "settlement.resolution": "",
          "settlement.resolvedAt": null,
          "settlement.accepted": false,
          "settlement.acceptedAt": null,
          "settlement.acceptedByUserId": null,
          "settlement.acceptedBySide": "",
          "settlement.endedNegotiations": false,
          "settlement.endedByUserId": null,
          "settlement.endedBySide": "",
          "settlement.endedAt": null,
          updatedAt: now,
        },
        $push: {
          "settlement.transcript": settlementIntentEntry,
        },
      },
      { new: true, returnDocument: "after" }
    );

    if (!updatedChallenge) {
      const error = new Error(
        "Settlement intent could not be sent because this challenge state changed. Refresh and try again."
      );
      error.status = 409;
      throw error;
    }
    if (!hasPendingSettlementIntent(updatedChallenge.settlement || {})) {
      const error = new Error(
        "Settlement intent write did not return a pending settlement state."
      );
      error.status = 500;
      throw error;
    }

    return buildChallengePayload({ challenge: updatedChallenge, viewerUserId: userId });
  }

  const intentSnapshot = {
    senderUserId: challenge.settlement?.intentSenderUserId || proposedByUserId,
    senderSide: challenge.settlement?.intentSenderSide || challenge.settlement?.proposedBySide || "",
    receiverUserId: challenge.settlement?.intentReceiverUserId || participant.userId,
    receiverSide: challenge.settlement?.intentReceiverSide || participant.side,
    message: challenge.settlement?.intentMessage || challenge.settlement?.proposalMessage || "",
    sentAt: challenge.settlement?.intentSentAt || challenge.settlement?.proposedAt || null,
  };
  const caseSession = buildParticipantCaseSession({
    challenge,
    participant,
    otherParticipant,
  });
  const activeSettlement = normalizeSettlement(challenge.settlement || {}, caseSession);
  const moods = {
    player: clampMood(activeSettlement.moods?.player || 0),
    opponent: clampMood(activeSettlement.moods?.opponent || 0),
  };
  const recipientMoodKey = getSettlementMoodKeyForChallengeSide(otherParticipant.side);
  const senderMoodKey = getSettlementMoodKeyForChallengeSide(participant.side);
  moods[recipientMoodKey] = clampMood(
    (moods[recipientMoodKey] || 0) + getPvpSettlementRecipientMoodDelta(message)
  );
  moods[senderMoodKey] = clampMood(moods[senderMoodKey] || 0);
  const now = new Date();
  const openingNegotiationTurnFields = {
    latestNegotiationMessageUserId: participant.userId,
    latestNegotiationMessageSide: participant.side,
    awaitingNegotiationResponseUserId: participant.userId,
    negotiationTurnUserId: otherParticipant.userId,
    negotiationTurnSide: otherParticipant.side,
    latestNegotiationMessageAt: now,
  };
  challenge.settlement = {
    ...(challenge.settlement || {}),
    status: "active",
    moods,
    ...openingNegotiationTurnFields,
    transcript: [
      ...((challenge.settlement && challenge.settlement.transcript) || []),
      {
        role: "player",
        userId: participant.userId,
        side: participant.side,
        speaker: getPartyName(challenge.templateSnapshot, participant.side),
        text: message,
        moodSnapshot: moods,
        createdAt: now,
      },
    ],
    intentPending: false,
    intentStatus: "accepted",
    intentSenderUserId: intentSnapshot.senderUserId,
    intentSenderSide: intentSnapshot.senderSide,
    intentReceiverUserId: intentSnapshot.receiverUserId,
    intentReceiverSide: intentSnapshot.receiverSide,
    intentMessage: intentSnapshot.message,
    intentSentAt: intentSnapshot.sentAt,
    intentResponse: "accepted",
    intentRespondedAt: now,
    resolved: false,
    resolution: "",
    resolvedAt: null,
    accepted: false,
    acceptedAt: null,
    acceptedByUserId: null,
    acceptedBySide: "",
    endedNegotiations: false,
    endedByUserId: null,
    endedBySide: "",
    endedAt: null,
  };
  challenge.status = "settlement";
  challenge.markModified?.("settlement");
  await challenge.save();
  await Challenge.collection.updateOne(
    { _id: challenge._id },
    {
      $set: Object.fromEntries(
        Object.entries(openingNegotiationTurnFields).map(([key, value]) => [
          `settlement.${key}`,
          value,
        ])
      ),
    }
  );

  return buildChallengePayload({ challenge, viewerUserId: userId });
};

export const draftChallengeSettlementMessage = async ({ userId, challengeId }) => {
  const challenge = await getChallengeDocumentForUser({ userId, challengeId });
  if (!challenge) {
    return null;
  }
  const participant = getParticipant(challenge, userId);
  const otherParticipant = getOtherParticipant(challenge, userId);
  if (!participant || !otherParticipant) {
    throw new Error("Challenge participant not found.");
  }
  if (!isParticipantInPrivateChallengeIntake({ challenge, participant })) {
    throw new Error("Settlement drafts can only be prepared during private intake.");
  }
  const negotiationProfile = getNegotiationProfile(challenge);
  if (!negotiationProfile.available) {
    throw new Error(negotiationProfile.blockedReason);
  }
  if (
    challenge.settlement?.status === "proposed" &&
    challenge.settlement?.proposedByUserId &&
    isSameId(challenge.settlement.proposedByUserId, userId)
  ) {
    const error = new Error(
      "Settlement intent has already been sent. Wait for opposing counsel to ask their client."
    );
    error.status = 409;
    throw error;
  }
  if (!hasClientSettlementAuthority(participant.interviewTranscript)) {
    const error = new Error(
      "Ask your client if they are willing to settle this out of court before drafting settlement terms."
    );
    error.status = 400;
    throw error;
  }

  const caseSession = buildParticipantCaseSession({
    challenge,
    participant,
    otherParticipant,
  });

  return generateOpeningSettlementMessage({ caseSession, userId });
};

export const continueChallengeSettlement = async ({
  userId,
  challengeId,
  message,
  terms = {},
  acceptTerms = false,
}) => {
  const challenge = await getChallengeDocumentForUser({ userId, challengeId });
  if (!challenge) {
    return null;
  }
  if (challenge.status !== "settlement") {
    throw new Error("This challenge is not in settlement negotiations.");
  }
  const negotiationProfile = getNegotiationProfile(challenge);
  if (!negotiationProfile.available) {
    throw new Error(negotiationProfile.blockedReason);
  }

  const participant = getParticipant(challenge, userId);
  const otherParticipant = getOtherParticipant(challenge, userId);
  if (!participant || !otherParticipant) {
    throw new Error("Challenge participant not found.");
  }

  const transcript = Array.isArray(challenge.settlement?.transcript)
    ? challenge.settlement.transcript
    : [];
  const negotiationTurnUserId = challenge.settlement?.negotiationTurnUserId;
  if (negotiationTurnUserId && !isSameId(negotiationTurnUserId, userId)) {
    const error = new Error("Waiting for the other player to respond.");
    error.status = 409;
    throw error;
  }
  const latestPlayerMessage = [...transcript]
    .reverse()
    .find((entry) => entry?.role === "player" && entry?.userId);

  if (!negotiationTurnUserId && latestPlayerMessage && isSameId(latestPlayerMessage.userId, userId)) {
    const error = new Error("Waiting for the other player to respond.");
    error.status = 409;
    throw error;
  }

  const caseSession = buildParticipantCaseSession({
    challenge,
    participant,
    otherParticipant,
  });
  const activeSettlement = normalizeSettlement(challenge.settlement || {}, caseSession);
  const requestProposalTerms = coerceSettlementProposalTerms(terms);
  const parsedProposalTerms = extractSettlementTermsFromMessage(message);
  const proposalTerms = requestProposalTerms.length ? requestProposalTerms : parsedProposalTerms;
  const latestOwnProposalEntry = [...transcript]
    .reverse()
    .find(
      (entry) =>
        entry?.role === "player" &&
        entry?.userId &&
        isSameId(entry.userId, userId)
    );
  const repeatedOwnProposal = Boolean(
    latestOwnProposalEntry &&
      getPvpSettlementProposalSignature({ terms: proposalTerms, message }) ===
        getPvpSettlementProposalSignature({
          terms: latestOwnProposalEntry.terms,
          message: latestOwnProposalEntry.text,
        })
  );
  const noProgressCount = repeatedOwnProposal
    ? activeSettlement.noProgressCount + 1
    : 0;
  const tacticShiftTriggered =
    repeatedOwnProposal && noProgressCount >= 2 && !activeSettlement.tacticShiftUsed;
  const tacticShiftFailed = Boolean(
    repeatedOwnProposal &&
      activeSettlement.tacticShiftUsed &&
      activeSettlement.tacticShiftRequired
  );
  const tacticShiftUsed = repeatedOwnProposal
    ? activeSettlement.tacticShiftUsed || tacticShiftTriggered
    : false;
  const tacticShiftRequired = tacticShiftTriggered;
  const publicExchangeCount = transcript.filter((entry) => entry?.role === "player").length + 1;
  const exchangeLimitReached = publicExchangeCount >= MAX_SETTLEMENT_PUBLIC_EXCHANGES;
  const latestOtherProposalEntry = [...transcript]
    .reverse()
    .find(
      (entry) =>
        entry?.role === "player" &&
        entry?.userId &&
        !isSameId(entry.userId, userId)
    );
  const latestOtherProposalTerms =
    getStoredOrParsedSettlementProposalTerms(latestOtherProposalEntry);
  const latestOtherProposalText = String(latestOtherProposalEntry?.text || "").trim();
  if (acceptTerms) {
    const assistantPreview = participant.settlementAssistant?.preview || {};
    const currentOfferSignature = getSettlementOfferSignature({
      settlement: activeSettlement,
      playerSide: participant.side,
    });
    if (
      !currentOfferSignature ||
      assistantPreview.sourceOfferSignature !== currentOfferSignature ||
      assistantPreview.acceptanceAuthority !== "accept"
    ) {
      const error = new Error("Ask your client about the latest offer before accepting it.");
      error.status = 409;
      throw error;
    }
  }
  const acceptedByPlainLanguage = Boolean(
    latestOtherProposalEntry && (acceptTerms || isSettlementAcceptanceMessage(message))
  );
  const acceptedMatchingTerms = settlementProposalTermsMatch(
    proposalTerms,
    latestOtherProposalTerms
  );
  const acceptedTerms = acceptedByPlainLanguage ? latestOtherProposalTerms : proposalTerms;
  const flatAcceptedTerms = flattenSettlementProposalTerms(acceptedTerms);
  const finalAcceptedTerms =
    flatAcceptedTerms.length > 0
      ? flatAcceptedTerms
      : acceptedByPlainLanguage
      ? [
          latestOtherProposalText
            ? `Accepted proposal: ${latestOtherProposalText.slice(0, 500)}`
            : "Accepted the other side's latest settlement proposal.",
        ]
      : [];
  const acceptedCandidate = Boolean(
    (acceptedMatchingTerms || acceptedByPlainLanguage) && finalAcceptedTerms.length > 0
  );
  const moods = {
    player: clampMood(activeSettlement.moods?.player || 0),
    opponent: clampMood(activeSettlement.moods?.opponent || 0),
  };
  const recipientMoodKey = getSettlementMoodKeyForChallengeSide(otherParticipant.side);
  const senderMoodKey = getSettlementMoodKeyForChallengeSide(participant.side);
  moods[recipientMoodKey] = clampMood(
    (moods[recipientMoodKey] || 0) + getPvpSettlementRecipientMoodDelta(message)
  );
  moods[senderMoodKey] = clampMood(moods[senderMoodKey] || 0);
  const failedMoodKey =
    moods[senderMoodKey] <= -100
      ? senderMoodKey
      : moods[recipientMoodKey] <= -100
      ? recipientMoodKey
      : "";
  const convergenceFailed = Boolean(
    !acceptedCandidate && (tacticShiftFailed || exchangeLimitReached)
  );
  const failed = Boolean(failedMoodKey || convergenceFailed);
  const failedParticipant =
    failedMoodKey === senderMoodKey
      ? participant
      : failedMoodKey === recipientMoodKey
      ? otherParticipant
      : null;
  const settled = acceptedCandidate && !failed;
  const now = new Date();
  const negotiationTurnFields = {
    latestNegotiationMessageUserId: participant.userId,
    latestNegotiationMessageSide: participant.side,
    awaitingNegotiationResponseUserId: failed || settled ? null : participant.userId,
    negotiationTurnUserId: failed || settled ? null : otherParticipant.userId,
    negotiationTurnSide: failed || settled ? "" : otherParticipant.side,
    latestNegotiationMessageAt: now,
  };
  const playerMessageEntry = {
    role: "player",
    userId: participant.userId,
    side: participant.side,
    speaker: getPartyName(challenge.templateSnapshot, participant.side),
    text: message,
    terms: settled ? acceptedTerms : proposalTerms,
    moodSnapshot: moods,
    createdAt: now,
  };
  const atomicSettlementFilter = {
    _id: challenge._id,
    status: "settlement",
    "participants.userId": participant.userId,
  };

  if (negotiationTurnUserId) {
    atomicSettlementFilter["settlement.negotiationTurnUserId"] = participant.userId;
  }

  const settlementSetFields = {
    status: settled ? "settled" : failed ? "active" : "settlement",
    "settlement.status": settled ? "settled" : failed ? "failed" : "active",
    "settlement.moods": moods,
    "settlement.noProgressCount": noProgressCount,
    "settlement.tacticShiftUsed": tacticShiftUsed,
    "settlement.tacticShiftRequired": tacticShiftRequired,
    "settlement.publicExchangeCount": publicExchangeCount,
    "settlement.finalTerms": settled ? finalAcceptedTerms : [],
    "settlement.resolved": settled || failed,
    "settlement.resolution": settled ? "settled" : failed ? "failed" : "",
    "settlement.resolvedAt": settled || failed ? now : null,
    "settlement.accepted": settled,
    "settlement.acceptedAt": settled ? now : null,
    "settlement.acceptedByUserId": settled ? participant.userId : null,
    "settlement.acceptedBySide": settled ? participant.side : "",
    "settlement.endedNegotiations": settled || failed,
    "settlement.endedByUserId":
      settled ? participant.userId : failed ? failedParticipant?.userId || null : null,
    "settlement.endedBySide":
      settled ? participant.side : failed ? failedParticipant?.side || "" : "",
    "settlement.endedAt": settled || failed ? now : null,
    "settlement.outcomeSummary": settled
      ? "Both players accepted the same settlement terms."
      : "",
    "settlement.completedAt": settled ? now : null,
    "settlement.latestNegotiationMessageUserId":
      negotiationTurnFields.latestNegotiationMessageUserId,
    "settlement.latestNegotiationMessageSide":
      negotiationTurnFields.latestNegotiationMessageSide,
    "settlement.awaitingNegotiationResponseUserId":
      negotiationTurnFields.awaitingNegotiationResponseUserId,
    "settlement.negotiationTurnUserId": negotiationTurnFields.negotiationTurnUserId,
    "settlement.negotiationTurnSide": negotiationTurnFields.negotiationTurnSide,
    "settlement.latestNegotiationMessageAt":
      negotiationTurnFields.latestNegotiationMessageAt,
    updatedAt: now,
  };

  if (settled || failed) {
    Object.assign(settlementSetFields, getClearedSettlementIntentFields());
  } else {
    settlementSetFields["settlement.intentPending"] = false;
    settlementSetFields["settlement.intentStatus"] = "accepted";
  }

  if (failed) {
    settlementSetFields["settlement.failureReason"] =
      exchangeLimitReached
        ? "Negotiations reached the eight-exchange limit without agreement."
        : tacticShiftFailed
        ? "Negotiations reached an impasse after the remaining blocker did not change."
        : "Negotiations broke down because a client wants to walk out.";
  }

  if (settled) {
    settlementSetFields.completedAt = now;
  }

  const updatedChallenge = await Challenge.findOneAndUpdate(
    atomicSettlementFilter,
    {
      $set: settlementSetFields,
      $push: {
        "settlement.transcript": playerMessageEntry,
      },
      $unset: {
        "settlement.currentTerms": "",
      },
    },
    { new: true, returnDocument: "after" }
  );

  if (!updatedChallenge) {
    const error = new Error("Waiting for the other player to respond.");
    error.status = 409;
    throw error;
  }

  if (settled) {
    await applyChallengeSettlementProgression(updatedChallenge);
  }

  return buildChallengePayload({ challenge: updatedChallenge, viewerUserId: userId });
};

export const previewChallengeSettlementDraft = async ({
  userId,
  challengeId,
  terms,
  message = "",
  clientInstruction = "",
  mode = "manual",
}) => {
  const challenge = await getChallengeDocumentForUser({ userId, challengeId });
  if (!challenge) {
    return null;
  }
  if (challenge.status !== "settlement") {
    throw new Error("This challenge is not in settlement negotiations.");
  }
  const negotiationProfile = getNegotiationProfile(challenge);
  if (!negotiationProfile.available) {
    throw new Error(negotiationProfile.blockedReason);
  }

  const participant = getParticipant(challenge, userId);
  const otherParticipant = getOtherParticipant(challenge, userId);
  if (!participant || !otherParticipant) {
    throw new Error("Challenge participant not found.");
  }

  const caseSession = buildParticipantCaseSession({
    challenge,
    participant,
    otherParticipant,
  });

  const previewResult = await previewSettlementDraftForClient({
    caseSession,
    offerTerms: mode === "assisted_follow_up" ? {} : terms,
    message: mode === "assisted_follow_up" ? "" : message,
    clientInstruction: mode === "assisted_follow_up" ? "" : clientInstruction,
    mode,
    userId,
  });
  const huddleResult = applyPrivateClientHuddleMood({
    caseSession,
    preview: previewResult.preview,
  });
  const updatedAt = new Date();
  const updatedChallenge = await Challenge.findOneAndUpdate(
    {
      _id: challenge._id,
      status: "settlement",
      "participants.userId": participant.userId,
    },
    {
      $set: {
        "settlement.moods": huddleResult.settlement.moods,
        "participants.$.settlementAssistant": {
          preview: previewResult.preview,
          clientHuddle: huddleResult.settlement.clientHuddle,
          updatedAt,
        },
        updatedAt,
      },
    },
    { new: true, returnDocument: "after" }
  );

  if (!updatedChallenge) {
    const error = new Error("The settlement changed while consulting your client. Please try again.");
    error.status = 409;
    throw error;
  }

  return {
    preview: previewResult.preview,
    moodUpdate: huddleResult.moodUpdate,
    challenge: await buildChallengePayload({
      challenge: updatedChallenge,
      viewerUserId: userId,
    }),
  };
};

const getPvpSettlementProposalSignature = ({ terms = [], message = "" } = {}) => {
  const structured = coerceSettlementProposalTerms(terms)
    .map((term) => `${normalizeSettlementTermKey(term.label)}:${normalizeSettlementTermValue(term.value)}`)
    .filter(Boolean)
    .sort()
    .join("|");

  return structured || String(message || "").toLowerCase().replace(/[^a-z0-9₹$€£]+/g, " ").trim();
};

export const exitChallengeSettlement = async ({ userId, challengeId }) => {
  const challenge = await getChallengeDocumentForUser({ userId, challengeId });
  if (!challenge) {
    return null;
  }
  const participant = getParticipant(challenge, userId);
  if (!participant) {
    throw new Error("Challenge participant not found.");
  }
  if (!["active", "settlement"].includes(challenge.status)) {
    throw new Error("Only intake-stage settlement talks can return to intake.");
  }

  const wasActiveSettlement =
    challenge.status === "settlement" || challenge.settlement?.status === "active";
  const endedAt = new Date();
  challenge.status = "active";
  if (challenge.settlement) {
    const isRejectingPendingIntent = hasPendingSettlementIntent(challenge.settlement);
    challenge.settlement.status =
      challenge.settlement.status === "failed" ? "failed" : "rejected";
    if (wasActiveSettlement && !isRejectingPendingIntent) {
      challenge.settlement.endedNegotiations = true;
      challenge.settlement.endedByUserId = participant.userId;
      challenge.settlement.endedBySide = participant.side;
      challenge.settlement.endedAt = endedAt;
      challenge.settlement.awaitingNegotiationResponseUserId = null;
      challenge.settlement.negotiationTurnUserId = null;
      challenge.settlement.negotiationTurnSide = "";
    }
    clearSettlementIntentState(challenge.settlement);
    challenge.markModified?.("settlement");
  }
  await challenge.save();

  return buildChallengePayload({ challenge, viewerUserId: userId });
};

const getSubmissionForParticipant = (round, participant) =>
  (round.submissions || []).find((submission) =>
    isSameId(submission.userId, participant.userId)
  ) || null;

const getLastCourtroomSubmission = (challenge) =>
  (challenge.courtroomRounds || [])
    .flatMap((round) =>
      (round.submissions || []).map((submission) => ({
        ...submission,
        round: round.round,
        submittedAt: submission.submittedAt || round.judgedAt || challenge.updatedAt,
      }))
    )
    .sort((left, right) => new Date(left.submittedAt) - new Date(right.submittedAt))
    .at(-1) || null;

const summarizeScoredRound = (round) => {
  const scores = (round.submissions || [])
    .filter((submission) => submission.judgeNotes?.benchSignal)
    .map((submission) => `${submission.side}: +${submission.judgeNotes?.playerDelta || 0}`)
    .join(", ");
  return scores ? `Round ${round.round} scored ${scores}.` : `Round ${round.round} scored.`;
};

const buildSubmissionFeedbackBackfill = (submission = {}) => {
  const notes = submission.judgeNotes || {};
  const playerDelta = Number(notes.playerDelta || 0);
  const opponentDelta = Number(notes.opponentDelta || 0);
  const benchSignal = String(notes.benchSignal || "").trim();
  const citedRules = uniqueTextList(submission.citedRules || []);
  const strengths = uniqueTextList(notes.strengths || []);
  const weaknesses = uniqueTextList(notes.weaknesses || []);

  if (!strengths.length) {
    if (playerDelta >= opponentDelta && benchSignal) {
      strengths.push(benchSignal);
    } else if (citedRules.length) {
      strengths.push(`Your argument engaged ${citedRules.slice(0, 2).join(", ")}.`);
    } else if (playerDelta > 0) {
      strengths.push("Your argument helped your side in this round.");
    }
  }

  if (!weaknesses.length) {
    if (playerDelta < opponentDelta && benchSignal) {
      weaknesses.push(benchSignal);
    } else if (opponentDelta > playerDelta) {
      weaknesses.push("The opposing side made the stronger showing in this exchange.");
    } else if (!citedRules.length) {
      weaknesses.push("The argument needed a clearer lawbook anchor.");
    }
  }

  return {
    strengths: strengths.slice(0, 3),
    weaknesses: weaknesses.slice(0, 3),
  };
};

const backfillChallengeCourtroomFeedback = (challenge) => {
  if (!challenge || !["courtroom", "verdict"].includes(challenge.status)) {
    return false;
  }

  let changed = false;

  for (const round of challenge.courtroomRounds || []) {
    for (const submission of round.submissions || []) {
      if (!submission.judgeNotes?.benchSignal) {
        continue;
      }

      const strengths = submission.judgeNotes.strengths || [];
      const weaknesses = submission.judgeNotes.weaknesses || [];
      if (strengths.length && weaknesses.length) {
        continue;
      }

      const feedback = buildSubmissionFeedbackBackfill(submission);
      if (!strengths.length && feedback.strengths.length) {
        submission.judgeNotes.strengths = feedback.strengths;
        changed = true;
      }
      if (!weaknesses.length && feedback.weaknesses.length) {
        submission.judgeNotes.weaknesses = feedback.weaknesses;
        changed = true;
      }
    }
  }

  if (changed) {
    markCourtroomRoundsModified(challenge);
  }

  return changed;
};

const finalizeChallengeIfComplete = async (challenge) => {
  const judgedRounds = (challenge.courtroomRounds || []).filter(
    (round) => round.status === "judged"
  );
  if (judgedRounds.length < challenge.maxCourtRounds || challenge.status === "verdict") {
    return;
  }

  const [left, right] = challenge.participants;
  const leftScore = left.score || 0;
  const rightScore = right.score || 0;
  const isDraw = leftScore === rightScore;
  const winnerParticipant = isDraw ? null : leftScore > rightScore ? left : right;
  const loserParticipant = isDraw ? null : leftScore > rightScore ? right : left;

  challenge.status = "verdict";
  challenge.completedAt = new Date();
  challenge.verdict = {
    winnerUserId: winnerParticipant?.userId || null,
    winner: isDraw ? "draw" : getParticipantLabel(challenge, winnerParticipant.userId),
    summary: isDraw
      ? "The court finds the challenge too close to separate after the full record."
      : "The court awards the challenge to the stronger courtroom record after all rounds.",
    finalScore: {
      initiator: isSameId(left.userId, challenge.initiatorId) ? leftScore : rightScore,
      challenged: isSameId(left.userId, challenge.challengedId) ? leftScore : rightScore,
    },
  };

  if (isDraw) {
    left.verdict = "draw";
    right.verdict = "draw";
    await Promise.all(
      challenge.participants.map((participant) =>
        applyChallengeVerdictToPvpProgression({
          userId: participant.userId,
          primaryCategory: challenge.primaryCategory,
          outcome: "draw",
        })
      )
    );
    return;
  }

  winnerParticipant.verdict = "win";
  loserParticipant.verdict = "loss";
  await Promise.all([
    applyChallengeVerdictToPvpProgression({
      userId: winnerParticipant.userId,
      primaryCategory: challenge.primaryCategory,
      outcome: "win",
    }),
    applyChallengeVerdictToPvpProgression({
      userId: loserParticipant.userId,
      primaryCategory: challenge.primaryCategory,
      outcome: "loss",
    }),
  ]);
};

const getParticipantScoreForVerdict = (challenge, participant) =>
  isSameId(participant.userId, challenge.initiatorId)
    ? challenge.verdict?.finalScore?.initiator || participant.score || 0
    : challenge.verdict?.finalScore?.challenged || participant.score || 0;

const applyResolvedChallengeProgression = async ({ challenge, left, right }) => {
  const leftScore = getParticipantScoreForVerdict(challenge, left);
  const rightScore = getParticipantScoreForVerdict(challenge, right);
  const isDraw = leftScore === rightScore;

  if (isDraw) {
    left.verdict = "draw";
    right.verdict = "draw";
    await Promise.all(
      challenge.participants.map((participant) =>
        applyChallengeVerdictToPvpProgression({
          userId: participant.userId,
          primaryCategory: challenge.primaryCategory,
          outcome: "draw",
        })
      )
    );
    return;
  }

  const winnerParticipant = leftScore > rightScore ? left : right;
  const loserParticipant = leftScore > rightScore ? right : left;
  winnerParticipant.verdict = "win";
  loserParticipant.verdict = "loss";

  await Promise.all([
    applyChallengeVerdictToPvpProgression({
      userId: winnerParticipant.userId,
      primaryCategory: challenge.primaryCategory,
      outcome: "win",
    }),
    applyChallengeVerdictToPvpProgression({
      userId: loserParticipant.userId,
      primaryCategory: challenge.primaryCategory,
      outcome: "loss",
    }),
  ]);
};

const getChallengeScoreByLabel = (challenge, label) => {
  const participant =
    label === "initiator"
      ? (challenge.participants || []).find((item) =>
          isSameId(item.userId, challenge.initiatorId)
        )
      : (challenge.participants || []).find((item) =>
          isSameId(item.userId, challenge.challengedId)
        );

  return participant?.score || 0;
};

const getChallengeParticipantByLabel = (challenge, label) =>
  label === "initiator"
    ? (challenge.participants || []).find((item) => isSameId(item.userId, challenge.initiatorId))
    : (challenge.participants || []).find((item) => isSameId(item.userId, challenge.challengedId));

const buildCourtroomTimeoutContext = (challenge) => {
  const [left, right] = challenge.participants || [];
  const initiatorParticipant = getChallengeParticipantByLabel(challenge, "initiator") || left;
  const challengedParticipant = getChallengeParticipantByLabel(challenge, "challenged") || right;

  return {
    challengeId: toObjectIdString(challenge._id || challenge.id),
    title: challenge.title,
    templateSlug: challenge.templateSlug,
    primaryCategory: challenge.primaryCategory,
    complexity: challenge.complexity,
    judgeProfile: challenge.judgeProfile || null,
    maxCourtRounds: challenge.maxCourtRounds,
    scores: {
      initiator: getChallengeScoreByLabel(challenge, "initiator"),
      challenged: getChallengeScoreByLabel(challenge, "challenged"),
    },
    initiator: {
      side: initiatorParticipant?.side || "",
      partyName: getPartyName(challenge.templateSnapshot, initiatorParticipant?.side),
      factSheet: initiatorParticipant?.factSheet || {},
      caseAssessment: initiatorParticipant?.caseAssessment || {},
    },
    challenged: {
      side: challengedParticipant?.side || "",
      partyName: getPartyName(challenge.templateSnapshot, challengedParticipant?.side),
      factSheet: challengedParticipant?.factSheet || {},
      caseAssessment: challengedParticipant?.caseAssessment || {},
    },
    courtroomRounds: (challenge.courtroomRounds || []).map((round) => ({
      round: round.round,
      status: round.status,
      benchSummary: round.benchSummary || "",
      submissions: (round.submissions || []).map((submission) => ({
        party:
          isSameId(submission.userId, challenge.initiatorId)
            ? "initiator"
            : isSameId(submission.userId, challenge.challengedId)
            ? "challenged"
            : "unknown",
        side: submission.side,
        text: submission.text,
        citedFacts: submission.citedFacts || [],
        citedClaimIds: submission.citedClaimIds || [],
        citedRules: submission.citedRules || [],
        judgeNotes: submission.judgeNotes || {},
        submittedAt: submission.submittedAt || null,
      })),
    })),
  };
};

const applyChallengeVerdictByLabel = async ({ challenge, winner, summary, highlights = [], concerns = [], timedOutAt = null }) => {
  const initiatorParticipant = getChallengeParticipantByLabel(challenge, "initiator");
  const challengedParticipant = getChallengeParticipantByLabel(challenge, "challenged");
  const isDraw = winner === "draw";
  const winnerParticipant = isDraw ? null : getChallengeParticipantByLabel(challenge, winner);
  const loserParticipant =
    isDraw || !winnerParticipant
      ? null
      : winner === "initiator"
      ? challengedParticipant
      : initiatorParticipant;

  challenge.status = "verdict";
  challenge.completedAt = challenge.completedAt || new Date();
  challenge.courtroomTimedOutAt = timedOutAt || challenge.courtroomTimedOutAt || null;
  challenge.courtroomTimeoutFinalizingAt = null;
  challenge.verdict = {
    ...(challenge.verdict || {}),
    winnerUserId: winnerParticipant?.userId || null,
    winner: isDraw ? "draw" : winner,
    summary,
    highlights,
    concerns,
    finalScore: {
      initiator: getChallengeScoreByLabel(challenge, "initiator"),
      challenged: getChallengeScoreByLabel(challenge, "challenged"),
    },
  };

  if (isDraw) {
    if (initiatorParticipant) initiatorParticipant.verdict = "draw";
    if (challengedParticipant) challengedParticipant.verdict = "draw";
    await Promise.all(
      (challenge.participants || []).map((participant) =>
        applyChallengeVerdictToPvpProgression({
          userId: participant.userId,
          primaryCategory: challenge.primaryCategory,
          outcome: "draw",
        })
      )
    );
    return;
  }

  if (winnerParticipant) {
    winnerParticipant.verdict = "win";
  }
  if (loserParticipant) {
    loserParticipant.verdict = "loss";
  }
  await Promise.all([
    winnerParticipant
      ? applyChallengeVerdictToPvpProgression({
          userId: winnerParticipant.userId,
          primaryCategory: challenge.primaryCategory,
          outcome: "win",
        })
      : null,
    loserParticipant
      ? applyChallengeVerdictToPvpProgression({
          userId: loserParticipant.userId,
          primaryCategory: challenge.primaryCategory,
          outcome: "loss",
        })
      : null,
  ].filter(Boolean));
};

const finalizeTimedOutChallenge = async ({ challenge, now = new Date() }) => {
  const submissions = (challenge.courtroomRounds || []).flatMap(
    (round) => round.submissions || []
  );

  if (!submissions.length) {
    await applyChallengeVerdictByLabel({
      challenge,
      winner: "draw",
      summary:
        "The court enters a draw because the courtroom deadline expired before either side filed an argument.",
      highlights: [],
      concerns: ["No courtroom arguments were filed before the response deadline."],
      timedOutAt: now,
    });
    return;
  }

  const timeoutVerdict = await runPvpCourtroomTimeoutVerdict({
    challengeContext: buildCourtroomTimeoutContext(challenge),
  });

  const initiatorAdjustment = timeoutVerdict.finalScoreAdjustment?.initiator || 0;
  const challengedAdjustment = timeoutVerdict.finalScoreAdjustment?.challenged || 0;
  const initiatorParticipant = getChallengeParticipantByLabel(challenge, "initiator");
  const challengedParticipant = getChallengeParticipantByLabel(challenge, "challenged");
  if (initiatorParticipant && initiatorAdjustment) {
    initiatorParticipant.score = (initiatorParticipant.score || 0) + initiatorAdjustment;
  }
  if (challengedParticipant && challengedAdjustment) {
    challengedParticipant.score = (challengedParticipant.score || 0) + challengedAdjustment;
  }

  await applyChallengeVerdictByLabel({
    challenge,
    winner: timeoutVerdict.winner,
    summary: timeoutVerdict.summary,
    highlights: timeoutVerdict.highlights,
    concerns: timeoutVerdict.concerns,
    timedOutAt: now,
  });
};

export const runChallengeCourtroomTimeouts = async ({ limit = 20, now = new Date() } = {}) => {
  await connectMongo();

  const finalizingStaleBefore = new Date(now.getTime() - COURTROOM_TIMEOUT_FINALIZING_STALE_MS);
  const challenges = await Challenge.find({
    status: "courtroom",
    courtroomDeadlineAt: { $lte: now },
    $or: [
      { courtroomTimeoutFinalizingAt: null },
      { courtroomTimeoutFinalizingAt: { $exists: false } },
      { courtroomTimeoutFinalizingAt: { $lte: finalizingStaleBefore } },
    ],
  })
    .sort({ courtroomDeadlineAt: 1 })
    .limit(Math.max(1, Math.min(100, Number(limit) || 20)));

  const summary = {
    scanned: challenges.length,
    finalized: 0,
    failed: 0,
    skipped: 0,
    errors: [],
  };

  for (const candidate of challenges) {
    const claimed = await Challenge.findOneAndUpdate(
      {
        _id: candidate._id,
        status: "courtroom",
        courtroomDeadlineAt: { $lte: now },
        $or: [
          { courtroomTimeoutFinalizingAt: null },
          { courtroomTimeoutFinalizingAt: { $exists: false } },
          { courtroomTimeoutFinalizingAt: { $lte: finalizingStaleBefore } },
        ],
      },
      {
        $set: {
          courtroomTimeoutStartedAt: candidate.courtroomTimeoutStartedAt || now,
          courtroomTimeoutFinalizingAt: now,
        },
      },
      { new: true }
    );

    if (!claimed) {
      summary.skipped += 1;
      continue;
    }

    try {
      await finalizeTimedOutChallenge({ challenge: claimed, now });
      markParticipantsModified(claimed);
      await claimed.save();
      summary.finalized += 1;
    } catch (error) {
      summary.failed += 1;
      summary.errors.push({
        challengeId: toObjectIdString(claimed._id),
        error: error.message || "Timeout verdict failed.",
      });
      await Challenge.updateOne(
        { _id: claimed._id, status: "courtroom" },
        { $set: { courtroomTimeoutFinalizingAt: null } }
      );
    }
  }

  return summary;
};

export const quitChallengeForUser = async ({ userId, challengeId }) => {
  const challenge = await getChallengeDocumentForUser({ userId, challengeId });
  if (!challenge) {
    return null;
  }

  const quittingParticipant = getParticipant(challenge, userId);
  const stayingParticipant = getOtherParticipant(challenge, userId);
  if (!quittingParticipant || !stayingParticipant) {
    throw new Error("Challenge participant not found.");
  }

  if (challenge.status === "verdict") {
    return buildChallengePayload({ challenge, viewerUserId: userId });
  }

  const quittingFromPrivateIntake = quittingParticipant.status !== "ready";
  const quittingFromCourtroom = challenge.status === "courtroom";
  if (
    !["active", "settlement", "courtroom"].includes(challenge.status) ||
    (!quittingFromPrivateIntake && !quittingFromCourtroom)
  ) {
    throw new Error("Only active challenges can be quit.");
  }

  const intakeForfeit = quittingFromPrivateIntake;
  const courtroomForfeit = quittingFromCourtroom;
  const baseStayingScore = stayingParticipant.score || 0;
  const stayBonus =
    intakeForfeit
      ? Math.max(12, challenge.complexity * 6, (quittingParticipant.score || 0) - baseStayingScore + 1)
      : 0;
  const quitterScore = quittingParticipant.score || 0;
  const stayingScore = baseStayingScore + stayBonus;
  const winnerParticipant = stayingParticipant;

  stayingParticipant.score = stayingScore;
  challenge.status = "verdict";
  challenge.completedAt = new Date();
  challenge.courtroomTimeoutFinalizingAt = null;
  challenge.verdict = {
    winnerUserId: winnerParticipant?.userId || null,
    winner: getParticipantLabel(challenge, winnerParticipant.userId),
    summary:
      intakeForfeit
        ? `${getPartyName(
            challenge.templateSnapshot,
            stayingParticipant.side
          )}'s counsel wins immediately by forfeit because the other player quit during intake.`
        : `${getPartyName(
            challenge.templateSnapshot,
            stayingParticipant.side
          )}'s counsel wins immediately by forfeit because the other player quit during court.`,
    finalScore: {
      initiator: isSameId(stayingParticipant.userId, challenge.initiatorId)
        ? stayingScore
        : quitterScore,
      challenged: isSameId(stayingParticipant.userId, challenge.challengedId)
        ? stayingScore
        : quitterScore,
    },
    quitByUserId: quittingParticipant.userId,
    quitAt: new Date(),
    stayBonus,
  };

  stayingParticipant.verdict = "win";
  quittingParticipant.verdict = "loss";
  await Promise.all([
    applyChallengeVerdictToPvpProgression({
      userId: stayingParticipant.userId,
      primaryCategory: challenge.primaryCategory,
      outcome: "win",
    }),
    applyChallengeVerdictToPvpProgression({
      userId: quittingParticipant.userId,
      primaryCategory: challenge.primaryCategory,
      outcome: "loss",
    }),
  ]);
  await challenge.save();

  return buildChallengePayload({ challenge, viewerUserId: userId });
};

const scoreChallengeSubmission = async ({ challenge, round, participant, submission, userId }) => {
  if (!participant || !submission || submission.judgeNotes?.benchSignal) {
    return;
  }

  const otherParticipant = getOtherParticipant(challenge, participant.userId);
  const caseSession = buildParticipantCaseSession({
    challenge,
    participant,
    otherParticipant,
  });
  const result = await runCourtroomRound({
    caseSession,
    argument: submission.text,
    userId: toObjectIdString(userId || participant.userId),
  });

  submission.citedFacts = result.citedFacts || [];
  submission.citedClaimIds = result.citedClaimIds || [];
  submission.citedEvidenceIds = result.citedEvidenceIds || [];
  submission.citedRules = result.citedRules || [];
  submission.judgeNotes = {
    playerDelta: result.playerDelta || 0,
    opponentDelta: result.opponentDelta || 0,
    strengths: result.strengths || [],
    weaknesses: result.weaknesses || [],
    benchSignal: result.benchSignal || "",
  };
  participant.score = (participant.score || 0) + (result.playerDelta || 0);
  round.benchSummary = result.benchSignal || summarizeScoredRound(round);
  markParticipantsModified(challenge);
  markCourtroomRoundsModified(challenge);
};

const closeRoundIfReady = async ({
  challenge,
  round,
  allowAutomaticAdjournment = false,
  userId = "",
}) => {
  if ((round.submissions || []).length < challenge.participants.length) {
    return;
  }

  round.status = "judged";
  round.judgedAt = new Date();
  round.benchSummary = round.benchSummary || summarizeScoredRound(round);
  markCourtroomRoundsModified(challenge);

  if (
    allowAutomaticAdjournment &&
    (challenge.courtroomRounds || []).filter((item) => item.status === "judged").length <
      challenge.maxCourtRounds &&
    getAdjournmentRemaining(challenge.adjournment, challenge.complexity) > 0
  ) {
    const participant = getParticipant(challenge, userId) || challenge.participants?.[0];
    const otherParticipant = getOtherParticipant(challenge, participant?.userId);
    const caseSession = buildParticipantCaseSession({
      challenge,
      participant,
      otherParticipant,
    });
    const ruling = await evaluateCourtAdjournment({
      caseSession,
      userId: toObjectIdString(userId || participant?.userId),
      requested: false,
    });

    if (ruling.granted) {
      recordAdjournmentDecision({
        source: challenge,
        trigger: "judge",
        courtroomRound: round.round,
        reason: ruling.curableGap,
        ruling: ruling.ruling,
        granted: true,
      });
      pauseChallengeForAdjournment(challenge);
      return;
    }
  }

  await finalizeChallengeIfComplete(challenge);
  appendOpenRoundIfNeeded(challenge);
};

const backfillChallengeCourtroomScores = async (challenge) => {
  if (!challenge || !["courtroom", "verdict"].includes(challenge.status)) {
    return false;
  }

  let changed = false;

  for (const round of challenge.courtroomRounds || []) {
    for (const submission of round.submissions || []) {
      if (submission.judgeNotes?.benchSignal) {
        continue;
      }

      const participant = getParticipant(challenge, submission.userId);
      if (!participant) {
        continue;
      }

      await scoreChallengeSubmission({
        challenge,
        round,
        participant,
        submission,
        userId: submission.userId,
      });
      changed = true;
    }

    const wasOpen = round.status === "open";
    await closeRoundIfReady({ challenge, round });
    if (wasOpen && round.status === "judged") {
      changed = true;
    }
  }

  return changed;
};

export const submitChallengeCourtroomArgument = async ({
  userId,
  challengeId,
  argument,
}) => {
  const challenge = await getChallengeDocumentForUser({ userId, challengeId });
  if (!challenge) {
    return null;
  }
  if (challenge.status !== "courtroom") {
    throw new Error("This challenge is not in courtroom rounds.");
  }
  if (
    challenge.courtroomDeadlineAt &&
    new Date(challenge.courtroomDeadlineAt).getTime() <= Date.now()
  ) {
    throw new Error("The response window expired. The court is preparing a timeout verdict.");
  }

  appendOpenRoundIfNeeded(challenge);
  const participant = getParticipant(challenge, userId);
  const round = getOpenRound(challenge);

  if (!participant || !round) {
    throw new Error("No open courtroom round is available.");
  }
  if (participant.status !== "ready") {
    throw new Error("Finalize your fact sheet before filing in court.");
  }
  if (getSubmissionForParticipant(round, participant)) {
    throw new Error("You already submitted for this round.");
  }
  const lastSubmission = getLastCourtroomSubmission(challenge);
  if (lastSubmission && isSameId(lastSubmission.userId, participant.userId)) {
    throw new Error("Wait for the other player's response before filing again.");
  }
  const plaintiffHasFiledOpening = (round.submissions || []).some(
    (submission) => submission.side === "client"
  );
  if (participant.side === "opponent" && round.round === 1 && !plaintiffHasFiledOpening) {
    throw new Error("Wait for the plaintiff's opening statement before responding.");
  }

  const submission = {
    userId: participant.userId,
    side: participant.side,
    text: argument,
    submittedAt: new Date(),
  };

  round.submissions.push(submission);
  markCourtroomRoundsModified(challenge);
  const savedSubmission = getSubmissionForParticipant(round, participant) || submission;

  await scoreChallengeSubmission({
    challenge,
    round,
    participant,
    submission: savedSubmission,
    userId,
  });
  await closeRoundIfReady({
    challenge,
    round,
    allowAutomaticAdjournment: true,
    userId,
  });
  if (challenge.status === "courtroom") {
    resetChallengeCourtroomTimer(challenge);
  }
  await challenge.save();

  return buildChallengePayload({ challenge, viewerUserId: userId });
};

export const requestChallengeAdjournment = async ({
  userId,
  challengeId,
  reason,
}) => {
  const challenge = await getChallengeDocumentForUser({ userId, challengeId });
  if (!challenge) return null;
  if (challenge.status !== "courtroom" || challenge.adjournment?.active) {
    const error = new Error(
      "An adjournment may only be requested while court is in session."
    );
    error.status = 400;
    throw error;
  }

  const participant = getParticipant(challenge, userId);
  const otherParticipant = getOtherParticipant(challenge, userId);
  const round = getOpenRound(challenge);
  if (!participant || !round || participant.status !== "ready") {
    const error = new Error(
      "No courtroom round is available for an adjournment request."
    );
    error.status = 400;
    throw error;
  }
  if (getSubmissionForParticipant(round, participant)) {
    const error = new Error(
      "You already filed your substantive argument this round."
    );
    error.status = 409;
    throw error;
  }

  const courtroomRound = getAdjournmentRound(challenge);
  if (
    hasAdjournmentRequestForRound({
      adjournment: challenge.adjournment,
      round: courtroomRound,
      requestedByUserId: userId,
    })
  ) {
    const error = new Error("You already requested an adjournment this round.");
    error.status = 409;
    throw error;
  }

  const caseSession = buildParticipantCaseSession({
    challenge,
    participant,
    otherParticipant,
  });
  const decision = await evaluateCourtAdjournment({
    caseSession,
    userId,
    reason,
    requested: true,
  });
  recordAdjournmentDecision({
    source: challenge,
    trigger: "player_request",
    requestedByUserId: userId,
    courtroomRound,
    reason,
    ruling: decision.ruling,
    granted: decision.granted,
  });

  if (decision.granted) pauseChallengeForAdjournment(challenge);
  try {
    await challenge.save();
  } catch (error) {
    if (!isMongooseVersionConflict(error)) throw error;
    const conflict = new Error(
      "The courtroom changed while the judge was considering the request. Refresh before requesting again."
    );
    conflict.status = 409;
    throw conflict;
  }

  return {
    challenge: await buildChallengePayload({ challenge, viewerUserId: userId }),
    adjournmentRuling: {
      granted: decision.granted,
      ruling: decision.ruling,
      curableGap: decision.curableGap,
    },
  };
};

export const buildChallengePayload = async ({ challenge, viewerUserId }) => {
  const privateCurrentEventProvenance =
    challenge?.currentEventProvenance || null;
  const plainChallenge = toPlain(challenge);
  delete plainChallenge.currentEventProvenance;
  const publicChallenge = {
    ...plainChallenge,
    participants: (plainChallenge.participants || []).map((participant) => {
      const { clientMemory, settlementAssistant, ...publicParticipant } = participant;
      return publicParticipant;
    }),
  };
  const participant = getParticipant(plainChallenge, viewerUserId);
  const otherParticipant = getOtherParticipant(plainChallenge, viewerUserId);
  const usersById = await userMapForChallenge(plainChallenge);
  const viewerUser = usersById.get(toObjectIdString(viewerUserId));
  const opponentUser = usersById.get(toObjectIdString(otherParticipant?.userId));
  const initiatorUser = usersById.get(toObjectIdString(plainChallenge.initiatorId));
  const challengedUser = usersById.get(toObjectIdString(plainChallenge.challengedId));
  const slug =
    plainChallenge.slug ||
    buildChallengeSlug(plainChallenge.title, plainChallenge.id || plainChallenge._id);
  const viewerInterviewSubject =
    participant && plainChallenge.templateSnapshot
      ? buildInterviewSubjectForSide(
          plainChallenge.templateSnapshot,
          participant.side === "opponent" ? "defendant" : "plaintiff"
        )
      : null;
  const opponentInterviewSubject =
    otherParticipant && plainChallenge.templateSnapshot
      ? buildInterviewSubjectForSide(
          plainChallenge.templateSnapshot,
          otherParticipant.side === "opponent" ? "defendant" : "plaintiff"
        )
      : null;

  const rounds = (plainChallenge.courtroomRounds || []).map((round) => {
    const viewerSubmitted = participant
      ? Boolean(getSubmissionForParticipant(round, participant))
      : false;
    return {
      round: round.round,
      status: round.status,
      benchSummary: round.benchSummary || "",
      judgedAt: round.judgedAt,
      viewerSubmitted,
      submissions: (round.submissions || [])
        .map((submission) => ({
            ...submission,
            userId: toObjectIdString(submission.userId),
            isViewer: isSameId(submission.userId, viewerUserId),
            playerName: getPlayerDisplayName(
              usersById.get(toObjectIdString(submission.userId))
            ),
          })),
      pendingSubmissionCount:
        round.status === "open" ? (round.submissions || []).length : 0,
    };
  });
  const settlement = plainChallenge.settlement || {};
  const proposedByUserId = toObjectIdString(settlement.proposedByUserId);
  const intentSenderUserId = toObjectIdString(
    settlement.intentSenderUserId || settlement.proposedByUserId
  );
  const fallbackIntentReceiver = intentSenderUserId
    ? (plainChallenge.participants || []).find(
        (challengeParticipant) => !isSameId(challengeParticipant.userId, intentSenderUserId)
      )
    : null;
  const intentReceiverUserId = toObjectIdString(
    settlement.intentReceiverUserId || fallbackIntentReceiver?.userId
  );
  const intentPending = hasPendingSettlementIntent(settlement);
  const intentStatus =
    settlement.intentStatus || (settlement.status === "proposed" ? "pending" : "none");
  const intentSentByViewer =
    intentPending && intentSenderUserId && isSameId(intentSenderUserId, viewerUserId);
  const intentReceivedByViewer =
    intentPending && intentSenderUserId && !isSameId(intentSenderUserId, viewerUserId);
  const settlementTranscript = (settlement.transcript || []).map((entry) => ({
    ...entry,
    userId: toObjectIdString(entry.userId),
    isViewer:
      entry.role === "player"
        ? !entry.userId || isSameId(entry.userId, viewerUserId)
        : entry.side
        ? participant?.side === entry.side
        : false,
  }));
  const latestSettlementPlayerMessage = [...settlementTranscript]
    .reverse()
    .find((entry) => entry?.role === "player" && entry?.userId);
  const getTermsFromSettlementMessage = (entry) => {
    const storedTerms = coerceSettlementProposalTerms(entry?.terms || []);
    if (storedTerms.length) {
      return storedTerms;
    }

    return extractSettlementTermsFromMessage(entry?.text || "");
  };
  const latestOpponentSettlementTerms =
    getTermsFromSettlementMessage(
      [...settlementTranscript]
        .reverse()
        .find(
          (entry) =>
            entry?.role === "player" &&
            entry?.userId &&
            !isSameId(entry.userId, viewerUserId)
        )
    ) || [];
  const latestViewerSettlementTerms =
    getTermsFromSettlementMessage(
      [...settlementTranscript]
        .reverse()
        .find(
          (entry) =>
            entry?.role === "player" &&
            entry?.userId &&
            isSameId(entry.userId, viewerUserId)
        )
    ) || [];
  const derivedCurrentTerms = latestSettlementPlayerMessage
    ? flattenSettlementProposalTerms(getTermsFromSettlementMessage(latestSettlementPlayerMessage))
    : [];
  const settlementAccepted = Boolean(
    settlement.accepted ||
      settlement.resolution === "settled" ||
      settlement.status === "settled" ||
      plainChallenge.status === "settled"
  );
  const settlementFailed = Boolean(
    !settlementAccepted &&
      (settlement.resolution === "failed" || settlement.status === "failed")
  );
  const settlementResolved = Boolean(
    settlement.resolved ||
      settlementAccepted ||
      settlementFailed ||
      settlement.resolution ||
      settlement.completedAt ||
      settlement.status === "failed"
  );
  const settlementTerminal = Boolean(
    settlementResolved || settlement.endedNegotiations || plainChallenge.status === "settled"
  );
  const settlementFailedShouldReturnToIntake = Boolean(
    settlementFailed && publicChallenge.status === "settlement"
  );
  const payloadStatus =
    publicChallenge.status === "verdict"
      ? "verdict"
      : settlementAccepted
      ? "settled"
      : settlementFailedShouldReturnToIntake
      ? "active"
      : publicChallenge.status;
  const currentEventResolved = ["verdict", "settled"].includes(payloadStatus);
  const endedByUserId = toObjectIdString(settlement.endedByUserId);
  const latestNegotiationMessageUserId = toObjectIdString(
    settlementTerminal
      ? ""
      : settlement.latestNegotiationMessageUserId || latestSettlementPlayerMessage?.userId
  );
  const awaitingNegotiationResponseUserId = toObjectIdString(
    settlementTerminal
      ? ""
      : settlement.awaitingNegotiationResponseUserId || latestNegotiationMessageUserId
  );
  const negotiationTurnUserId = toObjectIdString(
    settlementTerminal
      ? ""
      : settlement.negotiationTurnUserId ||
      (latestNegotiationMessageUserId
        ? (plainChallenge.participants || []).find(
            (challengeParticipant) =>
              !isSameId(challengeParticipant.userId, latestNegotiationMessageUserId)
          )?.userId
        : "")
  );
  const awaitingNegotiationResponse = Boolean(
    (settlement.status || "") === "active" &&
      awaitingNegotiationResponseUserId &&
      isSameId(awaitingNegotiationResponseUserId, viewerUserId)
  );
  const receivedNegotiationMessage = Boolean(
    (settlement.status || "") === "active" &&
      negotiationTurnUserId &&
      isSameId(negotiationTurnUserId, viewerUserId)
  );

  return {
    ...publicChallenge,
    status: payloadStatus,
    currentEventInspiration:
      currentEventResolved && privateCurrentEventProvenance
        ? buildPublicCurrentEventInspiration(privateCurrentEventProvenance)
        : null,
    id: plainChallenge.id || toObjectIdString(plainChallenge._id),
    slug,
    viewer: participant
      ? {
          userId: toObjectIdString(participant.userId),
          name: getPlayerDisplayName(viewerUser),
          image: viewerUser?.image || "",
          side: participant.side,
          status: participant.status,
          score: participant.score || 0,
          verdict: participant.verdict || "",
          factSheet: participant.factSheet,
          caseAssessment: participant.caseAssessment,
          interviewTranscript: participant.interviewTranscript || [],
          readyAt: participant.readyAt,
          clientPortrait: getStableChallengePortrait({
            challenge: plainChallenge,
            participant,
          }),
          partyName: getPartyName(plainChallenge.templateSnapshot, participant.side),
          clientMemoryExcerpt: participant.clientMemoryExcerpt || "",
          settlementAssistant: participant.settlementAssistant || null,
          interviewSubjectName:
            viewerInterviewSubject?.name ||
            getPartyName(plainChallenge.templateSnapshot, participant.side),
          interviewSubjectRole: viewerInterviewSubject?.role || "",
          objective: buildDesiredReliefForSide(
            plainChallenge.templateSnapshot,
            participant.side
          ),
        }
      : null,
    opponent: otherParticipant
      ? {
          userId: toObjectIdString(otherParticipant.userId),
          name: getPlayerDisplayName(opponentUser),
          image: opponentUser?.image || "",
          side: otherParticipant.side,
          status: otherParticipant.status,
          score: otherParticipant.score || 0,
          verdict: otherParticipant.verdict || "",
          readyAt: otherParticipant.readyAt,
          clientPortrait: getStableChallengePortrait({
            challenge: plainChallenge,
            participant: otherParticipant,
          }),
          partyName: getPartyName(plainChallenge.templateSnapshot, otherParticipant.side),
          interviewSubjectName:
            opponentInterviewSubject?.name ||
            getPartyName(plainChallenge.templateSnapshot, otherParticipant.side),
          interviewSubjectRole: opponentInterviewSubject?.role || "",
        }
      : null,
    initiator: {
      userId: toObjectIdString(plainChallenge.initiatorId),
      name: getPlayerDisplayName(initiatorUser),
    },
    challenged: {
      userId: toObjectIdString(plainChallenge.challengedId),
      name: getPlayerDisplayName(challengedUser),
    },
    courtroomRounds: rounds,
    settlement: {
      status: settlementAccepted ? "settled" : settlement.status || "none",
      moods: settlement.moods || { player: 0, opponent: 0 },
      transcript: settlementTranscript,
      currentTerms: derivedCurrentTerms,
      latestOpponentTerms: latestOpponentSettlementTerms,
      latestViewerTerms: latestViewerSettlementTerms,
      finalTerms: settlement.finalTerms || [],
      resolved: settlementResolved,
      resolution:
        settlementAccepted
          ? "settled"
          : settlement.resolution || (settlement.status === "failed" ? "failed" : ""),
      resolvedAt: settlement.resolvedAt || settlement.completedAt || null,
      accepted: settlementAccepted,
      acceptedAt: settlement.acceptedAt || settlement.completedAt || null,
      acceptedByUserId: toObjectIdString(settlement.acceptedByUserId),
      acceptedBySide: settlement.acceptedBySide || "",
      intentPending,
      intentStatus,
      intentSenderUserId,
      intentSenderSide: settlement.intentSenderSide || settlement.proposedBySide || "",
      intentReceiverUserId,
      intentReceiverSide: settlement.intentReceiverSide || fallbackIntentReceiver?.side || "",
      intentMessage: settlement.intentMessage || settlement.proposalMessage || "",
      intentSentAt: settlement.intentSentAt || settlement.proposedAt || null,
      intentResponse: settlement.intentResponse || "",
      intentRespondedAt: settlement.intentRespondedAt || null,
      intentSentByViewer,
      intentReceivedByViewer,
      awaitingSettlementResponse: intentSentByViewer,
      receivedSettlementIntent: intentReceivedByViewer,
      awaitingNegotiationResponse,
      receivedNegotiationMessage,
      latestNegotiationMessageByViewer: awaitingNegotiationResponse,
      latestNegotiationMessageUserId,
      awaitingNegotiationResponseUserId,
      negotiationTurnUserId,
      latestNegotiationMessageAt: settlement.latestNegotiationMessageAt || null,
      proposedByUserId,
      proposedBySide: settlement.proposedBySide || "",
      proposedByViewer: proposedByUserId ? isSameId(proposedByUserId, viewerUserId) : false,
      proposedByName: proposedByUserId
        ? getPlayerDisplayName(usersById.get(proposedByUserId))
        : "",
      proposalMessage: settlement.proposalMessage || "",
      proposedAt: settlement.proposedAt || null,
      outcomeSummary: settlement.outcomeSummary || "",
      failureReason: settlement.failureReason || "",
      endedNegotiations: Boolean(settlement.endedNegotiations),
      endedByUserId,
      endedBySide: settlement.endedBySide || "",
      endedByViewer: endedByUserId ? isSameId(endedByUserId, viewerUserId) : false,
      endedByOther: endedByUserId ? !isSameId(endedByUserId, viewerUserId) : false,
      endedAt: settlement.endedAt || null,
      rejectionCount: settlement.rejectionCount || 0,
      cooldownUntil: settlement.cooldownUntil || null,
      startedAt: settlement.startedAt || null,
      completedAt: settlement.completedAt || null,
    },
    lawbook: getLawbookRules(),
  };
};
