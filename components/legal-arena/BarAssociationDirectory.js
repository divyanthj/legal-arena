"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import * as HeroIcons from "@heroicons/react/24/outline";
import { toast } from "react-hot-toast";
import apiClient from "@/libs/api";
import MobileSectionNavigator from "./MobileSectionNavigator";

const barAssociationSectionNavigatorItems = [
  { key: "overview", label: "Overview", target: "bar-overview" },
  { key: "activity", label: "Profile activity", target: "bar-activity" },
  { key: "directory", label: "Lawyer directory", target: "bar-directory" },
];

const normalizeSearchText = (value = "") =>
  String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");

const fuzzyNameMatch = (name = "", query = "") => {
  const normalizedName = normalizeSearchText(name);
  const normalizedQuery = normalizeSearchText(query);

  if (!normalizedQuery) {
    return true;
  }

  if (normalizedName.includes(normalizedQuery)) {
    return true;
  }

  let queryIndex = 0;
  for (const character of normalizedName) {
    if (character === normalizedQuery[queryIndex]) {
      queryIndex += 1;
    }
    if (queryIndex === normalizedQuery.length) {
      return true;
    }
  }

  return false;
};

const getArenaHeadshot = (value = "") => {
  const image = String(value || "").trim();

  return image.startsWith("/api/players/avatar/") || image.startsWith("data:image/")
    ? image
    : "/images/profile.jpg";
};

const isDefaultHeadshot = (value = "") => getArenaHeadshot(value) === "/images/profile.jpg";

const LawyerPortrait = ({ image = "", name = "" }) => {
  const headshot = getArenaHeadshot(image);
  const fallbackHeadshot = getArenaHeadshot("");

  return (
    <div className="h-14 w-14 shrink-0 overflow-hidden rounded-full border border-white/15 bg-white/[0.04] shadow-[0_0_0_4px_rgba(255,255,255,0.025)]">
      <img
        src={headshot}
        alt={`${name || "Counsel"} headshot`}
        onError={(event) => {
          event.currentTarget.onerror = null;
          event.currentTarget.src = fallbackHeadshot;
        }}
        style={{ objectPosition: "center calc(50% + 1px)" }}
        className={`block h-full w-full object-cover object-center ${
          isDefaultHeadshot(image) ? "scale-[1.62]" : "scale-[1.09]"
        }`}
      />
    </div>
  );
};

const getRecordLabel = (entry = {}) =>
  `${entry.wins || 0}-${entry.losses || 0}-${entry.draws || 0}-${entry.settlements || 0}`;

const getWinRate = (entry = {}) => {
  const total = (entry.wins || 0) + (entry.losses || 0) + (entry.draws || 0);

  if (total <= 0) {
    return "Unrated";
  }

  return `${Math.round(((entry.wins || 0) / total) * 100)}% win rate`;
};

const getPvpRecordLabel = (entry = {}) => {
  const pvp = entry.pvp || {};

  return `${pvp.wins || 0}-${pvp.losses || 0}-${pvp.draws || 0}-${pvp.settlements || 0}`;
};

const formatProfileViewDate = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Recently";

  return `Viewed ${new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(date)}`;
};

const NUDGE_TYPE_LABELS = {
  manual_admin: "Admin nudge",
  resume_interview: "Resume intake",
  resume_courtroom: "Return to court",
  post_verdict_next_case: "Next matter",
  cooldown_return: "Matter available again",
  new_unlock: "New unlock",
  leaderboard_milestone: "Leaderboard milestone",
  new_content_relevant: "New matter",
  dormant_winback: "Return to arena",
};

const formatNudgeTimestamp = (value) => {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return "Unknown send time";

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "UTC",
    timeZoneName: "short",
  }).format(date);
};

const LastNudgePanel = ({ lastNudge, compact = false }) => {
  if (!lastNudge) {
    return compact ? (
      <div className="flex min-w-0 items-center gap-2 text-xs text-white/48">
        <HeroIcons.ClockIcon className="h-4 w-4 shrink-0" aria-hidden="true" />
        <span>No nudges sent yet</span>
      </div>
    ) : (
      <section className="animate-opacity overflow-hidden rounded-2xl border border-dashed border-white/12 bg-white/[0.025] p-4 md:p-5">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-white/10 bg-white/5 text-white/45">
            <HeroIcons.ClockIcon className="h-5 w-5" aria-hidden="true" />
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-white/45">Nudge history</p>
            <p className="mt-1 text-sm font-semibold text-white">No nudge has been sent to this lawyer yet.</p>
          </div>
        </div>
      </section>
    );
  }

  if (compact) {
    return (
      <div className="min-w-0 rounded-xl border border-emerald-300/12 bg-emerald-300/[0.045] px-3 py-2.5">
        <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.15em] text-emerald-200/70">
          <HeroIcons.CheckCircleIcon className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span>Last nudged</span>
          <span className="text-white/24">•</span>
          <time dateTime={lastNudge.sentAt} className="truncate text-white/50">
            {formatNudgeTimestamp(lastNudge.sentAt)}
          </time>
        </div>
        <p className="mt-1.5 truncate text-sm font-semibold text-white">{lastNudge.subject}</p>
        <p className="mt-1 line-clamp-2 text-xs leading-5 text-white/55">
          {lastNudge.messageAvailable
            ? lastNudge.message
            : "The body of this earlier nudge was not retained."}
        </p>
      </div>
    );
  }

  return (
    <section className="animate-opacity overflow-hidden rounded-2xl border border-emerald-300/15 bg-gradient-to-br from-emerald-300/[0.08] via-white/[0.035] to-amber-200/[0.035] shadow-lg shadow-black/15">
      <div className="flex flex-col gap-4 p-4 md:flex-row md:items-start md:justify-between md:p-5">
        <div className="flex min-w-0 items-start gap-3">
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-emerald-200/20 bg-emerald-200/10 text-emerald-200 shadow-inner">
            <HeroIcons.EnvelopeOpenIcon className="h-5 w-5" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-100/75">Last nudge sent</p>
              <span className="badge badge-sm border-white/10 bg-black/20 text-[10px] text-white/65">
                {NUDGE_TYPE_LABELS[lastNudge.nudgeType] || "Email nudge"}
              </span>
            </div>
            <p className="mt-2 text-base font-bold text-white">{lastNudge.subject}</p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2 rounded-full border border-white/10 bg-black/20 px-3 py-2 text-xs font-semibold text-white/65">
          <HeroIcons.ClockIcon className="h-4 w-4 text-emerald-200/70" aria-hidden="true" />
          <time dateTime={lastNudge.sentAt}>{formatNudgeTimestamp(lastNudge.sentAt)}</time>
        </div>
      </div>
      <div className="border-t border-white/8 bg-black/15 px-4 py-4 md:px-5">
        <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/40">Message sent</p>
        <p className={`mt-2 whitespace-pre-wrap text-sm leading-6 ${lastNudge.messageAvailable ? "text-white/75" : "italic text-white/45"}`}>
          {lastNudge.messageAvailable
            ? lastNudge.message
            : "The exact message body was not retained for this earlier nudge. Its subject and send time are still available above."}
        </p>
      </div>
    </section>
  );
};

export default function BarAssociationDirectory({
  players = [],
  viewerUserId = "",
  viewerName = "Counsel",
  recentProfileViewers = [],
  isAdmin = false,
}) {
  const [search, setSearch] = useState("");
  const [nudgeTarget, setNudgeTarget] = useState(null);
  const [nudgeOpen, setNudgeOpen] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState(null);
  const [analysisError, setAnalysisError] = useState("");
  const [selectedSuggestionId, setSelectedSuggestionId] = useState("");
  const [draft, setDraft] = useState({ subject: "", message: "" });
  const [sending, setSending] = useState(false);
  const [overrideWarnings, setOverrideWarnings] = useState(false);
  const [sendWarnings, setSendWarnings] = useState([]);
  const [lastNudgeByPlayerId, setLastNudgeByPlayerId] = useState(() =>
    Object.fromEntries(
      players.filter((player) => player.lastNudge).map((player) => [String(player.id), player.lastNudge])
    )
  );
  const query = search.trim();
  const viewer = players.find((player) => String(player.id) === String(viewerUserId));
  const challengers = players.filter((player) => String(player.id) !== String(viewerUserId));
  const filteredPlayers = useMemo(
    () => players.filter((player) => fuzzyNameMatch(player.name, query)),
    [players, query]
  );
  const filteredChallengerCount = filteredPlayers.filter(
    (player) => String(player.id) !== String(viewerUserId)
  ).length;
  const selectedSuggestion = analysis?.suggestions?.find(
    (suggestion) => suggestion.id === selectedSuggestionId
  );
  const activeWarnings = sendWarnings.length
    ? sendWarnings
    : selectedSuggestion?.warnings || analysis?.warnings || [];
  const modalLastNudge = analysis?.lastNudge || lastNudgeByPlayerId[String(nudgeTarget?.id)] || null;

  const analyzePlayer = async (player) => {
    setAnalyzing(true);
    setAnalysis(null);
    setAnalysisError("");
    setSelectedSuggestionId("");
    setDraft({ subject: "", message: "" });
    setOverrideWarnings(false);
    setSendWarnings([]);
    try {
      const result = await apiClient.post("/admin/nudges/analyze", {
        playerId: player.id,
      });
      setAnalysis(result);
      if (result.lastNudge) {
        setLastNudgeByPlayerId((current) => ({
          ...current,
          [String(player.id)]: result.lastNudge,
        }));
      }
    } catch (error) {
      setAnalysisError(error.message || "Could not analyze nudge opportunities.");
    } finally {
      setAnalyzing(false);
    }
  };

  const openNudge = (player) => {
    setNudgeTarget(player);
    setNudgeOpen(true);
    analyzePlayer(player);
  };

  const chooseSuggestion = (suggestion) => {
    setSelectedSuggestionId(suggestion.id);
    setDraft({ subject: suggestion.subject, message: suggestion.message });
    setOverrideWarnings(false);
    setSendWarnings([]);
  };

  const sendNudge = async () => {
    if (!selectedSuggestion || sending) return;
    setSending(true);
    try {
      const result = await apiClient.post("/admin/nudges/send", {
        playerId: nudgeTarget.id,
        conceptKey: selectedSuggestion.conceptKey,
        rationale: selectedSuggestion.rationale,
        subject: draft.subject,
        message: draft.message,
        overrideWarnings,
      });
      if (result.lastNudge) {
        setLastNudgeByPlayerId((current) => ({
          ...current,
          [String(nudgeTarget.id)]: result.lastNudge,
        }));
      }
      toast.success(`Nudge sent to ${nudgeTarget.name}.`);
      setNudgeOpen(false);
      setNudgeTarget(null);
    } catch (error) {
      const responseWarnings = error.response?.data?.warnings || [];
      if (responseWarnings.length) setSendWarnings(responseWarnings);
    } finally {
      setSending(false);
    }
  };

  return (
    <main className="arena-app-shell min-h-screen max-w-full overflow-x-hidden px-3 py-3 md:px-6 md:py-6">
      <section className="mx-auto w-full max-w-[1600px] min-w-0 space-y-4 arena-reveal">
        <div
          className="arena-surface arena-scanline arena-column-bg overflow-hidden"
          data-section-nav-target="bar-overview"
          style={{
            backgroundImage: [
              "linear-gradient(90deg, rgba(4,4,4,0.96) 0%, rgba(4,4,4,0.9) 42%, rgba(4,4,4,0.62) 72%, rgba(4,4,4,0.92) 100%)",
              "linear-gradient(180deg, rgba(15,37,45,0.16), rgba(0,0,0,0.1))",
              "url('/images/office.jpg')",
            ].join(", "),
            backgroundPosition: "center, center, 62% center",
            backgroundRepeat: "no-repeat, no-repeat, no-repeat",
            backgroundSize: "cover, cover, auto 120%",
          }}
        >
          <div className="p-5 md:p-8">
            <div className="flex flex-wrap items-center gap-2">
              <Link href="/dashboard" className="arena-btn-dark inline-flex px-4 py-2 text-sm">
                Back to Dashboard
              </Link>
              <span className="badge badge-outline border-white/15 text-white/80">
                Player Directory
              </span>
            </div>

            <div className="mt-8 grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
              <div className="min-w-0">
                <p className="arena-kicker">LEGAL ARENA</p>
                <h1 className="arena-headline mt-4 max-w-4xl break-words text-4xl uppercase leading-[0.92] sm:text-5xl md:text-7xl">
                  Bar Association
                </h1>
                <p className="mt-5 max-w-2xl text-sm leading-7 text-white/68 md:text-base">
                  Find counsel across the arena, inspect their public dossier, and choose who
                  deserves the next PVP challenge.
                </p>
              </div>

              <div className="arena-surface-soft flex flex-col justify-between p-5">
                <div>
                  <p className="arena-kicker">Roster</p>
                  <p className="mt-3 text-4xl font-semibold text-white">{players.length}</p>
                  <p className="mt-2 text-sm text-white/54">
                    {challengers.length} challenge targets outside your own profile.
                  </p>
                </div>
                {viewer ? (
                  <Link
                    href={`/dashboard/players/${viewer.id}`}
                    className="mt-6 flex items-center gap-3 rounded-lg border border-white/10 bg-black/24 p-3 transition hover:border-white/22"
                  >
                    <LawyerPortrait image={viewer.image} name={viewerName} />
                    <div className="min-w-0">
                      <p className="text-xs uppercase tracking-[0.15em] text-white/40">
                        Your listing
                      </p>
                      <p className="mt-1 truncate text-sm font-semibold text-white">
                        {viewerName}
                      </p>
                    </div>
                  </Link>
                ) : null}
              </div>
            </div>
          </div>
        </div>

        <section className="arena-surface" data-section-nav-target="bar-activity">
          <div className="p-5 md:p-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="arena-kicker">Profile Activity</p>
                <h2 className="arena-headline mt-2 text-2xl">Who viewed your dossier</h2>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-white/56">
                  Your six most recent unique visitors from the last 90 days. Your own visits
                  are never included.
                </p>
              </div>
              {recentProfileViewers.length ? (
                <span className="badge badge-outline border-white/15 text-white/64">
                  {recentProfileViewers.length} recent
                </span>
              ) : null}
            </div>

            {recentProfileViewers.length ? (
              <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {recentProfileViewers.map((player) => (
                  <Link
                    key={player.id}
                    href={`/dashboard/players/${player.id}`}
                    className="arena-surface-soft group flex min-w-0 items-center gap-3 border border-white/10 p-4 transition hover:-translate-y-0.5 hover:border-emerald-200/30"
                  >
                    <LawyerPortrait image={player.image} name={player.name} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-white group-hover:text-emerald-100">
                        {player.name}
                      </p>
                      <p className="mt-1 text-xs text-white/44">
                        {formatProfileViewDate(player.viewedAt)} · Rating {player.overallRating || 1000}
                      </p>
                    </div>
                    <HeroIcons.ChevronRightIcon className="h-4 w-4 shrink-0 text-white/28" aria-hidden="true" />
                  </Link>
                ))}
              </div>
            ) : (
              <div className="arena-surface-soft mt-5 border-dashed p-6 text-center">
                <HeroIcons.EyeIcon className="mx-auto h-6 w-6 text-white/32" aria-hidden="true" />
                <p className="mt-3 font-semibold text-white">No recent visitors yet</p>
                <p className="mt-2 text-sm text-white/52">
                  When another signed-in player opens your public dossier, they will appear here.
                </p>
              </div>
            )}
          </div>
        </section>

        <section className="arena-surface" data-section-nav-target="bar-directory">
          <div className="p-5 md:p-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="arena-kicker">Search Lawyers</p>
                <h2 className="arena-headline mt-2 text-2xl">Find a player to challenge</h2>
              </div>
              <div className="relative w-full lg:max-w-xl">
                <HeroIcons.MagnifyingGlassIcon
                  className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-white/36"
                  aria-hidden="true"
                />
                <input
                  type="search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search lawyers by name"
                  aria-label="Search lawyers by name"
                  className="h-12 w-full rounded-full border border-white/12 bg-white/[0.04] px-12 text-sm font-semibold text-white outline-none transition placeholder:text-white/35 focus:border-sky-300/60"
                />
              </div>
            </div>

            <div className="mt-5 flex flex-wrap items-center gap-2 text-xs uppercase tracking-[0.14em] text-white/42">
              <span>{filteredPlayers.length} visible lawyers</span>
              <span>{filteredChallengerCount} challenge targets</span>
              {query ? <span>Search: {query}</span> : null}
            </div>

            <div className="mt-6 grid gap-3 lg:grid-cols-2">
              {filteredPlayers.length > 0 ? (
                filteredPlayers.map((entry) => {
                  const isViewer = String(entry.id) === String(viewerUserId);
                  const lastNudge = lastNudgeByPlayerId[String(entry.id)] || entry.lastNudge || null;

                  return (
                    <article
                      key={entry.id}
                      className={`arena-surface-soft group flex min-w-0 flex-col gap-3 p-4 transition hover:-translate-y-0.5 hover:border-white/20 ${
                        isViewer ? "opacity-[0.78]" : ""
                      }`}
                    >
                      <Link
                        href={`/dashboard/players/${entry.id}`}
                        className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div className="flex min-w-0 items-center gap-4">
                          <LawyerPortrait image={entry.image} name={entry.name} />
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="truncate text-lg font-semibold text-white">
                                <span className="mr-2 text-white/45">#{entry.rank}</span>
                                {entry.name}
                              </p>
                              {isViewer ? (
                                <span className="badge border border-sky-300/25 bg-sky-300/10 text-sky-100">
                                  You
                                </span>
                              ) : null}
                            </div>
                            <p className="mt-2 text-sm text-white/52">
                              {entry.completedCases || 0} matters | Record {getRecordLabel(entry)} |{" "}
                              {getWinRate(entry)}
                            </p>
                            <p className="mt-1 text-sm text-white/42">
                              PVP {getPvpRecordLabel(entry)}
                            </p>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2 sm:w-44">
                          <div className="rounded-lg border border-white/10 bg-black/22 px-3 py-2">
                            <p className="text-[10px] uppercase tracking-[0.14em] text-white/36">Rating</p>
                            <p className="mt-1 text-lg font-semibold text-emerald-300">
                              {entry.overallRating || 1000}
                            </p>
                          </div>
                          <div className="rounded-lg border border-white/10 bg-black/22 px-3 py-2">
                            <p className="text-[10px] uppercase tracking-[0.14em] text-white/36">XP</p>
                            <p className="mt-1 text-lg font-semibold text-white">{entry.overallXp || 0}</p>
                          </div>
                        </div>
                      </Link>
                      {isAdmin && !isViewer && entry.canReceiveAdminNudge ? (
                        <div className="grid gap-3 border-t border-white/8 pt-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
                          <LastNudgePanel lastNudge={lastNudge} compact />
                          <button
                            type="button"
                            className="arena-btn-dark inline-flex items-center gap-2 px-4 py-2 text-sm"
                            onClick={() => openNudge(entry)}
                          >
                            <HeroIcons.BellAlertIcon className="h-4 w-4" aria-hidden="true" />
                            Nudge
                          </button>
                        </div>
                      ) : null}
                    </article>
                  );
                })
              ) : (
                <div className="arena-surface-soft border-dashed p-8 text-center lg:col-span-2">
                  <p className="text-lg font-semibold text-white">No lawyers match that search</p>
                  <p className="mt-2 text-sm text-white/62">
                    Try a shorter name fragment or clear the search to browse the full bar.
                  </p>
                </div>
              )}
            </div>
          </div>
        </section>
      </section>

      <MobileSectionNavigator sections={barAssociationSectionNavigatorItems} />

      {nudgeOpen ? (
        <dialog
          open
          className="arena-modal modal modal-open z-50 text-white"
          onCancel={(event) => {
            event.preventDefault();
            if (!sending) setNudgeOpen(false);
          }}
        >
          <div className="modal-box flex max-h-[92vh] w-11/12 max-w-5xl flex-col overflow-hidden rounded-3xl border border-white/15 bg-[#090b0f] p-0 text-white shadow-2xl shadow-black/80">
            <header className="relative shrink-0 overflow-hidden border-b border-white/10 bg-gradient-to-br from-white/[0.07] via-transparent to-amber-300/[0.06] px-6 py-5 md:px-8 md:py-6">
              <div className="pointer-events-none absolute -right-20 -top-28 h-64 w-64 rounded-full bg-amber-300/10 blur-3xl" />
              <div className="relative flex items-start justify-between gap-5">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 text-amber-100/80">
                    <HeroIcons.BellAlertIcon className="h-4 w-4" aria-hidden="true" />
                    <p className="text-xs font-bold uppercase tracking-[0.22em]">Admin Nudge</p>
                  </div>
                  <h2 className="mt-2 truncate text-3xl font-black tracking-tight text-white md:text-4xl">
                    {nudgeTarget?.name || "Analyze lawyer"}
                  </h2>
                  <p className="mt-2 max-w-3xl text-sm leading-6 text-white/70">
                    AI reviews summarized arena activity. Greetings, sign-offs, CTA, and unsubscribe text are added automatically.
                  </p>
                </div>
                <button
                  type="button"
                  className="arena-modal-close btn btn-circle btn-ghost btn-sm shrink-0 border border-white/10 bg-white/5 text-white hover:border-white/25 hover:bg-white/10"
                  onClick={() => setNudgeOpen(false)}
                  disabled={sending}
                  aria-label="Close nudge dialog"
                >
                  <HeroIcons.XMarkIcon className="h-5 w-5" />
                </button>
              </div>
            </header>

            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-5 text-white md:px-8 md:py-7">
              <LastNudgePanel lastNudge={modalLastNudge} />
              <div className="mt-6">
              {analyzing ? (
                <div className="flex min-h-[24rem] animate-opacity flex-col items-center justify-center text-center text-white">
                  <div className="relative grid h-20 w-20 place-items-center rounded-3xl border border-amber-200/20 bg-amber-200/10 shadow-lg shadow-amber-400/10">
                    <span className="loading loading-ring loading-lg text-amber-200" />
                    <HeroIcons.SparklesIcon className="absolute h-6 w-6 text-amber-100" />
                  </div>
                  <p className="mt-6 text-xl font-bold text-white">Analyzing activity</p>
                  <p className="mt-2 max-w-md text-sm leading-6 text-white/70">
                    Building grounded nudge options without reading raw transcripts.
                  </p>
                </div>
              ) : analysisError ? (
                <div role="alert" className="alert animate-popup border border-error/30 bg-error/10 text-white shadow-lg">
                  <HeroIcons.ExclamationTriangleIcon className="h-6 w-6 text-error" />
                  <div>
                    <h3 className="font-bold text-white">Analysis could not be completed</h3>
                    <p className="mt-1 text-sm text-white/70">{analysisError}</p>
                  </div>
                  <button type="button" className="btn btn-sm border-white/15 bg-white/10 text-white hover:bg-white/20" onClick={() => analyzePlayer(nudgeTarget)}>
                    Retry analysis
                  </button>
                </div>
              ) : analysis?.suppressed ? (
                <div role="alert" className="alert animate-popup border border-error/30 bg-error/10 text-white shadow-lg">
                  <HeroIcons.NoSymbolIcon className="h-6 w-6 text-error" />
                  <div>
                    <h3 className="font-bold text-white">Email delivery is suppressed</h3>
                    <p className="mt-1 text-sm leading-6 text-white/70">
                      {analysis.suppressionReason || "This lawyer has been removed from email delivery."} Suppression cannot be overridden here.
                    </p>
                  </div>
                </div>
              ) : analysis ? (
                <div className="grid animate-opacity gap-6 lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)]">
                  <section className="min-w-0">
                    <div className="flex items-end justify-between gap-4">
                      <div>
                        <p className="text-xs font-bold uppercase tracking-[0.2em] text-amber-100/75">Nudge Options</p>
                        <h3 className="mt-2 text-xl font-bold text-white">Choose an angle</h3>
                      </div>
                      <button type="button" className="btn btn-ghost btn-sm border border-white/10 bg-white/5 text-white hover:border-white/25 hover:bg-white/10" onClick={() => analyzePlayer(nudgeTarget)}>
                        <HeroIcons.ArrowPathIcon className="h-4 w-4" />
                        Analyze again
                      </button>
                    </div>
                    {analysis.warnings?.length ? (
                      <div role="alert" className="alert mt-4 border border-warning/30 bg-warning/10 py-3 text-warning-content shadow-sm">
                        <HeroIcons.ExclamationTriangleIcon className="h-5 w-5 text-warning" />
                        <div className="space-y-1 text-sm text-white">
                          {analysis.warnings.map((warning) => <p key={warning.code}>{warning.message}</p>)}
                        </div>
                      </div>
                    ) : null}
                    <div className="mt-4 space-y-3">
                      {analysis.suggestions.map((suggestion, index) => {
                        const isSelected = selectedSuggestionId === suggestion.id;
                        return (
                          <button
                            key={suggestion.id}
                            type="button"
                            onClick={() => chooseSuggestion(suggestion)}
                            style={{ animationDelay: `${Math.min(index * 55, 220)}ms` }}
                            className={`card w-full animate-appearFromRight border text-left text-white shadow-md transition duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-200 ${
                              isSelected
                                ? "scale-[1.01] border-amber-200/60 bg-amber-200/10 shadow-amber-400/10"
                                : "border-white/10 bg-white/[0.045] hover:-translate-y-0.5 hover:border-white/25 hover:bg-white/[0.075]"
                            }`}
                          >
                            <div className="card-body gap-2 p-4 md:p-5">
                              <div className="flex items-start justify-between gap-3">
                                <h4 className="text-base font-bold leading-6 text-white">{suggestion.title}</h4>
                                <span className={`mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full border transition ${isSelected ? "border-amber-200 bg-amber-200 text-black" : "border-white/20 text-transparent"}`}>
                                  <HeroIcons.CheckIcon className="h-4 w-4" />
                                </span>
                              </div>
                              <p className="text-sm leading-6 text-white/70">{suggestion.rationale}</p>
                              <div className="card-actions mt-1 items-center justify-between">
                                <span className="badge badge-outline border-amber-100/25 bg-amber-100/5 text-[10px] font-bold uppercase tracking-[0.16em] text-amber-100">
                                  {suggestion.ctaLabel}
                                </span>
                                <span className="text-xs font-semibold text-white/50">Select to edit</span>
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </section>

                  <section className="card min-h-[28rem] min-w-0 border border-white/10 bg-gradient-to-b from-white/[0.055] to-white/[0.025] text-white shadow-xl shadow-black/20 lg:sticky lg:top-0">
                    <div className="card-body p-5 md:p-6">
                      {selectedSuggestion ? (
                        <div key={selectedSuggestion.id} className="animate-opacity space-y-5 text-white">
                          <div className="flex items-start justify-between gap-4 border-b border-white/10 pb-4">
                            <div>
                              <p className="text-xs font-bold uppercase tracking-[0.2em] text-amber-100/75">Edit & Send</p>
                              <h3 className="mt-2 text-lg font-bold text-white">Review the final email</h3>
                              <p className="mt-1 text-sm leading-6 text-white/60">The recipient address is resolved securely when you send.</p>
                            </div>
                            <HeroIcons.EnvelopeIcon className="h-7 w-7 shrink-0 text-white/30" />
                          </div>
                          <label className="form-control w-full">
                            <div className="label px-0 py-1">
                              <span className="label-text font-bold text-white">Subject</span>
                              <span className="label-text-alt text-white/50">{draft.subject.length}/160</span>
                            </div>
                            <input
                              value={draft.subject}
                              maxLength={160}
                              onChange={(event) => setDraft((current) => ({ ...current, subject: event.target.value }))}
                              className="input input-bordered w-full border-white/15 bg-black/35 text-white placeholder:text-white/30 focus:border-amber-200 focus:outline-none"
                            />
                          </label>
                          <label className="form-control w-full">
                            <div className="label px-0 py-1">
                              <span className="label-text font-bold text-white">Message body</span>
                              <span className="label-text-alt text-white/50">{draft.message.length}/3000</span>
                            </div>
                            <textarea
                              value={draft.message}
                              maxLength={3000}
                              rows={10}
                              onChange={(event) => setDraft((current) => ({ ...current, message: event.target.value }))}
                              className="textarea textarea-bordered w-full resize-y border-white/15 bg-black/35 text-sm leading-6 text-white placeholder:text-white/30 focus:border-amber-200 focus:outline-none"
                            />
                            <div className="label px-0 pb-0">
                              <span className="label-text-alt flex items-center gap-1.5 text-white/60">
                                <HeroIcons.InformationCircleIcon className="h-4 w-4" />
                                Greeting and sign-off are added automatically.
                              </span>
                            </div>
                          </label>
                          {activeWarnings.length ? (
                            <div role="alert" className="alert block border border-warning/30 bg-warning/10 text-white">
                              <div className="flex items-start gap-3">
                                <HeroIcons.ExclamationTriangleIcon className="mt-0.5 h-5 w-5 shrink-0 text-warning" />
                                <div className="space-y-1 text-sm leading-6 text-white">
                                  {activeWarnings.map((warning) => <p key={warning.code}>{warning.message}</p>)}
                                </div>
                              </div>
                              <label className="mt-3 flex cursor-pointer items-start gap-3 rounded-xl border border-white/10 bg-black/20 p-3 text-sm leading-5 text-white/80">
                                <input type="checkbox" className="checkbox checkbox-warning checkbox-sm mt-0.5" checked={overrideWarnings} onChange={(event) => setOverrideWarnings(event.target.checked)} />
                                <span>I reviewed the warning and want to send this nudge anyway.</span>
                              </label>
                            </div>
                          ) : null}
                          <div className="card-actions pt-1">
                            <button
                              type="button"
                              className="btn w-full border-amber-100 bg-amber-100 text-black shadow-lg shadow-amber-300/10 hover:border-amber-200 hover:bg-amber-200"
                              disabled={sending || !draft.subject.trim() || !draft.message.trim() || (activeWarnings.length > 0 && !overrideWarnings)}
                              onClick={sendNudge}
                            >
                              {sending ? <span className="loading loading-spinner loading-sm" /> : <HeroIcons.PaperAirplaneIcon className="h-5 w-5" />}
                              {sending ? "Sending nudge..." : "Send nudge"}
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex min-h-[25rem] animate-opacity flex-col items-center justify-center text-center text-white">
                          <div className="grid h-16 w-16 place-items-center rounded-2xl border border-white/10 bg-white/5">
                            <HeroIcons.CursorArrowRaysIcon className="h-8 w-8 text-white/50" />
                          </div>
                          <p className="mt-5 text-lg font-bold text-white">Select a nudge option</p>
                          <p className="mt-2 max-w-sm text-sm leading-6 text-white/70">
                            Review and edit the exact subject and message before anything is sent.
                          </p>
                        </div>
                      )}
                    </div>
                  </section>
                </div>
              ) : null}
              </div>
            </div>
          </div>
          <form method="dialog" className="modal-backdrop bg-black/20">
            <button type="button" onClick={() => !sending && setNudgeOpen(false)} aria-label="Close nudge dialog">close</button>
          </form>
        </dialog>
      ) : null}
    </main>
  );
}
