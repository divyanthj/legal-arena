import "server-only";

import connectMongo from "@/libs/mongoose";
import CaseSession from "@/models/CaseSession";
import CaseTemplate from "@/models/CaseTemplate";
import { LAWBOOK_VERSION, getLawbookRules } from "@/data/legalArenaLawbook";
import { listCategoryOptions, ensureSeedCaseTemplates } from "./templates";
import {
  ensureUserProfile,
  getEligibleComplexityForCategory,
  normalizeProgression,
} from "./progression";
import { DEFAULT_CATEGORY_SLUG } from "./categories";

const toPlain = (doc) => (doc?.toJSON ? doc.toJSON() : doc);
const CASE_EXIT_COOLDOWN_MS = 24 * 60 * 60 * 1000;

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

const defaultOpenQuestions = (template) =>
  ((template && template.canonicalFacts) || [])
    .slice()
    .sort(
      (left, right) =>
        (right.discoverability?.priority || 0) - (left.discoverability?.priority || 0)
    )
    .slice(0, 3)
    .map((fact) => fact.label);

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

const buildTemplateCard = ({ template, progression, cooldownEndsAt = null }) => {
  const eligibleComplexity = getEligibleComplexityForCategory(
    progression,
    template.primaryCategory
  );
  const cooldownActive = cooldownEndsAt && cooldownEndsAt > new Date();
  const unlockedByProgression = template.complexity <= eligibleComplexity;

  return {
    id: template.id,
    slug: template.slug,
    title: template.title,
    subtitle: template.subtitle,
    overview: template.overview,
    courtName: template.courtName,
    clientName: template.clientName,
    opponentName: template.opponentName,
    practiceArea: template.practiceArea,
    primaryCategory: template.primaryCategory,
    secondaryCategories: template.secondaryCategories || [],
    complexity: template.complexity,
    sourceType: template.sourceType,
    legalTags: template.legalTags || [],
    unlocked: unlockedByProgression && !cooldownActive,
    cooldownEndsAt: cooldownActive ? cooldownEndsAt.toISOString() : null,
    unlockReason:
      cooldownActive
        ? `Available again after ${cooldownEndsAt.toLocaleString("en-US", {
            month: "short",
            day: "numeric",
            hour: "numeric",
            minute: "2-digit",
          })}.`
        : unlockedByProgression
        ? "Available for your current specialization level."
        : `Unlock ${template.primaryCategory} complexity ${template.complexity} by completing more cases in that category.`,
  };
};

export const buildCasePayload = (caseSession, templateOverride = null) => {
  const plainCase = toPlain(caseSession);
  const template =
    templateOverride ||
    plainCase.caseTemplateId ||
    plainCase.template ||
    null;
  const templateSlug = getTemplateSlugFromSession(plainCase);

  return {
    ...plainCase,
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
          overview: template.overview,
          practiceArea: template.practiceArea,
          primaryCategory: template.primaryCategory,
          secondaryCategories: template.secondaryCategories || [],
          complexity: template.complexity,
          sourceType: template.sourceType,
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
          overview: template.overview,
          practiceArea: template.practiceArea,
        }
      : null,
    lawbook: getLawbookRules(template?.legalTags || []),
  };
};

export const listScenarioOptions = async (userId) => {
  await connectMongo();
  await ensureSeedCaseTemplates();

  const user = await ensureUserProfile(userId);
  const progression = normalizeProgression(user?.progression);
  const [templates, cooldowns] = await Promise.all([
    CaseTemplate.find({ status: "active" }).sort({
      primaryCategory: 1,
      complexity: 1,
      createdAt: -1,
    }),
    getActiveExitCooldowns(userId),
  ]);

  return templates.map((template) =>
    buildTemplateCard({
      template: toPlain(template),
      progression,
      cooldownEndsAt: cooldowns.get(String(template._id)) || null,
    })
  );
};

export const createCaseSession = async ({ userId, caseTemplateId }) => {
  await connectMongo();
  await ensureSeedCaseTemplates();

  const template = await CaseTemplate.findOne({
    _id: caseTemplateId,
    status: "active",
  });

  if (!template) {
    throw new Error("Case template not found");
  }

  const user = await ensureUserProfile(userId);
  const progression = normalizeProgression(user?.progression);
  const allowedComplexity = getEligibleComplexityForCategory(
    progression,
    template.primaryCategory
  );
  const cooldowns = await getActiveExitCooldowns(userId);
  const cooldownEndsAt = cooldowns.get(String(template._id));
  const openingStatement = normalizeClientIntakeStatement(template.openingStatement);

  if (template.complexity > allowedComplexity) {
    throw new Error("This case is locked until you gain more experience in that category.");
  }
  if (cooldownEndsAt && cooldownEndsAt > new Date()) {
    throw new Error(
      `This case is on cooldown until ${cooldownEndsAt.toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      })}.`
    );
  }

  const caseSession = await CaseSession.create({
    userId,
    title: template.title,
    caseTemplateId: template._id,
    templateSlug: template.slug,
    scenarioId: template.slug,
    practiceArea: template.practiceArea,
    primaryCategory: template.primaryCategory,
    complexity: template.complexity,
    status: "interview",
    lawbookVersion: LAWBOOK_VERSION,
    maxCourtRounds: Math.max(3, template.complexity + 1),
    premise: {
      clientName: template.clientName,
      opponentName: template.opponentName,
      courtName: template.courtName,
      overview: template.overview,
      desiredRelief: template.desiredRelief,
      openingStatement,
    },
    interviewTranscript: [
      {
        role: "client",
        speaker: template.clientName,
        text: openingStatement,
        sourceType: "claim",
        relatedFactIds: [],
      },
    ],
    factSheet: {
      summary: template.overview,
      timeline: [],
      supportingFacts: [],
      risks: [],
      theory: template.starterTheory,
      desiredRelief: template.desiredRelief,
      openQuestions: defaultOpenQuestions(template),
      knownFacts: [],
      knownClaims: [],
      disputedFacts: [],
      corroboratedFacts: [],
      sourceLinks: [],
      discoveredFactIds: [],
      discoveredClaimIds: [],
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

  return buildCasePayload(caseSession, toPlain(template));
};

export const listCaseSessionsForUser = async (userId) => {
  await connectMongo();
  await ensureSeedCaseTemplates();

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
  await ensureSeedCaseTemplates();

  const caseSession = await CaseSession.findOne({ _id: caseId, userId }).populate(
    "caseTemplateId"
  );

  const fallbackTemplate =
    caseSession && !caseSession.caseTemplateId
      ? await CaseTemplate.findOne({ slug: getTemplateSlugFromSession(caseSession) })
      : null;

  return caseSession
    ? buildCasePayload(
        caseSession,
        toPlain(caseSession.caseTemplateId) || toPlain(fallbackTemplate)
      )
    : null;
};

export const getCaseSessionDocumentForUser = async ({ userId, caseId }) => {
  await connectMongo();
  await ensureSeedCaseTemplates();

  const caseSession = await CaseSession.findOne({ _id: caseId, userId }).populate(
    "caseTemplateId"
  );

  if (!caseSession) {
    return null;
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

  return caseSession;
};

export const exitCaseSessionForUser = async ({ userId, caseId }) => {
  await connectMongo();
  await ensureSeedCaseTemplates();

  const caseSession = await CaseSession.findOne({ _id: caseId, userId }).populate(
    "caseTemplateId"
  );

  if (!caseSession) {
    return null;
  }

  if (caseSession.status !== "interview") {
    throw new Error("Only interview-stage cases can be exited.");
  }

  caseSession.status = "exited";
  caseSession.exitedAt = new Date();
  await caseSession.save();

  return caseSession;
};

export const listDashboardDataForUser = async (userId) => {
  const [cases, templates, user] = await Promise.all([
    listCaseSessionsForUser(userId),
    listScenarioOptions(userId),
    ensureUserProfile(userId),
  ]);

  return {
    cases,
    templates,
    categories: listCategoryOptions(),
    progression: normalizeProgression(user?.progression),
  };
};
