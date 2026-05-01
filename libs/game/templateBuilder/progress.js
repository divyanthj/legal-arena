import "server-only";

import { isFastGenerationProfile } from "./shared";

export const emitBuilderProgress = async (onProgress, result, extra = {}) => {
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

export const getTemplateTokenBudget = (complexity = 1, generationProfile = "default") => {
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

  const baseBudget = budgets[normalized];

  if (!isFastGenerationProfile(generationProfile)) {
    return baseBudget;
  }

  return {
    ...baseBudget,
    factInventory: baseBudget.factInventory + 1200,
    interview: 0,
  };
};
