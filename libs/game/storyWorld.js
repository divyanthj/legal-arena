const OBJECT_PLACEHOLDER_PATTERN = /^\[object\s+Object\]$/i;

const cleanText = (value = "") => {
  if (value === null || value === undefined) {
    return "";
  }

  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value).trim();
  }

  return "";
};

const isMeaningfulText = (value = "") => {
  const text = cleanText(value);
  return Boolean(text) && !OBJECT_PLACEHOLDER_PATTERN.test(text);
};

const isPlainObject = (value) =>
  value &&
  typeof value === "object" &&
  !Array.isArray(value) &&
  !(value instanceof Date);

const normalizeStoryObject = (item = {}) => {
  const normalized = {};

  Object.entries(item).forEach(([key, value]) => {
    if (value === null || value === undefined) {
      return;
    }

    if (Array.isArray(value)) {
      const list = normalizeStoryList(value);
      if (list.length) {
        normalized[key] = list;
      }
      return;
    }

    if (isPlainObject(value)) {
      const nested = normalizeStoryObject(value);
      if (Object.keys(nested).length) {
        normalized[key] = nested;
      }
      return;
    }

    if (typeof value === "number" || typeof value === "boolean") {
      normalized[key] = value;
      return;
    }

    const text = cleanText(value);
    if (isMeaningfulText(text)) {
      normalized[key] = text;
    }
  });

  return normalized;
};

export const storyItemToText = (item = {}) => {
  if (typeof item === "string" || typeof item === "number" || typeof item === "boolean") {
    return isMeaningfulText(item) ? cleanText(item) : "";
  }

  if (!isPlainObject(item)) {
    return "";
  }

  const primaryParts = [
    item.label,
    item.date || item.timing,
    item.event || item.detail || item.description || item.text || item.canonicalDetail,
    item.plaintiffState || item.defendantState || item.thoughtProcess || item.reaction,
  ]
    .map((value) => cleanText(value))
    .filter(isMeaningfulText);

  if (primaryParts.length) {
    return primaryParts.join(": ");
  }

  return Object.values(item)
    .flatMap((value) => {
      if (Array.isArray(value)) {
        return value.map(storyItemToText);
      }
      if (isPlainObject(value)) {
        return storyItemToText(value);
      }
      return cleanText(value);
    })
    .filter(isMeaningfulText)
    .join(": ");
};

const normalizeStoryItem = (item = {}) => {
  if (isPlainObject(item)) {
    const normalized = normalizeStoryObject(item);
    return storyItemToText(normalized) ? normalized : "";
  }

  const text = cleanText(item);
  return isMeaningfulText(text) ? text : "";
};

const normalizeStoryList = (items = []) =>
  (Array.isArray(items) ? items : [])
    .map((item) => normalizeStoryItem(item))
    .filter(Boolean);

const storyItemsToTextList = (items = []) =>
  normalizeStoryList(items).map(storyItemToText).filter(isMeaningfulText);

export const normalizeCanonicalStory = (source = {}) => {
  const packet =
    source?.canonicalStoryPacket ||
    (source?.canonicalStory && typeof source.canonicalStory === "object"
      ? source.canonicalStory
      : source) ||
    {};
  const storyText = cleanText(packet.canonicalStory || packet.story || packet.narrative);
  const events = normalizeStoryList(packet.events || packet.storyBeats);
  const partyMentalStates = {
    plaintiff: normalizeStoryList(
      packet.partyMentalStates?.plaintiff ||
        packet.plaintiffMentalStates ||
        packet.plaintiffPressurePoints
    ),
    defendant: normalizeStoryList(
      packet.partyMentalStates?.defendant ||
        packet.defendantMentalStates ||
        packet.defendantPressurePoints
    ),
  };
  const evidenceNarrative = normalizeStoryList(
    packet.evidenceNarrative || packet.likelyEvidence
  );
  const ambiguities = normalizeStoryList(
    packet.ambiguities || packet.missingOrUncertainRecords || packet.disputedIssues
  );
  const authoringBoundaries = normalizeStoryList(
    packet.authoringBoundaries || packet.boundaries
  );

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
  const legacyFallback = buildCanonicalStoryFromLegacyTemplate(template);

  if (
    normalized.story ||
    normalized.events.length ||
    normalized.evidenceNarrative.length ||
    normalized.ambiguities.length
  ) {
    return {
      ...normalized,
      events: normalized.events.length ? normalized.events : legacyFallback.events,
      partyMentalStates: {
        plaintiff: normalized.partyMentalStates.plaintiff.length
          ? normalized.partyMentalStates.plaintiff
          : legacyFallback.partyMentalStates.plaintiff,
        defendant: normalized.partyMentalStates.defendant.length
          ? normalized.partyMentalStates.defendant
          : legacyFallback.partyMentalStates.defendant,
      },
      evidenceNarrative: normalized.evidenceNarrative.length
        ? normalized.evidenceNarrative
        : legacyFallback.evidenceNarrative,
      ambiguities: normalized.ambiguities.length
        ? normalized.ambiguities
        : legacyFallback.ambiguities,
      authoringBoundaries: normalized.authoringBoundaries.length
        ? normalized.authoringBoundaries
        : legacyFallback.authoringBoundaries,
    };
  }

  return legacyFallback;
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
  dynamicCase: template.dynamicCase || null,
  canonicalStory: getCanonicalStoryWorld(template),
});

export const buildStoryContextForSide = (template = {}, side = "plaintiff") => {
  const storyWorld = getCanonicalStoryWorld(template);
  const normalizedSide = side === "defendant" || side === "opponent" ? "defendant" : "plaintiff";

  return {
    canonicalStory: storyWorld.story,
    chronologicalEvents: storyItemsToTextList(storyWorld.events),
    myMentalState: storyItemsToTextList(storyWorld.partyMentalStates?.[normalizedSide] || []),
    otherSideMentalState:
      storyItemsToTextList(
        storyWorld.partyMentalStates?.[
          normalizedSide === "plaintiff" ? "defendant" : "plaintiff"
        ] || []
      ),
    evidenceInWorld: storyItemsToTextList(storyWorld.evidenceNarrative),
    ambiguities: storyItemsToTextList(storyWorld.ambiguities),
    authoringBoundaries: storyItemsToTextList(storyWorld.authoringBoundaries),
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
