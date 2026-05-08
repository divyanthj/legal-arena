"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "react-hot-toast";
import apiClient from "@/libs/api";
import {
  EmptyPanel,
  formatDate,
  getCategoryTitle,
  getMatterId,
  getSidePlayed,
  getStatusFilterLabel,
  getUniqueOptions,
  isValidDate,
  normalizeMatter,
  outcomeLabel,
  statusLabel,
  statusTone,
  summarizeCount,
} from "./playerDossierShared";
import { CollapseChevron } from "./caseWorkspaceUtils";

const getNextRatingMilestone = (rating = 1000) => {
  const milestones = [1200, 1500, 1800, 2100];
  return milestones.find((value) => value > rating) || rating + 300;
};

const formatResetDateTime = (value) => {
  if (!isValidDate(value)) {
    return "";
  }

  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
};

export default function PlayerProfileDossier({
  profile,
  viewerUserId = "",
}) {
  const router = useRouter();
  const { player, cases = [] } = profile;
  const normalizedCases = useMemo(() => cases.map(normalizeMatter), [cases]);
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [outcomeFilter, setOutcomeFilter] = useState("all");
  const [avatarPreview, setAvatarPreview] = useState("");
  const [showResetDialog, setShowResetDialog] = useState(false);
  const [resetting, setResetting] = useState(false);

  const categoryOptions = useMemo(
    () => getUniqueOptions(normalizedCases.map((caseSession) => caseSession.primaryCategory)),
    [normalizedCases]
  );
  const statusOptions = useMemo(
    () => getUniqueOptions(normalizedCases.map((caseSession) => caseSession.status)),
    [normalizedCases]
  );
  const outcomeOptions = useMemo(
    () => getUniqueOptions(normalizedCases.map((caseSession) => caseSession.outcome || "open")),
    [normalizedCases]
  );

  const filteredCases = useMemo(
    () =>
      normalizedCases.filter((caseSession) => {
        const outcome = caseSession.outcome || "open";

        return (
          (categoryFilter === "all" || caseSession.primaryCategory === categoryFilter) &&
          (statusFilter === "all" || caseSession.status === statusFilter) &&
          (outcomeFilter === "all" || outcome === outcomeFilter)
        );
      }),
    [categoryFilter, normalizedCases, outcomeFilter, statusFilter]
  );

  const sortedCategories = useMemo(
    () =>
      [...(player.categoryStats || [])].sort((left, right) => {
        if ((right.completedCases || 0) !== (left.completedCases || 0)) {
          return (right.completedCases || 0) - (left.completedCases || 0);
        }

        if ((right.rating || 0) !== (left.rating || 0)) {
          return (right.rating || 0) - (left.rating || 0);
        }

        return getCategoryTitle(left.categorySlug).localeCompare(
          getCategoryTitle(right.categorySlug)
        );
      }),
    [player.categoryStats]
  );

  const joinedLabel = isValidDate(player.joinedAt)
    ? `Joined ${formatDate(player.joinedAt)}`
    : "Join date unavailable";
  const nextMilestone = getNextRatingMilestone(player.overallRating || 1000);
  const completedCategories = sortedCategories.filter(
    (category) => (category.completedCases || 0) > 0
  ).length;
  const topCategory = sortedCategories[0] || null;
  const totalDecidedMatters =
    (player.wins || 0) + (player.losses || 0) + (player.draws || 0);
  const winRate =
    totalDecidedMatters > 0
      ? Math.round(((player.wins || 0) / totalDecidedMatters) * 100)
      : 0;
  const canEditAvatar = String(viewerUserId || "") === String(player.id || "");
  const resetAvailableAt = isValidDate(player.gameplayResetAvailableAt)
    ? new Date(player.gameplayResetAvailableAt)
    : null;
  const lastResetLabel = formatResetDateTime(player.lastGameplayResetAt);
  const nextResetLabel = formatResetDateTime(player.gameplayResetAvailableAt);
  const resetCooldownActive =
    Boolean(resetAvailableAt) && resetAvailableAt.getTime() > Date.now();
  const resetCooldownLabel = resetCooldownActive
    ? `Fresh Start opens again ${nextResetLabel || "soon"}.`
    : "";

  const openResetDialog = () => {
    setShowResetDialog(true);
  };

  const handleResetProgress = async () => {
    if (resetting || resetCooldownActive) {
      if (resetCooldownActive) {
        toast(resetCooldownLabel || "Fresh Start is cooling down.");
      }
      return;
    }

    setResetting(true);

    try {
      await apiClient.post("/players/reset");
      toast.success("Clean slate ready. The arena is yours again.");
      setShowResetDialog(false);
      router.refresh();
    } catch (error) {
      toast.error(error?.message || "Could not reset your arena record.");
    } finally {
      setResetting(false);
    }
  };

  const handleAvatarChange = (event) => {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    const previewUrl = URL.createObjectURL(file);
    setAvatarPreview((current) => {
      if (current) {
        URL.revokeObjectURL(current);
      }

      return previewUrl;
    });
  };

  return (
    <main className="arena-app-shell min-h-screen overflow-x-hidden px-4 py-6 md:px-8 md:py-10">
      <section className="mx-auto max-w-[1600px] space-y-6 arena-reveal">
        <div
          className="arena-surface arena-scanline arena-column-bg overflow-hidden"
          style={{
            backgroundImage: [
              "linear-gradient(90deg, rgba(4,4,4,0.96) 0%, rgba(4,4,4,0.9) 36%, rgba(4,4,4,0.58) 68%, rgba(4,4,4,0.92) 100%)",
              "linear-gradient(180deg, rgba(38,24,8,0.14), rgba(0,0,0,0.08))",
              "url('/images/office.jpg')",
            ].join(", "),
            backgroundPosition: "center, center, 62% center",
            backgroundRepeat: "no-repeat, no-repeat, no-repeat",
            backgroundSize: "cover, cover, auto 120%",
          }}
        >
          <div className="p-6 md:p-8">
            <div className="flex flex-wrap items-center gap-2">
              <Link href="/dashboard" className="arena-btn-dark inline-flex px-4 py-2 text-sm">
                Back to Dashboard
              </Link>
              <span className="badge badge-outline border-white/15 text-white/80">
                Lawyer Dossier
              </span>
              {canEditAvatar ? (
                <button
                  type="button"
                  className="arena-btn-danger ml-auto hidden px-4 py-2 text-sm xl:inline-flex"
                  onClick={openResetDialog}
                >
                  Fresh Start
                </button>
              ) : null}
            </div>

            <div className="mt-6 grid gap-6 xl:grid-cols-[220px_minmax(0,1fr)_460px]">
              <div className="flex flex-col items-center justify-start xl:pt-2">
                <div className="h-40 w-40 overflow-hidden rounded-full border border-white/15 bg-white/[0.04] shadow-[0_0_0_6px_rgba(255,255,255,0.03)]">
                  <img
                    src={avatarPreview || "/images/profile.jpg"}
                    alt={`${player.name} profile`}
                    className="block h-full w-full scale-[1.42] object-cover"
                  />
                </div>
                {canEditAvatar ? (
                  <div className="mt-5 flex flex-col gap-2">
                    <label className="arena-btn-dark flex cursor-pointer items-center justify-center px-4 py-3 text-sm">
                      Upload Image
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handleAvatarChange}
                      />
                    </label>
                    <button
                      type="button"
                      className="arena-btn-danger flex items-center justify-center px-4 py-3 text-sm xl:hidden"
                      onClick={openResetDialog}
                    >
                      Fresh Start
                    </button>
                  </div>
                ) : null}
              </div>

              <div className="min-w-0">
                <h1 className="arena-headline text-4xl uppercase leading-[0.92] md:text-6xl">
                  {player.name}
                </h1>
                <p className="mt-4 max-w-2xl text-sm leading-7 text-white/66 md:text-base">
                  {player.lawyerProfileSummary}
                </p>
                <div className="mt-6 grid gap-4 text-sm text-white/58 md:grid-cols-3">
                  <div>
                    <p className="arena-kicker">Joined</p>
                    <p className="mt-2 text-base font-semibold text-white">{joinedLabel}</p>
                  </div>
                  <div>
                    <p className="arena-kicker">Public Record</p>
                    <p className="mt-2 text-base font-semibold text-white">
                      {player.completedCases} completed matters
                    </p>
                  </div>
                  <div>
                    <p className="arena-kicker">Record</p>
                    <p className="mt-2 text-base font-semibold text-white">
                      {player.wins}-{player.losses}-{player.draws}
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                <div className="arena-stat-card !p-5">
                  <p className="arena-kicker">Rating</p>
                  <p className="mt-3 text-4xl font-semibold text-white">{player.overallRating}</p>
                  <p className="mt-2 text-sm text-white/52">Overall standing</p>
                </div>
                <div className="arena-stat-card !p-5">
                  <p className="arena-kicker">XP</p>
                  <p className="mt-3 text-4xl font-semibold text-white">{player.overallXp}</p>
                  <p className="mt-2 text-sm text-white/52">Next tier: {nextMilestone}</p>
                </div>
                <div className="arena-stat-card !p-5 sm:col-span-2 xl:col-span-1">
                  <p className="arena-kicker">Matters</p>
                  <p className="mt-3 text-4xl font-semibold text-white">{cases.length}</p>
                  <p className="mt-2 text-sm text-white/52">Tracked archive entries</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-6 xl:grid-cols-[420px_minmax(0,1fr)]">
          <aside className="space-y-6">
            <div className="arena-surface">
              <div className="p-5 md:p-6">
                <p className="arena-kicker">Specialty Record</p>
                <h2 className="arena-headline mt-2 text-2xl">Category progression</h2>
                <div className="mt-3 flex flex-wrap gap-3 text-sm text-white/52">
                  <span>{completedCategories}/{sortedCategories.length} categories active</span>
                  <span>{player.completedCases} matters completed</span>
                </div>
                <div className="mt-5 space-y-3">
                  {sortedCategories.map((category) => (
                    <article
                      key={category.categorySlug}
                      className="arena-surface-soft flex min-h-[9rem] flex-col p-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-semibold text-white">
                            {getCategoryTitle(category.categorySlug)}
                          </p>
                          <p className="mt-2 text-sm text-white/64">
                            {category.completedCases} completed | unlock{" "}
                            {category.unlockedComplexity}
                          </p>
                          <p className="mt-1 text-sm text-white/42">
                            Record {category.wins}-{category.losses}-{category.draws}
                          </p>
                        </div>
                        <span className="badge border arena-status arena-status-neutral">
                          {category.rating}
                        </span>
                      </div>
                      <p className="mt-auto pt-4 text-xs uppercase tracking-[0.15em] text-white/38">
                        Category strength archive
                      </p>
                    </article>
                  ))}
                </div>
              </div>
            </div>
          </aside>

          <section className="space-y-6">
            <div className="arena-surface overflow-hidden">
              <div className="grid gap-4 p-5 md:grid-cols-[minmax(0,1fr)_280px] md:p-6">
                <div>
                  <p className="arena-kicker">Performance Snapshot</p>
                  <h2 className="arena-headline mt-2 text-2xl">Current standing</h2>
                  <p className="mt-3 max-w-2xl text-sm leading-7 text-white/66">
                    {topCategory
                      ? `${player.name} is strongest in ${getCategoryTitle(
                          topCategory.categorySlug
                        )}, with ${topCategory.completedCases} completed matters in that track and a ${winRate}% win rate overall.`
                      : `${player.name} is still building an arena record. Complete more matters to establish a stronger category profile and climb the leaderboard.`}
                  </p>
                </div>
                <div className="arena-surface-soft flex flex-col justify-between p-5">
                  <div>
                    <p className="arena-kicker">Next Rating Milestone</p>
                    <p className="mt-2 text-4xl font-semibold text-white">{nextMilestone}</p>
                    <p className="mt-2 text-sm text-white/56">Top bracket target</p>
                  </div>
                  <div className="mt-6 arena-progress-track">
                    <div
                      className="arena-progress-fill"
                      style={{
                        width: `${Math.max(
                          8,
                          Math.min(
                            100,
                            ((player.overallRating || 0) / nextMilestone) * 100
                          )
                        )}%`,
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="arena-surface">
              <details className="group" open>
                <summary className="list-none cursor-pointer p-5 md:p-6">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                    <div>
                      <p className="arena-kicker">Matter Archive</p>
                      <h2 className="arena-headline mt-2 text-2xl">Cases</h2>
                    </div>
                    <div className="flex items-center gap-3">
                      <p className="text-sm text-white/42">
                        {filteredCases.length} of {cases.length} visible matters
                      </p>
                      <CollapseChevron />
                    </div>
                  </div>
                </summary>

                <div className="px-5 pb-5 md:px-6 md:pb-6">
                  <div className="grid gap-3 md:grid-cols-3">
                    <label className="form-control">
                      <span className="label-text text-xs uppercase tracking-[0.14em] text-white/62">
                        Category
                      </span>
                      <select
                        className="arena-select select select-bordered min-h-0 text-sm text-slate-100"
                        value={categoryFilter}
                        onChange={(event) => setCategoryFilter(event.target.value)}
                      >
                        <option value="all">All categories</option>
                        {categoryOptions.map((category) => (
                          <option key={category} value={category}>
                            {getCategoryTitle(category)}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="form-control">
                      <span className="label-text text-xs uppercase tracking-[0.14em] text-white/62">
                        Status
                      </span>
                      <select
                        className="arena-select select select-bordered min-h-0 text-sm text-slate-100"
                        value={statusFilter}
                        onChange={(event) => setStatusFilter(event.target.value)}
                      >
                        <option value="all">All statuses</option>
                        {statusOptions.map((status) => (
                          <option key={status} value={status}>
                            {getStatusFilterLabel(status)}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="form-control">
                      <span className="label-text text-xs uppercase tracking-[0.14em] text-white/62">
                        Outcome
                      </span>
                      <select
                        className="arena-select select select-bordered min-h-0 text-sm text-slate-100"
                        value={outcomeFilter}
                        onChange={(event) => setOutcomeFilter(event.target.value)}
                      >
                        <option value="all">All outcomes</option>
                        {outcomeOptions.map((outcome) => (
                          <option key={outcome} value={outcome}>
                            {outcome === "open"
                              ? "In Progress"
                              : outcomeLabel[outcome] || outcome}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>

                  <div className="mt-5 space-y-3">
                    {cases.length === 0 ? (
                      <EmptyPanel
                        title="No visible matters yet"
                        detail="This lawyer has not opened a public case record yet."
                      />
                    ) : filteredCases.length === 0 ? (
                      <EmptyPanel
                        title="No matters match these filters"
                        detail="Clear a filter to bring matters back into the archive."
                      />
                    ) : (
                      filteredCases.map((caseSession) => {
                        const matterId = getMatterId(caseSession);

                        return (
                          <Link
                            key={matterId}
                            href={`/dashboard/players/${player.id}/matters/${matterId}`}
                            className="arena-surface-soft block p-4 transition hover:-translate-y-0.5 hover:border-white/20"
                          >
                            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                              <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span
                                    className={`badge border arena-status ${
                                      statusTone[caseSession.status] || "arena-status-neutral"
                                    }`}
                                  >
                                    {statusLabel[caseSession.status] || caseSession.status}
                                  </span>
                                  <span className="badge border arena-status arena-status-neutral">
                                    {outcomeLabel[caseSession.outcome] || "In Progress"}
                                  </span>
                                  <span className="text-xs uppercase tracking-[0.14em] text-white/42">
                                    Updated {caseSession.updatedDateLabel}
                                  </span>
                                </div>
                                <h3 className="mt-3 text-lg font-semibold leading-tight text-white">
                                  {caseSession.title}
                                </h3>
                                <p className="mt-2 line-clamp-2 text-sm leading-7 text-white/66">
                                  {caseSession.premise?.overview ||
                                    "No case overview available."}
                                </p>
                                <div className="mt-3 flex flex-wrap gap-4 text-xs text-white/42">
                                  <span>
                                    {caseSession.premise?.courtName || "Unknown court"}
                                  </span>
                                  <span>Side played: {getSidePlayed(caseSession)}</span>
                                </div>
                              </div>
                              <div className="flex shrink-0 flex-wrap gap-2 text-xs text-white/56 lg:max-w-[16rem] lg:justify-end">
                                <span>{getCategoryTitle(caseSession.primaryCategory)}</span>
                                <span>Complexity {caseSession.complexity}</span>
                                <span>{summarizeCount(caseSession.interviewCount, "intake")}</span>
                                <span>{summarizeCount(caseSession.courtroomCount, "round")}</span>
                                <span className="font-semibold text-white">View matter</span>
                              </div>
                            </div>
                          </Link>
                        );
                      })
                    )}
                  </div>
                </div>
              </details>
            </div>
          </section>
        </div>
      </section>
      {showResetDialog ? (
        <dialog className="modal modal-open">
          <div className="modal-box border border-rose-400/30 bg-[#170707] text-white shadow-2xl shadow-black/60">
            <p className="arena-kicker text-rose-300">Fresh Start</p>
            <h3 className="arena-headline mt-2 text-3xl uppercase">
              {resetCooldownActive ? "Fresh Start is cooling down" : "Wipe the slate clean?"}
            </h3>
            {resetCooldownActive ? (
              <div className="mt-4 space-y-3 text-sm leading-7 text-white/68">
                <p>
                  Your clean docket is still settling. Fresh Start can be used once every
                  7 days.
                </p>
                <div className="arena-surface-soft grid gap-3 p-4 sm:grid-cols-2">
                  <div>
                    <p className="arena-kicker">Last Fresh Start</p>
                    <p className="mt-2 font-semibold text-white">
                      {lastResetLabel || "Recently"}
                    </p>
                  </div>
                  <div>
                    <p className="arena-kicker">Next Fresh Start</p>
                    <p className="mt-2 font-semibold text-white">
                      {nextResetLabel || "Soon"}
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <p className="mt-4 text-sm leading-7 text-white/68">
                This clears your case history, transcripts, wins, losses, rating progress,
                and cooldowns. Completed cases reopen, exited cases come back, and your
                lawyer starts over with a clean docket.
              </p>
            )}
            <div className="modal-action flex flex-wrap gap-3">
              {resetCooldownActive ? (
                <button
                  type="button"
                  className="arena-btn-dark px-5 py-3"
                  onClick={() => setShowResetDialog(false)}
                >
                  Okay..
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    className="arena-btn-dark px-5 py-3"
                    disabled={resetting}
                    onClick={() => setShowResetDialog(false)}
                  >
                    Keep My Record
                  </button>
                  <button
                    type="button"
                    className="arena-btn-danger px-5 py-3"
                    disabled={resetting}
                    onClick={handleResetProgress}
                  >
                    {resetting ? "Resetting..." : "Yes, Start Fresh"}
                  </button>
                </>
              )}
            </div>
          </div>
          <form method="dialog" className="modal-backdrop">
            <button
              type="button"
              disabled={resetting}
              onClick={() => setShowResetDialog(false)}
            >
              close
            </button>
          </form>
        </dialog>
      ) : null}
    </main>
  );
}
