import "server-only";

import {
  uniqueList,
  ensureTemplate,
  getClaimId,
  normalizeFactSheetPatch,
  getInterviewQuestionHistory,
  resolveFactSheetOpenQuestions,
  mergeFactSheet,
  coerceString,
  coerceStringList,
  sanitizeIdList,
} from "./shared";
import { normalizeMemoryClaims } from "../memoryClaims";

const cleanPartyResponseAddress = (value = "") =>
  String(value || "")
    .replace(/\s+/g, " ")
    .replace(/^(your\s+honou?r|judge|court)\s*[:,.-]?\s*/i, "")
    .trim();

export const normalizeInterviewResult = ({
  aiResult,
  template,
  caseSession,
  question,
  factSheet,
  playerSide,
}) => {
  const safeTemplate = ensureTemplate(template);
  if (!aiResult || typeof aiResult !== "object") {
    throw new Error("Interview response generation failed.");
  }

  const partyResponse = cleanPartyResponseAddress(coerceString(aiResult.partyResponse));
  if (!partyResponse) {
    throw new Error("Interview response generation returned no answer.");
  }

  const validFactIds = (safeTemplate.canonicalFacts || []).map((fact) => fact.factId);
  const validEvidenceIds = (safeTemplate.evidenceItems || []).map((item) => item.id);
  const revealedFactIds = sanitizeIdList(
    aiResult.revealedFactIds || aiResult.discoveredFactIds || aiResult.relatedFactIds,
    validFactIds,
    6
  );
  const revealedEvidenceIds = sanitizeIdList(
    aiResult.revealedEvidenceIds || aiResult.discoveredEvidenceIds,
    validEvidenceIds,
    6
  );
  const relatedFactIds = uniqueList([
    ...sanitizeIdList(aiResult.relatedFactIds, validFactIds, 6),
    ...revealedFactIds,
    ...revealedEvidenceIds.flatMap((id) => {
      const item = (safeTemplate.evidenceItems || []).find((entry) => entry.id === id);
      return item?.linkedFactIds || [];
    }),
  ]);
  const questionHistory = getInterviewQuestionHistory(caseSession, question);
  const patch = normalizeFactSheetPatch({
    summary: coerceString(aiResult.summary),
    timeline: coerceStringList(aiResult.timeline, 3),
    supportingFacts: coerceStringList(aiResult.supportingFacts, 3),
    risks: coerceStringList(aiResult.risks, 3),
    theory: coerceString(aiResult.theory),
    desiredRelief: coerceString(aiResult.desiredRelief),
    knownFacts: [],
    knownClaims: coerceStringList(aiResult.knownClaims, 4),
    disputedFacts: coerceStringList(aiResult.disputedFacts, 3),
    corroboratedFacts: coerceStringList(aiResult.corroboratedFacts, 3),
    sourceLinks: coerceStringList(aiResult.sourceLinks, 3),
    missingEvidence: coerceStringList(aiResult.missingEvidence, 3),
    openQuestions: coerceStringList(aiResult.openQuestions, 3),
    discoveredFactIds: revealedFactIds,
    discoveredClaimIds: revealedFactIds.map((factId) => getClaimId(factId, playerSide)),
    discoveredEvidenceIds: revealedEvidenceIds,
  });
  const mergedPatch = normalizeFactSheetPatch({
    ...patch,
    openQuestions: resolveFactSheetOpenQuestions({
      template: safeTemplate,
      playerSide,
      currentOpenQuestions: factSheet.openQuestions || [],
      patchOpenQuestions: patch.openQuestions,
      discoveredFactIds: patch.discoveredFactIds,
      discoveredEvidenceIds: patch.discoveredEvidenceIds,
      blockedQuestions: questionHistory,
      limit: 3,
    }),
  });

  return {
    partyResponse,
    newMemoryClaims: normalizeMemoryClaims(aiResult.newMemoryClaims || [], playerSide),
    patch: mergedPatch,
    nextFactSheet: mergeFactSheet(factSheet, mergedPatch, safeTemplate, {
      playerSide,
      questionHistory,
    }),
    relatedFactIds,
    discoveredClaimIds: mergedPatch.discoveredClaimIds,
  };
};
