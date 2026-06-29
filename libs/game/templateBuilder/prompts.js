import "server-only";

import { normalizeTemplateParty } from "../templateInterview";
import {
  categoryLegalTagDefaults,
  uniqueList,
  normalizeClientIntakeStatement,
  normalizeCategorySlug,
  normalizeClaims,
  normalizeProfileScalar,
  normalizeBlueprintSide,
  ensurePartyCoverage,
  isRepairInactionFact,
  isCrossCaseContaminatedClaim,
  isDocumentationGapFact,
  buildDocumentationGapClaim,
  buildFallbackClaimText,
  sanitizeClaimText,
  finalizeTemplatePresentation,
} from "./shared";
import {
  normalizeGeneratedPayload,
  mergeInterviewPlanningPayload,
  shouldSkipSemanticEvidenceMismatch,
  countSharedEvidenceTokens,
} from "./repair";
import {
  baseTemplateOutputSchema,
  factInventoryOutputSchema,
} from "./schemas";
import {
  buildClaimFromSideStory,
  buildDeterministicInterviewBlueprint,
  buildDeterministicPartyProfiles,
  factPriorityScore,
  pickMatchingClaimedFact,
} from "./deterministic";
import { normalizeCanonicalStory } from "../storyWorld";

export const buildCompactStoryContext = (artifact = {}) => ({
  categorySlug: String(artifact?.categorySlug || "").trim(),
  complexity: Number(artifact?.complexity || 1),
  canonicalStoryPacket: artifact?.canonicalStoryPacket
    ? {
        title: artifact.canonicalStoryPacket.title,
        subtitle: artifact.canonicalStoryPacket.subtitle,
        overview: artifact.canonicalStoryPacket.overview,
        desiredRelief: artifact.canonicalStoryPacket.desiredRelief,
        openingStatement: artifact.canonicalStoryPacket.openingStatement,
        starterTheory: artifact.canonicalStoryPacket.starterTheory,
        practiceArea: artifact.canonicalStoryPacket.practiceArea,
        courtName: artifact.canonicalStoryPacket.courtName,
        plaintiffName: artifact.canonicalStoryPacket.plaintiffName,
        defendantName: artifact.canonicalStoryPacket.defendantName,
        legalTags: artifact.canonicalStoryPacket.legalTags,
        authoringNotes: artifact.canonicalStoryPacket.authoringNotes,
        canonicalStory: artifact.canonicalStoryPacket.canonicalStory,
        storyBeats: artifact.canonicalStoryPacket.storyBeats,
        settledFacts: artifact.canonicalStoryPacket.settledFacts,
        disputedIssues: artifact.canonicalStoryPacket.disputedIssues,
        likelyEvidence: artifact.canonicalStoryPacket.likelyEvidence,
        missingOrUncertainRecords: artifact.canonicalStoryPacket.missingOrUncertainRecords,
        plaintiffPressurePoints: artifact.canonicalStoryPacket.plaintiffPressurePoints,
        defendantPressurePoints: artifact.canonicalStoryPacket.defendantPressurePoints,
      }
    : null,
  plaintiffDetailedStory: artifact?.plaintiffDetailedStory
    ? {
        side: artifact.plaintiffDetailedStory.side,
        narrative: artifact.plaintiffDetailedStory.narrative,
        intakeOpening: artifact.plaintiffDetailedStory.intakeOpening,
        timelineDetails: artifact.plaintiffDetailedStory.timelineDetails,
        claimedFacts: artifact.plaintiffDetailedStory.claimedFacts,
        evidenceReferences: artifact.plaintiffDetailedStory.evidenceReferences,
        proofGaps: artifact.plaintiffDetailedStory.proofGaps,
        witnessHooks: artifact.plaintiffDetailedStory.witnessHooks,
      }
    : null,
  defendantDetailedStory: artifact?.defendantDetailedStory
    ? {
        side: artifact.defendantDetailedStory.side,
        narrative: artifact.defendantDetailedStory.narrative,
        intakeOpening: artifact.defendantDetailedStory.intakeOpening,
        timelineDetails: artifact.defendantDetailedStory.timelineDetails,
        claimedFacts: artifact.defendantDetailedStory.claimedFacts,
        evidenceReferences: artifact.defendantDetailedStory.evidenceReferences,
        proofGaps: artifact.defendantDetailedStory.proofGaps,
        witnessHooks: artifact.defendantDetailedStory.witnessHooks,
      }
    : null,
});

export const buildFactInventoryPrompt = ({ storyContext, category, complexity, prompt }) => ({
  task: "Extract the proposition inventory for a legal simulation template from a canonical story and two side-specific branch stories.",
  requirements: {
    category: category.slug,
    categoryTitle: category.title,
    complexity,
    additionalPrompt: prompt || "",
    rules: [
      "Use the canonical story as the truth anchor.",
      "Use the plaintiff and defendant detailed stories to identify what is disputed, emphasized, omitted, or uncertain.",
      "Output factual propositions, not legal slogans.",
      "Do not include claims yet. Do not include evidence refs yet.",
      "Keep follow-up questions brief and practical.",
      "Classify supporting, dispute, risk, and evidence-oriented proof-gap points carefully.",
      "If a point is a missing receipt, missing itemization, missing notice, or similar gap, model it as supporting or evidence-related proof-gap rather than automatic corroboration.",
      ...(category.slug === "rental-dispute"
        ? [
            "For security-deposit disputes, preserve the concrete deposit amount and the amount withheld, refunded, or deducted as canonical facts when those numbers appear in the story.",
            "Do not collapse deposit and deduction amounts into vague phrases like 'most of the deposit' if the source story gives dollar figures.",
          ]
        : []),
    ],
  },
  storyContext,
  outputSchema: factInventoryOutputSchema,
});

export const buildEvidenceInventoryPrompt = ({
  storyContext,
  factInventory,
  category,
  complexity,
  prompt,
}) => ({
  task: "Build the evidence inventory for a legal simulation template from the story artifact and proposition inventory.",
  requirements: {
    category: category.slug,
    categoryTitle: category.title,
    complexity,
    additionalPrompt: prompt || "",
    rules: [
      "Derive evidence items from the canonical story and both branch stories.",
      "Include documents, messages, photos, invoices, witnesses, records, and missing or contested proof where appropriate.",
      "Link each evidence item to the relevant fact ids.",
      "Use realistic availability statuses such as confirmed, mentioned, unknown, missing, or contested.",
    ],
  },
  storyContext,
  factInventory,
  outputSchema: {
    evidenceItems: baseTemplateOutputSchema.evidenceItems,
  },
});
export const buildClaimsAndMetaPrompt = ({
  storyContext,
  factInventory,
  category,
  complexity,
}) => {
  const canonical = storyContext?.canonicalStoryPacket || {};
  const plaintiffStory = storyContext?.plaintiffDetailedStory || {};
  const defendantStory = storyContext?.defendantDetailedStory || {};
  const facts = Array.isArray(factInventory?.canonicalFacts) ? factInventory.canonicalFacts : [];

  return {
    title: String(canonical.title || "").trim(),
    subtitle: String(canonical.subtitle || "").trim(),
    overview: String(canonical.overview || "").trim(),
    desiredRelief: String(canonical.desiredRelief || "").trim(),
    openingStatement: String(
      canonical.openingStatement || plaintiffStory.intakeOpening || ""
    ).trim(),
    starterTheory: String(canonical.starterTheory || "").trim(),
    practiceArea: String(canonical.practiceArea || "").trim(),
    primaryCategory: category.slug,
    secondaryCategories: Array.isArray(canonical.secondaryCategories)
      ? canonical.secondaryCategories.map((item) => String(item).trim()).filter(Boolean)
      : [],
    complexity,
    courtName: String(canonical.courtName || "").trim(),
    plaintiffName: String(canonical.plaintiffName || "").trim(),
    defendantName: String(canonical.defendantName || "").trim(),
    legalTags: Array.isArray(canonical.legalTags)
      ? canonical.legalTags.map((item) => String(item).trim()).filter(Boolean)
      : [],
    authoringNotes: String(canonical.authoringNotes || "").trim(),
    canonicalStory: normalizeCanonicalStory({
      canonicalStory: canonical.canonicalStory || "",
      events: canonical.storyBeats || [],
      partyMentalStates: {
        plaintiff: [
          ...(Array.isArray(canonical.plaintiffPressurePoints)
            ? canonical.plaintiffPressurePoints
            : []),
          plaintiffStory.narrative || "",
        ],
        defendant: [
          ...(Array.isArray(canonical.defendantPressurePoints)
            ? canonical.defendantPressurePoints
            : []),
          defendantStory.narrative || "",
        ],
      },
      evidenceNarrative: canonical.likelyEvidence || [],
      ambiguities: [
        ...(Array.isArray(canonical.disputedIssues) ? canonical.disputedIssues : []),
        ...(Array.isArray(canonical.missingOrUncertainRecords)
          ? canonical.missingOrUncertainRecords
          : []),
      ],
      authoringBoundaries: canonical.authoringNotes ? [canonical.authoringNotes] : [],
    }),
    partyProfiles: buildDeterministicPartyProfiles(storyContext),
    interviewBlueprint: buildDeterministicInterviewBlueprint(facts, storyContext),
    claimsByFact: facts.map((fact) => ({
      factId: fact.factId,
      claims: [
        buildClaimFromSideStory("plaintiff", fact, plaintiffStory),
        buildClaimFromSideStory("defendant", fact, defendantStory),
      ],
    })),
  };
};

export const buildTemplateAssemblyPrompt = ({
  factInventory,
  evidenceInventory,
  claimsAndMeta,
}) => {
  const claimsByFactMap = new Map(
    (Array.isArray(claimsAndMeta?.claimsByFact) ? claimsAndMeta.claimsByFact : [])
      .filter((item) => item?.factId)
      .map((item) => [String(item.factId).trim(), item.claims || []])
  );
  const evidenceItems = Array.isArray(evidenceInventory?.evidenceItems)
    ? evidenceInventory.evidenceItems
    : [];
  const evidenceByFactId = new Map();

  evidenceItems.forEach((item) => {
    (item.linkedFactIds || []).forEach((factId) => {
      const key = String(factId || "").trim();
      if (!key) {
        return;
      }

      if (!evidenceByFactId.has(key)) {
        evidenceByFactId.set(key, []);
      }
      evidenceByFactId.get(key).push(String(item.id || "").trim());
    });
  });

  return {
    ...claimsAndMeta,
    canonicalFacts: (Array.isArray(factInventory?.canonicalFacts)
      ? factInventory.canonicalFacts
      : []
    ).map((fact) => ({
      ...fact,
      evidenceRefs: uniqueList(evidenceByFactId.get(String(fact.factId || "").trim()) || []),
      claims: claimsByFactMap.get(String(fact.factId || "").trim()) || [],
    })),
    evidenceItems,
  };
};

export const repairTemplateDeterministically = (payload = {}, canonicalStory = "", categorySlug = "") => {
  const normalizedPayload = {
    ...payload,
    interviewBlueprint: {
      plaintiff: normalizeBlueprintSide(payload.interviewBlueprint?.plaintiff || {}),
      defendant: normalizeBlueprintSide(payload.interviewBlueprint?.defendant || {}),
    },
  };
  const facts = Array.isArray(normalizedPayload.canonicalFacts) ? normalizedPayload.canonicalFacts : [];
  const evidenceItems = Array.isArray(normalizedPayload.evidenceItems)
    ? normalizedPayload.evidenceItems
    : [];
  const evidenceById = new Map(
    evidenceItems
      .filter((item) => String(item?.id || "").trim())
      .map((item) => [String(item.id).trim(), { ...item, linkedFactIds: uniqueList(item.linkedFactIds || []) }])
  );
  const factIds = new Set(
    facts.map((fact) => String(fact?.factId || "").trim()).filter(Boolean)
  );

  const repairedFacts = facts.map((fact) => {
    const factId = String(fact.factId || "").trim();
    const cleanedEvidenceRefs = uniqueList(
      (fact.evidenceRefs || []).filter((ref) => {
        const evidenceItem = evidenceById.get(String(ref || "").trim());
        if (!evidenceItem) {
          return false;
        }

        const factCorpus = [
          fact.label || "",
          fact.canonicalDetail || "",
          ...(fact.discoverability?.keywords || []),
        ].join(" ");
        const evidenceCorpus = [evidenceItem.label || "", evidenceItem.detail || ""].join(" ");

        return (
          shouldSkipSemanticEvidenceMismatch(fact, evidenceItem) ||
          countSharedEvidenceTokens(factCorpus, evidenceCorpus) > 0
        );
      })
    );

    cleanedEvidenceRefs.forEach((ref) => {
      const evidenceItem = evidenceById.get(ref);
      if (evidenceItem) {
        evidenceItem.linkedFactIds = uniqueList([...(evidenceItem.linkedFactIds || []), factId]);
      }
    });

    return {
      ...fact,
      kind:
        String(fact.kind || "").trim().toLowerCase() === "risk" && isRepairInactionFact(fact)
          ? "supporting"
          : fact.kind,
      claims: ensurePartyCoverage({
        ...fact,
        claims: normalizeClaims(fact.claims).map((claim) => ({
          ...claim,
          claimedDetail: isCrossCaseContaminatedClaim({
            claimText: claim.claimedDetail,
            fact,
            canonicalStory,
          })
            ? (isDocumentationGapFact(fact)
                ? buildDocumentationGapClaim({
                    party: normalizeTemplateParty(claim.party),
                    canonicalDetail: fact.canonicalDetail,
                  })
                : buildFallbackClaimText({
                    party: normalizeTemplateParty(claim.party),
                    canonicalDetail: fact.canonicalDetail,
                    kind: fact.kind,
                  }))
            : sanitizeClaimText(claim.claimedDetail),
        })),
      }, canonicalStory),
      evidenceRefs: cleanedEvidenceRefs,
    };
  });

  const repairedEvidenceItems = [...evidenceById.values()]
    .map((item) => ({
      ...item,
      linkedFactIds: uniqueList((item.linkedFactIds || []).filter((factId) => factIds.has(String(factId)))),
    }))
    .filter((item) => (item.linkedFactIds || []).length > 0);

  return finalizeTemplatePresentation(
    {
      ...normalizedPayload,
      canonicalFacts: repairedFacts,
      evidenceItems: repairedEvidenceItems,
    },
    categorySlug,
    canonicalStory
  );
};

export const buildInterviewPlanningPrompt = ({ basePayload, category, complexity, prompt }) => ({
  task: "Refine the generated case into an interview-ready template with staged proof and side-specific intake guidance.",
  requirements: {
    category: category.slug,
    categoryTitle: category.title,
    complexity,
    additionalPrompt: prompt || "",
    rules: [
      "Keep the same dispute, parties, and overall theory from the base case.",
      "Do not rewrite the whole case. Only refine proof status and interview guidance.",
      "Use evidence availability statuses carefully.",
      "Use confirmed only when the record is realistically in hand or clearly available.",
      "Use mentioned when a party plausibly thinks a record exists but cannot confidently prove that yet.",
      "Use unknown or missing when the interview should surface a proof gap.",
      ...(category.slug === "rental-dispute"
        ? [
            "For security-deposit disputes, keep the total deposit amount and withheld/refunded/deducted amount answerable during intake unless the generated story truly omitted them.",
            "Ask follow-up questions about itemization, invoices, photos, and ordinary wear without making the basic deposit total unknowable.",
          ]
        : []),
      "Write follow-up questions that a lawyer would naturally ask during intake.",
      "Write a natural opening for both sides so the interview works whether the player draws claimant-side or defense-side.",
      "Add partyProfiles for plaintiff and defendant so speech, recall quality, and disclosure style can vary by person.",
      "Keep party profile numbers realistic and differentiated.",
    ],
  },
  baseTemplate: basePayload,
  outputSchema: {
    canonicalFacts: [
      {
        factId: "string",
        truthStatus: "verified|probable|uncertain",
        followUpQuestions: ["string"],
      },
    ],
    evidenceItems: [
      {
        id: "string",
        availabilityStatus: "confirmed|mentioned|unknown|missing|contested",
        holderSide: "plaintiff|defendant|shared|third-party|unknown",
        followUpQuestions: ["string"],
      },
    ],
    interviewBlueprint: baseTemplateOutputSchema.interviewBlueprint,
    partyProfiles: baseTemplateOutputSchema.partyProfiles,
  },
});
