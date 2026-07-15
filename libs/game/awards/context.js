import { calculateSettlementQuality } from "@/libs/game/settlementQuality";

const words = (text = "") => String(text || "").trim().split(/\s+/).filter(Boolean).length;
const asPlain = (value) => value?.toObject ? value.toObject() : value;
const unique = (items = []) => [...new Set(items.filter(Boolean).map(String))];
const playerSideName = (side = "") => side === "opponent" ? "defendant" : "claimant";

const evidenceInventory = (source = {}) =>
  source.templateSnapshot?.evidenceItems || source.caseTemplateId?.evidenceItems || [];

export const buildSoloAwardContext = (caseSession) => {
  const source = asPlain(caseSession) || {};
  const playerEntries = (source.courtroomTranscript || []).filter((entry) => entry.speaker === "player");
  const questions = (source.interviewTranscript || []).filter(
    (entry) => entry.role === "player" && entry.sourceType === "question"
  );
  const discoveredFacts = unique(source.factSheet?.discoveredFactIds || []);
  const discoveredEvidence = unique(source.factSheet?.discoveredEvidenceIds || []);
  const evidenceById = new Map(evidenceInventory(source).map((item) => [String(item.id), item]));
  const canonicalFacts = source.templateSnapshot?.canonicalFacts || [];
  const priorityFacts = canonicalFacts.filter((fact) => Number(fact.discoverability?.priority) >= 4);
  const priorityRisks = priorityFacts.filter((fact) => fact.kind === "risk");
  const settlementQuality = calculateSettlementQuality({ finalMoods: source.settlement?.moods || {} });
  const outcome = source.status === "settled"
    ? "settled"
    : source.verdict?.winner === "player" ? "win"
      : source.verdict?.winner === "opponent" ? "loss"
        : source.verdict?.winner === "draw" ? "draw" : "abandoned";
  const createdAt = source.createdAt ? new Date(source.createdAt).getTime() : null;
  const completedAt = source.completedAt ? new Date(source.completedAt).getTime() : null;

  return {
    sourceType: "case",
    caseId: String(source._id || source.id),
    playerId: String(source.userId),
    outcome,
    side: playerSideName(source.playerSide),
    difficulty: Number(source.complexity) || 1,
    initialSuccessChance: source.caseAssessment?.lockedCourtEntryChance ?? null,
    finalSuccessChance: source.caseAssessment?.currentSuccessChance ?? null,
    legalCategory: source.primaryCategory || "",
    jurisdiction: source.caseCountry?.code || "",
    intakeQuestionCount: questions.length,
    decisiveFactsDiscovered: discoveredFacts.length,
    allMaterialFactsDiscovered: priorityFacts.length > 0 && priorityFacts.every((fact) => discoveredFacts.includes(String(fact.factId))),
    allMaterialRisksDiscovered: priorityRisks.length > 0 && priorityRisks.every((fact) => discoveredFacts.includes(String(fact.factId))),
    hiddenFactsDiscovered: priorityFacts.filter((fact) => discoveredFacts.includes(String(fact.factId))).length,
    evidenceSubmittedCount: unique(playerEntries.flatMap((entry) => entry.citedEvidenceIds || [])).length || null,
    submittedEvidenceIds: unique(playerEntries.flatMap((entry) => entry.citedEvidenceIds || [])),
    evidenceTypes: unique(discoveredEvidence.map((id) => evidenceById.get(id)?.type)),
    argumentCount: playerEntries.length,
    argumentWordCount: playerEntries.reduce((total, entry) => total + words(entry.text), 0),
    legalRulesCorrectlyApplied: unique(playerEntries.flatMap((entry) => entry.citedRules || [])).length,
    legalRuleIds: unique(playerEntries.flatMap((entry) => entry.citedRules || [])),
    durationSeconds: createdAt != null && completedAt != null ? Math.max(0, Math.round((completedAt - createdAt) / 1000)) : null,
    intakeDurationSeconds: null,
    disposition: source.verdict?.outcomeMetrics?.disposition || null,
    amountClaimed: source.verdict?.outcomeMetrics?.amountClaimed ?? null,
    amountAwarded: source.verdict?.outcomeMetrics?.amountAwarded ?? null,
    expectedLiabilityBefore: source.verdict?.outcomeMetrics?.expectedLiabilityBefore ?? null,
    actualLiability: source.verdict?.outcomeMetrics?.actualLiability ?? null,
    overallRating: null,
    settlement: {
      accepted: source.status === "settled" || source.settlement?.accepted === true,
      rounds: (source.settlement?.transcript || []).filter((entry) => entry.role === "player").length,
      rejectedOffers: Number(source.settlement?.rejectionCount) || 0,
      finalMoodScores: Object.values(source.settlement?.moods || {}).map(Number),
      monetaryOutcome: source.settlement?.outcomeMetrics?.monetaryOutcome ?? null,
      nonMonetaryTerms: source.settlement?.finalTerms || [],
      qualityScore: settlementQuality.score,
    },
    playerArguments: playerEntries.map((entry) => ({ text: entry.text, citedFacts: entry.citedFacts || [], citedRules: entry.citedRules || [] })),
    opposingArguments: (source.courtroomTranscript || []).filter((entry) => entry.speaker === "opponent").map((entry) => entry.text),
    intakeSummary: questions.map((entry) => entry.text),
    discoveredFacts,
    verdict: source.verdict || {},
  };
};

export const buildChallengeAwardContexts = (challenge) => {
  const source = asPlain(challenge) || {};
  return (source.participants || []).map((participant) => {
    const submissions = (source.courtroomRounds || []).flatMap((round) =>
      (round.submissions || []).filter((submission) => String(submission.userId) === String(participant.userId))
    );
    const opponentSubmissions = (source.courtroomRounds || []).flatMap((round) =>
      (round.submissions || []).filter((submission) => String(submission.userId) !== String(participant.userId))
    );
    const questions = (participant.interviewTranscript || []).filter((entry) => entry.role === "player" && entry.sourceType === "question");
    const settlementQuality = calculateSettlementQuality({ finalMoods: source.settlement?.moods || {} });
    return {
      sourceType: "challenge",
      caseId: String(source._id || source.id),
      playerId: String(participant.userId),
      outcome: source.status === "settled" ? "settled" : participant.verdict || "abandoned",
      side: playerSideName(participant.side),
      difficulty: Number(source.complexity) || 1,
      initialSuccessChance: participant.caseAssessment?.lockedCourtEntryChance ?? null,
      legalCategory: source.primaryCategory || "",
      jurisdiction: source.caseCountry?.code || "",
      intakeQuestionCount: questions.length,
      decisiveFactsDiscovered: unique(participant.factSheet?.discoveredFactIds || []).length,
      evidenceSubmittedCount: unique(submissions.flatMap((entry) => entry.citedEvidenceIds || [])).length || null,
      submittedEvidenceIds: unique(submissions.flatMap((entry) => entry.citedEvidenceIds || [])),
      evidenceTypes: [],
      argumentCount: submissions.length,
      argumentWordCount: submissions.reduce((total, entry) => total + words(entry.text), 0),
      legalRulesCorrectlyApplied: unique(submissions.flatMap((entry) => entry.citedRules || [])).length,
      legalRuleIds: unique(submissions.flatMap((entry) => entry.citedRules || [])),
      durationSeconds: source.createdAt && source.completedAt ? Math.max(0, Math.round((new Date(source.completedAt) - new Date(source.createdAt)) / 1000)) : null,
      settlement: { accepted: source.status === "settled", rounds: (source.settlement?.transcript || []).length, rejectedOffers: Number(source.settlement?.rejectionCount) || 0, finalMoodScores: Object.values(source.settlement?.moods || {}).map(Number), nonMonetaryTerms: source.settlement?.finalTerms || [], qualityScore: settlementQuality.score },
      playerArguments: submissions.map((entry) => ({ text: entry.text, citedFacts: entry.citedFacts || [], citedRules: entry.citedRules || [] })),
      opposingArguments: opponentSubmissions.map((entry) => entry.text),
      intakeSummary: questions.map((entry) => entry.text),
      discoveredFacts: unique(participant.factSheet?.discoveredFactIds || []),
      verdict: source.verdict || {},
    };
  });
};

