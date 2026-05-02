import "server-only";

import {
  enrichTemplateForGameplay,
  normalizeEvidenceAvailabilityStatus,
  normalizeEvidenceHolderSide,
  normalizeTemplateParty,
} from "../templateInterview";
import {
  isFastGenerationProfile,
  categoryLegalTagDefaults,
  ALLOWED_EVIDENCE_TYPES,
  uniqueList,
  CLAIM_MATCH_STOPWORDS,
  normalizeLookupKey,
  normalizeCategorySlug,
  normalizeClientIntakeStatement,
  sanitizeClaimText,
  isLowQualityClaimText,
  CROSS_CASE_CLAIM_GROUPS,
  isCrossCaseContaminatedClaim,
  DOCUMENTATION_GAP_PATTERN,
  OMISSION_PATTERN,
  LEGAL_CONCLUSION_PATTERN,
  REPAIR_INACTION_PATTERN,
  LANDLORD_NONRESPONSE_PATTERN,
  isDocumentationGapFact,
  isRepairInactionFact,
  inferGeneratedFactKind,
  buildDocumentationGapClaim,
  normalizeEvidenceType,
  normalizeClaims,
  buildFallbackClaimText,
  tokenizeClaimMatchText,
  scoreClaimMatch,
  ensurePartyCoverage,
  normalizeBlueprintSide,
  normalizeBlueprintPatchSide,
  normalizeProfileScalar,
  normalizePartyProfile,
  titleLooksGeneric,
  categoryTitleFallbacks,
  MONEY_PATTERN,
  extractMoneyValues,
  buildDepositCaseTitle,
  buildInterestingTitle,
  finalizeTemplatePresentation,
  META_SCAFFOLDING_PATTERN,
} from "./shared";

export const tokenizeEvidenceText = (value = "") =>
  uniqueList(
    String(value || "")
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((token) => token.length > 3)
  );

export const countSharedEvidenceTokens = (left = "", right = "") => {
  const rightTokens = new Set(tokenizeEvidenceText(right));
  return tokenizeEvidenceText(left).filter((token) => rightTokens.has(token)).length;
};

export const isDocumentationEvidenceType = (value = "") =>
  ["invoice", "record", "document", "message"].includes(
    String(value || "")
      .trim()
      .toLowerCase()
  );

export const shouldSkipSemanticEvidenceMismatch = (fact = {}, evidenceItem = {}) => {
  const factKind = String(fact.kind || "").trim().toLowerCase();
  const factCorpus = [
    fact.label || "",
    fact.canonicalDetail || "",
    ...(fact.discoverability?.keywords || []),
  ].join(" ");
  const evidenceType = String(evidenceItem.type || "")
    .trim()
    .toLowerCase();

  if (evidenceType === "witness") {
    return true;
  }

  if (["risk", "evidence"].includes(factKind)) {
    return true;
  }

  if (isDocumentationGapFact(fact) && isDocumentationEvidenceType(evidenceType)) {
    return true;
  }

  if (
    /\b(proof gap|proof-gaps|missing|uncertain|unclear|incomplete|availability|documentation|invoice|receipt|work order|records?)\b/i.test(
      factCorpus
    ) &&
    isDocumentationEvidenceType(evidenceType)
  ) {
    return true;
  }

  return false;
};

export const reconcileEvidenceGraph = (payload = {}) => {
  const facts = Array.isArray(payload.canonicalFacts) ? payload.canonicalFacts : [];
  const evidenceItems = Array.isArray(payload.evidenceItems) ? payload.evidenceItems : [];

  const factIdLookup = new Map(
    facts.flatMap((fact) => {
      const factId = String(fact.factId || "").trim();
      const factLabel = String(fact.label || "").trim();
      return [
        [normalizeLookupKey(factId), factId],
        [normalizeLookupKey(factLabel), factId],
      ].filter(([key, value]) => key && value);
    })
  );
  const evidenceIdLookup = new Map(
    evidenceItems.flatMap((item) => {
      const id = String(item.id || "").trim();
      const label = String(item.label || "").trim();
      return [
        [normalizeLookupKey(id), id],
        [normalizeLookupKey(label), id],
      ].filter(([key, value]) => key && value);
    })
  );

  const normalizedFacts = facts.map((fact) => ({
    ...fact,
    evidenceRefs: uniqueList(
      (fact.evidenceRefs || [])
        .map((ref) => evidenceIdLookup.get(normalizeLookupKey(ref)) || "")
        .filter(Boolean)
    ),
  }));
  const normalizedEvidenceItems = evidenceItems.map((item) => ({
    ...item,
    linkedFactIds: uniqueList(
      (item.linkedFactIds || [])
        .map((factId) => factIdLookup.get(normalizeLookupKey(factId)) || "")
        .filter(Boolean)
    ),
  }));

  const evidenceRefsByFactId = new Map(
    normalizedFacts.map((fact) => [String(fact.factId || "").trim(), new Set(fact.evidenceRefs || [])])
  );
  const linkedFactIdsByEvidenceId = new Map(
    normalizedEvidenceItems.map((item) => [
      String(item.id || "").trim(),
      new Set(item.linkedFactIds || []),
    ])
  );

  normalizedEvidenceItems.forEach((item) => {
    const evidenceId = String(item.id || "").trim();
    (item.linkedFactIds || []).forEach((factId) => {
      if (!evidenceRefsByFactId.has(factId)) {
        evidenceRefsByFactId.set(factId, new Set());
      }
      evidenceRefsByFactId.get(factId).add(evidenceId);
    });
  });

  normalizedFacts.forEach((fact) => {
    const factId = String(fact.factId || "").trim();
    (fact.evidenceRefs || []).forEach((evidenceId) => {
      if (!linkedFactIdsByEvidenceId.has(evidenceId)) {
        linkedFactIdsByEvidenceId.set(evidenceId, new Set());
      }
      linkedFactIdsByEvidenceId.get(evidenceId).add(factId);
    });
  });

  return {
    ...payload,
    canonicalFacts: normalizedFacts.map((fact) => ({
      ...fact,
      evidenceRefs: uniqueList([...(evidenceRefsByFactId.get(String(fact.factId || "").trim()) || [])]),
    })),
    evidenceItems: normalizedEvidenceItems.map((item) => ({
      ...item,
      linkedFactIds: uniqueList([
        ...(linkedFactIdsByEvidenceId.get(String(item.id || "").trim()) || []),
      ]),
    })),
  };
};

export const BLOCKING_REPAIR_PATTERNS = [
  /meta\/scaffolded/i,
  /does not resolve to an evidence item id/i,
  /not linked back to the fact/i,
  /not linked to any canonical fact/i,
  /missing evidencerefs even though evidence links to it/i,
  /does not appear semantically related/i,
  /misclassified as a risk/i,
];

export const hasBlockingTemplateIssues = (issues = []) =>
  (issues || []).some((issue) =>
    BLOCKING_REPAIR_PATTERNS.some((pattern) => pattern.test(String(issue || "")))
  );

export const detectTemplateRepairIssues = (payload = {}, canonicalStory = "") => {
  const issues = [];
  const title = String(payload.title || "").trim();
  const subtitle = String(payload.subtitle || "").trim();
  const desiredRelief = String(payload.desiredRelief || "").trim();
  const story = String(canonicalStory || payload.authoringNotes || "").trim();

  if (
    [title, subtitle].some((text) => /cool/i.test(text)) &&
    /heat/i.test(story) &&
    !/cool/i.test(story)
  ) {
    issues.push(
      "The title or subtitle references cooling, but the canonical story is about heating problems."
    );
  }

  if (titleLooksGeneric(title)) {
    issues.push("The title is generic and should be replaced with a story-specific title.");
  }

  const allOpenings = [
    payload.interviewBlueprint?.plaintiff?.opening,
    payload.interviewBlueprint?.defendant?.opening,
  ].filter(Boolean);
  if (allOpenings.some((value) => META_SCAFFOLDING_PATTERN.test(String(value)))) {
    issues.push("Interview blueprint openings contain meta/scaffolded text instead of party voice.");
  }

  (payload.canonicalFacts || []).forEach((fact, index) => {
    (fact.claims || []).forEach((claim) => {
      if (META_SCAFFOLDING_PATTERN.test(String(claim.claimedDetail || ""))) {
        issues.push(
          `canonicalFacts[${index}] contains meta/scaffolded claim text for ${claim.party}.`
        );
      }

      if (
        isCrossCaseContaminatedClaim({
          claimText: claim.claimedDetail,
          fact,
          canonicalStory,
        })
      ) {
        issues.push(
          `canonicalFacts[${index}] contains claim text for ${claim.party} that appears to belong to a different case domain.`
        );
      }
    });

    if (fact.kind === "risk" && isRepairInactionFact(fact)) {
      issues.push(
        `canonicalFacts[${index}] is misclassified as a risk even though it describes ignored repairs or landlord inaction.`
      );
    }
  });

  const evidenceItems = payload.evidenceItems || [];
  const evidenceById = new Map(
    evidenceItems.map((item) => [String(item.id || "").trim(), item])
  );
  const evidenceLinkedFactIds = new Set(
    evidenceItems.flatMap((item) => (item.linkedFactIds || []).map((factId) => String(factId)))
  );

  evidenceItems.forEach((item, index) => {
    if (!(item.linkedFactIds || []).length) {
      issues.push(`evidenceItems[${index}] is not linked to any canonical fact.`);
    }
  });

  (payload.canonicalFacts || []).forEach((fact, index) => {
    const factId = String(fact.factId || "");
    if ((fact.evidenceRefs || []).length === 0 && evidenceLinkedFactIds.has(factId)) {
      issues.push(`canonicalFacts[${index}] is missing evidenceRefs even though evidence links to it.`);
    }

    (fact.evidenceRefs || []).forEach((ref) => {
      const evidenceItem = evidenceById.get(String(ref || "").trim());

      if (!evidenceItem) {
        issues.push(`canonicalFacts[${index}] references evidenceRef "${ref}" that does not resolve to an evidence item id.`);
        return;
      }

      if (
        Array.isArray(evidenceItem.linkedFactIds) &&
        evidenceItem.linkedFactIds.length > 0 &&
        !evidenceItem.linkedFactIds.map((id) => String(id)).includes(factId)
      ) {
        issues.push(
          `canonicalFacts[${index}] references evidence "${evidenceItem.label}" but that evidence is not linked back to the fact.`
        );
        return;
      }

      const factCorpus = [
        fact.label || "",
        fact.canonicalDetail || "",
        ...(fact.discoverability?.keywords || []),
      ].join(" ");
      const evidenceCorpus = [evidenceItem.label || "", evidenceItem.detail || ""].join(" ");

      if (
        !shouldSkipSemanticEvidenceMismatch(fact, evidenceItem) &&
        countSharedEvidenceTokens(factCorpus, evidenceCorpus) === 0
      ) {
        issues.push(
          `canonicalFacts[${index}] references evidence "${evidenceItem.label}" that does not appear semantically related.`
        );
      }
    });
  });

  const reliefAmounts = extractMoneyValues(desiredRelief);
  const storyAmounts = extractMoneyValues(story);
  const factAmounts = (payload.canonicalFacts || []).flatMap((fact) =>
    extractMoneyValues(fact.canonicalDetail || "")
  );
  const distinctAmounts = uniqueList([...reliefAmounts, ...storyAmounts, ...factAmounts]);

  if (distinctAmounts.length >= 3) {
    issues.push(
      "There are multiple distinct money amounts across desired relief, canonical story, and facts; verify the deposit and damage amounts are consistent."
    );
  }

  const factCountWithoutEvidence = (payload.canonicalFacts || []).filter((fact) => {
    const factId = String(fact.factId || "");
    return !evidenceLinkedFactIds.has(factId) && !(fact.evidenceRefs || []).length;
  }).length;
  if (factCountWithoutEvidence >= 3 && evidenceItems.length > 0) {
    issues.push("Too many canonical facts are disconnected from the available evidence graph.");
  }

  return uniqueList(issues);
};

export const hasUsableCanonicalFacts = (payload = {}) =>
  Array.isArray(payload.canonicalFacts) &&
  payload.canonicalFacts.some(
    (fact) =>
      String(fact?.canonicalDetail || "").trim() &&
      Array.isArray(fact?.claims) &&
      fact.claims.some((claim) => claim.party === "plaintiff") &&
      fact.claims.some((claim) => claim.party === "defendant")
  );

export const withCanonicalStoryNote = (payload = {}, canonicalStory = "") => {
  if (!canonicalStory) {
    return payload;
  }

  const existingNotes = String(payload.authoringNotes || "")
    .replace(/\n*\s*Canonical story:\s[\s\S]*$/i, "")
    .trim();

  return {
    ...payload,
    authoringNotes: uniqueList([
      existingNotes,
      `Canonical story: ${String(canonicalStory).trim()}`,
    ]).join("\n\n"),
  };
};

export const normalizeGeneratedPayload = (payload, categorySlug, complexity) => {
  const normalizedPayload = enrichTemplateForGameplay({
    ...payload,
    sourceType: "generated",
    status: "active",
    title: String(payload.title || "").trim(),
    subtitle: String(payload.subtitle || "").trim(),
    openingStatement: normalizeClientIntakeStatement(payload.openingStatement),
    plaintiffName: String(payload.plaintiffName || payload.clientName || "").trim(),
    defendantName: String(payload.defendantName || payload.opponentName || "").trim(),
    primaryCategory: normalizeCategorySlug(payload.primaryCategory, categorySlug),
    complexity,
    secondaryCategories: Array.isArray(payload.secondaryCategories)
      ? payload.secondaryCategories.map((item) => String(item).trim()).filter(Boolean)
      : [],
    legalTags:
      Array.isArray(payload.legalTags) &&
      payload.legalTags.map((item) => String(item).trim()).filter(Boolean).length > 0
        ? payload.legalTags.map((item) => String(item).trim()).filter(Boolean)
        : categoryLegalTagDefaults[categorySlug] || ["records", "evidence", "credibility"],
    partyProfiles: {
      plaintiff: normalizePartyProfile(payload.partyProfiles?.plaintiff, "plaintiff"),
      defendant: normalizePartyProfile(payload.partyProfiles?.defendant, "defendant"),
    },
    canonicalFacts: Array.isArray(payload.canonicalFacts)
      ? payload.canonicalFacts.map((fact, index) => ({
          factId: String(fact.factId || `fact-${index + 1}`).trim(),
          label: String(fact.label || `Fact ${index + 1}`).trim(),
          kind: inferGeneratedFactKind(fact),
          truthStatus: ["verified", "probable", "uncertain"].includes(fact.truthStatus)
            ? fact.truthStatus
            : "verified",
          canonicalDetail: String(fact.canonicalDetail || "").trim(),
          discoverability: {
            keywords: Array.isArray(fact.discoverability?.keywords)
              ? fact.discoverability.keywords.map((item) => String(item).trim()).filter(Boolean)
              : [],
            phase: ["interview", "courtroom"].includes(fact.discoverability?.phase)
              ? fact.discoverability.phase
              : "interview",
            priority:
              typeof fact.discoverability?.priority === "number"
                ? Math.max(1, Math.min(5, fact.discoverability.priority))
                : 3,
          },
          evidenceRefs: Array.isArray(fact.evidenceRefs)
            ? fact.evidenceRefs.map((item) => String(item).trim()).filter(Boolean)
            : [],
          followUpQuestions: Array.isArray(fact.followUpQuestions)
            ? fact.followUpQuestions.map((item) => String(item).trim()).filter(Boolean)
            : [],
          claims: ensurePartyCoverage({
            ...fact,
            kind: inferGeneratedFactKind(fact),
            claims: normalizeClaims(fact.claims).map((claim) => ({
              ...claim,
              claimedDetail:
                isDocumentationGapFact(fact) &&
                LEGAL_CONCLUSION_PATTERN.test(String(claim.claimedDetail || ""))
                  ? buildDocumentationGapClaim({
                      party: normalizeTemplateParty(claim.party),
                      canonicalDetail: fact.canonicalDetail,
                    })
                  : claim.claimedDetail,
            })),
          }, payload.authoringNotes || ""),
        }))
      : [],
    evidenceItems: Array.isArray(payload.evidenceItems)
      ? payload.evidenceItems.map((item, index) => ({
          id: String(item.id || `evidence-${index + 1}`).trim(),
          label: String(item.label || `Evidence ${index + 1}`).trim(),
          detail: String(item.detail || "").trim(),
          type: normalizeEvidenceType(item.type),
          availabilityStatus:
            normalizeEvidenceAvailabilityStatus(item.availabilityStatus) || "unknown",
          holderSide: normalizeEvidenceHolderSide(item.holderSide) || "unknown",
          linkedFactIds: Array.isArray(item.linkedFactIds)
            ? item.linkedFactIds.map((factId) => String(factId).trim()).filter(Boolean)
            : [],
          followUpQuestions: Array.isArray(item.followUpQuestions)
            ? item.followUpQuestions.map((value) => String(value).trim()).filter(Boolean)
            : [],
        }))
      : [],
    interviewBlueprint: {
      plaintiff: normalizeBlueprintSide(
        payload.interviewBlueprint?.plaintiff || payload.interviewBlueprint?.client
      ),
      defendant: normalizeBlueprintSide(
        payload.interviewBlueprint?.defendant || payload.interviewBlueprint?.opponent
      ),
    },
  });

  return reconcileEvidenceGraph(normalizedPayload);
};

export const mergeInterviewPlanningPayload = (payload, plan = {}) => {
  const factPatchMap = new Map(
    (Array.isArray(plan.canonicalFacts) ? plan.canonicalFacts : [])
      .filter((item) => item?.factId)
      .map((item) => [String(item.factId).trim(), item])
  );
  const evidencePatchMap = new Map(
    (Array.isArray(plan.evidenceItems) ? plan.evidenceItems : [])
      .filter((item) => item?.id)
      .map((item) => [String(item.id).trim(), item])
  );

  return enrichTemplateForGameplay({
    ...payload,
    canonicalFacts: (payload.canonicalFacts || []).map((fact) => {
      const patch = factPatchMap.get(fact.factId) || {};
      const truthStatus = ["verified", "probable", "uncertain"].includes(patch.truthStatus)
        ? patch.truthStatus
        : fact.truthStatus;

      return {
        ...fact,
        truthStatus,
        followUpQuestions: Array.isArray(patch.followUpQuestions)
          ? patch.followUpQuestions.map((item) => String(item).trim()).filter(Boolean)
          : fact.followUpQuestions,
      };
    }),
    evidenceItems: (payload.evidenceItems || []).map((item) => {
      const patch = evidencePatchMap.get(item.id) || {};

      return {
        ...item,
        availabilityStatus:
          normalizeEvidenceAvailabilityStatus(patch.availabilityStatus) ||
          item.availabilityStatus ||
          "unknown",
        holderSide:
          normalizeEvidenceHolderSide(patch.holderSide) ||
          item.holderSide ||
          "unknown",
        followUpQuestions: Array.isArray(patch.followUpQuestions)
          ? patch.followUpQuestions.map((value) => String(value).trim()).filter(Boolean)
          : item.followUpQuestions,
      };
    }),
    interviewBlueprint: {
      plaintiff: {
        ...(payload.interviewBlueprint?.plaintiff ||
          payload.interviewBlueprint?.client ||
          {}),
        ...normalizeBlueprintPatchSide(
          plan.interviewBlueprint?.plaintiff || plan.interviewBlueprint?.client
        ),
      },
      defendant: {
        ...(payload.interviewBlueprint?.defendant ||
          payload.interviewBlueprint?.opponent ||
          {}),
        ...normalizeBlueprintPatchSide(
          plan.interviewBlueprint?.defendant || plan.interviewBlueprint?.opponent
        ),
      },
    },
    partyProfiles: {
      plaintiff: normalizePartyProfile(
        plan.partyProfiles?.plaintiff || payload.partyProfiles?.plaintiff || {},
        "plaintiff"
      ),
      defendant: normalizePartyProfile(
        plan.partyProfiles?.defendant || payload.partyProfiles?.defendant || {},
        "defendant"
      ),
    },
  });
};
