const SIDE_VALUES = ["client", "opponent"];
const EVIDENCE_AVAILABILITY_VALUES = [
  "confirmed",
  "mentioned",
  "unknown",
  "missing",
  "contested",
];
const EVIDENCE_HOLDER_VALUES = [
  "client",
  "opponent",
  "shared",
  "third-party",
  "unknown",
];

const uniqueList = (items = []) =>
  [...new Set((items || []).map((item) => String(item || "").trim()).filter(Boolean))];

const normalizeStringList = (value) =>
  Array.isArray(value)
    ? value.map((item) => String(item || "").trim()).filter(Boolean)
    : [];

export const normalizeEvidenceAvailabilityStatus = (value = "") =>
  EVIDENCE_AVAILABILITY_VALUES.includes(String(value || "").trim())
    ? String(value || "").trim()
    : "";

export const normalizeEvidenceHolderSide = (value = "") =>
  EVIDENCE_HOLDER_VALUES.includes(String(value || "").trim())
    ? String(value || "").trim()
    : "";

export const cleanPartyClaimText = (value = "") =>
  String(value || "")
    .trim()
    .replace(
      /\bthe opponent would use this point to challenge the client's credibility:\s*/gi,
      ""
    )
    .replace(
      /\bthe opponent is likely to minimize the importance of this event or frame it differently:\s*/gi,
      ""
    )
    .replace(
      /\bthe opponent disputes the client's framing and says the fact does not prove liability:\s*/gi,
      ""
    )
    .replace(/\bi don't think this should matter much, but\s*/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim();

const lowerFirst = (value = "") =>
  value ? `${value.charAt(0).toLowerCase()}${value.slice(1)}` : "";

const buildFallbackFactQuestion = (fact, evidenceItems = []) => {
  const factLabel = String(fact.label || fact.canonicalDetail || "this issue").trim();
  const unresolvedEvidence = evidenceItems.find(
    (item) => item.availabilityStatus && item.availabilityStatus !== "confirmed"
  );

  if (unresolvedEvidence) {
    return `What proof do you actually have for ${lowerFirst(factLabel)}?`;
  }

  if (fact.kind === "timeline") {
    return `Can you walk me through ${lowerFirst(factLabel)}?`;
  }

  if (fact.kind === "risk" || fact.kind === "dispute") {
    return `What is the weak spot around ${lowerFirst(factLabel)}?`;
  }

  return `What happened with ${lowerFirst(factLabel)}?`;
};

const buildFallbackEvidenceQuestion = (item) => {
  const label = String(item.label || item.detail || "that record").trim();

  switch (item.availabilityStatus) {
    case "confirmed":
      return `What does ${lowerFirst(label)} show?`;
    case "mentioned":
      return `Do you actually have ${lowerFirst(label)}, or just think it exists?`;
    case "missing":
      return `Why do you not have ${lowerFirst(label)} yet?`;
    case "contested":
      return `Who is going to challenge ${lowerFirst(label)} and why?`;
    default:
      return `Do you know whether ${lowerFirst(label)} exists?`;
  }
};

const inferEvidenceAvailabilityStatus = (item = {}, factsById = new Map()) => {
  const explicit = normalizeEvidenceAvailabilityStatus(item.availabilityStatus);

  if (explicit) {
    return explicit;
  }

  const linkedFacts = normalizeStringList(item.linkedFactIds)
    .map((factId) => factsById.get(factId))
    .filter(Boolean);

  if (linkedFacts.some((fact) => fact.truthStatus === "verified")) {
    return "confirmed";
  }

  if (linkedFacts.some((fact) => fact.truthStatus === "probable")) {
    return "mentioned";
  }

  if (linkedFacts.some((fact) => fact.truthStatus === "uncertain")) {
    return "unknown";
  }

  return "unknown";
};

const normalizeEvidenceItem = (item = {}, index = 0, factsById = new Map()) => {
  const linkedFactIds = normalizeStringList(item.linkedFactIds);
  const availabilityStatus = inferEvidenceAvailabilityStatus(
    { ...item, linkedFactIds },
    factsById
  );
  const holderSide = normalizeEvidenceHolderSide(item.holderSide) || "unknown";

  return {
    ...item,
    id: String(item.id || `evidence-${index + 1}`).trim(),
    label: String(item.label || `Evidence ${index + 1}`).trim(),
    detail: String(item.detail || "").trim(),
    type: String(item.type || "document").trim(),
    linkedFactIds,
    availabilityStatus,
    holderSide,
    followUpQuestions: uniqueList(
      normalizeStringList(item.followUpQuestions).length
        ? normalizeStringList(item.followUpQuestions)
        : [buildFallbackEvidenceQuestion({ ...item, availabilityStatus })]
    ),
  };
};

const normalizeFact = (fact = {}, index = 0, evidenceById = new Map()) => {
  const evidenceRefs = normalizeStringList(fact.evidenceRefs);
  const linkedEvidenceItems = evidenceRefs.map((ref) => evidenceById.get(ref)).filter(Boolean);

  return {
    ...fact,
    factId: String(fact.factId || `fact-${index + 1}`).trim(),
    label: String(fact.label || `Fact ${index + 1}`).trim(),
    canonicalDetail: String(fact.canonicalDetail || "").trim(),
    evidenceRefs,
    followUpQuestions: uniqueList(
      normalizeStringList(fact.followUpQuestions).length
        ? normalizeStringList(fact.followUpQuestions)
        : [buildFallbackFactQuestion(fact, linkedEvidenceItems)]
    ),
  };
};

const getTopClaimForSide = (template, side) => {
  const facts = Array.isArray(template.canonicalFacts) ? template.canonicalFacts : [];

  return facts
    .slice()
    .sort(
      (left, right) =>
        (right.discoverability?.priority || 0) - (left.discoverability?.priority || 0)
    )
    .map((fact) => (fact.claims || []).find((claim) => claim.party === side))
    .find((claim) => claim?.claimedDetail);
};

const buildFallbackOpening = (template, side) => {
  const claim = getTopClaimForSide(template, side);
  const playerName = side === "opponent" ? template.opponentName : template.clientName;
  const otherName = side === "opponent" ? template.clientName : template.opponentName;

  if (claim?.claimedDetail) {
    return cleanPartyClaimText(claim.claimedDetail);
  }

  if (side === "client") {
    return String(template.openingStatement || "").trim();
  }

  return `${playerName} disputes ${otherName}'s request for relief and wants the court to reject or reduce it.`;
};

const normalizeBlueprintSide = (value = {}, template, side) => ({
  opening: String(value.opening || "").trim() || buildFallbackOpening(template, side),
  posture: String(value.posture || "").trim(),
  priorityFactIds: uniqueList(value.priorityFactIds || []),
  suggestedQuestions: uniqueList(value.suggestedQuestions || []),
});

export const enrichTemplateForGameplay = (template = {}) => {
  const baseFacts = Array.isArray(template.canonicalFacts) ? template.canonicalFacts : [];
  const factsById = new Map(
    baseFacts.map((fact, index) => [
      String(fact.factId || `fact-${index + 1}`).trim(),
      {
        ...fact,
        factId: String(fact.factId || `fact-${index + 1}`).trim(),
      },
    ])
  );

  const evidenceItems = (Array.isArray(template.evidenceItems) ? template.evidenceItems : []).map(
    (item, index) => normalizeEvidenceItem(item, index, factsById)
  );
  const evidenceById = new Map(evidenceItems.map((item) => [item.id, item]));
  const canonicalFacts = baseFacts.map((fact, index) => normalizeFact(fact, index, evidenceById));
  const normalizedTemplate = {
    ...template,
    canonicalFacts,
    evidenceItems,
  };
  const interviewBlueprint = {
    client: normalizeBlueprintSide(template.interviewBlueprint?.client, normalizedTemplate, "client"),
    opponent: normalizeBlueprintSide(
      template.interviewBlueprint?.opponent,
      normalizedTemplate,
      "opponent"
    ),
  };

  return {
    ...normalizedTemplate,
    interviewBlueprint,
  };
};

export const getInterviewBlueprintForSide = (template = {}, side = "client") => {
  const safeTemplate = enrichTemplateForGameplay(template);
  return safeTemplate.interviewBlueprint?.[side] || safeTemplate.interviewBlueprint?.client;
};

export const buildSuggestedQuestionsForSide = (
  template = {},
  side = "client",
  { excludedFactIds = [], excludedEvidenceIds = [], limit = 3 } = {}
) => {
  const safeTemplate = enrichTemplateForGameplay(template);
  const blueprint = getInterviewBlueprintForSide(safeTemplate, side);
  const useBlueprintDirectly =
    excludedFactIds.length === 0 &&
    excludedEvidenceIds.length === 0 &&
    blueprint?.suggestedQuestions?.length;

  if (useBlueprintDirectly) {
    return blueprint.suggestedQuestions.slice(0, limit);
  }

  const facts = (safeTemplate.canonicalFacts || [])
    .filter((fact) => fact.discoverability?.phase !== "courtroom")
    .filter((fact) => !excludedFactIds.includes(fact.factId))
    .slice()
    .sort(
      (left, right) =>
        (right.discoverability?.priority || 0) - (left.discoverability?.priority || 0)
    );

  const evidenceItems = (safeTemplate.evidenceItems || [])
    .filter((item) => !excludedEvidenceIds.includes(item.id))
    .slice()
    .sort((left, right) => {
      const leftWeight = left.availabilityStatus === "confirmed" ? 0 : 1;
      const rightWeight = right.availabilityStatus === "confirmed" ? 0 : 1;

      return rightWeight - leftWeight;
    });

  return uniqueList([
    ...(blueprint?.suggestedQuestions || []),
    ...facts.flatMap((fact) => fact.followUpQuestions || []),
    ...evidenceItems.flatMap((item) => item.followUpQuestions || []),
  ]).slice(0, limit);
};

const describeEvidenceHolder = (holderSide, side) => {
  switch (holderSide) {
    case side:
      return "I";
    case "shared":
      return "both sides";
    case "third-party":
      return "a third party";
    case "client":
    case "opponent":
      return "the other side";
    default:
      return "someone";
  }
};

const buildMissingEvidenceNote = (item, side) => {
  const label = String(item.label || item.detail || "the record").trim();
  const holder = describeEvidenceHolder(item.holderSide, side);

  switch (item.availabilityStatus) {
    case "mentioned":
      return `${label} has been mentioned, but it still needs to be confirmed or collected.`;
    case "missing":
      return `${label} is not in hand yet. ${holder} may need to produce it.`;
    case "contested":
      return `${label} exists, but the other side is likely to dispute what it proves.`;
    case "unknown":
      return `We still need to determine whether ${lowerFirst(label)} exists and who has it.`;
    default:
      return "";
  }
};

export const buildMissingEvidenceNotesForSide = (template = {}, side = "client") => {
  const safeTemplate = enrichTemplateForGameplay(template);

  return uniqueList(
    (safeTemplate.evidenceItems || [])
      .map((item) => buildMissingEvidenceNote(item, side))
      .filter(Boolean)
  );
};

export const getEvidenceItemsForFact = (template = {}, fact = {}) => {
  const safeTemplate = enrichTemplateForGameplay(template);
  const refs = normalizeStringList(fact.evidenceRefs);
  const evidenceById = new Map((safeTemplate.evidenceItems || []).map((item) => [item.id, item]));

  return refs.map((ref) => evidenceById.get(ref)).filter(Boolean);
};

export const isFactCorroborated = (template = {}, fact = {}) =>
  getEvidenceItemsForFact(template, fact).some((item) => item.availabilityStatus === "confirmed");

export const getSideOpeningStatement = (template = {}, side = "client") =>
  getInterviewBlueprintForSide(template, side)?.opening || "";

export { SIDE_VALUES, EVIDENCE_AVAILABILITY_VALUES, EVIDENCE_HOLDER_VALUES };
