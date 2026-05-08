import "server-only";

import connectMongo from "@/libs/mongoose";
import CaseSession from "@/models/CaseSession";
import CaseTemplate from "@/models/CaseTemplate";
import User from "@/models/User";
import { LAWBOOK_VERSION, getLawbookRules } from "@/data/legalArenaLawbook";
import { listCategoryOptions } from "./templates";
import {
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
  buildPublicLeaderboardEntry,
  ensureUserProfile,
  getEligibleComplexityForCategory,
  normalizeProgression,
} from "./progression";
import { DEFAULT_CATEGORY_SLUG } from "./categories";
import { ensureStoredLawyerProfileSummary } from "./profileSummary";

const toPlain = (doc) => (doc?.toJSON ? doc.toJSON() : doc);
const CASE_EXIT_COOLDOWN_MS = 24 * 60 * 60 * 1000;
const DEFAULT_PLAYER_SIDE = "client";
const OPPOSING_SIDE = {
  client: "opponent",
  opponent: "client",
};
const MONGO_ID_PATTERN = /^[a-f0-9]{24}$/i;

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

  return `${template.opponentName} should prevail because the record leaves enough dispute, credibility pressure, or proof gaps to defeat ${template.clientName}'s request for relief.`;
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

export const buildPlaintiffCourtOpeningStatement = (templateInput = {}) => {
  const template = toPlain(templateInput) || {};
  const plaintiffName = template.clientName || template.plaintiffName || "Plaintiff";
  const defendantName = template.opponentName || template.defendantName || "Defendant";
  const requestedRelief = String(template.desiredRelief || "").trim();
  const theory = String(template.starterTheory || template.overview || "").trim();
  const prioritizedFacts = (template.canonicalFacts || [])
    .slice()
    .sort(
      (left, right) =>
        (right.discoverability?.priority || 0) - (left.discoverability?.priority || 0)
    );
  const supportingClaims = prioritizedFacts
    .map((fact) =>
      (fact.claims || []).find((item) => item.party === "plaintiff")?.claimedDetail ||
      fact.canonicalDetail ||
      ""
    )
    .map(cleanPartyClaimText)
    .filter(Boolean)
    .slice(0, 2);

  return [
    `May it please the Court. I represent ${plaintiffName}.`,
    theory || `${plaintiffName} brings this claim against ${defendantName}.`,
    ...supportingClaims.map((claim) => `The evidence will show that ${claim}`),
    requestedRelief ? `${plaintiffName} asks the Court for ${requestedRelief}` : "",
  ]
    .filter(Boolean)
    .join("\n");
};

const getTemplateSlugFromSession = (caseSession) =>
  caseSession.templateSlug || caseSession.scenarioId || "";

const formatCooldownEndsAt = (value) =>
  value.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

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

const getActiveExitCooldowns = async (userId) => {
  const threshold = new Date(Date.now() - CASE_EXIT_COOLDOWN_MS);
  const exitedSessions = await CaseSession.find({
    userId,
    status: "exited",
    exitedAt: { $gte: threshold },
  })
    .select("caseTemplateId exitedAt")
    .sort({ exitedAt: -1 });

  const cooldowns = new Map();

  exitedSessions.forEach((session) => {
    const templateId = String(session.caseTemplateId);
    const cooldownEndsAt = new Date(
      new Date(session.exitedAt).getTime() + CASE_EXIT_COOLDOWN_MS
    );
    const current = cooldowns.get(templateId);

    if (!current || cooldownEndsAt > current) {
      cooldowns.set(templateId, cooldownEndsAt);
    }
  });

  return cooldowns;
};

const getActiveCompletedCooldowns = async (userId) => {
  const completedSessions = await CaseSession.find({
    userId,
    status: "verdict",
  })
    .select("caseTemplateId")
    .sort({ updatedAt: -1 });

  const completedTemplateLocks = new Map();

  completedSessions.forEach((session) => {
    const templateId = String(session.caseTemplateId);

    if (templateId) {
      completedTemplateLocks.set(templateId, true);
    }
  });

  return completedTemplateLocks;
};

const getTemplateAvailability = ({
  template,
  progression,
  exitCooldownEndsAt = null,
  completionCooldownEndsAt = null,
}) => {
  const eligibleComplexity = getEligibleComplexityForCategory(
    progression,
    template.primaryCategory
  );
  const now = new Date();
  const exitCooldownActive = exitCooldownEndsAt && exitCooldownEndsAt > now;
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

  if (exitCooldownActive) {
    return {
      visible: true,
      unlocked: unlockedByProgression && !exitCooldownActive,
      cooldownEndsAt: exitCooldownEndsAt,
      unlockReason: "Available again soon.",
      blockReason: `This case is on cooldown until ${formatCooldownEndsAt(
        exitCooldownEndsAt
      )}.`,
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
  exitCooldownEndsAt = null,
  completionCooldownEndsAt = null,
}) => {
  const availability = getTemplateAvailability({
    template,
    progression,
    exitCooldownEndsAt,
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

  return {
    ...plainCase,
    slug:
      plainCase.slug ||
      buildCaseSessionSlug(plainCase.title, plainCase.id || plainCase._id || ""),
    playerSide,
    opponentSide,
    playerSideLabel,
    opponentSideLabel,
    playerPartyName,
    opponentPartyName,
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
    lawbook: getLawbookRules(template?.legalTags || []),
  };
};

export const listScenarioOptions = async (userId, userProfile = null) => {
  await connectMongo();

  const user = await ensureUserProfile(userId, userProfile);
  const progression = normalizeProgression(user?.progression);
  const [templates, exitCooldowns, completedCooldowns] = await Promise.all([
    CaseTemplate.find({ status: "active" }).sort({
      primaryCategory: 1,
      complexity: 1,
      createdAt: -1,
    }),
    getActiveExitCooldowns(userId),
    getActiveCompletedCooldowns(userId),
  ]);

  return templates.flatMap((templateDocument) => {
    const template = toPlain(templateDocument);
    const availability = getTemplateAvailability({
      template,
      progression,
      exitCooldownEndsAt: exitCooldowns.get(String(templateDocument._id)) || null,
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
        exitCooldownEndsAt: exitCooldowns.get(String(templateDocument._id)) || null,
        completionCooldownEndsAt:
          completedCooldowns.get(String(templateDocument._id)) || null,
      }),
    ];
  });
};

export const createCaseSession = async ({ userId, userProfile = null, caseTemplateId }) => {
  await connectMongo();

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
  const [exitCooldowns, completedCooldowns] = await Promise.all([
    getActiveExitCooldowns(userId),
    getActiveCompletedCooldowns(userId),
  ]);
  const availability = getTemplateAvailability({
    template,
    progression,
    exitCooldownEndsAt: exitCooldowns.get(String(templateDocument._id)) || null,
    completionCooldownEndsAt:
      completedCooldowns.get(String(templateDocument._id)) || null,
  });
  const playerSide = Math.random() < 0.5 ? "client" : "opponent";
  const openingStatement = buildOpeningStatementForSide(template, playerSide);

  if (!availability.unlocked) {
    throw new Error(availability.blockReason);
  }

  const caseSession = new CaseSession({
    userId,
    title: template.title,
    caseTemplateId: templateDocument._id,
    templateSlug: template.slug,
    scenarioId: template.slug,
    practiceArea: template.practiceArea,
    primaryCategory: template.primaryCategory,
    complexity: template.complexity,
    playerSide,
    status: "interview",
    lawbookVersion: LAWBOOK_VERSION,
    maxCourtRounds: Math.max(3, template.complexity + 1),
    templateSnapshot,
    canonicalStory,
    premise: {
      clientName: template.clientName,
      opponentName: template.opponentName,
      courtName: template.courtName,
      overview: buildOverviewForSide(template, playerSide),
      desiredRelief: buildDesiredReliefForSide(template, playerSide),
      openingStatement,
    },
    interviewTranscript: [
      {
        role: "party",
        speaker: getPartyName(template, playerSide),
        text: openingStatement,
        sourceType: "claim",
        relatedFactIds: [],
      },
    ],
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

  if (caseSession.status !== "interview") {
    throw new Error("Only interview-stage cases can be exited.");
  }

  caseSession.status = "exited";
  caseSession.exitedAt = new Date();
  await caseSession.save();

  return caseSession;
};

export const listDashboardDataForUser = async (userId, userProfile = null) => {
  const [cases, templates, user] = await Promise.all([
    listCaseSessionsForUser(userId),
    listScenarioOptions(userId, userProfile),
    ensureUserProfile(userId, userProfile),
  ]);

  return {
    cases,
    templates,
    categories: listCategoryOptions(),
    progression: normalizeProgression(user?.progression),
  };
};

export const getPublicPlayerProfile = async (playerId) => {
  await connectMongo();

  const user = await User.findById(playerId);

  if (!user) {
    return null;
  }

  const hydratedUser = await ensureUserProfile(playerId);
  const cases = await CaseSession.find({
    userId: playerId,
    status: { $ne: "exited" },
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

    return buildCasePayload(caseSession, template);
  });

  const lawyerProfileSummary = await ensureStoredLawyerProfileSummary({
    user: hydratedUser,
    cases: publicCases,
  });

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
  };
};
