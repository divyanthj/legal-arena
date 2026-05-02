import "server-only";

export const baseTemplateOutputSchema = {
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
  canonicalStory: {
    story: "string",
    events: ["string"],
    partyMentalStates: {
      plaintiff: ["string"],
      defendant: ["string"],
    },
    evidenceNarrative: ["string"],
    ambiguities: ["string"],
    authoringBoundaries: ["string"],
  },
  partyProfiles: {
    plaintiff: {
      role: "plaintiff",
      occupation: "string",
      educationOrTraining: "string",
      communicationStyle: "plain|precise|guarded|rambling|combative|measured",
      intelligence: "number",
      memoryDiscipline: "number",
      honesty: "number",
      emotionalControl: "number",
      speechDeterminism: "number",
      backgroundNotes: ["string"],
    },
    defendant: {
      role: "defendant",
      occupation: "string",
      educationOrTraining: "string",
      communicationStyle: "plain|precise|guarded|rambling|combative|measured",
      intelligence: "number",
      memoryDiscipline: "number",
      honesty: "number",
      emotionalControl: "number",
      speechDeterminism: "number",
      backgroundNotes: ["string"],
    },
  },
  interviewBlueprint: {
    plaintiff: {
      opening: "string",
      posture: "string",
      priorityFactIds: ["string"],
      suggestedQuestions: ["string"],
    },
    defendant: {
      opening: "string",
      posture: "string",
      priorityFactIds: ["string"],
      suggestedQuestions: ["string"],
    },
  },
  canonicalFacts: [
    {
      factId: "string",
      label: "string",
      kind: "timeline|supporting|risk|dispute|evidence",
      truthStatus: "verified|probable|uncertain",
      canonicalDetail: "string",
      discoverability: {
        keywords: ["string"],
        phase: "interview|courtroom",
        priority: "number",
      },
      evidenceRefs: ["string"],
      followUpQuestions: ["string"],
      claims: [
        {
          party: "plaintiff|defendant",
          claimedDetail: "string",
          stance: "admits|denies|distorts|omits",
          confidence: "number",
          accessLevel: "direct|partial|hearsay",
          deceptionProfile: "string",
          keywords: ["string"],
        },
      ],
    },
  ],
  evidenceItems: [
    {
      id: "string",
      label: "string",
      detail: "string",
      type: "document|photo|message|invoice|witness|record|other",
      availabilityStatus: "confirmed|mentioned|unknown|missing|contested",
      holderSide: "plaintiff|defendant|shared|third-party|unknown",
      linkedFactIds: ["string"],
      followUpQuestions: ["string"],
    },
  ],
};

export const factInventoryOutputSchema = {
  canonicalFacts: [
    {
      factId: "string",
      label: "string",
      kind: "timeline|supporting|risk|dispute|evidence",
      truthStatus: "verified|probable|uncertain",
      canonicalDetail: "string",
      discoverability: {
        keywords: ["string"],
        phase: "interview|courtroom",
        priority: "number",
      },
      followUpQuestions: ["string"],
    },
  ],
};
