import "server-only";

import connectMongo from "@/libs/mongoose";
import CaseTemplate from "@/models/CaseTemplate";
import { legalArenaScenarios } from "@/data/legalArenaScenarios";
import {
  DEFAULT_CATEGORY_SLUG,
  LEGAL_CASE_CATEGORIES,
  getCategoryBySlug,
} from "./categories";

const scenarioCategoryMap = {
  "security-deposit": "rental-dispute",
  "freelance-invoice": "contract-violation",
  "wrongful-tow": "property",
};

const inferOpponentClaim = (fact) => {
  if (fact.category === "risk") {
    return `The opponent would use this point to challenge the client's credibility: ${fact.detail}`;
  }

  if (fact.category === "timeline") {
    return `The opponent is likely to minimize the importance of this event or frame it differently: ${fact.detail}`;
  }

  return `The opponent disputes the client's framing and says the fact does not prove liability: ${fact.detail}`;
};

const inferEvidenceType = (fact) => {
  const text = `${fact.label} ${fact.detail}`.toLowerCase();

  if (text.includes("photo")) return "photo";
  if (text.includes("invoice") || text.includes("receipt") || text.includes("bill")) {
    return "invoice";
  }
  if (text.includes("message") || text.includes("email") || text.includes("text")) {
    return "message";
  }
  if (text.includes("checklist") || text.includes("record") || text.includes("proposal")) {
    return "record";
  }

  return "document";
};

const buildTemplateFromScenario = (scenario) => {
  const primaryCategory =
    scenarioCategoryMap[scenario.id] || DEFAULT_CATEGORY_SLUG;
  const complexity = scenario.factInventory.length >= 6 ? 2 : 1;

  return {
    slug: scenario.id,
    sourceType: "imported",
    status: "active",
    title: scenario.title,
    subtitle: scenario.subtitle,
    overview: scenario.overview,
    desiredRelief: scenario.desiredRelief,
    openingStatement: scenario.openingStatement,
    starterTheory: scenario.starterTheory,
    practiceArea: scenario.practiceArea,
    primaryCategory,
    secondaryCategories: [scenario.practiceArea.toLowerCase()],
    complexity,
    courtName: scenario.courtName,
    clientName: scenario.clientName,
    opponentName: scenario.opponentName,
    legalTags: scenario.legalTags,
    authoringNotes: "Migrated from the original local scenario seed into MongoDB.",
    canonicalFacts: scenario.factInventory.map((fact) => ({
      factId: fact.id,
      label: fact.label,
      kind: fact.category === "supporting" ? "supporting" : fact.category,
      truthStatus: fact.category === "risk" ? "probable" : "verified",
      canonicalDetail: fact.detail,
      discoverability: {
        keywords: fact.keywords,
        phase: "interview",
        priority: fact.category === "risk" ? 4 : 2,
      },
      evidenceRefs: [`evidence-${fact.id}`],
      claims: [
        {
          party: "client",
          claimedDetail:
            fact.category === "risk"
              ? `I don't think this should matter much, but ${fact.detail.charAt(0).toLowerCase()}${fact.detail.slice(1)}`
              : fact.detail,
          stance: fact.category === "risk" ? "omits" : "admits",
          confidence: fact.category === "risk" ? 0.45 : 0.9,
          accessLevel: "direct",
          deceptionProfile:
            fact.category === "risk" ? "defensive minimization" : "straightforward",
          keywords: fact.keywords,
        },
        {
          party: "opponent",
          claimedDetail: inferOpponentClaim(fact),
          stance: fact.category === "risk" ? "admits" : "distorts",
          confidence: fact.category === "risk" ? 0.8 : 0.7,
          accessLevel: "partial",
          deceptionProfile:
            fact.category === "risk"
              ? "uses as impeachment"
              : "self-serving reframing",
          keywords: fact.keywords,
        },
      ],
    })),
    evidenceItems: scenario.factInventory.map((fact) => ({
      id: `evidence-${fact.id}`,
      label: fact.label,
      detail: fact.detail,
      type: inferEvidenceType(fact),
      linkedFactIds: [fact.id],
    })),
  };
};

export const validateCaseTemplatePayload = (payload = {}) => {
  const errors = [];

  if (!payload.title?.trim()) {
    errors.push("title is required");
  }
  if (!payload.overview?.trim()) {
    errors.push("overview is required");
  }
  if (!payload.openingStatement?.trim()) {
    errors.push("openingStatement is required");
  }
  if (!payload.desiredRelief?.trim()) {
    errors.push("desiredRelief is required");
  }
  if (!payload.starterTheory?.trim()) {
    errors.push("starterTheory is required");
  }
  if (!getCategoryBySlug(payload.primaryCategory || "")) {
    errors.push("primaryCategory is invalid");
  }
  if (
    typeof payload.complexity !== "number" ||
    payload.complexity < 1 ||
    payload.complexity > 5
  ) {
    errors.push("complexity must be between 1 and 5");
  }
  if (!Array.isArray(payload.canonicalFacts) || payload.canonicalFacts.length === 0) {
    errors.push("at least one canonical fact is required");
  }

  (payload.canonicalFacts || []).forEach((fact, index) => {
    if (!fact.factId?.trim()) {
      errors.push(`canonicalFacts[${index}].factId is required`);
    }
    if (!fact.canonicalDetail?.trim()) {
      errors.push(`canonicalFacts[${index}].canonicalDetail is required`);
    }

    const parties = (fact.claims || []).map((claim) => claim.party);
    if (!parties.includes("client")) {
      errors.push(`canonicalFacts[${index}] must include a client claim`);
    }
    if (!parties.includes("opponent")) {
      errors.push(`canonicalFacts[${index}] must include an opponent claim`);
    }
  });

  return errors;
};

export const ensureSeedCaseTemplates = async () => {
  await connectMongo();

  const existingCount = await CaseTemplate.countDocuments();
  if (existingCount > 0) {
    return;
  }

  const payloads = legalArenaScenarios.map(buildTemplateFromScenario);
  await CaseTemplate.insertMany(payloads);
};

export const listCategoryOptions = () => [...LEGAL_CASE_CATEGORIES];

