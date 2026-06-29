import "server-only";

import {
  uniqueList,
  DEFAULT_PLAYER_SIDE,
  hashString,
  humanizeClaimText,
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
} from "./shared.js";
import {
  getCourtroomDifficultyProfile,
  limitOpponentResponseForDifficulty,
  normalizeCourtroomDeltasForDifficulty,
} from "../courtroomDifficulty.js";

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

const DEPOSIT_CASE_PATTERN =
  /\b(security deposit|deposit|withheld|deduction|deductions|itemized|itemised|ordinary wear|cleaning|repair)\b/i;

export const buildCourtroomRuleApplicationGuidance = ({ caseSession = {}, template = {} } = {}) => {
  const categoryCorpus = [
    caseSession.primaryCategory,
    caseSession.practiceArea,
    template.primaryCategory,
    template.practiceArea,
    template.title,
    template.overview,
    ...(caseSession.factSheet?.summary || []),
    ...(caseSession.factSheet?.supportingFacts || []),
    ...(caseSession.factSheet?.knownClaims || []),
    ...(caseSession.factSheet?.disputedFacts || []),
    ...(caseSession.factSheet?.corroboratedFacts || []),
    ...(caseSession.factSheet?.missingEvidence || []),
  ].join(" ");
  const guidance = [
    "Apply every materially cited lawbook rule that fits the visible record; do not let generic burden or proportionality rules crowd out category-specific rules.",
    "Treat visible party-side claimed amounts as testimony or party claims. Approximation lowers precision, but it does not erase the claim if the amount was surfaced in the fact sheet or transcript.",
    "When the record supports liability or an improper category but not the full requested amount, consider a partial remedy or reduced award instead of an all-or-nothing denial.",
  ];

  if (DEPOSIT_CASE_PATTERN.test(categoryCorpus)) {
    guidance.push(
      "For security-deposit disputes, apply Rule 11 directly: a landlord withholding deposit money needs itemization, actual-cost support, and a connection between each deduction and tenant-caused damage.",
      "For security-deposit disputes, apply Rule 9 directly: ordinary wear, routine turnover cleaning, and vague minor repairs should not be treated as chargeable damage without specific support.",
      "Use deposit burden allocation: the tenant must show the deposit was withheld and why the deduction is challenged; the landlord must justify the deduction with itemization, actual costs, or specific condition evidence.",
      "Missing landlord receipts, invoices, itemization, or condition records are legal weaknesses for the landlord, not merely proof gaps for the tenant."
    );
  }

  return guidance;
};

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
      ...(caseSession.factSheet.knownClaims || []),
      ...(caseSession.factSheet.disputedFacts || []),
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
  const ruleApplicationGuidance = buildCourtroomRuleApplicationGuidance({
    caseSession,
    template: safeTemplate,
  });
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
      ruleApplicationGuidance,
      scoringRules: [
        "Score the player only from the representedCounsel.publicCaseFile, lawbook rules, and courtroom transcript.",
        "Score the opponent only from opposingCounsel.preparedCaseFile, lawbook rules, and courtroom transcript.",
        "Do not infer, cite, or credit facts, claims, story details, or evidence outside those visible side files.",
        "Treat missing or unsurfaced proof as unavailable, even if an argument alludes to it.",
        ...ruleApplicationGuidance,
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
export const normalizeCourtResult = ({
  aiResult,
  counselAnalysis,
  shouldReturnVerdict,
  caseSession,
  rules,
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
      ...(caseSession.factSheet.knownClaims || []),
      ...(caseSession.factSheet.disputedFacts || []),
    ].map((item) => String(item || "").trim())
  );
  const validClaimIds = caseSession.factSheet.discoveredClaimIds || [];
  const validRuleIds = new Set((rules || []).map((rule) => rule.id));
  const sanitizeCourtFacts = (items = []) =>
    coerceStringList(items, 4).filter((item) => validFactText.has(item));
  const sanitizeCourtClaims = (items = []) => sanitizeIdList(items, validClaimIds, 4);
  const sanitizeCourtRules = (items = []) =>
    coerceStringList(items, 4).filter((item) => validRuleIds.has(item));

  if (!aiResult || typeof aiResult !== "object") {
    throw new Error("Courtroom response generation failed.");
  }

  const opponentResponse = coerceString(aiResult.opponentResponse);
  if (!opponentResponse) {
    throw new Error("Courtroom response generation returned no opponent response.");
  }
  if (typeof aiResult.playerDelta !== "number" || typeof aiResult.opponentDelta !== "number") {
    throw new Error("Courtroom response generation returned no score deltas.");
  }
  const benchSignal = coerceString(aiResult.benchSignal);
  if (!benchSignal) {
    throw new Error("Courtroom response generation returned no bench signal.");
  }

  const normalized = {
    opponentResponse: limitOpponentResponseForDifficulty(
      opponentResponse,
      difficultyProfile
    ),
    ...normalizeCourtroomDeltasForDifficulty({
      playerDelta: aiResult.playerDelta,
      opponentDelta: aiResult.opponentDelta,
      difficultyProfile,
      hasPartialCredit:
        normalizedCounsel.citedFacts.length > 0 ||
        normalizedCounsel.citedRules.length > 0 ||
        normalizedCounsel.citedClaimIds.length > 0,
    }),
    citedFacts: Array.isArray(aiResult.citedFacts)
      ? sanitizeCourtFacts(aiResult.citedFacts)
      : normalizedCounsel.citedFacts.length
      ? normalizedCounsel.citedFacts
      : [],
    citedRules: Array.isArray(aiResult.citedRules)
      ? sanitizeCourtRules(aiResult.citedRules)
      : normalizedCounsel.citedRules.length
      ? normalizedCounsel.citedRules
      : [],
    citedClaimIds: Array.isArray(aiResult.citedClaimIds)
      ? sanitizeCourtClaims(aiResult.citedClaimIds)
      : normalizedCounsel.citedClaimIds.length
      ? normalizedCounsel.citedClaimIds
      : [],
    strengths: Array.isArray(aiResult.strengths)
      ? aiResult.strengths
      : normalizedCounsel.strengths.length
      ? normalizedCounsel.strengths
      : [],
    weaknesses: Array.isArray(aiResult.weaknesses)
      ? aiResult.weaknesses
      : normalizedCounsel.weaknesses.length
      ? normalizedCounsel.weaknesses
      : [],
    benchSignal,
  };

  if (!shouldReturnVerdict) {
    return {
      ...normalized,
      verdict: null,
    };
  }

  const verdict = aiResult.verdict;
  const winner = coerceString(verdict?.winner);
  const summary = coerceString(verdict?.summary);

  if (!["player", "opponent", "draw"].includes(winner) || !summary) {
    throw new Error("Courtroom response generation returned no final verdict.");
  }

  return {
    ...normalized,
    verdict: {
      winner,
      summary,
      highlights: coerceStringList(verdict?.highlights, 3),
      concerns: coerceStringList(verdict?.concerns, 3),
    },
  };
};
