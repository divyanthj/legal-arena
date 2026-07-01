import { LEGAL_CASE_CATEGORIES } from "@/libs/game/categories";

export const statusLabel = {
  interview: "Intake",
  settlement: "Settlement",
  settled: "Settled",
  courtroom: "In Court",
  verdict: "Verdict Ready",
  exited: "Exited",
};

export const statusTone = {
  interview: "arena-status-caution",
  settlement: "arena-status-caution",
  settled: "arena-status-favorable",
  courtroom: "arena-status-neutral",
  verdict: "arena-status-favorable",
  exited: "arena-status-critical",
};

export const outcomeLabel = {
  player: "Won",
  opponent: "Lost",
  draw: "Drew",
  settled: "Settled",
  "": "In Progress",
};

export const matterTabs = ["Case File", "Interview", "Courtroom", "Settlement", "Verdict"];

export const isValidDate = (value) => {
  if (!value) return false;
  return !Number.isNaN(new Date(value).getTime());
};

export const formatDate = (value, fallback = "Unknown date") => {
  if (!isValidDate(value)) return fallback;

  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
};

export const formatDateTime = (value, fallback = "Time unavailable") => {
  if (!isValidDate(value)) return fallback;

  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
};

export const getCategoryTitle = (slug) =>
  LEGAL_CASE_CATEGORIES.find((category) => category.slug === slug)?.title || slug;

export const getMatterId = (caseSession) =>
  caseSession?.slug || caseSession?.id || caseSession?._id || "";

export const getMatterIdentifiers = (caseSession) =>
  [caseSession?.slug, caseSession?.id, caseSession?._id].filter(Boolean).map(String);

export const findMatterById = (cases = [], matterId = "") => {
  const normalizedMatterId = String(matterId || "");

  return (
    cases.find((caseSession) =>
      getMatterIdentifiers(caseSession).includes(normalizedMatterId)
    ) || null
  );
};

export const getOutcome = (caseSession) =>
  caseSession?.status === "settled" ? "settled" : caseSession?.verdict?.winner || "";

export const getSidePlayed = (caseSession) =>
  caseSession?.playerSide === "opponent" ? "Defendant" : "Plaintiff";

export const getInterviewSpeaker = (entry, playerName) =>
  entry.role === "player" ? playerName : entry.speaker;

export const getCourtSpeaker = (entry, playerName, caseSession) =>
  entry.speaker === "player"
    ? playerName
    : caseSession.opponentPartyName || caseSession.premise?.opponentName || "Opponent";

export const getUniqueOptions = (items) => [...new Set(items.filter(Boolean))].sort();

export const getStatusFilterLabel = (status) => statusLabel[status] || status;

export const summarizeCount = (count, singular, plural = `${singular}s`) =>
  `${count} ${count === 1 ? singular : plural}`;

export const normalizeMatter = (caseSession) => ({
  ...caseSession,
  interviewCount: (caseSession.interviewTranscript || []).length,
  courtroomCount: (caseSession.courtroomTranscript || []).length,
  settlementCount: (caseSession.settlement?.transcript || []).length,
  outcome: getOutcome(caseSession),
  updatedDateLabel: formatDate(caseSession.updatedAt),
});

export function EmptyPanel({ title, detail }) {
  return (
    <div className="arena-surface-soft border-dashed p-6 text-center">
      <p className="font-semibold text-white">{title}</p>
      <p className="mt-2 text-sm leading-7 text-white/62">{detail}</p>
    </div>
  );
}

export function FactList({ title, items }) {
  const visibleItems = (items || []).filter(Boolean);

  return (
    <div className="arena-surface-soft p-4">
      <p className="font-semibold text-white">{title}</p>
      {visibleItems.length > 0 ? (
        <ul className="mt-3 space-y-2 text-sm leading-7 text-white/66">
          {visibleItems.map((item, index) => (
            <li key={`${title}-${index}`}>- {item}</li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-sm text-white/42">No entries recorded.</p>
      )}
    </div>
  );
}

export function TranscriptEntry({ children, isPlayer, meta, speaker }) {
  return (
    <article
      className={`rounded-xl p-4 ${
        isPlayer
          ? "arena-transcript-player ml-auto max-w-[95%]"
          : "arena-transcript-opponent"
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-semibold text-white">{speaker}</p>
        <p className="text-xs text-white/40">{meta}</p>
      </div>
      <p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-white">
        {children}
      </p>
    </article>
  );
}
