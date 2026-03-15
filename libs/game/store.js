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

const buildTemplateCard = ({ template, progression }) => {
  const eligibleComplexity = getEligibleComplexityForCategory(
    progression,
    template.primaryCategory
  );

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
    unlocked: template.complexity <= eligibleComplexity,
    unlockReason:
      template.complexity <= eligibleComplexity
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
  const templates = await CaseTemplate.find({ status: "active" }).sort({
    primaryCategory: 1,
    complexity: 1,
    createdAt: -1,
  });

  return templates.map((template) =>
    buildTemplateCard({
      template: toPlain(template),
      progression,
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

  if (template.complexity > allowedComplexity) {
    throw new Error("This case is locked until you gain more experience in that category.");
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
      openingStatement: template.openingStatement,
    },
    interviewTranscript: [
      {
        role: "client",
        speaker: template.clientName,
        text: template.openingStatement,
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

  const cases = await CaseSession.find({ userId })
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
