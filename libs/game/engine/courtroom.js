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
} from "./shared.js";
import {
  getCourtroomDifficultyProfile,
  limitOpponentResponseForDifficulty,
  normalizeCourtroomDeltasForDifficulty,
  normalizePlayerPerspectiveVerdictLists,
  normalizeVerdictForDifficulty,
  rewriteVerdictForPlayerAddress,
} from "../courtroomDifficulty.js";
import { pickRuleMentions } from "../lawbookCitation.js";

export { pickRuleMentions } from "../lawbookCitation.js";

const PROOF_GAP_PATTERN =
  /\b(photo|photos|receipt|receipts|invoice|invoices|inspection|dated|document|documentation|record|records|log|logs|itemized|itemised|support|supported|proof)\b/i;
const WEAK_PROOF_PATTERN =
  /\b(incomplete|missing|thin|uncertain|not fully|not clearly|vague|generic|unsupported|proof gap|documentation gap|not adequately|not enough reliable support|not reliably)\b/i;
const VERIFICATION_FEEDBACK_PATTERN =
  /\b(thin|documentation|documented|verify|verification|item-by-item|item by item|ordinary wear|chargeable damage|routine turnover|unsupported|substantiated|proof|receipts?|invoices?|photos?|inspection notes?)\b/i;
const DISCRETE_DAMAGE_PATTERN =
  /\b(broken|replacement|replace|fixture|blind|window latch|lock|door|cracked|hole|missing|damaged)\b/i;
const SUBJECTIVE_CHARGE_PATTERN =
  /\b(cleaning|carpet|stain|wall marks?|paint|scuff|turnover|ordinary wear|routine)\b/i;

const hasMeaningfulAdvocacyMove = ({
  citedFacts = [],
  citedRules = [],
  citedClaims = [],
  addressesRisk = false,
  addressesDispute = false,
  argument = "",
}) =>
  citedFacts.length > 0 ||
  citedRules.length > 0 ||
  citedClaims.length > 0 ||
  addressesRisk ||
  addressesDispute ||
  String(argument || "").trim().length >= 180;

const proofTextCorpus = (factSheet = {}) =>
  [
    ...(factSheet.risks || []),
    ...(factSheet.missingEvidence || []),
    ...(factSheet.disputedFacts || []),
    ...(factSheet.supportingFacts || []),
  ].join(" ");

const recentBenchCorpus = (caseSession = {}) =>
  [
    caseSession.score?.lastBenchSignal || "",
    ...(caseSession.courtroomTranscript || [])
      .slice(-4)
      .flatMap((entry) => [entry.benchSignal, entry.text]),
  ]
    .filter(Boolean)
    .join(" ");

const extractProofGaps = (factSheet = {}) =>
  uniqueList([...(factSheet.missingEvidence || []), ...(factSheet.risks || [])].filter(
    (item) => PROOF_GAP_PATTERN.test(item) || WEAK_PROOF_PATTERN.test(item)
  )).slice(0, 5);

const extractSalvageableItems = (factSheet = {}) =>
  uniqueList(
    [
      ...(factSheet.supportingFacts || []),
      ...(factSheet.corroboratedFacts || []),
      ...(factSheet.disputedFacts || []),
      ...(factSheet.knownClaims || []),
    ].filter((item) => DISCRETE_DAMAGE_PATTERN.test(item))
  ).slice(0, 3);

const extractWeakCategories = (factSheet = {}) =>
  uniqueList(
    [
      ...(factSheet.supportingFacts || []),
      ...(factSheet.disputedFacts || []),
      ...(factSheet.risks || []),
    ].filter((item) => SUBJECTIVE_CHARGE_PATTERN.test(item) || WEAK_PROOF_PATTERN.test(item))
  ).slice(0, 4);

const OPPONENT_FACT_LIMITS = {
  1: 2,
  2: 3,
  3: 4,
  4: 6,
  5: 8,
};

const OPPONENT_EVIDENCE_LIMITS = {
  1: 1,
  2: 2,
  3: 3,
  4: 5,
  5: 7,
};

const normalizeEvidenceHolder = (value = "") =>
  String(value || "").trim().toLowerCase();

const normalizeEvidenceStatus = (value = "") =>
  String(value || "").trim().toLowerCase();

const evidenceIsProofForSide = (item = {}, templateSide = "plaintiff", complexity = 3) => {
  const holderSide = normalizeEvidenceHolder(item.holderSide);
  const status = normalizeEvidenceStatus(item.availabilityStatus);

  if (["missing", "unknown"].includes(status) || holderSide === "third-party") {
    return false;
  }

  if (holderSide === templateSide || holderSide === "shared") {
    return status !== "contested" || complexity >= 3;
  }

  return status === "confirmed" && holderSide === "";
};

const evidenceIsLeadForSide = (item = {}, templateSide = "plaintiff", complexity = 3) => {
  const holderSide = normalizeEvidenceHolder(item.holderSide);
  const status = normalizeEvidenceStatus(item.availabilityStatus);

  if (complexity < 4) {
    return false;
  }

  if (holderSide === templateSide || holderSide === "shared") {
    return ["mentioned", "unknown", "missing", "contested"].includes(status);
  }

  return holderSide === "third-party" && ["mentioned", "unknown", "contested"].includes(status);
};

const buildPortfolioEvidencePacket = (item = {}) => ({
  id: item.id,
  label: item.label,
  detail: item.detail,
  type: item.type,
  availabilityStatus: item.availabilityStatus,
  holderSide: item.holderSide,
  linkedFactIds: item.linkedFactIds || [],
});

const sortFactsForOpponentPortfolio = (template, opponentSide) =>
  (template.canonicalFacts || [])
    .map((fact) => {
      const claim = getClaimForParty(fact, opponentSide);
      const linkedEvidence = (template.evidenceItems || []).filter((item) =>
        (item.linkedFactIds || []).includes(fact.factId)
      );

      return {
        fact,
        claim,
        linkedEvidence,
        score:
          (fact.discoverability?.priority || 0) * 3 +
          (claim?.confidence || 0) * 2 +
          (fact.kind === "dispute" ? 1.5 : 0) +
          (fact.kind === "risk" ? 1 : 0) +
          linkedEvidence.length * 0.5,
      };
    })
    .filter((item) => item.claim?.claimedDetail)
    .sort((left, right) => right.score - left.score);

export const buildOpponentCourtroomPortfolio = ({
  template,
  opponentSide = DEFAULT_PLAYER_SIDE,
  complexity = 3,
} = {}) => {
  const safeTemplate = ensureTemplate(template);
  const profile = getCourtroomDifficultyProfile(complexity);
  const normalizedComplexity = profile.complexity;
  const templateSide = getTemplatePartyForSessionSide(opponentSide);
  const factLimit = OPPONENT_FACT_LIMITS[normalizedComplexity] || OPPONENT_FACT_LIMITS[3];
  const evidenceLimit =
    OPPONENT_EVIDENCE_LIMITS[normalizedComplexity] || OPPONENT_EVIDENCE_LIMITS[3];
  const rankedFacts = sortFactsForOpponentPortfolio(safeTemplate, opponentSide);
  const selectedFactPackets = rankedFacts.slice(0, factLimit);
  const selectedFactIds = selectedFactPackets.map((item) => item.fact.factId);
  const linkedEvidence = (safeTemplate.evidenceItems || []).filter((item) =>
    (item.linkedFactIds || []).some((factId) => selectedFactIds.includes(factId))
  );
  const proofEvidence = linkedEvidence
    .filter((item) => evidenceIsProofForSide(item, templateSide, normalizedComplexity))
    .slice()
    .sort((left, right) => {
      const leftConfirmed = normalizeEvidenceStatus(left.availabilityStatus) === "confirmed" ? 1 : 0;
      const rightConfirmed = normalizeEvidenceStatus(right.availabilityStatus) === "confirmed" ? 1 : 0;
      return rightConfirmed - leftConfirmed;
    })
    .slice(0, evidenceLimit);
  const proofEvidenceIds = proofEvidence.map((item) => item.id);
  const evidenceLeads = linkedEvidence
    .filter((item) => !proofEvidenceIds.includes(item.id))
    .filter((item) => evidenceIsLeadForSide(item, templateSide, normalizedComplexity))
    .slice(0, Math.max(1, normalizedComplexity - 3));
  const evidenceByFactId = new Map();

  proofEvidence.forEach((item) => {
    (item.linkedFactIds || []).forEach((factId) => {
      if (!evidenceByFactId.has(factId)) {
        evidenceByFactId.set(factId, []);
      }
      evidenceByFactId.get(factId).push(item);
    });
  });

  const facts = selectedFactPackets.map(({ fact, claim }) => ({
    factId: fact.factId,
    label: fact.label,
    kind: fact.kind,
    priority: fact.discoverability?.priority || 3,
    position: humanizeClaimText(claim.claimedDetail),
    claimId: getClaimId(fact.factId, opponentSide),
    linkedEvidenceIds: (evidenceByFactId.get(fact.factId) || []).map((item) => item.id),
  }));
  const supportingFacts = facts
    .filter((fact) => ["timeline", "supporting", "evidence"].includes(fact.kind))
    .map((fact) => fact.position);
  const disputedFacts = facts
    .filter((fact) => fact.kind === "dispute")
    .map((fact) => fact.position);
  const risks = facts
    .filter((fact) => fact.kind === "risk")
    .map((fact) => fact.position);

  return {
    side: templateSide,
    partyName: getPartyName(safeTemplate, opponentSide),
    preparationLevel: profile.counselPosture,
    summary: uniqueList([buildOverviewForSide(safeTemplate, opponentSide)]),
    theory: uniqueList([buildTheoryForSide(safeTemplate, opponentSide)]),
    desiredRelief: uniqueList([buildDesiredReliefForSide(safeTemplate, opponentSide)]),
    supportingFacts: uniqueList(supportingFacts),
    risks: uniqueList(risks),
    disputedFacts: uniqueList(disputedFacts),
    knownClaims: uniqueList(facts.map((fact) => fact.position)),
    corroboratedFacts: uniqueList(proofEvidence.map((item) => item.detail || item.label)),
    sourceLinks: uniqueList(proofEvidence.map((item) => item.label || item.id)),
    missingEvidence: uniqueList(
      evidenceLeads.map((item) => `${item.label || item.id} remains a proof lead, not produced proof.`)
    ),
    preparedFactIds: selectedFactIds,
    preparedClaimIds: facts.map((fact) => fact.claimId),
    preparedEvidenceIds: proofEvidenceIds,
    facts,
    evidence: proofEvidence.map(buildPortfolioEvidencePacket),
    evidenceLeads: evidenceLeads.map(buildPortfolioEvidencePacket),
  };
};

export const buildProofStrategyContext = ({ caseSession }) => {
  const factSheet = caseSession.factSheet || {};
  const fileCorpus = proofTextCorpus(factSheet);
  const benchCorpus = recentBenchCorpus(caseSession);
  const proofGaps = extractProofGaps(factSheet);
  const salvageableItems = extractSalvageableItems(factSheet);
  const weakCategories = extractWeakCategories(factSheet);
  const weakFile = proofGaps.length > 0 || WEAK_PROOF_PATTERN.test(fileCorpus);
  const benchFlaggedVerification =
    VERIFICATION_FEEDBACK_PATTERN.test(benchCorpus) &&
    caseSession.score?.roundsCompleted > 0;
  const mode = weakFile || benchFlaggedVerification ? "salvage" : "standard";

  return {
    mode,
    weakFile,
    benchFlaggedVerification,
    proofGaps,
    salvageableItems,
    weakCategories,
    lateRound: (caseSession.score?.roundsCompleted || 0) + 1 >= 3,
    instructions:
      mode === "salvage"
        ? [
            "Do not keep defending broad categories as if they are fully proven.",
            "Concede or narrow weakly documented categories instead of overclaiming them.",
            "Identify the strongest one or two verifiable items and explain why they can support a limited allowance.",
            "Tie each requested allowance to a documented condition and a bounded amount or proportional reduction when the record permits.",
            "Ask for a partial ruling or reduced award, not an all-or-nothing win.",
          ]
        : [
            "Anchor the argument to specific facts, corroborated points, and lawbook rules.",
            "Address visible disputes directly before asking for the full requested relief.",
          ],
  };
};

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
    proofStrategy: buildProofStrategyContext({ caseSession }),
    lawbookRules: rules,
    recentCourtroomTranscript: caseSession.courtroomTranscript.slice(-6),
  };
};

export const normalizeCounselAnalysis = ({ aiResult, caseSession, rules }) => {
  const validClaimIds = caseSession.factSheet.discoveredClaimIds || [];
  const validRuleIds = new Set((rules || []).map((rule) => rule.id));
  const validFactText = new Set(
    [
      ...(caseSession.factSheet.supportingFacts || []),
      ...(caseSession.factSheet.timeline || []),
      ...(caseSession.factSheet.corroboratedFacts || []),
      ...(caseSession.factSheet.knownFacts || []),
    ].map((item) => String(item || "").trim())
  );

  return {
    playerTheory: coerceString(aiResult?.playerTheory),
    citedFacts: coerceStringList(aiResult?.citedFacts, 4).filter((item) =>
      validFactText.has(item)
    ),
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
  const proofStrategy = buildProofStrategyContext({ caseSession });
  const difficultyProfile = getCourtroomDifficultyProfile(caseSession.complexity);
  const opponentPortfolio = buildOpponentCourtroomPortfolio({
    template: safeTemplate,
    opponentSide,
    complexity: caseSession.complexity,
  });

  return {
    shouldReturnVerdict,
    representedCounsel: {
      side: getTemplatePartyForSessionSide(playerSide),
      partyName: getPartyName(safeTemplate, playerSide),
      objective: buildDesiredReliefForSide(safeTemplate, playerSide),
      publicCaseFile: caseSession.factSheet,
      analysis: counselAnalysis,
      proofStrategy,
    },
    opposingCounsel: {
      side: getTemplatePartyForSessionSide(opponentSide),
      partyName: getPartyName(safeTemplate, opponentSide),
      objective: buildDesiredReliefForSide(safeTemplate, opponentSide),
      profile: getPartyProfileForSide(safeTemplate, opponentSide),
      preparedCaseFile: opponentPortfolio,
    },
    bench: {
      recordBound: true,
      playerCaseFile: caseSession.factSheet,
      opponentCaseFile: opponentPortfolio,
      lawbookRules: rules,
      score: caseSession.score,
      judgeProfile: caseSession.judgeProfile || null,
      recentCourtroomTranscript: caseSession.courtroomTranscript.slice(-6),
      proofStrategy,
      scoringRules: [
        "Score the player only from the representedCounsel.publicCaseFile, lawbook rules, and courtroom transcript.",
        "Score the opponent only from opposingCounsel.preparedCaseFile, lawbook rules, and courtroom transcript.",
        "Do not infer, cite, or credit facts, claims, story details, or evidence outside those visible side files.",
        "Treat missing or unsurfaced proof as unavailable, even if an argument alludes to it.",
      ],
      courtroomCalibration: {
        counselPosture: difficultyProfile.counselPosture,
        scoringBounds: {
          playerMinDelta: difficultyProfile.playerMinDelta,
          playerMaxDelta: difficultyProfile.playerMaxDelta,
          opponentMinDelta: difficultyProfile.opponentMinDelta,
          opponentMaxDelta: difficultyProfile.opponentMaxDelta,
        },
        responseLimits: difficultyProfile.opponentResponseLimits,
        closeCaseBand: difficultyProfile.verdictCloseCaseBand,
        guidance: difficultyProfile.promptGuidance,
        confidentiality:
          "Never mention calibration, difficulty, complexity scaling, junior counsel, senior counsel, scoring bounds, or hidden tuning in player-facing text.",
      },
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
  const opponentPortfolio = buildOpponentCourtroomPortfolio({
    template: safeTemplate,
    opponentSide,
    complexity: caseSession.complexity,
  });
  const citedFacts = pickFactMentions(argument, caseSession.factSheet);
  const citedRules = pickRuleMentions(argument, rules);
  const citedClaims = pickClaimMentions(argument, caseSession.factSheet);
  const lowerArgument = argument.toLowerCase();
  const judgeProfile = caseSession.judgeProfile || {};
  const judgeVariance =
    typeof judgeProfile.varianceSeed === "number"
      ? ((judgeProfile.varianceSeed + caseSession.score.roundsCompleted) % 5) - 2
      : 0;
  const proofStrictness =
    typeof judgeProfile.proofStrictness === "number" ? judgeProfile.proofStrictness : 0.6;
  const proofStrategy = buildProofStrategyContext({ caseSession });
  const difficultyProfile = getCourtroomDifficultyProfile(caseSession.complexity);
  const adjustedProofStrictness = clamp(
    proofStrictness + difficultyProfile.proofStrictnessOffset,
    0.25,
    0.95
  );

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
      (argument.length > 240 ? 2 : 0) +
      (corroboratedHits > 0 ? Math.round(adjustedProofStrictness * 2) : 0) +
      judgeVariance,
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
      (citedRules.length === 0 ? 2 : 0) +
      (corroboratedHits === 0 ? Math.round(adjustedProofStrictness * 2) : 0) -
      judgeVariance,
    4,
    18
  );
  const normalizedDeltas = normalizeCourtroomDeltasForDifficulty({
    playerDelta,
    opponentDelta,
    difficultyProfile,
    hasPartialCredit: hasMeaningfulAdvocacyMove({
      citedFacts,
      citedRules,
      citedClaims,
      addressesRisk,
      addressesDispute,
      argument,
    }),
  });

  const opponentClaims = opponentPortfolio.knownClaims || [];
  const opponentClaim =
    opponentClaims[caseSession.score.roundsCompleted % Math.max(opponentClaims.length, 1)] || "";
  const opponentProof = opponentPortfolio.corroboratedFacts?.[0] || "";
  const opponentPartyName = getPartyName(safeTemplate, opponentSide);

  const opponentResponse = opponentClaim
    ? `Counsel for ${opponentPartyName} argues that ${opponentClaim.charAt(0).toLowerCase()}${opponentClaim.slice(
        1
      )}. ${
        opponentProof
          ? `They point to their prepared file on ${opponentProof.charAt(0).toLowerCase()}${opponentProof.slice(1)}.`
          : "They say the player's presentation leans too heavily on its own version instead of record proof."
      }`
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
    proofStrategy.mode === "salvage" &&
    proofStrategy.salvageableItems.length === 0
      ? "The record has documentation gaps and the argument did not isolate a provable minimum item."
      : "",
    proofStrategy.mode === "salvage" &&
    proofStrategy.salvageableItems.length > 0 &&
    !proofStrategy.salvageableItems.some((item) =>
      item
        .toLowerCase()
        .split(/\s+/)
        .filter((token) => token.length > 4)
        .some((token) => lowerArgument.includes(token))
    )
      ? `The argument should narrow to a verifiable item such as: ${proofStrategy.salvageableItems[0]}`
      : "",
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
    proofStrategy.mode === "salvage"
      ? `The ${judgeProfile.label || "judge"} judge needs a decision-ready partial remedy tied to the strongest documented item, not repeated broad damage categories.`
      : 
    normalizedDeltas.playerDelta >= normalizedDeltas.opponentDelta
      ? `The ${judgeProfile.label || "judge"} judge seems to trust arguments more when they rest on facts that were actually gathered and presented.`
      : `The ${judgeProfile.label || "judge"} judge appears concerned that the opposing side still has room to reframe the disputed record.`;

  return {
    opponentResponse,
    playerDelta: normalizedDeltas.playerDelta,
    opponentDelta: normalizedDeltas.opponentDelta,
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

const normalizeVerdictForPlayerPerspective = ({
  verdict,
  playerStrengths,
  playerWeaknesses,
  fallbackVerdict,
  playerSide,
  playerPartyName,
  opponentPartyName,
}) => {
  const lists = normalizePlayerPerspectiveVerdictLists({
    verdict,
    playerStrengths,
    playerWeaknesses,
    fallbackVerdict,
    playerSide,
    playerPartyName,
    opponentPartyName,
  });

  return {
    ...verdict,
    summary: rewriteVerdictForPlayerAddress(verdict.summary, {
      playerSide,
      playerPartyName,
      opponentPartyName,
    }),
    highlights: lists.highlights,
    concerns: lists.concerns,
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
  const difficultyProfile = getCourtroomDifficultyProfile(caseSession.complexity);
  const validFactText = new Set(
    [
      ...(caseSession.factSheet.supportingFacts || []),
      ...(caseSession.factSheet.timeline || []),
      ...(caseSession.factSheet.corroboratedFacts || []),
      ...(caseSession.factSheet.knownFacts || []),
    ].map((item) => String(item || "").trim())
  );
  const validClaimIds = caseSession.factSheet.discoveredClaimIds || [];
  const validRuleIds = new Set((rules || []).map((rule) => rule.id));
  const sanitizeCourtFacts = (items = []) =>
    coerceStringList(items, 4).filter((item) => validFactText.has(item));
  const sanitizeCourtClaims = (items = []) => sanitizeIdList(items, validClaimIds, 4);
  const sanitizeCourtRules = (items = []) =>
    coerceStringList(items, 4).filter((item) => validRuleIds.has(item));
  const aiReturnedPlayerDelta = typeof aiResult?.playerDelta === "number";
  const aiReturnedOpponentDelta = typeof aiResult?.opponentDelta === "number";
  const hasPartialCredit = aiReturnedPlayerDelta && hasMeaningfulAdvocacyMove({
    citedFacts: fallback.citedFacts,
    citedRules: fallback.citedRules,
    citedClaims: fallback.citedClaimIds,
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
    opponentResponse: limitOpponentResponseForDifficulty(
      normalizeOpponentResponse(aiResult.opponentResponse, fallback.opponentResponse),
      difficultyProfile
    ),
    ...normalizeCourtroomDeltasForDifficulty({
      playerDelta:
        aiReturnedPlayerDelta ? aiResult.playerDelta : fallback.playerDelta,
      opponentDelta:
        aiReturnedOpponentDelta ? aiResult.opponentDelta : fallback.opponentDelta,
      difficultyProfile,
      hasPartialCredit,
    }),
    citedFacts: Array.isArray(aiResult.citedFacts)
      ? sanitizeCourtFacts(aiResult.citedFacts)
      : normalizedCounsel.citedFacts.length
      ? normalizedCounsel.citedFacts
      : fallback.citedFacts,
    citedRules: Array.isArray(aiResult.citedRules)
      ? sanitizeCourtRules(aiResult.citedRules)
      : normalizedCounsel.citedRules.length
      ? normalizedCounsel.citedRules
      : fallback.citedRules,
    citedClaimIds: Array.isArray(aiResult.citedClaimIds)
      ? sanitizeCourtClaims(aiResult.citedClaimIds)
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

  const normalizedUpdatedScore = {
    player: caseSession.score.player + normalized.playerDelta,
    opponent: caseSession.score.opponent + normalized.opponentDelta,
    highlights: normalized.strengths,
    weaknesses: normalized.weaknesses,
  };
  const playerSide = getPlayerSide(caseSession);
  const opponentSide = getOpposingSide(playerSide);
  const normalizedFallbackVerdict = buildVerdictFallback({
    updatedScore: normalizedUpdatedScore,
    rules,
    factSheet: caseSession.factSheet,
    template,
    playerSide,
  });

  return {
    ...normalized,
    verdict: normalizeVerdictForPlayerPerspective({
      verdict: normalizeVerdictForDifficulty({
        verdict: aiResult.verdict,
        updatedScore: normalizedUpdatedScore,
        fallbackVerdict: normalizedFallbackVerdict,
        difficultyProfile,
        playerPartyName: getPartyName(template, playerSide),
        opponentPartyName: getPartyName(template, opponentSide),
      }),
      playerStrengths: normalized.strengths,
      playerWeaknesses: normalized.weaknesses,
      fallbackVerdict: normalizedFallbackVerdict,
      playerSide,
      playerPartyName: getPartyName(template, playerSide),
      opponentPartyName: getPartyName(template, opponentSide),
    }),
  };
};
