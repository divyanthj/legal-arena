import "server-only";

import {
  buildMissingEvidenceNotesForSide,
  getEvidenceItemsForFact,
} from "../templateInterview";
import {
  uniqueList,
  clamp,
  lowerFirst,
  LOW_SIGNAL_TOKENS,
  DEFAULT_PLAYER_SIDE,
  OPPOSING_SIDE,
  tokenize,
  countSharedTokens,
  hashString,
  humanizeClaimText,
  stripClaimScaffolding,
  isMetaResponse,
  toSpokenSentence,
  getTemplate,
  ensureTemplate,
  getClaimId,
  getTemplatePartyForSessionSide,
  getOtherTemplateParty,
  getClaimForParty,
  getPlayerSide,
  getOpposingSide,
  getPartyName,
  getPartyProfileForSide,
  buildDesiredReliefForSide,
  buildTheoryForSide,
  buildOverviewForSide,
  buildSummaryForSide,
  buildInterviewDisputeNote,
  sortClaimsByRecallPriority,
  buildMemoryStyleClaimText,
  formatOpponentPosition,
  normalizeFactSheetPatch,
  buildOpenQuestions,
  getInterviewQuestionHistory,
  resolveFactSheetOpenQuestions,
  mergeFactSheet,
  coerceString,
  coerceStringList,
  sanitizeIdList,
  hasOpponentPraise,
  normalizeOpponentResponse,
  buildEvidencePromptPacket,
  buildClaimPromptPacket,
  buildRoleFactPacket,
  buildCanonicalWorldPacket,
  buildInterviewAgentContext,
} from "./shared";

import {
  buildEvidenceResponseSegment,
  buildEvidenceHolderResponseSegment,
  findSupportingEvidenceForClaims,
  pickRelevantEvidence,
  pickRelevantFacts,
} from "./interview/evidence";
import {
  buildSpecificDetailFallback,
  buildStalledProductionReply,
  hasRecordSearchPromise,
  isResponsiveInterviewAnswer,
  questionAsksForProofLikeEvidence,
  questionRequestsProductionOrLookup,
  shouldUseKnownSpecificFallback,
} from "./interview/questions";
export const buildRelevantMissingEvidenceNotes = ({
  safeTemplate,
  playerSide,
  partyClaims = [],
  matchedEvidence = [],
  lowerQuestion = "",
}) => {
  if (!questionAsksForProofLikeEvidence(lowerQuestion)) {
    return [];
  }

  const linkedEvidence = uniqueList([
    ...matchedEvidence.map((item) => item.id),
    ...partyClaims.flatMap((item) =>
      getEvidenceItemsForFact(safeTemplate, item.fact).map((evidenceItem) => evidenceItem.id)
    ),
  ])
    .map((id) => (safeTemplate.evidenceItems || []).find((item) => item.id === id))
    .filter(Boolean)
    .filter((item) => item.availabilityStatus !== "confirmed");

  return uniqueList(
    linkedEvidence.map((item) => buildMissingEvidenceNotesForSide({
      ...safeTemplate,
      evidenceItems: [item],
    }, playerSide)[0]).filter(Boolean)
  );
};

export const buildInterviewFallback = ({ caseSession, template, question, factSheet }) => {
  const safeTemplate = ensureTemplate(template);
  const playerSide = getPlayerSide(caseSession);
  const opponentSide = getOpposingSide(playerSide);
  const partyProfile = getPartyProfileForSide(safeTemplate, playerSide);
  const lowerQuestion = String(question || "").trim().toLowerCase();
  const questionHistory = getInterviewQuestionHistory(caseSession, question);
  const recentPartyResponses = caseSession.interviewTranscript
    .filter((entry) => entry.role === "party")
    .slice(-3)
    .map((entry) => entry.text?.trim())
    .filter(Boolean);
  const matchedFacts = pickRelevantFacts(
    safeTemplate,
    question,
    playerSide,
    factSheet.discoveredFactIds
  );

  const partyClaims = sortClaimsByRecallPriority(
    matchedFacts
    .map((fact) => ({
      fact,
      playerClaim: getClaimForParty(fact, playerSide),
      opposingClaim: getClaimForParty(fact, opponentSide),
    }))
    .filter((item) => item.playerClaim && !isMetaResponse(item.playerClaim.claimedDetail))
  );

  const factLinkedEvidence = uniqueList(
    partyClaims.flatMap((item) =>
      getEvidenceItemsForFact(safeTemplate, item.fact).map((evidenceItem) => evidenceItem.id)
    )
  )
    .map((id) => (safeTemplate.evidenceItems || []).find((item) => item.id === id))
    .filter(Boolean);
  const matchedEvidence = uniqueList([
    ...factLinkedEvidence.map((item) => item.id),
    ...pickRelevantEvidence(
      safeTemplate,
      question,
      playerSide,
      factSheet.discoveredEvidenceIds
    ).map(
      (item) => item.id
    ),
  ])
    .map((id) => (safeTemplate.evidenceItems || []).find((item) => item.id === id))
    .filter(Boolean);
  const supportingEvidence = findSupportingEvidenceForClaims({
    matchedEvidence,
    partyClaims,
    playerSide,
  });
  const remainingFacts = (safeTemplate.canonicalFacts || []).filter(
    (fact) => !factSheet.discoveredFactIds.includes(fact.factId)
  );
  const nextDiscoveredFactIds = uniqueList([
    ...factSheet.discoveredFactIds,
    ...partyClaims.map((item) => item.fact.factId),
  ]);
  const nextDiscoveredEvidenceIds = uniqueList([
    ...factSheet.discoveredEvidenceIds,
    ...matchedEvidence.map((item) => item.id),
  ]);
  const suggestedOpenQuestions = resolveFactSheetOpenQuestions({
    template: safeTemplate,
    playerSide,
    currentOpenQuestions: factSheet.openQuestions || [],
    discoveredFactIds: nextDiscoveredFactIds,
    discoveredEvidenceIds: nextDiscoveredEvidenceIds,
    blockedQuestions: questionHistory,
    limit: 3,
  });
  const leadQuestion = suggestedOpenQuestions[0];
  const evidenceResponse = supportingEvidence
    .slice(0, 1)
    .map((item) => buildEvidenceResponseSegment(item, playerSide))
    .join(" ");
  const responseCorpus = uniqueList([
    ...partyClaims.map((item) => humanizeClaimText(item.playerClaim.claimedDetail)),
    ...matchedEvidence.flatMap((item) => [item.label, item.detail]),
  ]).join(" ");

  const primaryClaim = partyClaims[0] || null;
  const secondaryClaim = partyClaims[1] || null;

  let partyResponse =
    primaryClaim
      ? [
          buildMemoryStyleClaimText(
            primaryClaim.playerClaim,
            primaryClaim.fact,
            partyProfile,
            question
          ),
          secondaryClaim &&
          countSharedTokens(
            primaryClaim.playerClaim.claimedDetail,
            secondaryClaim.playerClaim.claimedDetail
          ) > 1
            ? `I also remember that ${toSpokenSentence(
                secondaryClaim.playerClaim.claimedDetail
              )}`
            : "",
          evidenceResponse,
        ]
          .filter(Boolean)
          .join(" ")
      : evidenceResponse
      ? evidenceResponse
      : remainingFacts.length === 0
      ? "I do not know anything more specific about that right now."
      : "I do not know that detail right now.";
  const specificDetailFallback = buildSpecificDetailFallback({
    lowerQuestion,
    corpus: responseCorpus,
    bestKnownDetail: partyClaims[0]?.playerClaim?.claimedDetail || "",
    matchedEvidence,
    supportingEvidence,
    leadQuestion,
    playerSide,
  });

  const repeatedFallbackReply = recentPartyResponses.includes(partyResponse.trim());
  const holderQuestion =
    /\b(who|which)\b/.test(lowerQuestion) &&
    (lowerQuestion.includes("third party") ||
      lowerQuestion.includes("has it") ||
      lowerQuestion.includes("holds it") ||
      lowerQuestion.includes("who has"));
  const proofQuestion = questionAsksForProofLikeEvidence(lowerQuestion);
  const thirdPartyEvidence = matchedEvidence.find(
    (item) => item.holderSide === "third-party"
  );

  if (specificDetailFallback) {
    partyResponse = specificDetailFallback;
  } else if (repeatedFallbackReply && holderQuestion && thirdPartyEvidence) {
    partyResponse = buildEvidenceHolderResponseSegment(thirdPartyEvidence);
  } else if (repeatedFallbackReply && proofQuestion && supportingEvidence[0]) {
    partyResponse = `The most concrete thing I can tell you right now is this: ${buildEvidenceResponseSegment(
      supportingEvidence[0],
      playerSide
    )}`;
  } else if (repeatedFallbackReply) {
    partyResponse = "I do not know anything more specific about that right now.";
  }

  const patch = {
    summary: factSheet.summary || "",
    timeline: partyClaims
      .filter((item) => item.fact.kind === "timeline")
      .slice(0, 1)
      .map((item) => humanizeClaimText(item.playerClaim.claimedDetail)),
    supportingFacts: partyClaims
      .filter((item) => item.fact.kind === "supporting")
      .slice(0, 1)
      .map((item) => humanizeClaimText(item.playerClaim.claimedDetail)),
    risks: partyClaims
      .filter((item) => item.fact.kind === "risk")
      .slice(0, 1)
      .map((item) => humanizeClaimText(item.playerClaim.claimedDetail)),
    theory: factSheet.theory || "",
    desiredRelief: factSheet.desiredRelief || "",
    knownFacts: [],
    knownClaims: partyClaims.map((item) =>
      humanizeClaimText(item.playerClaim.claimedDetail)
    ),
    disputedFacts: partyClaims
      .filter(
        (item) =>
          item.opposingClaim &&
          item.opposingClaim.claimedDetail !== item.playerClaim.claimedDetail
      )
      .slice(0, 1)
      .map((item) => buildInterviewDisputeNote(item)),
    corroboratedFacts: [],
    sourceLinks: [],
    missingEvidence: buildRelevantMissingEvidenceNotes({
      safeTemplate,
      playerSide,
      partyClaims,
      matchedEvidence,
      lowerQuestion,
    }),
    openQuestions: suggestedOpenQuestions.slice(0, 2),
    discoveredFactIds: partyClaims.map((item) => item.fact.factId),
    discoveredClaimIds: partyClaims.map((item) =>
      getClaimId(item.fact.factId, playerSide)
    ),
    discoveredEvidenceIds: matchedEvidence.map((item) => item.id),
  };

  const normalizedPatch = normalizeFactSheetPatch(patch);
  const nextFactSheet = mergeFactSheet(factSheet, normalizedPatch, safeTemplate, {
    playerSide,
    questionHistory,
  });

  return {
    partyResponse,
    patch: normalizedPatch,
    nextFactSheet,
    relatedFactIds: uniqueList([
      ...partyClaims.map((item) => item.fact.factId),
      ...matchedEvidence.flatMap((item) => item.linkedFactIds || []),
    ]),
    discoveredClaimIds: normalizedPatch.discoveredClaimIds,
  };
};

export const normalizeInterviewResult = ({
  aiResult,
  fallback,
  template,
  caseSession,
  question,
  factSheet,
  playerSide,
}) => {
  const safeTemplate = ensureTemplate(template);
  if (!aiResult || typeof aiResult !== "object") {
    return fallback;
  }
  const lowerQuestion = String(question || "").trim().toLowerCase();
  const recentPartyResponses = (caseSession?.interviewTranscript || [])
    .filter((entry) => entry.role === "party")
    .slice(-3)
    .map((entry) => entry.text?.trim())
    .filter(Boolean);

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
  const questionHistory = getInterviewQuestionHistory(caseSession, question);
  const normalizedAiPartyResponse = humanizeClaimText(aiResult.partyResponse || "");
  const useKnownSpecificFallback = shouldUseKnownSpecificFallback(
    question,
    normalizedAiPartyResponse,
    fallback.partyResponse
  );
  const repeatedProductionLoop =
    questionRequestsProductionOrLookup(lowerQuestion) &&
    hasRecordSearchPromise(normalizedAiPartyResponse) &&
    recentPartyResponses.some((value) => hasRecordSearchPromise(value));
  const mergedDiscoveredFactIds = uniqueList([
    ...(fallback.patch?.discoveredFactIds || []),
    ...patch.discoveredFactIds,
  ]);
  const mergedDiscoveredEvidenceIds = uniqueList([
    ...(fallback.patch?.discoveredEvidenceIds || []),
    ...patch.discoveredEvidenceIds,
  ]);
  const mergedPatch = normalizeFactSheetPatch({
    ...fallback.patch,
    ...patch,
    timeline:
      patch.timeline.length > 0 ? patch.timeline : fallback.patch?.timeline || [],
    supportingFacts:
      patch.supportingFacts.length > 0
        ? patch.supportingFacts
        : fallback.patch?.supportingFacts || [],
    risks: patch.risks.length > 0 ? patch.risks : fallback.patch?.risks || [],
    knownClaims:
      patch.knownClaims.length > 0 ? patch.knownClaims : fallback.patch?.knownClaims || [],
    disputedFacts:
      patch.disputedFacts.length > 0
        ? patch.disputedFacts
        : fallback.patch?.disputedFacts || [],
    corroboratedFacts:
      patch.corroboratedFacts.length > 0
        ? patch.corroboratedFacts
        : fallback.patch?.corroboratedFacts || [],
    sourceLinks:
      patch.sourceLinks.length > 0 ? patch.sourceLinks : fallback.patch?.sourceLinks || [],
    missingEvidence:
      patch.missingEvidence.length > 0
        ? patch.missingEvidence
        : fallback.patch?.missingEvidence || [],
    openQuestions: resolveFactSheetOpenQuestions({
      template: safeTemplate,
      playerSide,
      currentOpenQuestions: factSheet.openQuestions || [],
      patchOpenQuestions:
        patch.openQuestions.length > 0
          ? patch.openQuestions
          : fallback.patch?.openQuestions || [],
      discoveredFactIds: mergedDiscoveredFactIds,
      discoveredEvidenceIds: mergedDiscoveredEvidenceIds,
      blockedQuestions: questionHistory,
      limit: 3,
    }),
    discoveredFactIds:
      patch.discoveredFactIds.length > 0
        ? patch.discoveredFactIds
        : fallback.patch?.discoveredFactIds || [],
    discoveredClaimIds:
      patch.discoveredClaimIds.length > 0
        ? patch.discoveredClaimIds
        : fallback.patch?.discoveredClaimIds || [],
    discoveredEvidenceIds:
      patch.discoveredEvidenceIds.length > 0
        ? patch.discoveredEvidenceIds
        : fallback.patch?.discoveredEvidenceIds || [],
  });

  return {
    partyResponse:
      repeatedProductionLoop
        ? buildStalledProductionReply(lowerQuestion)
        : useKnownSpecificFallback
        ? fallback.partyResponse
        : aiResult.partyResponse &&
          !isMetaResponse(aiResult.partyResponse) &&
          isResponsiveInterviewAnswer(question, aiResult.partyResponse)
        ? normalizedAiPartyResponse
        : fallback.partyResponse,
    patch: mergedPatch,
    nextFactSheet: mergeFactSheet(factSheet, mergedPatch, safeTemplate, {
      playerSide,
      questionHistory,
    }),
    relatedFactIds: relatedFactIds.length > 0 ? relatedFactIds : fallback.relatedFactIds,
    discoveredClaimIds:
      mergedPatch.discoveredClaimIds.length > 0
        ? mergedPatch.discoveredClaimIds
        : fallback.discoveredClaimIds,
  };
};
