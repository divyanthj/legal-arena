import "server-only";

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

export const buildCounselContext = ({ caseSession, template, rules }) => {
  const safeTemplate = ensureTemplate(template);
  const playerSide = getPlayerSide(caseSession);

  return {
    representedParty: {
      side: getTemplatePartyForSessionSide(playerSide),
      name: getPartyName(safeTemplate, playerSide),
      objective: buildDesiredReliefForSide(safeTemplate, playerSide),
    },
    opposingParty: {
      side: getTemplatePartyForSessionSide(getOpposingSide(playerSide)),
      name: getPartyName(safeTemplate, getOpposingSide(playerSide)),
    },
    publicCaseFile: caseSession.factSheet,
    lawbookRules: rules,
    recentCourtroomTranscript: caseSession.courtroomTranscript.slice(-6),
  };
};

export const normalizeCounselAnalysis = ({ aiResult, caseSession, rules }) => {
  const validClaimIds = caseSession.factSheet.discoveredClaimIds || [];
  const validRuleIds = new Set((rules || []).map((rule) => rule.id));

  return {
    playerTheory: coerceString(aiResult?.playerTheory),
    citedFacts: coerceStringList(aiResult?.citedFacts, 4),
    citedClaimIds: sanitizeIdList(aiResult?.citedClaimIds, validClaimIds, 4),
    citedRules: coerceStringList(aiResult?.citedRules, 4).filter((item) =>
      validRuleIds.has(item)
    ),
    strengths: coerceStringList(aiResult?.strengths, 3),
    weaknesses: coerceStringList(aiResult?.weaknesses, 3),
  };
};

export const buildCourtroomAgentContext = ({
  caseSession,
  template,
  rules,
  counselAnalysis,
  shouldReturnVerdict,
}) => {
  const safeTemplate = ensureTemplate(template);
  const playerSide = getPlayerSide(caseSession);
  const opponentSide = getOpposingSide(playerSide);

  return {
    shouldReturnVerdict,
    representedCounsel: {
      side: getTemplatePartyForSessionSide(playerSide),
      partyName: getPartyName(safeTemplate, playerSide),
      objective: buildDesiredReliefForSide(safeTemplate, playerSide),
      publicCaseFile: caseSession.factSheet,
      analysis: counselAnalysis,
    },
    opposingCounsel: {
      side: getTemplatePartyForSessionSide(opponentSide),
      partyName: getPartyName(safeTemplate, opponentSide),
      objective: buildDesiredReliefForSide(safeTemplate, opponentSide),
      profile: getPartyProfileForSide(safeTemplate, opponentSide),
      memory: (safeTemplate.canonicalFacts || []).map((fact) =>
        buildRoleFactPacket({
          template: safeTemplate,
          fact,
          playerSide: opponentSide,
          discoveredFactIds: caseSession.factSheet.discoveredFactIds || [],
          discoveredEvidenceIds: caseSession.factSheet.discoveredEvidenceIds || [],
        })
      ),
    },
    canonicalWorld: buildCanonicalWorldPacket(
      safeTemplate,
      caseSession.factSheet.discoveredFactIds || [],
      caseSession.factSheet.discoveredEvidenceIds || []
    ),
    bench: {
      lawbookRules: rules,
      score: caseSession.score,
      recentCourtroomTranscript: caseSession.courtroomTranscript.slice(-6),
    },
  };
};
export const pickFactMentions = (argument, factSheet) => {
  const lowerArgument = argument.toLowerCase();

  return uniqueList(
    [
      ...(factSheet.supportingFacts || []),
      ...(factSheet.timeline || []),
      ...(factSheet.corroboratedFacts || []),
      ...(factSheet.knownFacts || []),
    ].filter((fact) => {
      const tokens = fact
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, " ")
        .split(/\s+/)
        .filter((token) => token.length > 4);

      return tokens.some((token) => lowerArgument.includes(token));
    })
  ).slice(0, 4);
};

export const pickRuleMentions = (argument, rules) => {
  const lowerArgument = argument.toLowerCase();

  return rules
    .filter((rule) => {
      const titleTokens = rule.title
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, " ")
        .split(/\s+/)
        .filter((token) => token.length > 4);

      return (
        titleTokens.some((token) => lowerArgument.includes(token)) ||
        lowerArgument.includes(rule.id.replace(/-/g, " "))
      );
    })
    .map((rule) => rule.id)
    .slice(0, 3);
};

export const pickClaimMentions = (argument, factSheet) => {
  const lowerArgument = argument.toLowerCase();

  return uniqueList(
    (factSheet.knownClaims || []).filter((claim) => {
      const tokens = claim
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, " ")
        .split(/\s+/)
        .filter((token) => token.length > 4);

      return tokens.some((token) => lowerArgument.includes(token));
    })
  ).slice(0, 3);
};

export const buildCourtroomFallback = ({ caseSession, argument, rules, template }) => {
  const safeTemplate = ensureTemplate(template);
  const playerSide = getPlayerSide(caseSession);
  const opponentSide = getOpposingSide(playerSide);
  const citedFacts = pickFactMentions(argument, caseSession.factSheet);
  const citedRules = pickRuleMentions(argument, rules);
  const citedClaims = pickClaimMentions(argument, caseSession.factSheet);
  const lowerArgument = argument.toLowerCase();

  const addressesRisk = (caseSession.factSheet.risks || []).some((risk) =>
    risk
      .toLowerCase()
      .split(/\s+/)
      .filter((token) => token.length > 4)
      .some((token) => lowerArgument.includes(token))
  );

  const addressesDispute = (caseSession.factSheet.disputedFacts || []).some((dispute) =>
    dispute
      .toLowerCase()
      .split(/\s+/)
      .filter((token) => token.length > 4)
      .some((token) => lowerArgument.includes(token))
  );

  const corroboratedHits = (caseSession.factSheet.corroboratedFacts || []).filter(
    (fact) => citedFacts.includes(fact)
  ).length;

  const playerDelta = clamp(
    4 +
      corroboratedHits * 4 +
      (citedFacts.length - corroboratedHits) * 2 +
      citedRules.length * 4 +
      citedClaims.length * 1 +
      (addressesRisk ? 2 : 0) +
      (addressesDispute ? 3 : 0) +
      (argument.length > 240 ? 2 : 0),
    4,
    20
  );

  const unresolvedDisputes = clamp(
    (caseSession.factSheet.disputedFacts || []).length - (addressesDispute ? 1 : 0),
    0,
    3
  );
  const unresolvedRisks = clamp(
    (caseSession.factSheet.risks || []).length - (addressesRisk ? 1 : 0),
    0,
    3
  );
  const opponentDelta = clamp(
    5 +
      unresolvedDisputes * 3 +
      unresolvedRisks * 2 +
      (citedRules.length === 0 ? 2 : 0),
    4,
    18
  );

  const templateFacts = safeTemplate.canonicalFacts || [];
  const pressureFact =
    templateFacts[caseSession.score.roundsCompleted % templateFacts.length] || null;
  const opponentClaim = pressureFact ? getClaimForParty(pressureFact, opponentSide) : null;
  const opponentPartyName = getPartyName(safeTemplate, opponentSide);

  const opponentResponse = opponentClaim
    ? `Counsel for ${opponentPartyName} argues that ${opponentClaim.claimedDetail.charAt(0).toLowerCase()}${opponentClaim.claimedDetail.slice(
        1
      )}. They say the player's presentation leans too heavily on its own version instead of settled proof.`
    : `Counsel for ${opponentPartyName} argues that the player's record is too thin and the disputed facts cut against relief.`;

  const strengths = uniqueList([
    corroboratedHits > 0
      ? `You leaned on corroborated proof, not only unsupported narrative.`
      : "",
    citedFacts[0] ? `You grounded the argument in a concrete fact: ${citedFacts[0]}` : "",
    citedRules[0] ? `You tied the argument to ${citedRules[0]}.` : "",
    addressesDispute ? "You directly confronted the opposing side's framing." : "",
  ]).slice(0, 3);

  const weaknesses = uniqueList([
    citedRules.length === 0 ? "The argument did not clearly anchor itself to a lawbook rule." : "",
    !addressesRisk && caseSession.factSheet.risks[0]
      ? `A visible weakness remains unaddressed: ${caseSession.factSheet.risks[0]}`
      : "",
    !addressesDispute && caseSession.factSheet.disputedFacts[0]
      ? `You did not directly answer a live dispute: ${caseSession.factSheet.disputedFacts[0]}`
      : "",
    citedFacts.length === 0 ? "The bench still needs a more specific fact from the case file." : "",
  ]).slice(0, 3);

  const benchSignal =
    playerDelta >= opponentDelta
      ? "The judge seems to trust arguments more when they rest on corroborated facts rather than raw party statements."
      : "The judge appears concerned that the opposing side still has room to reframe the disputed record.";

  return {
    opponentResponse,
    playerDelta,
    opponentDelta,
    citedFacts,
    citedRules,
    citedClaimIds: citedClaims.slice(0, 3),
    strengths,
    weaknesses,
    benchSignal,
  };
};

export const buildVerdictFallback = ({ updatedScore, rules, factSheet, template, playerSide }) => {
  const safeTemplate = ensureTemplate(template);
  const opponentSide = getOpposingSide(playerSide);
  const playerPartyName = getPartyName(safeTemplate, playerSide);
  const opponentPartyName = getPartyName(safeTemplate, opponentSide);
  const winner =
    updatedScore.player === updatedScore.opponent
      ? "draw"
      : updatedScore.player > updatedScore.opponent
      ? "player"
      : "opponent";

  const ruleLabel = rules[0]?.title || "the lawbook";
  const summary =
    winner === "player"
      ? `The court finds for ${playerPartyName}, concluding that the stronger corroborated record and better handling of disputed facts carried the day.`
      : winner === "opponent"
      ? `The court finds for ${opponentPartyName}, concluding that the player's showing relied too heavily on unresolved side-specific claims.`
      : "The court finds the record too closely balanced and declines to separate the parties decisively.";

  return {
    winner,
    summary,
    highlights: uniqueList([
      factSheet.corroboratedFacts[0] || factSheet.supportingFacts[0] || "",
      `The court relied heavily on ${ruleLabel}.`,
      updatedScore.highlights?.[0] || "",
    ]).slice(0, 3),
    concerns: uniqueList([
      factSheet.risks[0] || "",
      factSheet.disputedFacts[0] || "",
      updatedScore.weaknesses?.[0] || "",
    ]).slice(0, 3),
  };
};

export const normalizeCourtResult = ({
  aiResult,
  fallback,
  counselAnalysis,
  shouldReturnVerdict,
  caseSession,
  rules,
  template,
}) => {
  const normalizedCounsel = normalizeCounselAnalysis({
    aiResult: counselAnalysis,
    caseSession,
    rules,
  });
  const fallbackVerdict = shouldReturnVerdict
      ? buildVerdictFallback({
        updatedScore: {
          player: caseSession.score.player + fallback.playerDelta,
          opponent: caseSession.score.opponent + fallback.opponentDelta,
          highlights: fallback.strengths,
          weaknesses: fallback.weaknesses,
        },
        rules,
        factSheet: caseSession.factSheet,
        template,
        playerSide: getPlayerSide(caseSession),
      })
    : null;

  if (!aiResult || typeof aiResult !== "object") {
    return {
      ...fallback,
      citedFacts: normalizedCounsel.citedFacts.length
        ? normalizedCounsel.citedFacts
        : fallback.citedFacts,
      citedRules: normalizedCounsel.citedRules.length
        ? normalizedCounsel.citedRules
        : fallback.citedRules,
      citedClaimIds: normalizedCounsel.citedClaimIds.length
        ? normalizedCounsel.citedClaimIds
        : fallback.citedClaimIds,
      strengths: normalizedCounsel.strengths.length
        ? normalizedCounsel.strengths
        : fallback.strengths,
      weaknesses: normalizedCounsel.weaknesses.length
        ? normalizedCounsel.weaknesses
        : fallback.weaknesses,
      verdict: fallbackVerdict,
    };
  }

  const normalized = {
    opponentResponse: normalizeOpponentResponse(
      aiResult.opponentResponse,
      fallback.opponentResponse
    ),
    playerDelta:
      typeof aiResult.playerDelta === "number"
        ? clamp(aiResult.playerDelta, 1, 20)
        : fallback.playerDelta,
    opponentDelta:
      typeof aiResult.opponentDelta === "number"
        ? clamp(aiResult.opponentDelta, 1, 20)
        : fallback.opponentDelta,
    citedFacts: Array.isArray(aiResult.citedFacts)
      ? aiResult.citedFacts
      : normalizedCounsel.citedFacts.length
      ? normalizedCounsel.citedFacts
      : fallback.citedFacts,
    citedRules: Array.isArray(aiResult.citedRules)
      ? aiResult.citedRules
      : normalizedCounsel.citedRules.length
      ? normalizedCounsel.citedRules
      : fallback.citedRules,
    citedClaimIds: Array.isArray(aiResult.citedClaimIds)
      ? aiResult.citedClaimIds
      : normalizedCounsel.citedClaimIds.length
      ? normalizedCounsel.citedClaimIds
      : fallback.citedClaimIds,
    strengths: Array.isArray(aiResult.strengths)
      ? aiResult.strengths
      : normalizedCounsel.strengths.length
      ? normalizedCounsel.strengths
      : fallback.strengths,
    weaknesses: Array.isArray(aiResult.weaknesses)
      ? aiResult.weaknesses
      : normalizedCounsel.weaknesses.length
      ? normalizedCounsel.weaknesses
      : fallback.weaknesses,
    benchSignal: aiResult.benchSignal || fallback.benchSignal,
  };

  if (!shouldReturnVerdict) {
    return {
      ...normalized,
      verdict: null,
    };
  }

  return {
    ...normalized,
    verdict:
      aiResult.verdict && typeof aiResult.verdict === "object"
        ? {
            winner: aiResult.verdict.winner || fallbackVerdict?.winner || "draw",
            summary: aiResult.verdict.summary || fallbackVerdict?.summary || "",
            highlights: Array.isArray(aiResult.verdict.highlights)
              ? aiResult.verdict.highlights
              : fallbackVerdict?.highlights || [],
            concerns: Array.isArray(aiResult.verdict.concerns)
              ? aiResult.verdict.concerns
              : fallbackVerdict?.concerns || [],
          }
        : fallbackVerdict,
  };
};

