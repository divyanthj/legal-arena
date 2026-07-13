const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

export const getCourtroomDifficultyProfile = (complexity = 3) => {
  const normalizedComplexity = clamp(Math.round(Number(complexity) || 3), 1, 5);
  const profiles = {
    1: {
      complexity: 1,
      counselPosture: "focused",
      opponentMinDelta: 0,
      opponentMaxDelta: 20,
      playerMinDelta: 0,
      playerMaxDelta: 20,
      partialCreditBonus: 0,
      preparation: {
        factLimit: 2,
        evidenceLimit: 1,
        evidenceLeadLimit: 0,
        contradictionBudget: 0,
        ruleCombinationLimit: 1,
        maxIssuePivots: 0,
        secondaryWeaknessBudget: 0,
      },
      opponentResponseLimits: {
        maxParagraphs: 2,
        maxSentences: 5,
        maxCharacters: 950,
        issueBudget: 1,
      },
      promptGuidance: [
        "Opposing counsel is a junior, forgiving advocate who presses one plain core theory and one directly responsive rebuttal.",
        "Stay on that core theory throughout the case. Do not rotate to a new weakness in a later round, combine rules, exploit contradictions, or pursue secondary attacks.",
      ],
    },
    2: {
      complexity: 2,
      counselPosture: "focused",
      opponentMinDelta: 0,
      opponentMaxDelta: 20,
      playerMinDelta: 0,
      playerMaxDelta: 20,
      partialCreditBonus: 0,
      preparation: {
        factLimit: 3,
        evidenceLimit: 2,
        evidenceLeadLimit: 0,
        contradictionBudget: 1,
        ruleCombinationLimit: 1,
        maxIssuePivots: 0,
        secondaryWeaknessBudget: 0,
      },
      opponentResponseLimits: {
        maxParagraphs: 3,
        maxSentences: 7,
        maxCharacters: 1250,
        issueBudget: 2,
      },
      promptGuidance: [
        "Opposing counsel is a capable beginner who may press two connected issues but should use plain, direct advocacy.",
        "Keep the same connected issues throughout the case and do not introduce a new secondary weakness merely because an earlier response already used the strongest point.",
      ],
    },
    3: {
      complexity: 3,
      counselPosture: "balanced",
      opponentMinDelta: 0,
      opponentMaxDelta: 20,
      playerMinDelta: 0,
      playerMaxDelta: 20,
      partialCreditBonus: 0,
      preparation: {
        factLimit: 4,
        evidenceLimit: 3,
        evidenceLeadLimit: 1,
        contradictionBudget: 1,
        ruleCombinationLimit: 2,
        maxIssuePivots: 1,
        secondaryWeaknessBudget: 1,
      },
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
      opponentMinDelta: 0,
      opponentMaxDelta: 20,
      playerMinDelta: 0,
      playerMaxDelta: 20,
      partialCreditBonus: 0,
      preparation: {
        factLimit: 6,
        evidenceLimit: 5,
        evidenceLeadLimit: 2,
        contradictionBudget: 2,
        ruleCombinationLimit: 3,
        maxIssuePivots: 2,
        secondaryWeaknessBudget: 2,
      },
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
      opponentMinDelta: 0,
      opponentMaxDelta: 20,
      playerMinDelta: 0,
      playerMaxDelta: 20,
      partialCreditBonus: 0,
      preparation: {
        factLimit: 8,
        evidenceLimit: 7,
        evidenceLeadLimit: 3,
        contradictionBudget: 3,
        ruleCombinationLimit: 4,
        maxIssuePivots: 3,
        secondaryWeaknessBudget: 3,
      },
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

const escapeRegExp = (value = "") =>
  String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const replaceRoleReferences = (text = "", role = "", replacement = "") => {
  if (!role || !replacement) {
    return text;
  }

  const rolePattern = escapeRegExp(role);

  return text
    .replace(new RegExp(`\\b${rolePattern}'s\\b`, "gi"), `${replacement}'s`)
    .replace(new RegExp(`\\b${rolePattern}\\b`, "gi"), replacement);
};

export const rewriteVerdictForPlayerAddress = (
  value = "",
  { playerSide = "player", playerPartyName = "", opponentPartyName = "" } = {}
) => {
  let text = cleanVerdictListItem(value);

  if (!text) {
    return "";
  }

  const playerRole = playerSide === "opponent" ? "Defendant" : "Plaintiff";
  const opponentRole = playerSide === "opponent" ? "Plaintiff" : "Defendant";
  const playerNamePattern = escapeRegExp(playerPartyName);
  const opponentNamePattern = escapeRegExp(opponentPartyName);

  if (playerNamePattern) {
    text = text
      .replace(new RegExp(`\\b(judg(?:e)?ment|ruling|verdict|decision) for ${playerNamePattern}\\b`, "gi"), "$1 for your side")
      .replace(new RegExp(`\\bfinds for ${playerNamePattern}\\b`, "gi"), "finds for your side")
      .replace(new RegExp(`\\b${playerNamePattern}'s\\b`, "gi"), "Your")
      .replace(new RegExp(`\\b${playerNamePattern}\\b`, "gi"), "You");
  }

  if (opponentNamePattern) {
    text = text
      .replace(new RegExp(`\\b(judg(?:e)?ment|ruling|verdict|decision) for ${opponentNamePattern}\\b`, "gi"), "$1 for the other side")
      .replace(new RegExp(`\\bfinds for ${opponentNamePattern}\\b`, "gi"), "finds for the other side")
      .replace(new RegExp(`\\b${opponentNamePattern}'s\\b`, "gi"), "The other side's")
      .replace(new RegExp(`\\b${opponentNamePattern}\\b`, "gi"), "The other side");
  }

  text = replaceRoleReferences(text, playerRole, "You");
  text = replaceRoleReferences(text, opponentRole, "The other side");

  return text
    .replace(/\bYou's\b/g, "Your")
    .replace(/\bThe other side's's\b/g, "The other side's")
    .replace(/\bfor You\b/g, "for your side")
    .replace(/\bfor the You\b/gi, "for your side")
    .replace(/\bfor The other side\b/g, "for the other side")
    .replace(/\bfor the The other side\b/gi, "for the other side")
    .replace(/\bthe The other side\b/g, "the other side")
    .replace(/\bYou was\b/g, "You were")
    .replace(/\bYou has\b/g, "You have")
    .replace(/\bYou does\b/g, "You do")
    .replace(/\bYou is\b/g, "You are")
    .replace(/\s+/g, " ")
    .trim();
};

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

const hasPlayerReliefDenied = (summary = "") => {
  const text = normalizeVerdictText(summary);
  if (!text) return false;

  const denial =
    /\b(denies|denied|declines|refuses|rejects|does not grant|will not grant|cannot award|no award|no recovery|no judgment|no judgement|without award|denied relief)\b/.test(
      text
    );
  const playerRelief =
    /\b(your requested|your request|your claim|you seek|you sought|requested relief|requested money|money judgment|money judgement|repayment award|award of damages|requested award|relief you seek|judgment you seek|judgement you seek)\b/.test(
      text
    );

  return denial && playerRelief;
};

const hasOpponentReliefDenied = (summary = "") => {
  const text = normalizeVerdictText(summary);
  if (!text) return false;

  const denial =
    /\b(denies|denied|declines|refuses|rejects|does not grant|will not grant|cannot award|no award|no recovery|no judgment|no judgement|without award|denied relief)\b/.test(
      text
    );
  const opponentRelief =
    /\b(the other side s requested|the other side requested|opposing counsel s requested|opponent s requested|their requested|their request|their claim|they seek|they sought|the other side seeks|the other side sought)\b/.test(
      text
    );

  return denial && opponentRelief;
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

  if (hasPlayerReliefDenied(text) && !hasOpponentReliefDenied(text)) return "opponent";
  if (hasOpponentReliefDenied(text) && !hasPlayerReliefDenied(text)) return "player";

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

export const getOpponentStrategyPromptRules = (difficultyProfile) => {
  const profile = difficultyProfile || getCourtroomDifficultyProfile();
  const preparation = profile.preparation;

  return [
    `Use no more than ${preparation.ruleCombinationLimit} materially connected lawbook rule${preparation.ruleCombinationLimit === 1 ? "" : "s"} in one response.`,
    `Exploit no more than ${preparation.contradictionBudget} contradiction${preparation.contradictionBudget === 1 ? "" : "s"} from the prepared case file.`,
    preparation.maxIssuePivots === 0
      ? "Do not pivot to a new core issue across rounds; keep rebutting from the prepared core theory already used in the transcript."
      : `Across the whole case, make at most ${preparation.maxIssuePivots} strategic issue pivot${preparation.maxIssuePivots === 1 ? "" : "s"}.`,
    preparation.secondaryWeaknessBudget === 0
      ? "Do not pursue secondary weaknesses outside the prepared core issues."
      : `Pursue no more than ${preparation.secondaryWeaknessBudget} secondary weakness${preparation.secondaryWeaknessBudget === 1 ? "" : "es"} across the response.`,
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
  fallbackVerdict,
  difficultyProfile,
  playerPartyName = "",
  opponentPartyName = "",
}) => {
  const safeVerdict =
    verdict && typeof verdict === "object" ? verdict : fallbackVerdict || {};
  const fallbackWinner = fallbackVerdict?.winner || "draw";
  const requestedWinner = safeVerdict.winner || fallbackWinner;
  const summary = safeVerdict.summary || fallbackVerdict?.summary || "";
  const winner = reconcileVerdictWinnerWithSummary({
    winner: requestedWinner,
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
  playerSide = "player",
  playerPartyName = "",
  opponentPartyName = "",
}) => {
  const safeVerdict = verdict && typeof verdict === "object" ? verdict : {};
  const perspective = { playerSide, playerPartyName, opponentPartyName };
  const providedHighlights = normalizeVerdictList(safeVerdict.highlights).map((item) =>
    rewriteVerdictForPlayerAddress(item, perspective)
  );
  const providedConcerns = normalizeVerdictList(safeVerdict.concerns).map((item) =>
    rewriteVerdictForPlayerAddress(item, perspective)
  );
  const fallbackHighlights = normalizeVerdictList(fallbackVerdict.highlights).map((item) =>
    rewriteVerdictForPlayerAddress(item, perspective)
  );
  const fallbackConcerns = normalizeVerdictList(fallbackVerdict.concerns).map((item) =>
    rewriteVerdictForPlayerAddress(item, perspective)
  );
  const strengths = normalizeVerdictList(playerStrengths).map((item) =>
    rewriteVerdictForPlayerAddress(item, perspective)
  );
  const weaknesses = normalizeVerdictList(playerWeaknesses).map((item) =>
    rewriteVerdictForPlayerAddress(item, perspective)
  );

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
