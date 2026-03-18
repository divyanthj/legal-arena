import "server-only";

import { LEGAL_CASE_CATEGORIES, getCategoryBySlug } from "./categories";

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
  if (!(payload.plaintiffName || payload.clientName)?.trim()) {
    errors.push("plaintiffName is required");
  }
  if (!(payload.defendantName || payload.opponentName)?.trim()) {
    errors.push("defendantName is required");
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
    if (!parties.includes("plaintiff")) {
      errors.push(`canonicalFacts[${index}] must include a plaintiff claim`);
    }
    if (!parties.includes("defendant")) {
      errors.push(`canonicalFacts[${index}] must include a defendant claim`);
    }
  });

  return errors;
};

export const ensureSeedCaseTemplates = async () => {
  return;
};

export const listCategoryOptions = () => [...LEGAL_CASE_CATEGORIES];
