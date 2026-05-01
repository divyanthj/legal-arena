export const ALL_FILTER_OPTION = "all";

export const emptyManualTemplate = (defaultCategory) => ({
  title: "",
  subtitle: "",
  overview: "",
  desiredRelief: "",
  openingStatement: "",
  starterTheory: "",
  practiceArea: "",
  primaryCategory: defaultCategory,
  complexity: 2,
  courtName: "",
  plaintiffName: "",
  defendantName: "",
  legalTags: "",
  authoringNotes: "",
  canonicalFacts: JSON.stringify(
    [
      {
        factId: "fact-1",
        label: "Key event",
        kind: "timeline",
        truthStatus: "verified",
        canonicalDetail: "Describe what actually happened.",
        discoverability: {
          keywords: ["date", "event"],
          phase: "interview",
          priority: 3,
        },
        evidenceRefs: ["evidence-1"],
        claims: [
          {
            party: "plaintiff",
            claimedDetail: "Client version of this fact.",
            stance: "admits",
            confidence: 0.9,
            accessLevel: "direct",
            deceptionProfile: "straightforward",
            keywords: ["date", "event"],
          },
          {
            party: "defendant",
            claimedDetail: "Opponent version of this fact.",
            stance: "distorts",
            confidence: 0.7,
            accessLevel: "partial",
            deceptionProfile: "self-serving reframing",
            keywords: ["date", "event"],
          },
        ],
      },
    ],
    null,
    2
  ),
  evidenceItems: JSON.stringify(
    [
      {
        id: "evidence-1",
        label: "Key document",
        detail: "Describe the document, message, photo, or witness.",
        type: "document",
        linkedFactIds: ["fact-1"],
      },
    ],
    null,
    2
  ),
});

export const splitCsv = (value) =>
  value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

export const GENERATION_STAGES = [
  "Writing canon",
  "Writing plaintiff draft",
  "Writing defendant draft",
  "Detailing plaintiff",
  "Checking plaintiff plausibility",
  "Detailing defendant",
  "Checking defendant plausibility",
  "Building template",
  "Repairing template",
  "Planning interview",
];

export const parseSseEventBlocks = (buffer, onEvent) => {
  const blocks = buffer.split("\n\n");
  const remainder = blocks.pop() || "";

  blocks.forEach((block) => {
    const lines = block.split("\n");
    const eventLine = lines.find((line) => line.startsWith("event:"));
    const dataLines = lines.filter((line) => line.startsWith("data:"));

    if (!eventLine || dataLines.length === 0) {
      return;
    }

    const event = eventLine.replace("event:", "").trim();
    const data = dataLines.map((line) => line.replace("data:", "").trim()).join("\n");

    try {
      onEvent(event, JSON.parse(data));
    } catch (error) {
      console.error("Failed to parse generator stream event", event, error);
    }
  });

  return remainder;
};

export const formatTemplateForForm = (template) => ({
  id: template.id || "",
  title: template.title || "",
  subtitle: template.subtitle || "",
  overview: template.overview || "",
  desiredRelief: template.desiredRelief || "",
  openingStatement: template.openingStatement || "",
  starterTheory: template.starterTheory || "",
  practiceArea: template.practiceArea || "",
  primaryCategory: template.primaryCategory || "contract-violation",
  complexity: template.complexity || 2,
  courtName: template.courtName || "",
  plaintiffName: template.plaintiffName || template.clientName || "",
  defendantName: template.defendantName || template.opponentName || "",
  legalTags: (template.legalTags || []).join(", "),
  authoringNotes: template.authoringNotes || "",
  canonicalFacts: JSON.stringify(template.canonicalFacts || [], null, 2),
  evidenceItems: JSON.stringify(template.evidenceItems || [], null, 2),
});

export const SORTABLE_COLUMNS = {
  title: {
    label: "Title",
    getValue: (template) => template.title || "",
  },
  category: {
    label: "Category",
    getValue: (template, categoryMap) =>
      categoryMap.get(template.primaryCategory) || template.primaryCategory || "",
  },
  complexity: {
    label: "Complexity",
    getValue: (template) => Number(template.complexity) || 0,
  },
  plays: {
    label: "Plays",
    getValue: (template) => Number(template.plays) || 0,
  },
  wld: {
    label: "W/L/D",
    getValue: (template) =>
      `${template.wins || 0}-${template.losses || 0}-${template.draws || 0}`,
    compare: (left, right) => {
      const leftValues = [left.wins || 0, left.losses || 0, left.draws || 0];
      const rightValues = [right.wins || 0, right.losses || 0, right.draws || 0];

      for (let index = 0; index < leftValues.length; index += 1) {
        if (leftValues[index] !== rightValues[index]) {
          return leftValues[index] - rightValues[index];
        }
      }

      return 0;
    },
  },
};

export const formatCompletionTimeIst = (value = new Date()) =>
  new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  }).format(value);
