const SIDE_VALUES = ["plaintiff", "defendant"];
const EVIDENCE_AVAILABILITY_VALUES = [
  "confirmed",
  "mentioned",
  "unknown",
  "missing",
  "contested",
];
const EVIDENCE_HOLDER_VALUES = [
  "plaintiff",
  "defendant",
  "shared",
  "third-party",
  "unknown",
];

const normalizeTemplateParty = (value = "") => {
  const normalized = String(value || "").trim().toLowerCase();

  if (normalized === "client") return "plaintiff";
  if (normalized === "opponent") return "defendant";
  return normalized;
};

const uniqueList = (items = []) =>
  [...new Set((items || []).map((item) => String(item || "").trim()).filter(Boolean))];

const normalizeStringList = (value) =>
  Array.isArray(value)
    ? value.map((item) => String(item || "").trim()).filter(Boolean)
    : [];

const QUESTION_NOISE_TOKENS = new Set([
  "about",
  "after",
  "any",
  "before",
  "can",
  "could",
  "detail",
  "details",
  "did",
  "does",
  "exact",
  "exactly",
  "front",
  "have",
  "how",
  "kind",
  "more",
  "please",
  "really",
  "right",
  "should",
  "specific",
  "tell",
  "that",
  "there",
  "this",
  "what",
  "when",
  "where",
  "which",
  "who",
  "why",
  "with",
  "would",
  "your",
]);

const normalizeQuestionToken = (token = "") => {
  if (token.endsWith("ies") && token.length > 4) {
    return `${token.slice(0, -3)}y`;
  }

  if (token.endsWith("s") && token.length > 4) {
    return token.slice(0, -1);
  }

  return token;
};

const tokenizeQuestionSuggestion = (value = "") =>
  String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .map((token) => normalizeQuestionToken(token))
    .filter((token) => token.length > 2 && !QUESTION_NOISE_TOKENS.has(token));

const normalizeQuestionSuggestion = (value = "") =>
  String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const areQuestionSuggestionsEquivalent = (left = "", right = "") => {
  const normalizedLeft = normalizeQuestionSuggestion(left);
  const normalizedRight = normalizeQuestionSuggestion(right);

  if (!normalizedLeft || !normalizedRight) {
    return false;
  }

  if (normalizedLeft === normalizedRight) {
    return true;
  }

  const leftTokens = [...new Set(tokenizeQuestionSuggestion(left))];
  const rightTokens = [...new Set(tokenizeQuestionSuggestion(right))];

  if (!leftTokens.length || !rightTokens.length) {
    return false;
  }

  const rightTokenSet = new Set(rightTokens);
  const sharedCount = leftTokens.filter((token) => rightTokenSet.has(token)).length;
  const minTokenCount = Math.min(leftTokens.length, rightTokens.length);

  if (sharedCount === minTokenCount && minTokenCount >= 2) {
    return true;
  }

  return sharedCount >= 3 && sharedCount / minTokenCount >= 0.75;
};

export const dedupeSuggestedQuestions = (
  questions = [],
  { excludedQuestions = [], limit = Infinity } = {}
) => {
  const normalizedLimit =
    Number.isFinite(limit) && limit > 0 ? Math.floor(limit) : Infinity;
  const kept = [];
  const blocked = normalizeStringList(excludedQuestions);

  normalizeStringList(questions).forEach((question) => {
    if (
      blocked.some((blockedQuestion) =>
        areQuestionSuggestionsEquivalent(question, blockedQuestion)
      )
    ) {
      return;
    }

    if (
      kept.some((existingQuestion) =>
        areQuestionSuggestionsEquivalent(question, existingQuestion)
      )
    ) {
      return;
    }

    if (kept.length < normalizedLimit) {
      kept.push(question);
    }
  });

  return kept;
};

export const normalizeEvidenceAvailabilityStatus = (value = "") =>
  EVIDENCE_AVAILABILITY_VALUES.includes(String(value || "").trim())
    ? String(value || "").trim()
    : "";

export const normalizeEvidenceHolderSide = (value = "") =>
  EVIDENCE_HOLDER_VALUES.includes(normalizeTemplateParty(String(value || "").trim()))
    ? normalizeTemplateParty(String(value || "").trim())
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
    claims: Array.isArray(fact.claims)
      ? fact.claims.map((claim) => ({
          ...claim,
          party: SIDE_VALUES.includes(normalizeTemplateParty(claim.party))
            ? normalizeTemplateParty(claim.party)
            : "plaintiff",
        }))
      : [],
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
  const playerName =
    side === "defendant" ? template.defendantName : template.plaintiffName;
  const otherName =
    side === "defendant" ? template.plaintiffName : template.defendantName;

  if (claim?.claimedDetail) {
    return cleanPartyClaimText(claim.claimedDetail);
  }

  if (side === "plaintiff") {
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

const normalizeProfileScalar = (value, fallback) => {
  const raw =
    typeof value === "number" && Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : fallback;
  const softened =
    raw >= 0.95 ? 0.85 : raw <= 0.05 ? 0.15 : raw;

  return Math.round(softened * 20) / 20;
};

const normalizePartyProfile = (value = {}, role) => ({
  role,
  occupation: String(value.occupation || "").trim(),
  educationOrTraining: String(value.educationOrTraining || "").trim(),
  communicationStyle: [
    "plain",
    "precise",
    "guarded",
    "rambling",
    "combative",
    "measured",
  ].includes(value.communicationStyle)
    ? value.communicationStyle
    : "plain",
  intelligence: normalizeProfileScalar(value.intelligence, 0.5),
  memoryDiscipline: normalizeProfileScalar(value.memoryDiscipline, 0.5),
  honesty: normalizeProfileScalar(value.honesty, 0.7),
  emotionalControl: normalizeProfileScalar(value.emotionalControl, 0.5),
  speechDeterminism: normalizeProfileScalar(value.speechDeterminism, 0.5),
  backgroundNotes: uniqueList(value.backgroundNotes || []),
});

export const enrichTemplateForGameplay = (template = {}) => {
  const plaintiffName =
    String(template.plaintiffName || template.clientName || "").trim();
  const defendantName =
    String(template.defendantName || template.opponentName || "").trim();
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
    plaintiffName,
    defendantName,
    clientName: plaintiffName,
    opponentName: defendantName,
    partyProfiles: {
      plaintiff: normalizePartyProfile(template.partyProfiles?.plaintiff, "plaintiff"),
      defendant: normalizePartyProfile(template.partyProfiles?.defendant, "defendant"),
    },
    canonicalFacts,
    evidenceItems,
  };
  const interviewBlueprint = {
    plaintiff: normalizeBlueprintSide(
      template.interviewBlueprint?.plaintiff || template.interviewBlueprint?.client,
      normalizedTemplate,
      "plaintiff"
    ),
    defendant: normalizeBlueprintSide(
      template.interviewBlueprint?.defendant || template.interviewBlueprint?.opponent,
      normalizedTemplate,
      "defendant"
    ),
  };

  return {
    ...normalizedTemplate,
    interviewBlueprint,
  };
};

export const getInterviewBlueprintForSide = (template = {}, side = "plaintiff") => {
  const safeTemplate = enrichTemplateForGameplay(template);
  const normalizedSide = normalizeTemplateParty(side);
  return (
    safeTemplate.interviewBlueprint?.[normalizedSide] ||
    safeTemplate.interviewBlueprint?.plaintiff
  );
};

export const buildSuggestedQuestionsForSide = (
  template = {},
  side = "plaintiff",
  { excludedFactIds = [], excludedEvidenceIds = [], limit = 3 } = {}
) => {
  const safeTemplate = enrichTemplateForGameplay(template);
  const normalizedSide = normalizeTemplateParty(side);
  const blueprint = getInterviewBlueprintForSide(safeTemplate, normalizedSide);
  const useBlueprintDirectly =
    excludedFactIds.length === 0 &&
    excludedEvidenceIds.length === 0 &&
    blueprint?.suggestedQuestions?.length;

  if (useBlueprintDirectly) {
    return dedupeSuggestedQuestions(blueprint.suggestedQuestions, { limit });
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

  return dedupeSuggestedQuestions([
    ...(blueprint?.suggestedQuestions || []),
    ...facts.flatMap((fact) => fact.followUpQuestions || []),
    ...evidenceItems.flatMap((item) => item.followUpQuestions || []),
  ], { limit });
};

const describeEvidenceHolder = (holderSide, side) => {
  switch (holderSide) {
    case side:
      return "I";
    case "shared":
      return "both sides";
    case "third-party":
      return "a third party";
    case "plaintiff":
    case "defendant":
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

export const buildMissingEvidenceNotesForSide = (template = {}, side = "plaintiff") => {
  const safeTemplate = enrichTemplateForGameplay(template);
  const normalizedSide = normalizeTemplateParty(side);

  return uniqueList(
    (safeTemplate.evidenceItems || [])
      .map((item) => buildMissingEvidenceNote(item, normalizedSide))
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

export const getSideOpeningStatement = (template = {}, side = "plaintiff") =>
  getInterviewBlueprintForSide(template, side)?.opening || "";

export { SIDE_VALUES, EVIDENCE_AVAILABILITY_VALUES, EVIDENCE_HOLDER_VALUES, normalizeTemplateParty };
