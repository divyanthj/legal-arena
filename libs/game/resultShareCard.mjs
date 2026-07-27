export const RESULT_SHARE_IMAGE_WIDTH = 1200;
export const RESULT_SHARE_IMAGE_HEIGHT = 630;

const OUTCOMES = new Set(["won", "lost", "draw", "settled"]);
const RESOLUTION_TYPES = new Set(["verdict", "settlement"]);

const cleanText = (value, maxLength = 120) =>
  String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);

const id = (value) => String(value?._id || value?.id || value || "");
const sameId = (left, right) => Boolean(id(left) && id(left) === id(right));
const clampComplexity = (value) =>
  Math.max(1, Math.min(5, Math.round(Number(value) || 1)));
const normalizeScore = (value) => Math.max(0, Math.round(Number(value) || 0));

const resultError = (message, status = 409) => {
  const error = new Error(message);
  error.status = status;
  return error;
};

const outcomeLabelFor = (outcome) =>
  ({
    won: "WON",
    lost: "LOST",
    draw: "DRAW",
    settled: "SETTLEMENT REACHED",
  }[outcome] || "");

export const buildResultShareCaption = (data) => {
  if (data.resolutionType === "settlement") {
    return `I settled a Level ${data.complexity} ${data.categoryTitle} case in Legal Arena — ${data.settlementQualityScore}/100 settlement quality. https://legalarena.app`;
  }

  const verb = data.outcome === "won" ? "won" : data.outcome === "lost" ? "lost" : "drew";
  return `I ${verb} a Level ${data.complexity} ${data.categoryTitle} case in Legal Arena — ${data.playerScore}–${data.opponentScore}. https://legalarena.app`;
};

export const createResultShareData = ({
  resolutionType,
  outcome,
  playerScore = 0,
  opponentScore = 0,
  settlementQualityScore = null,
  category,
  categoryTitle,
  complexity,
} = {}) => {
  if (!RESOLUTION_TYPES.has(resolutionType)) {
    throw resultError("A final verdict or settlement is required before sharing.");
  }
  if (!OUTCOMES.has(outcome)) {
    throw resultError("The result is not ready to share.");
  }
  if (resolutionType === "settlement" && outcome !== "settled") {
    throw resultError("The settlement result is not ready to share.");
  }
  if (resolutionType === "verdict" && outcome === "settled") {
    throw resultError("The verdict result is not ready to share.");
  }

  const normalizedCategory = cleanText(category, 80) || "general";
  const normalizedCategoryTitle = cleanText(categoryTitle, 80) || "General";
  const normalizedComplexity = clampComplexity(complexity);
  const normalizedQuality =
    resolutionType === "settlement"
      ? Math.max(0, Math.min(100, Math.round(Number(settlementQualityScore) || 0)))
      : null;
  const data = {
    resolutionType,
    outcome,
    outcomeLabel: outcomeLabelFor(outcome),
    playerScore: resolutionType === "verdict" ? normalizeScore(playerScore) : null,
    opponentScore: resolutionType === "verdict" ? normalizeScore(opponentScore) : null,
    settlementQualityScore: normalizedQuality,
    category: normalizedCategory,
    categoryTitle: normalizedCategoryTitle,
    complexity: normalizedComplexity,
    levelLabel: `LEVEL ${normalizedComplexity}`,
  };

  return {
    ...data,
    caption: buildResultShareCaption(data),
    fileName: `legal-arena-${outcome}-${normalizedCategory
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "case"}-level-${normalizedComplexity}.png`,
  };
};

const isSettledSource = (source = {}) =>
  source.status === "settled" ||
  source.settlement?.status === "settled" ||
  (source.settlement?.resolved === true && source.settlement?.resolution === "settled");

const soloOutcome = (winner) =>
  winner === "player" ? "won" : winner === "opponent" ? "lost" : winner === "draw" ? "draw" : "";

const challengeOutcome = ({ source, participant, viewerId }) => {
  if (participant?.verdict === "win") return "won";
  if (participant?.verdict === "loss") return "lost";
  if (participant?.verdict === "draw" || source.verdict?.winner === "draw") return "draw";
  if (source.verdict?.winnerUserId) {
    return sameId(source.verdict.winnerUserId, viewerId) ? "won" : "lost";
  }
  return "";
};

export const buildResultShareData = ({
  sourceType,
  source,
  viewerId,
  categoryTitle,
  settlementQualityScore,
} = {}) => {
  if (!source || !["caseSession", "challenge"].includes(sourceType)) {
    throw resultError("Result source not found.", 404);
  }

  const common = {
    category: source.primaryCategory,
    categoryTitle,
    complexity: source.complexity,
  };

  if (isSettledSource(source)) {
    return createResultShareData({
      ...common,
      resolutionType: "settlement",
      outcome: "settled",
      settlementQualityScore,
    });
  }

  if (source.status !== "verdict") {
    throw resultError("Resolve this case before sharing its result.");
  }

  if (sourceType === "caseSession") {
    const outcome = soloOutcome(source.verdict?.winner);
    if (!outcome) throw resultError("A final verdict is required before sharing.");
    return createResultShareData({
      ...common,
      resolutionType: "verdict",
      outcome,
      playerScore: source.verdict?.finalScore?.player ?? source.score?.player,
      opponentScore: source.verdict?.finalScore?.opponent ?? source.score?.opponent,
    });
  }

  const participant = (source.participants || []).find((entry) =>
    sameId(entry.userId, viewerId)
  );
  if (!participant) throw resultError("Result source not found.", 404);
  const opponent = (source.participants || []).find((entry) => !sameId(entry.userId, viewerId));
  const outcome = challengeOutcome({ source, participant, viewerId });
  if (!outcome) throw resultError("A final verdict is required before sharing.");

  return createResultShareData({
    ...common,
    resolutionType: "verdict",
    outcome,
    playerScore: participant.score,
    opponentScore: opponent?.score,
  });
};

const escapeXml = (value) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");

const visualTone = (outcome) => {
  if (outcome === "won" || outcome === "settled") {
    return { accent: "#6ee7b7", glow: "#10b981", soft: "#d1fae5" };
  }
  if (outcome === "lost") {
    return { accent: "#fda4af", glow: "#e11d48", soft: "#ffe4e6" };
  }
  return { accent: "#fcd34d", glow: "#f59e0b", soft: "#fef3c7" };
};

export const buildResultShareSvg = (data) => {
  const tone = visualTone(data.outcome);
  const isSettlement = data.resolutionType === "settlement";
  const metricLabel = isSettlement ? "SETTLEMENT QUALITY" : "FINAL SCORE";
  const metricValue = isSettlement
    ? `${data.settlementQualityScore}/100`
    : `${data.playerScore} — ${data.opponentScore}`;
  const outcomeLines = isSettlement
    ? [
        '<text x="88" y="278" font-size="68">SETTLEMENT</text>',
        '<text x="88" y="352" font-size="68">REACHED</text>',
      ]
    : [`<text x="88" y="334" font-size="112">${escapeXml(data.outcomeLabel)}</text>`];

  return `
<svg xmlns="http://www.w3.org/2000/svg" width="${RESULT_SHARE_IMAGE_WIDTH}" height="${RESULT_SHARE_IMAGE_HEIGHT}" viewBox="0 0 ${RESULT_SHARE_IMAGE_WIDTH} ${RESULT_SHARE_IMAGE_HEIGHT}">
  <defs>
    <linearGradient id="background" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#050707"/>
      <stop offset="0.58" stop-color="#0b0e0d"/>
      <stop offset="1" stop-color="#101411"/>
    </linearGradient>
    <radialGradient id="resultGlow" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(1000 105) rotate(139) scale(580 420)">
      <stop stop-color="${tone.glow}" stop-opacity="0.22"/>
      <stop offset="1" stop-color="${tone.glow}" stop-opacity="0"/>
    </radialGradient>
    <filter id="softGlow" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur stdDeviation="18"/>
    </filter>
  </defs>
  <rect width="1200" height="630" rx="36" fill="url(#background)"/>
  <rect width="1200" height="630" rx="36" fill="url(#resultGlow)"/>
  <rect x="1.5" y="1.5" width="1197" height="627" rx="34.5" fill="none" stroke="#ffffff" stroke-opacity="0.12" stroke-width="3"/>
  <circle cx="1072" cy="96" r="130" fill="${tone.glow}" fill-opacity="0.09" filter="url(#softGlow)"/>

  <g font-family="Arial, Helvetica, sans-serif">
    <g transform="translate(88 66)">
      <path d="M18 3v35M7 12h22M4 12l-4 14h14L10 12M26 12l-4 14h14L32 12M7 42h22" fill="none" stroke="#fcd34d" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/>
      <text x="52" y="29" fill="#ffffff" font-size="27" font-weight="800" letter-spacing="4">LEGAL ARENA</text>
    </g>
    <text x="1112" y="91" fill="#ffffff" fill-opacity="0.44" font-size="16" font-weight="700" letter-spacing="4" text-anchor="end">RESULT CARD</text>

    <text x="88" y="204" fill="${tone.accent}" font-size="21" font-weight="800" letter-spacing="5">${isSettlement ? "MATTER RESOLVED" : "FINAL VERDICT"}</text>
    <g fill="#ffffff" font-weight="900" letter-spacing="-2">
      ${outcomeLines.join("\n      ")}
    </g>

    <g transform="translate(756 174)">
      <rect width="356" height="220" rx="28" fill="#ffffff" fill-opacity="0.045" stroke="#ffffff" stroke-opacity="0.13" stroke-width="2"/>
      <rect x="1" y="1" width="354" height="218" rx="27" fill="${tone.glow}" fill-opacity="0.04"/>
      <text x="178" y="65" fill="#ffffff" fill-opacity="0.48" font-size="17" font-weight="800" letter-spacing="3" text-anchor="middle">${metricLabel}</text>
      <text x="178" y="146" fill="${tone.soft}" font-size="${isSettlement ? 66 : 58}" font-weight="900" text-anchor="middle">${escapeXml(metricValue)}</text>
      <text x="178" y="184" fill="#ffffff" fill-opacity="0.38" font-size="15" font-weight="700" letter-spacing="2" text-anchor="middle">${isSettlement ? "BALANCED OUTCOME" : "YOU  /  OPPONENT"}</text>
    </g>

    <line x1="88" y1="438" x2="1112" y2="438" stroke="#ffffff" stroke-opacity="0.12" stroke-width="2"/>
    <text x="88" y="488" fill="#ffffff" fill-opacity="0.42" font-size="15" font-weight="800" letter-spacing="3">PRACTICE AREA</text>
    <text x="88" y="535" fill="#ffffff" font-size="34" font-weight="800">${escapeXml(data.categoryTitle)}</text>
    <g transform="translate(842 475)">
      <rect width="270" height="70" rx="35" fill="${tone.glow}" fill-opacity="0.12" stroke="${tone.accent}" stroke-opacity="0.42" stroke-width="2"/>
      <text x="135" y="45" fill="${tone.soft}" font-size="23" font-weight="900" letter-spacing="3" text-anchor="middle">${escapeXml(data.levelLabel)}</text>
    </g>
    <text x="88" y="592" fill="#ffffff" fill-opacity="0.34" font-size="17" font-weight="700" letter-spacing="1.5">AI LAWYER GAME</text>
    <text x="1112" y="592" fill="#fcd34d" fill-opacity="0.82" font-size="18" font-weight="800" letter-spacing="2" text-anchor="end">LEGALARENA.APP</text>
  </g>
</svg>`.trim();
};
