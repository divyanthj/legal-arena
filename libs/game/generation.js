import "server-only";

import CaseTemplate from "@/models/CaseTemplate";
import GenerationArtifact from "@/models/GenerationArtifact";
import { requestStructuredCompletion } from "@/libs/gpt";
import { DEFAULT_CATEGORY_SLUG, getCategoryBySlug } from "./categories";
import { buildTemplateFromStoryArtifact } from "./templateBuilder";

const DEFAULT_GENERATION_MODEL =
  process.env.OPENAI_GENERATION_MODEL?.trim() ||
  process.env.OPENAI_MODEL?.trim() ||
  "gpt-5.4";

const GENERATION_STAGE_LABELS = {
  canonical: "Writing canon",
  plaintiffDraft: "Writing plaintiff draft",
  defendantDraft: "Writing defendant draft",
  plaintiffDetails: "Detailing plaintiff",
  plaintiffPlausibility: "Checking plaintiff plausibility",
  defendantDetails: "Detailing defendant",
  defendantPlausibility: "Checking defendant plausibility",
  template: "Building template",
  repair: "Repairing template",
  interview: "Planning interview",
  complete: "Complete",
};

const slugify = (value = "") =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);

const emitGenerationProgress = async (onProgress, stage, result, extra = {}) => {
  if (typeof onProgress !== "function") {
    return;
  }

  await onProgress({
    stage,
    label: GENERATION_STAGE_LABELS[stage] || stage,
    result,
    ...extra,
  });
};

const attachArtifactIdToError = (error, artifact) => {
  if (error && artifact?.id && !error.artifactId) {
    error.artifactId = String(artifact.id);
  }

  return error;
};

const findResumableArtifact = async ({
  resumeArtifactId,
  categorySlug,
  complexity,
  prompt,
  model,
}) => {
  if (resumeArtifactId) {
    return GenerationArtifact.findById(resumeArtifactId);
  }

  return GenerationArtifact.findOne({
    finalTemplateId: null,
    categorySlug,
    complexity,
    prompt,
    model,
    status: { $in: ["running", "failed"] },
  }).sort({ updatedAt: -1 });
};

const purgeResumableArtifacts = async ({
  resumeArtifactId,
  categorySlug,
  complexity,
  prompt,
  model,
}) => {
  if (resumeArtifactId) {
    await GenerationArtifact.deleteOne({
      _id: resumeArtifactId,
      finalTemplateId: null,
      status: { $in: ["running", "failed"] },
    });
    return;
  }

  await GenerationArtifact.deleteMany({
    finalTemplateId: null,
    categorySlug,
    complexity,
    prompt,
    model,
    status: { $in: ["running", "failed"] },
  });
};

export const getStoryComplexityProfile = (complexity = 1) => {
  const normalized = Math.max(1, Math.min(5, Number(complexity) || 1));
  const profiles = {
    1: {
      targetWordRange: "500-750",
      targetBeatCount: 5,
      targetDisputeCount: 1,
      targetLikelyEvidenceCount: 4,
      targetProofGapCount: 2,
      targetPressurePointCount: 2,
      guidance:
        "Keep the case short and focused on a single main dispute with only a small number of supporting details.",
    },
    2: {
      targetWordRange: "750-1050",
      targetBeatCount: 6,
      targetDisputeCount: 2,
      targetLikelyEvidenceCount: 5,
      targetProofGapCount: 2,
      targetPressurePointCount: 3,
      guidance:
        "Add one or two secondary factual points and a modest documentation gap while staying easy to follow.",
    },
    3: {
      targetWordRange: "1050-1400",
      targetBeatCount: 8,
      targetDisputeCount: 3,
      targetLikelyEvidenceCount: 7,
      targetProofGapCount: 3,
      targetPressurePointCount: 4,
      guidance:
        "Use a fuller chronology with multiple sub-issues, cross-checkable records, and at least one meaningful witness or missing document issue.",
    },
    4: {
      targetWordRange: "1400-1850",
      targetBeatCount: 10,
      targetDisputeCount: 4,
      targetLikelyEvidenceCount: 9,
      targetProofGapCount: 4,
      targetPressurePointCount: 5,
      guidance:
        "Create a denser chronology with overlapping disputed issues, several proof gaps, multiple evidence paths, and clear asymmetry between the sides.",
    },
    5: {
      targetWordRange: "1850-2400",
      targetBeatCount: 12,
      targetDisputeCount: 5,
      targetLikelyEvidenceCount: 11,
      targetProofGapCount: 5,
      targetPressurePointCount: 6,
      guidance:
        "Write the richest canonical story with layered sub-issues, several records or witnesses, and stronger ambiguity about who can actually prove what.",
    },
  };

  return {
    complexity: normalized,
    ...profiles[normalized],
  };
};

const getStoryTokenBudget = (complexity = 1) => {
  const normalized = Math.max(1, Math.min(5, Number(complexity) || 1));
  const budgets = {
    1: {
      canonical: 2800,
      branchDraft: 2200,
      detail: 3200,
      plausibility: 1800,
    },
    2: {
      canonical: 3400,
      branchDraft: 2600,
      detail: 3800,
      plausibility: 2200,
    },
    3: {
      canonical: 4000,
      branchDraft: 3000,
      detail: 4400,
      plausibility: 2600,
    },
    4: {
      canonical: 4600,
      branchDraft: 3300,
      detail: 4800,
      plausibility: 3000,
    },
    5: {
      canonical: 5200,
      branchDraft: 3600,
      detail: 5200,
      plausibility: 3400,
    },
  };

  return budgets[normalized];
};

const storyPacketOutputSchema = {
  title: "string",
  subtitle: "string",
  overview: "string",
  desiredRelief: "string",
  openingStatement: "string",
  starterTheory: "string",
  practiceArea: "string",
  primaryCategory: "string",
  secondaryCategories: ["string"],
  complexity: "number",
  courtName: "string",
  plaintiffName: "string",
  defendantName: "string",
  legalTags: ["string"],
  authoringNotes: "string",
  canonicalStory: "string",
  storyBeats: [
    {
      beatId: "string",
      order: "number",
      label: "string",
      detail: "string",
      status: "settled|disputed|unknown",
    },
  ],
  settledFacts: ["string"],
  disputedIssues: ["string"],
  likelyEvidence: [
    {
      label: "string",
      detail: "string",
      type: "document|photo|message|invoice|witness|record|other",
      holderSide: "plaintiff|defendant|shared|third-party|unknown",
      availabilityStatus: "confirmed|mentioned|unknown|missing|contested",
    },
  ],
  missingOrUncertainRecords: ["string"],
  plaintiffPressurePoints: ["string"],
  defendantPressurePoints: ["string"],
};

const branchDraftOutputSchema = {
  side: "plaintiff|defendant",
  narrative: "string",
  intakeOpening: "string",
  focalPoints: ["string"],
  omittedOrUncertainPoints: ["string"],
  claimedFacts: [
    {
      label: "string",
      detail: "string",
      stance: "emphasizes|contests|omits|uncertain",
    },
  ],
  likelyEvidenceEmphasis: ["string"],
};

const detailedBranchOutputSchema = {
  side: "plaintiff|defendant",
  narrative: "string",
  intakeOpening: "string",
  timelineDetails: [
    {
      order: "number",
      label: "string",
      detail: "string",
    },
  ],
  claimedFacts: [
    {
      label: "string",
      detail: "string",
      stance: "emphasizes|contests|omits|uncertain",
    },
  ],
  evidenceReferences: [
    {
      label: "string",
      detail: "string",
      status: "confirmed|mentioned|unknown|missing|contested",
    },
  ],
  proofGaps: ["string"],
  witnessHooks: ["string"],
};

const plausibilityReviewOutputSchema = {
  side: "plaintiff|defendant",
  isPlausible: "boolean",
  issues: ["string"],
  correctedDetailedStory: detailedBranchOutputSchema,
};

const buildCanonicalStoryPrompt = ({
  category,
  complexity,
  prompt,
  complexityProfile,
}) => ({
  task: "Create the canonical story packet for a legal simulation case before any side-specific branch narratives or template extraction.",
  requirements: {
    category: category.slug,
    categoryTitle: category.title,
    complexity,
    complexityProfile,
    additionalPrompt: prompt || "",
    rules: [
      "Write one coherent underlying story of what happened in plain language.",
      "Use the complexity profile to control length, number of beats, number of disputes, likely evidence count, proof gaps, and side pressure points.",
      "Keep the dispute realistic and ordinary for the category.",
      "Focus on events, communications, records, omissions, and motives rather than abstract legal conclusions.",
      "Make the opening statement sound like a real plaintiff talking to counsel during intake.",
      "Distinguish clearly between settled facts, disputed issues, and proof gaps.",
      "Do not output canonicalFacts, evidenceItems, or interviewBlueprint.",
    ],
  },
  outputSchema: storyPacketOutputSchema,
});

const buildPerspectiveStoryPrompt = ({
  side,
  category,
  complexity,
  prompt,
  complexityProfile,
  canonicalStoryPacket,
}) => ({
  task: `Write a ${side} perspective draft that stays anchored to the canonical story but sounds like that side's own account.`,
  requirements: {
    category: category.slug,
    categoryTitle: category.title,
    complexity,
    complexityProfile,
    side,
    additionalPrompt: prompt || "",
    rules: [
      "Stay anchored to the canonical story packet.",
      "You may add perspective, emphasis, omissions, and plausible side-specific framing.",
      "Do not introduce materially new world facts that contradict canonical truth.",
      "Use a voice appropriate to that side speaking to counsel.",
      "Highlight the side's main pressure points, evidence emphasis, and uncertainty areas.",
    ],
  },
  canonicalStoryPacket,
  outputSchema: branchDraftOutputSchema,
});

const buildDetailedStoryPrompt = ({
  side,
  category,
  complexity,
  prompt,
  complexityProfile,
  canonicalStoryPacket,
  perspectiveDraft,
  priorIssues = [],
}) => ({
  task: `Expand the ${side} branch draft into a richer intake-ready narrative with more concrete details and chronology.`,
  requirements: {
    category: category.slug,
    categoryTitle: category.title,
    complexity,
    complexityProfile,
    side,
    priorIssues,
    additionalPrompt: prompt || "",
    rules: [
      "Stay anchored to the canonical story packet and the side-specific branch draft.",
      "Add playable specifics, chronology, witness hooks, and proof gaps.",
      "Do not contradict canonical truth.",
      "Use prior plausibility issues to avoid repeating contradictions or impossible details.",
    ],
  },
  canonicalStoryPacket,
  perspectiveDraft,
  outputSchema: detailedBranchOutputSchema,
});

const buildBranchPlausibilityReviewPrompt = ({
  side,
  category,
  complexity,
  prompt,
  canonicalStoryPacket,
  perspectiveDraft,
  detailedStory,
}) => ({
  task: `Review the detailed ${side} branch story for plausibility and consistency against canon.`,
  requirements: {
    category: category.slug,
    categoryTitle: category.title,
    complexity,
    side,
    additionalPrompt: prompt || "",
    rules: [
      "Check for contradictions with the canonical story packet.",
      "Check for implausible dates, records, witness knowledge, or sequencing.",
      "Return whether the branch is plausible.",
      "If needed, include a corrected detailed story that keeps the same side perspective while fixing the issues.",
    ],
  },
  canonicalStoryPacket,
  perspectiveDraft,
  detailedStory,
  outputSchema: plausibilityReviewOutputSchema,
});

const updateArtifactFailure = async (artifact, failureStage, failureReason) => {
  if (!artifact) {
    return;
  }

  artifact.status = "failed";
  artifact.failureStage = failureStage;
  artifact.failureReason = String(failureReason || "").trim();
  await artifact.save();
};

const createUsageTracker = () => {
  let artifactRef = null;
  const pendingEntries = [];

  const applyEntry = (target, entry) => {
    if (!target) {
      return;
    }

    target.usageLog = Array.isArray(target.usageLog) ? target.usageLog : [];
    target.usageTotals =
      target.usageTotals && typeof target.usageTotals === "object"
        ? target.usageTotals
        : {
            inputTokens: 0,
            outputTokens: 0,
            totalTokens: 0,
            cachedInputTokens: 0,
            reasoningTokens: 0,
          };

    target.usageLog.push(entry);
    target.usageTotals.inputTokens += Number(entry.inputTokens || 0);
    target.usageTotals.outputTokens += Number(entry.outputTokens || 0);
    target.usageTotals.totalTokens += Number(entry.totalTokens || 0);
    target.usageTotals.cachedInputTokens += Number(entry.cachedInputTokens || 0);
    target.usageTotals.reasoningTokens += Number(entry.reasoningTokens || 0);
  };

  return {
    setArtifact(nextArtifact) {
      artifactRef = nextArtifact || null;

      if (artifactRef && pendingEntries.length > 0) {
        pendingEntries.splice(0).forEach((entry) => applyEntry(artifactRef, entry));
      }
    },
    record(entry = {}) {
      const normalizedEntry = {
        label: String(entry.label || "").trim(),
        attempt: Number(entry.attempt || 0),
        maxTokens: Number(entry.maxTokens || 0),
        finishReason: String(entry.finishReason || "").trim(),
        model: String(entry.model || "").trim(),
        api: String(entry.api || "").trim(),
        parsed: Boolean(entry.parsed),
        inputTokens: Number(entry.inputTokens || 0),
        outputTokens: Number(entry.outputTokens || 0),
        totalTokens: Number(entry.totalTokens || 0),
        cachedInputTokens: Number(entry.cachedInputTokens || 0),
        reasoningTokens: Number(entry.reasoningTokens || 0),
        createdAt: new Date().toISOString(),
      };

      if (artifactRef) {
        applyEntry(artifactRef, normalizedEntry);
        return;
      }

      pendingEntries.push(normalizedEntry);
    },
  };
};

const runDetailedBranchWithPlausibility = async ({
  artifact,
  artifactStoryField,
  artifactReviewField,
  side,
  category,
  complexity,
  prompt,
  model,
  userId,
  tokenBudget,
  complexityProfile,
  canonicalStoryPacket,
  perspectiveDraft,
  detailStage,
  plausibilityStage,
  onUsage,
  onProgress,
}) => {
  let priorIssues = [];

  for (let attempt = 0; attempt < 3; attempt += 1) {
    artifact.failureStage = detailStage;
    await artifact.save();
    const detailedStory = await requestStructuredCompletion({
      userId,
      model,
      temperature: 0.55,
      maxTokens: tokenBudget.detail,
      retryAttempts: 1,
      usageLabel: `${side}.detail`,
      onUsage,
      throwOnError: true,
      systemPrompt:
        `You expand ${side} branch stories into richer intake-ready narratives. This is a detailed branch pass for a legal simulation app. Output valid JSON only.`,
      userPrompt: JSON.stringify(
        buildDetailedStoryPrompt({
          side,
          category,
          complexity,
          prompt,
          complexityProfile,
          canonicalStoryPacket,
          perspectiveDraft,
          priorIssues,
        })
      ),
    });

    artifact[artifactStoryField] = detailedStory;
    await artifact.save();
    await emitGenerationProgress(onProgress, detailStage, detailedStory, {
      artifactId: artifact.id,
      attempt: attempt + 1,
    });

    artifact.failureStage = plausibilityStage;
    await artifact.save();
    const plausibilityReview = await requestStructuredCompletion({
      userId,
      model,
      temperature: 0.2,
      maxTokens: tokenBudget.plausibility,
      retryAttempts: 1,
      usageLabel: `${side}.plausibility`,
      onUsage,
      throwOnError: true,
      systemPrompt:
        `You review detailed ${side} branch narratives for plausibility and consistency. Output valid JSON only.`,
      userPrompt: JSON.stringify(
        buildBranchPlausibilityReviewPrompt({
          side,
          category,
          complexity,
          prompt,
          canonicalStoryPacket,
          perspectiveDraft,
          detailedStory,
        })
      ),
    });

    artifact[artifactReviewField] = plausibilityReview;
    if (plausibilityReview?.isPlausible && plausibilityReview?.correctedDetailedStory) {
      artifact[artifactStoryField] = plausibilityReview.correctedDetailedStory;
    }
    await artifact.save();
    await emitGenerationProgress(onProgress, plausibilityStage, plausibilityReview, {
      artifactId: artifact.id,
      attempt: attempt + 1,
    });

    if (plausibilityReview?.isPlausible) {
      return plausibilityReview.correctedDetailedStory || detailedStory;
    }

    priorIssues = Array.isArray(plausibilityReview?.issues)
      ? plausibilityReview.issues
      : ["The branch story was not plausible."];
  }

  throw new Error(
    `${side === "plaintiff" ? "Plaintiff" : "Defendant"} detailed story could not pass plausibility review after retries.`
  );
};

export const generateCaseTemplatePayload = async ({
  categorySlug,
  complexity = 2,
  prompt = "",
  userId = "system",
  model = DEFAULT_GENERATION_MODEL,
  resumeArtifactId = "",
  purgePreviousWork = false,
  onProgress,
}) => {
  const category = getCategoryBySlug(categorySlug) || getCategoryBySlug(DEFAULT_CATEGORY_SLUG);
  const normalizedComplexity = Math.max(1, Math.min(5, Number(complexity) || 1));
  const complexityProfile = getStoryComplexityProfile(normalizedComplexity);
  const tokenBudget = getStoryTokenBudget(normalizedComplexity);
  const usageTracker = createUsageTracker();
  if (purgePreviousWork) {
    await purgeResumableArtifacts({
      resumeArtifactId,
      categorySlug: category.slug,
      complexity: normalizedComplexity,
      prompt,
      model,
    });
  }
  let artifact = purgePreviousWork
    ? null
    : await findResumableArtifact({
        resumeArtifactId,
        categorySlug: category.slug,
        complexity: normalizedComplexity,
        prompt,
        model,
      });

  try {
    if (artifact) {
      usageTracker.setArtifact(artifact);
      artifact.status = "running";
      artifact.failureReason = "";
      await artifact.save();
      await emitGenerationProgress(
        onProgress,
        artifact.failureStage === "template" ||
          artifact.failureStage === "repair" ||
          artifact.failureStage === "interview" ||
          artifact.templateDraft
          ? "template"
          : artifact.failureStage || "canonical",
        {
          resumedFromArtifact: true,
          artifactId: artifact.id,
          failureStage: artifact.failureStage,
        },
        {
          artifactId: artifact.id,
          resumed: true,
        }
      );
    }

    let canonicalStoryPacket = artifact?.canonicalStoryPacket || null;
    if (!canonicalStoryPacket) {
      canonicalStoryPacket = await requestStructuredCompletion({
        userId,
        model,
        temperature: 0.85,
        maxTokens: tokenBudget.canonical,
        retryAttempts: 1,
        usageLabel: "story.canonical",
        onUsage: usageTracker.record,
        throwOnError: true,
        systemPrompt:
          "You generate canonical legal case stories for a courtroom simulation app. This is the canonical truth-anchor pass. Output valid JSON only.",
        userPrompt: JSON.stringify(
          buildCanonicalStoryPrompt({
            category,
            complexity: normalizedComplexity,
            prompt,
            complexityProfile,
          })
        ),
      });
      await emitGenerationProgress(onProgress, "canonical", canonicalStoryPacket, {
        artifactId: artifact?.id || null,
      });
    }

    let plaintiffStoryDraft = artifact?.plaintiffStoryDraft || null;
    if (!plaintiffStoryDraft) {
      plaintiffStoryDraft = await requestStructuredCompletion({
        userId,
        model,
        temperature: 0.65,
        maxTokens: tokenBudget.branchDraft,
        retryAttempts: 1,
        usageLabel: "story.plaintiffDraft",
        onUsage: usageTracker.record,
        throwOnError: true,
        systemPrompt:
          "You write plaintiff-side branch narratives for legal simulation cases. Output valid JSON only and stay anchored to canon.",
        userPrompt: JSON.stringify(
          buildPerspectiveStoryPrompt({
            side: "plaintiff",
            category,
            complexity: normalizedComplexity,
            prompt,
            complexityProfile,
            canonicalStoryPacket,
          })
        ),
      });
      await emitGenerationProgress(onProgress, "plaintiffDraft", plaintiffStoryDraft, {
        artifactId: artifact?.id || null,
      });
    }

    let defendantStoryDraft = artifact?.defendantStoryDraft || null;
    if (!defendantStoryDraft) {
      defendantStoryDraft = await requestStructuredCompletion({
        userId,
        model,
        temperature: 0.65,
        maxTokens: tokenBudget.branchDraft,
        retryAttempts: 1,
        usageLabel: "story.defendantDraft",
        onUsage: usageTracker.record,
        throwOnError: true,
        systemPrompt:
          "You write defendant-side branch narratives for legal simulation cases. Output valid JSON only and stay anchored to canon.",
        userPrompt: JSON.stringify(
          buildPerspectiveStoryPrompt({
            side: "defendant",
            category,
            complexity: normalizedComplexity,
            prompt,
            complexityProfile,
            canonicalStoryPacket,
          })
        ),
      });
    }

    if (!artifact) {
      artifact = await GenerationArtifact.create({
        status: "running",
        categorySlug: category.slug,
        complexity: normalizedComplexity,
        prompt,
        model,
        canonicalStoryPacket,
        plaintiffStoryDraft,
        defendantStoryDraft,
      });
      usageTracker.setArtifact(artifact);
    } else {
      artifact.categorySlug = category.slug;
      artifact.complexity = normalizedComplexity;
      artifact.prompt = prompt;
      artifact.model = model;
      artifact.canonicalStoryPacket = canonicalStoryPacket;
      artifact.plaintiffStoryDraft = plaintiffStoryDraft;
      artifact.defendantStoryDraft = defendantStoryDraft;
      await artifact.save();
    }
    await emitGenerationProgress(onProgress, "defendantDraft", defendantStoryDraft, {
      artifactId: artifact.id,
    });

    const plaintiffDetailedStory =
      artifact?.plaintiffDetailedStory &&
      artifact?.plaintiffPlausibilityReview?.isPlausible
        ? artifact.plaintiffDetailedStory
        : await runDetailedBranchWithPlausibility({
            artifact,
            artifactStoryField: "plaintiffDetailedStory",
            artifactReviewField: "plaintiffPlausibilityReview",
            side: "plaintiff",
            category,
            complexity: normalizedComplexity,
            prompt,
            model,
            userId,
            tokenBudget,
            complexityProfile,
            canonicalStoryPacket,
            perspectiveDraft: plaintiffStoryDraft,
            detailStage: "plaintiffDetails",
            plausibilityStage: "plaintiffPlausibility",
            onUsage: usageTracker.record,
            onProgress,
          });

    const defendantDetailedStory =
      artifact?.defendantDetailedStory &&
      artifact?.defendantPlausibilityReview?.isPlausible
        ? artifact.defendantDetailedStory
        : await runDetailedBranchWithPlausibility({
            artifact,
            artifactStoryField: "defendantDetailedStory",
            artifactReviewField: "defendantPlausibilityReview",
            side: "defendant",
            category,
            complexity: normalizedComplexity,
            prompt,
            model,
            userId,
            tokenBudget,
            complexityProfile,
            canonicalStoryPacket,
            perspectiveDraft: defendantStoryDraft,
            detailStage: "defendantDetails",
            plausibilityStage: "defendantPlausibility",
            onUsage: usageTracker.record,
            onProgress,
          });

    artifact.plaintiffDetailedStory = plaintiffDetailedStory;
    artifact.defendantDetailedStory = defendantDetailedStory;
    artifact.failureStage = "template";
    await artifact.save();

    const payload = await buildTemplateFromStoryArtifact({
      artifact,
      category,
      complexity: normalizedComplexity,
      prompt,
      userId,
      model,
      onUsage: usageTracker.record,
      onProgress,
    });

    payload.slug =
      payload.slug?.trim() ||
      `${category.slug}-${slugify(payload.title || "generated-case")}-${Date.now()}`;

    await emitGenerationProgress(onProgress, "complete", payload, {
      artifactId: artifact.id,
    });

    return { payload, artifact };
  } catch (error) {
    await updateArtifactFailure(
      artifact,
      artifact?.failureStage || "generation",
      error.message || "Generation failed."
    );
    throw attachArtifactIdToError(error, artifact);
  }
};

export const createGeneratedCaseTemplate = async (options) => {
  const { payload, artifact } = await generateCaseTemplatePayload(options);

  try {
    const template = await CaseTemplate.create({
      ...payload,
      generationArtifactId: artifact?.id || null,
    });

    if (artifact) {
      artifact.status = "completed";
      artifact.finalTemplateId = template._id;
      artifact.failureStage = "";
      artifact.failureReason = "";
      await artifact.save();
    }

    return {
      template,
      artifactId: artifact?.id || null,
    };
  } catch (error) {
    await updateArtifactFailure(artifact, "save", error.message || "Template save failed.");
    throw attachArtifactIdToError(error, artifact);
  }
};
