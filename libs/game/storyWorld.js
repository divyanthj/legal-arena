const cleanText = (value = "") => String(value || "").trim();
const cleanList = (items = []) =>
  (Array.isArray(items) ? items : [])
    .map((item) => cleanText(item))
    .filter(Boolean);

const stringifyStoryItem = (item = {}) => {
  if (typeof item === "string") {
    return cleanText(item);
  }

  return cleanText(
    [
      item.label,
      item.date || item.timing,
      item.event || item.detail || item.description || item.text,
      item.plaintiffState || item.defendantState || item.thoughtProcess,
    ]
      .filter(Boolean)
      .join(": ")
  );
};

export const normalizeCanonicalStory = (source = {}) => {
  const packet =
    source?.canonicalStoryPacket ||
    (source?.canonicalStory && typeof source.canonicalStory === "object"
      ? source.canonicalStory
      : source) ||
    {};
  const storyText = cleanText(packet.canonicalStory || packet.story || packet.narrative);
  const events = cleanList(packet.events || packet.storyBeats).map(stringifyStoryItem);
  const partyMentalStates = {
    plaintiff: cleanList(
      packet.partyMentalStates?.plaintiff ||
        packet.plaintiffMentalStates ||
        packet.plaintiffPressurePoints
    ).map(stringifyStoryItem),
    defendant: cleanList(
      packet.partyMentalStates?.defendant ||
        packet.defendantMentalStates ||
        packet.defendantPressurePoints
    ).map(stringifyStoryItem),
  };
  const evidenceNarrative = cleanList(
    packet.evidenceNarrative || packet.likelyEvidence
  ).map(stringifyStoryItem);
  const ambiguities = cleanList(
    packet.ambiguities || packet.missingOrUncertainRecords || packet.disputedIssues
  ).map(stringifyStoryItem);
  const authoringBoundaries = cleanList(
    packet.authoringBoundaries || packet.boundaries
  ).map(stringifyStoryItem);

  return {
    story: storyText,
    events,
    partyMentalStates,
    evidenceNarrative,
    ambiguities,
    authoringBoundaries,
  };
};

export const buildCanonicalStoryFromLegacyTemplate = (template = {}) => {
  const factEvents = (template.canonicalFacts || [])
    .slice()
    .sort(
      (left, right) =>
        (left.discoverability?.priority || 3) - (right.discoverability?.priority || 3)
    )
    .map((fact) => fact.canonicalDetail || fact.label)
    .filter(Boolean);

  const evidenceNarrative = (template.evidenceItems || [])
    .map((item) => [item.label, item.detail].filter(Boolean).join(": "))
    .filter(Boolean);

  return normalizeCanonicalStory({
    canonicalStory: cleanText(
      [
        template.overview,
        template.authoringNotes,
        template.starterTheory,
      ]
        .filter(Boolean)
        .join("\n\n")
    ),
    events: factEvents,
    partyMentalStates: {
      plaintiff: [
        ...(template.partyProfiles?.plaintiff?.backgroundNotes || []),
        template.interviewBlueprint?.plaintiff?.posture || "",
      ],
      defendant: [
        ...(template.partyProfiles?.defendant?.backgroundNotes || []),
        template.interviewBlueprint?.defendant?.posture || "",
      ],
    },
    evidenceNarrative,
    ambiguities: [
      ...(template.evidenceItems || [])
        .filter((item) => ["missing", "unknown", "contested"].includes(item.availabilityStatus))
        .map((item) => `${item.label}: ${item.detail}`),
    ],
    authoringBoundaries: template.authoringNotes
      ? [`Stay within these case boundaries: ${template.authoringNotes}`]
      : [],
  });
};

export const getCanonicalStoryWorld = (template = {}) => {
  const normalized = normalizeCanonicalStory(template.canonicalStory);

  if (
    normalized.story ||
    normalized.events.length ||
    normalized.evidenceNarrative.length ||
    normalized.ambiguities.length
  ) {
    return normalized;
  }

  return buildCanonicalStoryFromLegacyTemplate(template);
};

export const buildSessionTemplateSnapshot = (template = {}) => ({
  id: template.id || template._id || "",
  slug: template.slug || "",
  title: template.title || "",
  subtitle: template.subtitle || "",
  overview: template.overview || "",
  desiredRelief: template.desiredRelief || "",
  openingStatement: template.openingStatement || "",
  starterTheory: template.starterTheory || "",
  practiceArea: template.practiceArea || "",
  primaryCategory: template.primaryCategory || "",
  secondaryCategories: template.secondaryCategories || [],
  complexity: template.complexity || 1,
  courtName: template.courtName || "",
  plaintiffName: template.plaintiffName || template.clientName || "",
  defendantName: template.defendantName || template.opponentName || "",
  clientName: template.clientName || template.plaintiffName || "",
  opponentName: template.opponentName || template.defendantName || "",
  legalTags: template.legalTags || [],
  authoringNotes: template.authoringNotes || "",
  partyProfiles: template.partyProfiles || {},
  interviewBlueprint: template.interviewBlueprint || {},
  canonicalFacts: template.canonicalFacts || [],
  evidenceItems: template.evidenceItems || [],
  canonicalStory: getCanonicalStoryWorld(template),
});

export const buildStoryContextForSide = (template = {}, side = "plaintiff") => {
  const storyWorld = getCanonicalStoryWorld(template);
  const normalizedSide = side === "defendant" || side === "opponent" ? "defendant" : "plaintiff";

  return {
    canonicalStory: storyWorld.story,
    chronologicalEvents: storyWorld.events,
    myMentalState: storyWorld.partyMentalStates?.[normalizedSide] || [],
    otherSideMentalState:
      storyWorld.partyMentalStates?.[
        normalizedSide === "plaintiff" ? "defendant" : "plaintiff"
      ] || [],
    evidenceInWorld: storyWorld.evidenceNarrative,
    ambiguities: storyWorld.ambiguities,
    authoringBoundaries: storyWorld.authoringBoundaries,
  };
};

export const buildJudgeProfile = ({ caseSessionId = "", complexity = 1 } = {}) => {
  const seed = String(caseSessionId || "judge");
  const sum = seed.split("").reduce((total, char) => total + char.charCodeAt(0), 0);
  const archetypes = [
    {
      label: "Proof-focused",
      proofStrictness: 0.75,
      equityWeight: 0.35,
      documentationWeight: 0.85,
      argumentVolatility: 0.2,
    },
    {
      label: "Equity-minded",
      proofStrictness: 0.45,
      equityWeight: 0.8,
      documentationWeight: 0.55,
      argumentVolatility: 0.3,
    },
    {
      label: "Pragmatic",
      proofStrictness: 0.6,
      equityWeight: 0.55,
      documentationWeight: 0.65,
      argumentVolatility: 0.25,
    },
  ];
  const profile = archetypes[sum % archetypes.length];

  return {
    ...profile,
    complexity,
    varianceSeed: sum % 11,
  };
};
