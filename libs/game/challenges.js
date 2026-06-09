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
  buildConversationFactSheetFallback,
  continueInterview,
  ensureClientMemory,
  finalizeFactSheetInput,
  lockAssessmentForCourt,
  runCourtroomRound,
} from "./engine";
import {
  buildDesiredReliefForSide,
  buildOverviewForSide,
  buildSummaryForSide,
  buildTheoryForSide,
  getOpposingSide,
  getPartyName,
  mergeFactSheet,
  normalizeFactSheetPatch,
  uniqueList,
} from "./engine/shared";
import { applyChallengeVerdictToPvpProgression, ensureUserProfile } from "./progression";
import { listScenarioOptions } from "./store";
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
import { buildSafeClientMemoryExcerpt } from "./clientMemory";

const MONGO_ID_PATTERN = /^[a-f0-9]{24}$/i;
const CHALLENGE_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000;

const toPlain = (doc) => (doc?.toJSON ? doc.toJSON() : doc);
const toObjectIdString = (value) => String(value?._id || value?.id || value || "");
const isSameId = (left, right) => toObjectIdString(left) === toObjectIdString(right);

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

const applyClientMemoryOpeningToParticipant = (challenge, participant, clientMemory) => {
  const opening = buildSafeClientMemoryExcerpt({
    clientMemory,
    partyName: getPartyName(templateForChallenge(challenge), participant?.side),
    playerSide: participant?.side,
    fallback: "",
    maxLength: 420,
    maxSentences: 4,
  });

  if (!participant || !opening) {
    return false;
  }

  const transcript = participant.interviewTranscript || [];
  const firstPartyEntry = transcript.find((entry) => entry?.role === "party" || entry?.role === "client");
  const previousOpening = firstPartyEntry?.text || "";

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
    participant.factSheet = factSheet;
  }

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

const blankFactSheet = (template, side, openingStatement = "") => ({
  summary: uniqueTextList([buildSummaryForSide(template, side)]),
  timeline: [],
  supportingFacts: uniqueTextList([
    buildOverviewForSide(template, side),
    openingStatement,
  ]),
  risks: [],
  theory: uniqueTextList([buildTheoryForSide(template, side)]),
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

const buildTranscriptBackfillPatch = (transcript = []) => {
  const patch = {
    summary: [],
    theory: [],
    desiredRelief: [],
    timeline: [],
    supportingFacts: [],
    risks: [],
    knownFacts: [],
    knownClaims: [],
    disputedFacts: [],
    corroboratedFacts: [],
    sourceLinks: [],
    missingEvidence: [],
    openQuestions: [],
    discoveredFactIds: [],
    discoveredClaimIds: [],
    discoveredEvidenceIds: [],
  };
  const patchFields = Object.keys(patch);

  for (let index = 0; index < transcript.length; index += 1) {
    const entry = transcript[index];
    if (entry?.role !== "party") {
      continue;
    }

    const previousQuestion =
      transcript[index - 1]?.role === "player" ? transcript[index - 1]?.text || "" : "";
    const answer = String(entry.text || "").trim();
    if (!answer) {
      continue;
    }

    const exchangePatch = buildConversationFactSheetFallback({
      latestQuestion: previousQuestion,
      latestAnswer: answer,
    });

    patchFields.forEach((field) => {
      if (exchangePatch[field]?.length) {
        patch[field].push(...exchangePatch[field]);
      }
    });
  }

  return normalizeFactSheetPatch(patch);
};

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

  const plaintiffParticipant = (challenge.participants || []).find(
    (participant) => participant.side === "client"
  );
  const plaintiffReady =
    plaintiffParticipant?.status === "ready" ||
    Boolean(plaintiffParticipant?.factSheet?.ready);

  if (!plaintiffReady) {
    return false;
  }

  challenge.status = "courtroom";
  appendOpenRoundIfNeeded(challenge);
  return true;
};

const normalizeChallengeForRead = (challenge) => {
  let changed = false;

  changed = ensureChallengeSlug(challenge) || changed;
  changed = updateExpiredChallenge(challenge) || changed;
  changed = seedChallengeFactSheetsIfNeeded(challenge) || changed;
  changed = backfillChallengeFactSheetsFromTranscript(challenge) || changed;
  changed = advanceChallengeToCourtIfPlaintiffReady(challenge) || changed;

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

const setParticipantClientMemory = (challenge, participant, clientMemory) => {
  if (typeof participant?.set === "function") {
    participant.set("clientMemory", clientMemory);
  } else if (participant) {
    participant.clientMemory = clientMemory;
  }

  applyClientMemoryOpeningToParticipant(challenge, participant, clientMemory);
  markParticipantsModified(challenge);
};

const userMapForChallenge = async (challenge) => {
  const userIds = [
    challenge.initiatorId,
    challenge.challengedId,
    ...(challenge.participants || []).map((participant) => participant.userId),
  ].map(toObjectIdString);
  const users = await User.find({ _id: { $in: [...new Set(userIds)] } }).select(
    "name email image progression"
  );
  return new Map(users.map((user) => [String(user._id), user]));
};

const getPlayerDisplayName = (user) =>
  user?.name || user?.email?.split("@")[0] || "Counsel";

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
    complexity: challenge.complexity,
    playerSide: participant.side,
    status: challenge.status === "courtroom" ? "courtroom" : "interview",
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
    setParticipantClientMemory(challenge, participant, result.clientMemory);
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

  const availableTemplates = await listScenarioOptions(initiatorId, initiatorProfile);
  const selectedTemplate = availableTemplates.find(
    (template) => isSameId(template.id, caseTemplateId) && template.unlocked
  );

  if (!selectedTemplate) {
    throw new Error("Choose an unlocked case before sending a challenge.");
  }

  const templateDocument = await CaseTemplate.findOne({
    _id: caseTemplateId,
    status: "active",
  });

  if (!templateDocument) {
    throw new Error("Case template not found.");
  }

  const template = enrichTemplateForGameplay(toPlain(templateDocument));
  const templateSnapshot = buildSessionTemplateSnapshot(template);
  const canonicalStory = getCanonicalStoryWorld(template);
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
    caseTemplateId: templateDocument._id,
    templateSlug: template.slug,
    practiceArea: template.practiceArea,
    primaryCategory: template.primaryCategory,
    complexity: template.complexity,
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
  const initiatorParticipant = getParticipant(challenge, initiator._id);
  await ensureParticipantClientMemory({
    challenge,
    participant: initiatorParticipant,
    otherParticipant: getOtherParticipant(challenge, initiator._id),
    userId: initiator._id,
  });
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
    await Promise.all(dirtyChallenges.map((challenge) => challenge.save()));
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
  if (changed) {
    await challenge.save();
  }

  return buildChallengePayload({ challenge, viewerUserId: userId });
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
    await challenge.save();
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

  const caseSession = buildParticipantCaseSession({
    challenge,
    participant,
    otherParticipant,
  });
  const result = await continueInterview({ caseSession, question, userId });

  if (result.clientMemory) {
    setParticipantClientMemory(challenge, participant, result.clientMemory);
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
  if (result.caseAssessment) {
    setParticipantCaseAssessment(challenge, participant, result.caseAssessment);
  }

  await challenge.save();
  return buildChallengePayload({ challenge, viewerUserId: userId });
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

  const allReady = challenge.participants.every((item) => item.status === "ready");
  const plaintiffReady = participant.side === "client";
  if (allReady || plaintiffReady) {
    challenge.status = "courtroom";
    appendOpenRoundIfNeeded(challenge);
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

export const quitChallengeForUser = async ({ userId, challengeId }) => {
  const challenge = await getChallengeDocumentForUser({ userId, challengeId });
  if (!challenge) {
    return null;
  }
  if (!["active", "courtroom"].includes(challenge.status)) {
    throw new Error("Only active challenges can be quit.");
  }

  const quittingParticipant = getParticipant(challenge, userId);
  const stayingParticipant = getOtherParticipant(challenge, userId);
  if (!quittingParticipant || !stayingParticipant) {
    throw new Error("Challenge participant not found.");
  }

  const judgedRounds = (challenge.courtroomRounds || []).filter(
    (round) => round.status === "judged"
  );
  const stayBonus =
    judgedRounds.length === 0
      ? Math.max(12, challenge.complexity * 6)
      : Math.max(8, challenge.complexity * 3 + judgedRounds.length * 2);
  const quitterScore = quittingParticipant.score || 0;
  const stayingScore = (stayingParticipant.score || 0) + stayBonus;
  const isDraw = judgedRounds.length > 0 && stayingScore === quitterScore;
  const winnerParticipant = isDraw
    ? null
    : stayingScore > quitterScore
    ? stayingParticipant
    : quittingParticipant;

  stayingParticipant.score = stayingScore;
  challenge.status = "verdict";
  challenge.completedAt = new Date();
  challenge.verdict = {
    winnerUserId: winnerParticipant?.userId || null,
    winner: isDraw ? "draw" : getParticipantLabel(challenge, winnerParticipant.userId),
    summary:
      judgedRounds.length === 0
        ? `${getPartyName(
            challenge.templateSnapshot,
            stayingParticipant.side
          )}'s counsel wins by forfeit because the other player quit before court.`
        : `One player quit before the challenge was complete. The court still considered the judged rounds so far, then awarded a staying bonus for the player who remained available.`,
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

  await applyResolvedChallengeProgression({
    challenge,
    left: challenge.participants[0],
    right: challenge.participants[1],
  });
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

const closeRoundIfReady = async ({ challenge, round }) => {
  if ((round.submissions || []).length < challenge.participants.length) {
    return;
  }

  round.status = "judged";
  round.judgedAt = new Date();
  round.benchSummary = round.benchSummary || summarizeScoredRound(round);
  markCourtroomRoundsModified(challenge);
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
  await closeRoundIfReady({ challenge, round });
  await challenge.save();

  return buildChallengePayload({ challenge, viewerUserId: userId });
};

export const buildChallengePayload = async ({ challenge, viewerUserId }) => {
  const plainChallenge = toPlain(challenge);
  const publicChallenge = {
    ...plainChallenge,
    participants: (plainChallenge.participants || []).map((participant) => {
      const { clientMemory, ...publicParticipant } = participant;
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

  return {
    ...publicChallenge,
    id: plainChallenge.id || toObjectIdString(plainChallenge._id),
    slug,
    viewer: participant
      ? {
          userId: toObjectIdString(participant.userId),
          name: getPlayerDisplayName(viewerUser),
          side: participant.side,
          status: participant.status,
          score: participant.score || 0,
          verdict: participant.verdict || "",
          factSheet: participant.factSheet,
          caseAssessment: participant.caseAssessment,
          interviewTranscript: participant.interviewTranscript || [],
          readyAt: participant.readyAt,
          partyName: getPartyName(plainChallenge.templateSnapshot, participant.side),
          clientMemoryExcerpt: buildSafeClientMemoryExcerpt({
            clientMemory: participant.clientMemory,
            partyName: getPartyName(plainChallenge.templateSnapshot, participant.side),
            playerSide: participant.side,
            fallback: "",
            maxLength: 520,
            maxSentences: 4,
          }),
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
          side: otherParticipant.side,
          status: otherParticipant.status,
          score: otherParticipant.score || 0,
          verdict: otherParticipant.verdict || "",
          readyAt: otherParticipant.readyAt,
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
    lawbook: getLawbookRules(),
  };
};
