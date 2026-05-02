import "server-only";

import { requestStructuredCompletion } from "@/libs/gpt";
import { validateCaseTemplatePayload } from "./templates";
import {
  detectTemplateRepairIssues,
  hasBlockingTemplateIssues,
  hasUsableCanonicalFacts,
  withCanonicalStoryNote,
  normalizeGeneratedPayload,
  mergeInterviewPlanningPayload,
} from "./templateBuilder/repair";
import {
  buildCompactStoryContext,
  buildFactInventoryPrompt,
  buildEvidenceInventoryPrompt,
  buildClaimsAndMetaPrompt,
  buildTemplateAssemblyPrompt,
  repairTemplateDeterministically,
  buildInterviewPlanningPrompt,
} from "./templateBuilder/prompts";
import {
  emitBuilderProgress,
  getTemplateTokenBudget,
} from "./templateBuilder/progress";

export const buildTemplateFromStoryArtifact = async ({
  artifact,
  category,
  complexity,
  prompt = "",
  userId = "system",
  model,
  generationProfile = "default",
  yieldController,
  onUsage,
  onProgress,
}) => {
  const canonicalStory = String(artifact?.canonicalStoryPacket?.canonicalStory || "").trim();
  const tokenBudget = getTemplateTokenBudget(complexity, generationProfile);
  const storyContext = buildCompactStoryContext(artifact);

  await yieldController?.checkpoint("template");
  const factInventory = await requestStructuredCompletion({
    userId,
    model,
    temperature: 0.35,
    maxTokens: tokenBudget.factInventory,
    retryAttempts: 1,
    usageLabel: "template.factInventory",
    onUsage,
    throwOnError: true,
    systemPrompt:
      "You extract proposition inventories for legal simulation templates. Output valid JSON only. Use the canonical story as truth and branch stories as party perspective inputs.",
    userPrompt: JSON.stringify(
      buildFactInventoryPrompt({
        storyContext,
        category,
        complexity,
        prompt,
      })
    ),
  });
  await emitBuilderProgress(onProgress, factInventory, {
    stage: "template",
    substep: "Extracting proposition inventory",
    artifactId: artifact?.id,
  });

  await yieldController?.checkpoint("template");
  const evidenceInventory = await requestStructuredCompletion({
    userId,
    model,
    temperature: 0.3,
    maxTokens: tokenBudget.evidenceInventory,
    retryAttempts: 1,
    usageLabel: "template.evidenceInventory",
    onUsage,
    throwOnError: true,
    systemPrompt:
      "You build evidence inventories for legal simulation templates. Output valid JSON only. Link evidence to fact ids and use realistic availability statuses.",
    userPrompt: JSON.stringify(
      buildEvidenceInventoryPrompt({
        storyContext,
        factInventory,
        category,
        complexity,
        prompt,
      })
    ),
  });
  await emitBuilderProgress(onProgress, evidenceInventory, {
    stage: "template",
    substep: "Building evidence inventory",
    artifactId: artifact?.id,
  });

  const claimsAndMeta = buildClaimsAndMetaPrompt({
    storyContext,
    factInventory,
    evidenceInventory,
    category,
    complexity,
    prompt,
  });
  await emitBuilderProgress(onProgress, claimsAndMeta, {
    stage: "template",
    substep: "Building side claims and metadata",
    artifactId: artifact?.id,
  });

  const templateDraft = buildTemplateAssemblyPrompt({
    storyContext,
    factInventory,
    evidenceInventory,
    claimsAndMeta,
    category,
    complexity,
    prompt,
  });
  artifact.templateDraft = templateDraft;
  await artifact.save();
  await emitBuilderProgress(onProgress, templateDraft, {
    stage: "template",
    substep: "Assembling template draft",
    artifactId: artifact?.id,
  });

  let payload = withCanonicalStoryNote(
    normalizeGeneratedPayload(templateDraft, category.slug, complexity),
    canonicalStory
  );

  if (!hasUsableCanonicalFacts(payload)) {
    throw new Error(
      "Case generation failed because the template builder did not produce usable canonical facts."
    );
  }

  let detectedIssues = detectTemplateRepairIssues(payload, canonicalStory);
  artifact.templateRepairIssues = detectedIssues;
  await artifact.save();

  if (detectedIssues.length > 0) {
    payload = withCanonicalStoryNote(
      repairTemplateDeterministically(payload, canonicalStory, category.slug),
      canonicalStory
    );
    detectedIssues = detectTemplateRepairIssues(payload, canonicalStory);
    artifact.templateRepairIssues = detectedIssues;
    artifact.templateDraft = payload;
    await artifact.save();
  }

  await emitBuilderProgress(onProgress, payload, {
    stage: "repair",
    label: "Repairing template",
    detectedIssues,
    artifactId: artifact?.id,
  });

  if (hasBlockingTemplateIssues(detectedIssues)) {
    throw new Error(
      `Case generation failed because blocking template issues remained: ${detectedIssues.join(
        "; "
      )}`
    );
  }

  let interviewPlan = null;

  if (!isFastGenerationProfile(generationProfile) && tokenBudget.interview > 0) {
    try {
      await yieldController?.checkpoint("interview");
      interviewPlan = await requestStructuredCompletion({
        userId,
        model,
        temperature: 0.35,
        maxTokens: tokenBudget.interview,
        retryAttempts: 2,
        usageLabel: "template.interview",
        onUsage,
        throwOnError: true,
        systemPrompt:
          "You refine legal simulation cases into interview-ready templates. Output valid JSON only. Preserve the dispute but distinguish confirmed proof from leads, missing records, and disputed evidence.",
        userPrompt: JSON.stringify(
          buildInterviewPlanningPrompt({
            basePayload: payload,
            category,
            complexity,
            prompt,
          })
        ),
      });
    } catch (error) {
      console.warn("Interview planning refinement failed; using deterministic template fallback.", {
        artifactId: artifact?.id || null,
        category: category.slug,
        complexity,
        error: error?.message || String(error),
      });
    }
  }

  if (interviewPlan && typeof interviewPlan === "object") {
    const plannedPayload = mergeInterviewPlanningPayload(payload, interviewPlan);

    if (hasUsableCanonicalFacts(plannedPayload)) {
      payload = plannedPayload;
    }
  }

  payload = finalizeTemplatePresentation(payload, category.slug, canonicalStory);
  const finalIssues = detectTemplateRepairIssues(payload, canonicalStory);
  if (hasBlockingTemplateIssues(finalIssues)) {
    throw new Error(
      `Case generation failed final verification because blocking issues remained: ${finalIssues.join(
        "; "
      )}`
    );
  }

  const errors = validateCaseTemplatePayload(payload);
  if (errors.length > 0) {
    throw new Error(`Generated case template was invalid: ${errors.join(", ")}`);
  }

  artifact.templateDraft = payload;
  artifact.templateRepairIssues = finalIssues;
  await artifact.save();

  await emitBuilderProgress(onProgress, payload, {
    stage: "interview",
    label: "Planning interview",
    interviewPlan,
    finalIssues,
    artifactId: artifact?.id,
  });

  return payload;
};
