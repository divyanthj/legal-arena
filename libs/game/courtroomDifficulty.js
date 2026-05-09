const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

export const getCourtroomDifficultyProfile = (complexity = 3) => {
  const normalizedComplexity = clamp(Math.round(Number(complexity) || 3), 1, 5);
  const profiles = {
    1: {
      complexity: 1,
      counselPosture: "focused",
      opponentMinDelta: 1,
      opponentMaxDelta: 11,
      playerMinDelta: 5,
      playerMaxDelta: 20,
      partialCreditBonus: 3,
      proofStrictnessOffset: -0.25,
      verdictCloseCaseBand: 1,
      opponentResponseLimits: {
        maxParagraphs: 2,
        maxSentences: 5,
        maxCharacters: 950,
        issueBudget: 1,
      },
      promptGuidance: [
        "Opposing counsel remains talented and professional, but should press one or two decisive points rather than every possible weakness.",
        "The bench should credit clear, good-faith advocacy when it uses the visible record, even if it is not exhaustive.",
      ],
    },
    2: {
      complexity: 2,
      counselPosture: "focused",
      opponentMinDelta: 2,
      opponentMaxDelta: 13,
      playerMinDelta: 5,
      playerMaxDelta: 20,
      partialCreditBonus: 2,
      proofStrictnessOffset: -0.15,
      verdictCloseCaseBand: 2,
      opponentResponseLimits: {
        maxParagraphs: 3,
        maxSentences: 7,
        maxCharacters: 1250,
        issueBudget: 2,
      },
      promptGuidance: [
        "Opposing counsel remains talented and professional, but should prioritize the strongest weakness over a broad issue checklist.",
        "The bench should reward partially complete arguments that responsibly connect facts, law, and requested relief.",
      ],
    },
    3: {
      complexity: 3,
      counselPosture: "balanced",
      opponentMinDelta: 3,
      opponentMaxDelta: 16,
      playerMinDelta: 4,
      playerMaxDelta: 20,
      partialCreditBonus: 1,
      proofStrictnessOffset: 0,
      verdictCloseCaseBand: 3,
      opponentResponseLimits: {
        maxParagraphs: 4,
        maxSentences: 10,
        maxCharacters: 1700,
        issueBudget: 3,
      },
      promptGuidance: [
        "Opposing counsel should make a balanced professional response, attacking the most important proof and legal weaknesses.",
        "The bench should weigh the exchange under ordinary courtroom game expectations.",
      ],
    },
    4: {
      complexity: 4,
      counselPosture: "layered",
      opponentMinDelta: 4,
      opponentMaxDelta: 18,
      playerMinDelta: 3,
      playerMaxDelta: 20,
      partialCreditBonus: 0,
      proofStrictnessOffset: 0.1,
      verdictCloseCaseBand: 4,
      opponentResponseLimits: {
        maxParagraphs: 5,
        maxSentences: 14,
        maxCharacters: 2300,
        issueBudget: 4,
      },
      promptGuidance: [
        "Opposing counsel should make a sharper professional response that can layer proof, credibility, and legal-fit attacks.",
        "The bench should expect specific record use and careful handling of live disputes.",
      ],
    },
    5: {
      complexity: 5,
      counselPosture: "layered",
      opponentMinDelta: 4,
      opponentMaxDelta: 20,
      playerMinDelta: 2,
      playerMaxDelta: 20,
      partialCreditBonus: 0,
      proofStrictnessOffset: 0.18,
      verdictCloseCaseBand: 5,
      opponentResponseLimits: {
        maxParagraphs: 6,
        maxSentences: 18,
        maxCharacters: 3000,
        issueBudget: 5,
      },
      promptGuidance: [
        "Opposing counsel should make a sophisticated professional response that exploits multiple material gaps when the record supports them.",
        "The bench should expect precise fact use, lawbook fit, and strong answers to adverse proof.",
      ],
    },
  };

  return profiles[normalizedComplexity];
};

const splitSentences = (text = "") =>
  String(text || "")
    .replace(/\s+/g, " ")
    .match(/[^.!?]+[.!?]+|[^.!?]+$/g)
    ?.map((sentence) => sentence.trim())
    .filter(Boolean) || [];

const cleanVerdictListItem = (item = "") =>
  String(item || "")
    .trim()
    .replace(/^[-*•]\s+/, "")
    .trim();

const normalizeVerdictList = (items = [], limit = 3) =>
  [...new Set((Array.isArray(items) ? items : []).map(cleanVerdictListItem).filter(Boolean))]
    .slice(0, limit);

const normalizeVerdictText = (value = "") =>
  String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const hasJudgmentForParty = (summary = "", partyName = "") => {
  const text = normalizeVerdictText(summary);
  const party = normalizeVerdictText(partyName);
  if (!text || !party) return false;

  return [
    `judgment for ${party}`,
    `judgement for ${party}`,
    `ruling for ${party}`,
    `verdict for ${party}`,
    `decision for ${party}`,
    `finds for ${party}`,
    `court finds for ${party}`,
    `judgment in favor of ${party}`,
    `judgement in favor of ${party}`,
    `ruling in favor of ${party}`,
    `verdict in favor of ${party}`,
  ].some((phrase) => text.includes(phrase));
};

const hasBurdenFailureForParty = (summary = "", partyName = "") => {
  const text = normalizeVerdictText(summary);
  const party = normalizeVerdictText(partyName);
  if (!text || !party) return false;

  const partyIndex = text.indexOf(party);
  if (partyIndex === -1) return false;

  const windowText = text.slice(partyIndex, partyIndex + 220);
  const failure =
    /\b(has not|have not|did not|failed to|fails to|failure to)\b/.test(windowText);
  const burden =
    /\b(burden|prove|proven|proved|establish|established|show|shown|carried|carry)\b/.test(
      windowText
    );

  return failure && burden;
};

export const reconcileVerdictWinnerWithSummary = ({
  winner,
  summary = "",
  playerPartyName = "",
  opponentPartyName = "",
}) => {
  const safeWinner = ["player", "opponent", "draw"].includes(winner) ? winner : "draw";
  const text = String(summary || "").trim();

  if (!text) return safeWinner;

  const judgmentForPlayer = hasJudgmentForParty(text, playerPartyName);
  const judgmentForOpponent = hasJudgmentForParty(text, opponentPartyName);

  if (judgmentForPlayer && !judgmentForOpponent) return "player";
  if (judgmentForOpponent && !judgmentForPlayer) return "opponent";

  const playerWon = hasBurdenFailureForParty(text, opponentPartyName);
  const opponentWon = hasBurdenFailureForParty(text, playerPartyName);

  if (playerWon && !opponentWon) return "player";
  if (opponentWon && !playerWon) return "opponent";
  return safeWinner;
};

const PLAYER_ADVERSE_PATTERN =
  /\b(did not|does not|has not|have not|cannot|could not|failed|fails|failure|lack(?:s|ed|ing)?|no clean|no detailed|no reliable|no specific|not shown|not prove|not proven|not establish|not carried|not carry|unresolved|unsupported|weak|weakened|gap|gaps|defect|concession|wrong address|old address|proof problem|proof issue|concern|adverse)\b/i;

export const isPlayerAdverseVerdictPoint = (item = "") =>
  PLAYER_ADVERSE_PATTERN.test(cleanVerdictListItem(item));

export const getOpponentResponsePromptRules = (difficultyProfile) => {
  const profile = difficultyProfile || getCourtroomDifficultyProfile();
  const limits = profile.opponentResponseLimits;

  return [
    `Limit opponentResponse to at most ${limits.maxParagraphs} short paragraph${limits.maxParagraphs === 1 ? "" : "s"} and ${limits.maxSentences} sentences total.`,
    `Press no more than ${limits.issueBudget} core issue${limits.issueBudget === 1 ? "" : "s"} in opponentResponse; choose the best issue or issues and leave lesser points alone.`,
    "Do not turn opponentResponse into an exhaustive checklist of every weakness in the file.",
    "Keep opponentResponse elegant, forceful, and court-facing, not verbose or encyclopedic.",
  ];
};

export const limitOpponentResponseForDifficulty = (response = "", difficultyProfile) => {
  const profile = difficultyProfile || getCourtroomDifficultyProfile();
  const limits = profile.opponentResponseLimits;
  const paragraphs = String(response || "")
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
    .slice(0, limits.maxParagraphs);
  const sentenceLimited = [];
  let sentenceCount = 0;

  for (const paragraph of paragraphs) {
    if (sentenceCount >= limits.maxSentences) {
      break;
    }

    const remaining = limits.maxSentences - sentenceCount;
    const sentences = splitSentences(paragraph).slice(0, remaining);

    if (sentences.length) {
      sentenceLimited.push(sentences.join(" "));
      sentenceCount += sentences.length;
    }
  }

  let limited = (sentenceLimited.length ? sentenceLimited : paragraphs)
    .join("\n\n")
    .trim();

  if (limited.length > limits.maxCharacters) {
    const truncated = limited.slice(0, limits.maxCharacters);
    const lastSentenceEnd = Math.max(
      truncated.lastIndexOf("."),
      truncated.lastIndexOf("?"),
      truncated.lastIndexOf("!")
    );

    limited =
      lastSentenceEnd > limits.maxCharacters * 0.55
        ? truncated.slice(0, lastSentenceEnd + 1).trim()
        : truncated.trim();
  }

  return limited || String(response || "").trim();
};

export const normalizeCourtroomDeltasForDifficulty = ({
  playerDelta,
  opponentDelta,
  difficultyProfile,
  hasPartialCredit = false,
}) => {
  const profile = difficultyProfile || getCourtroomDifficultyProfile();
  const playerBonus = hasPartialCredit ? profile.partialCreditBonus : 0;

  return {
    playerDelta: clamp(
      Math.round(Number(playerDelta) || 0) + playerBonus,
      profile.playerMinDelta,
      profile.playerMaxDelta
    ),
    opponentDelta: clamp(
      Math.round(Number(opponentDelta) || 0),
      profile.opponentMinDelta,
      profile.opponentMaxDelta
    ),
  };
};

export const normalizeVerdictForDifficulty = ({
  verdict,
  updatedScore,
  fallbackVerdict,
  difficultyProfile,
  playerPartyName = "",
  opponentPartyName = "",
}) => {
  const profile = difficultyProfile || getCourtroomDifficultyProfile();
  const safeVerdict =
    verdict && typeof verdict === "object" ? verdict : fallbackVerdict || {};
  const fallbackWinner = fallbackVerdict?.winner || "draw";
  const scoreMargin = (updatedScore?.player || 0) - (updatedScore?.opponent || 0);
  let scoreWinner = "draw";

  if (scoreMargin > 0) {
    scoreWinner = "player";
  } else if (scoreMargin < 0) {
    scoreWinner = "opponent";
  }

  const closeCase = Math.abs(scoreMargin) <= profile.verdictCloseCaseBand;
  const requestedWinner = safeVerdict.winner || fallbackWinner;
  const scoreAdjustedWinner = closeCase ? requestedWinner : scoreWinner;
  const summary = safeVerdict.summary || fallbackVerdict?.summary || "";
  const winner = reconcileVerdictWinnerWithSummary({
    winner: scoreAdjustedWinner,
    summary,
    playerPartyName,
    opponentPartyName,
  });

  return {
    winner,
    summary,
    highlights: Array.isArray(safeVerdict.highlights)
      ? safeVerdict.highlights
      : fallbackVerdict?.highlights || [],
    concerns: Array.isArray(safeVerdict.concerns)
      ? safeVerdict.concerns
      : fallbackVerdict?.concerns || [],
  };
};

export const normalizePlayerPerspectiveVerdictLists = ({
  verdict,
  playerStrengths = [],
  playerWeaknesses = [],
  fallbackVerdict = {},
}) => {
  const safeVerdict = verdict && typeof verdict === "object" ? verdict : {};
  const providedHighlights = normalizeVerdictList(safeVerdict.highlights);
  const providedConcerns = normalizeVerdictList(safeVerdict.concerns);
  const fallbackHighlights = normalizeVerdictList(fallbackVerdict.highlights);
  const fallbackConcerns = normalizeVerdictList(fallbackVerdict.concerns);
  const strengths = normalizeVerdictList(playerStrengths);
  const weaknesses = normalizeVerdictList(playerWeaknesses);

  const adverseHighlights = providedHighlights.filter(isPlayerAdverseVerdictPoint);
  const playerHelpfulHighlights = providedHighlights.filter(
    (item) => !isPlayerAdverseVerdictPoint(item)
  );

  const highlights = normalizeVerdictList([
    ...playerHelpfulHighlights,
    ...strengths.filter((item) => !isPlayerAdverseVerdictPoint(item)),
    ...fallbackHighlights.filter((item) => !isPlayerAdverseVerdictPoint(item)),
  ]);

  const concerns = normalizeVerdictList([
    ...providedConcerns,
    ...adverseHighlights,
    ...weaknesses,
    ...fallbackConcerns,
  ]);

  return {
    highlights,
    concerns,
  };
};
