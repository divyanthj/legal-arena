export const CASE_ASSEMBLY_STAGES = [
  {
    key: "brief",
    title: "Brief received",
    description: "Your category, jurisdiction, and difficulty are locked in.",
  },
  {
    key: "draft",
    title: "Drafting the matter",
    description: "Building the dispute, competing accounts, evidence gaps, and objectives.",
  },
  {
    key: "dossier",
    title: "Assembling the dossier",
    description: "Assigning your side and preparing the opening client file.",
  },
  {
    key: "portraits",
    title: "Creating courtroom portraits",
    description: "Commissioning the client and opposing-counsel portraits in parallel.",
  },
  {
    key: "opening",
    title: "Opening client intake",
    description: "Moving the completed file onto your desk.",
  },
];

export const CASE_ASSEMBLY_TIP_INTERVAL_MS = 6000;

export const CASE_ASSEMBLY_TIPS = [
  "Ask one focused question at a time. Specific questions uncover stronger facts than broad invitations.",
  "Separate what your client believes from what the available evidence can actually prove.",
  "A contradiction is most useful when you can connect it to a document, message, or timeline entry.",
  "Before arguing, identify the strongest point for the other side and answer it directly.",
  "Strong courtroom arguments link a legal issue, a proven fact, and a concrete piece of evidence.",
  "Settlement leverage comes from risks the other side understands, not just demands your client prefers.",
];

export const HEADLINES_CASE_ASSEMBLY_TIP =
  "Headlines matters fictionalize every identity and identifying detail. Inspiration sources are revealed only after the case is resolved.";

export const getCaseAssemblyTips = (categorySlug = "") =>
  categorySlug === "current-events"
    ? [HEADLINES_CASE_ASSEMBLY_TIP, ...CASE_ASSEMBLY_TIPS]
    : CASE_ASSEMBLY_TIPS;

export const getCaseAssemblyStageState = (stageKey, status) => {
  if (stageKey === "brief") return "complete";
  if (stageKey === "draft") {
    if (status === "generating") return "active";
    if (status === "error") return "error";
    return "complete";
  }
  if (stageKey === "dossier") {
    return ["portraits", "opening"].includes(status) ? "complete" : "upcoming";
  }
  if (stageKey === "portraits") {
    if (status === "portraits") return "active";
    if (status === "opening") return "complete";
    return "upcoming";
  }
  if (stageKey === "opening") return status === "opening" ? "active" : "upcoming";
  return "upcoming";
};

export const buildCaseAssemblyBrief = ({
  mode = "dynamic",
  categorySlug = "",
  categoryTitle = "Case category",
  difficultyLabel = "Difficulty selected",
  countryName = "Jurisdiction selected",
  templateTitle = "",
} = {}) => ({
  mode: mode === "template" ? "template" : "dynamic",
  categorySlug: String(categorySlug || ""),
  categoryTitle: String(categoryTitle || "Case category"),
  difficultyLabel: String(difficultyLabel || "Difficulty selected"),
  countryName: String(countryName || "Jurisdiction selected"),
  templateTitle: String(templateTitle || ""),
});

export const buildCaseAssemblyPreview = (caseSession = {}, fallbackTitle = "New matter") => ({
  id: String(caseSession.id || caseSession._id || caseSession.slug || ""),
  title: String(caseSession.title || fallbackTitle || "New matter"),
  courtName: String(
    caseSession.premise?.courtName ||
      caseSession.template?.courtName ||
      caseSession.scenario?.courtName ||
      "Court assignment ready"
  ),
  playerSideLabel: String(caseSession.playerSideLabel || "your assigned side"),
  playerPartyName: String(caseSession.playerPartyName || ""),
  opponentPartyName: String(caseSession.opponentPartyName || ""),
  clientName: String(
    caseSession.playerInterviewSubjectName ||
      caseSession.playerPartyName ||
      caseSession.premise?.clientName ||
      "Your client"
  ),
  opponentName: String(
    caseSession.opponentPartyName ||
      caseSession.premise?.opponentName ||
      "the opposing party"
  ),
  objective: String(caseSession.premise?.desiredRelief || "").trim(),
});
