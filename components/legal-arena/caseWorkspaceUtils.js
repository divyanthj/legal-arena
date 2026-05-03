"use client";

export const formatDateTime = (value) =>
  new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));

export const joinLines = (items = []) => items.join("\n");
export const splitLines = (value) =>
  value
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean);

export const normalizeCourtroomEntry = (entry = {}) => ({
  ...entry,
  citedFacts: Array.isArray(entry.citedFacts) ? entry.citedFacts : [],
  citedRules: Array.isArray(entry.citedRules) ? entry.citedRules : [],
  citedClaimIds: Array.isArray(entry.citedClaimIds) ? entry.citedClaimIds : [],
});

export const caseFileFieldClass =
  "textarea textarea-bordered arena-textarea arena-field h-24 text-slate-100";

export const winnerLabel = {
  player: "You prevailed",
  opponent: "Opposing counsel prevailed",
  draw: "The court found it too close",
};

export const winnerSignal = {
  player: "Favorable Ruling",
  opponent: "Adverse Ruling",
  draw: "Split Outcome",
};

export const verdictTone = {
  player: {
    card: "arena-status-favorable",
    eyebrow: "text-emerald-300",
  },
  opponent: {
    card: "arena-status-critical",
    eyebrow: "text-rose-300",
  },
  draw: {
    card: "arena-status-caution",
    eyebrow: "text-amber-300",
  },
};

export const statusTone = {
  interview: "arena-status-caution",
  courtroom: "arena-status-neutral",
  verdict: "arena-status-favorable",
  exited: "arena-status-critical",
};

export const ruleExplainers = {
  "burden-of-proof":
    "Tracks who had to prove the disputed point and whether that burden was actually met.",
  "reliable-records":
    "Rewards records and concrete documentation over assumptions or unsupported memory.",
  "presumption-and-proof":
    "Measures whether the argument overcame the starting presumption with actual proof.",
  "ordinary-wear-vs-damage":
    "Separates routine usage outcomes from chargeable damage based on the record.",
  "notice-and-fair-warning":
    "Looks at whether the opposing side had clear notice of the claimed basis or charge.",
  "proportional-remedy":
    "Checks whether requested relief is proportionate to what the record supports.",
  "credibility-under-pressure":
    "Weighs whether testimony remains credible once pressed on specifics and weak points.",
};

export const helpText = {
  playerPressure:
    "Pressure reflects how strongly your side has persuaded the court so far in this matter.",
  opponentPressure:
    "Opponent pressure reflects how strongly the other side is currently persuading the bench.",
  helpedYourSide:
    "These points helped your side establish stronger credibility or legal footing.",
  weakenedYourSide:
    "These points weakened your side through gaps, concessions, or unresolved issues.",
  factsUsed:
    "Badges indicate facts your argument relied on. Hover to inspect the underlying record detail.",
  rulesUsed:
    "Badges indicate lawbook rules engaged in the round. Hover to inspect each rule lens.",
};

export const InfoDot = ({ content, label }) => (
  <span
    className="inline-flex cursor-pointer items-center justify-center text-slate-400 transition hover:text-slate-200"
    data-tooltip-id="tooltip"
    data-tooltip-content={content}
    aria-label={label || "More information"}
    tabIndex={0}
  >
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
      className="h-4 w-4"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="m11.25 11.25.041-.02a.75.75 0 0 1 1.063.852l-.708 2.836a.75.75 0 0 0 1.063.853l.041-.021M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9-3.75h.008v.008H12V8.25Z"
      />
    </svg>
  </span>
);

export const getRuleTooltip = (rule) =>
  ruleExplainers[rule] ||
  `${rule
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ")} is one of the lawbook lenses the court used in this round.`;

export const normalizeFactKey = (value = "") => String(value || "").trim().toLowerCase();

export const buildCanonicalFactLookup = (caseSession) =>
  new Map(
    ((caseSession.template && caseSession.template.canonicalFacts) || []).flatMap((fact) => {
      const key = normalizeFactKey(fact.factId);
      if (!key) return [];
      return [[key, fact]];
    })
  );

export const resolveFactReference = (factReference, canonicalFactLookup) => {
  const trimmed = String(factReference || "").trim();
  if (!trimmed) {
    return {
      badge: "Fact",
      tooltip: helpText.factsUsed,
    };
  }

  const canonicalFact = canonicalFactLookup.get(normalizeFactKey(trimmed));

  if (canonicalFact) {
    return {
      badge: "Fact",
      tooltip: canonicalFact.canonicalDetail || canonicalFact.label || trimmed,
    };
  }

  return {
    badge: "Fact",
    tooltip: trimmed,
  };
};

export const getPlayerPartyName = (caseSession) =>
  caseSession.playerPartyName ||
  (caseSession.playerSide === "opponent"
    ? caseSession.premise.opponentName
    : caseSession.premise.clientName);

export const getOpponentPartyName = (caseSession) =>
  caseSession.opponentPartyName ||
  (caseSession.playerSide === "opponent"
    ? caseSession.premise.clientName
    : caseSession.premise.opponentName);

export const getPlaintiffName = (caseSession) =>
  caseSession.plaintiffName || caseSession.premise.clientName;

export const getDefendantName = (caseSession) =>
  caseSession.defendantName || caseSession.premise.opponentName;

export const getCaseRouteRef = (caseSession) => caseSession.slug || caseSession.id;

export const clampPercent = (value) => {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, value));
};
