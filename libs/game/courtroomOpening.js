import "server-only";

import { generatePlaintiffCourtOpeningStatement } from "./engine";
import { getOpposingSide, getPartyName, getPlayerSide, getTemplate } from "./engine/shared";
import { createUsageCollector } from "./sessionUsage";

const cleanText = (value = "") => String(value || "").replace(/\s+/g, " ").trim();

const buildFallbackPlaintiffOpening = (caseSession = {}) => {
  const template = getTemplate(caseSession);
  const playerSide = getPlayerSide(caseSession);
  const plaintiffSide = getOpposingSide(playerSide);
  const plaintiffName = getPartyName(template, plaintiffSide);
  const defendantName = getPartyName(template, playerSide);
  const factualOpening =
    cleanText(template?.openingStatement) ||
    cleanText(template?.overview) ||
    cleanText(caseSession?.premise?.openingStatement) ||
    "the defendant failed to provide the performance promised";
  const requestedRelief =
    cleanText(template?.desiredRelief) ||
    "the relief supported by the agreement and the evidence";

  return `May it please the Court. I represent ${plaintiffName}. ${factualOpening} We will show why ${defendantName} is responsible, and we ask the Court to award ${requestedRelief}.`;
};

export const ensurePlaintiffCourtOpening = async ({ caseSession, userId } = {}) => {
  const transcript = Array.isArray(caseSession?.courtroomTranscript)
    ? caseSession.courtroomTranscript
    : [];
  const needsOpening = Boolean(
    caseSession?.status === "courtroom" &&
      getPlayerSide(caseSession) === "opponent" &&
      Number(caseSession?.score?.roundsCompleted || 0) === 0 &&
      transcript.length === 0
  );

  if (!needsOpening) {
    return { created: false, usageEntries: [] };
  }

  const usageCollector = createUsageCollector("courtroom");
  let openingStatement = "";

  try {
    openingStatement = await generatePlaintiffCourtOpeningStatement({
      caseSession,
      userId,
      onUsage: usageCollector.record,
    });
  } catch (error) {
    console.error("plaintiff courtroom opening generation failed", error);
    openingStatement = buildFallbackPlaintiffOpening(caseSession);
  }

  caseSession.courtroomTranscript.push({
    round: 1,
    speaker: "opponent",
    text: openingStatement,
    citedFacts: [],
    citedClaimIds: [],
    citedEvidenceIds: [],
    citedRules: [],
    judgeNotes: {
      playerDelta: 0,
      opponentDelta: 0,
      strengths: [],
      weaknesses: [],
      benchSignal: "The plaintiff has opened the case. The defense may respond.",
    },
    createdAt: new Date(),
  });

  return { created: true, usageEntries: usageCollector.entries };
};
