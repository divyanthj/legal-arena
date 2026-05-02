"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
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

export default function PlayerProfileDossier({ profile }) {
  const { player, cases = [] } = profile;
  const normalizedCases = useMemo(() => cases.map(normalizeMatter), [cases]);
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [outcomeFilter, setOutcomeFilter] = useState("all");

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

  return (
    <main className="arena-shell min-h-screen overflow-x-hidden px-4 py-6 md:px-8 md:py-10">
      <section className="mx-auto max-w-7xl space-y-6 arena-reveal">
        <div className="arena-console arena-scanline">
          <div className="p-6 md:p-8">
            <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
              <div className="max-w-4xl">
                <div className="flex flex-wrap items-center gap-2">
                  <Link
                    href="/dashboard"
                    className="btn btn-ghost btn-sm border border-slate-500/25 bg-slate-900/30 text-slate-100"
                  >
                    Back to Dashboard
                  </Link>
                  <span className="badge badge-outline border-slate-400/35 text-slate-100">
                    Player Dossier
                  </span>
                </div>
                <h1 className="arena-case-title mt-4 text-4xl leading-tight md:text-5xl">
                  {player.name}
                </h1>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300 md:text-base">
                  A focused archive of this lawyer&apos;s matter record and category
                  strength.
                </p>
                <div className="mt-4 flex flex-wrap gap-4 text-sm text-slate-300">
                  <span>{joinedLabel}</span>
                  <span>{player.completedCases} completed matters</span>
                  <span>
                    Record {player.wins}-{player.losses}-{player.draws}
                  </span>
                </div>
              </div>
              <div className="grid w-full gap-3 sm:grid-cols-3 md:w-auto md:min-w-[25rem]">
                <div className="arena-metric">
                  <p className="arena-kicker">Rating</p>
                  <p className="mt-2 text-3xl font-semibold text-slate-100">
                    {player.overallRating}
                  </p>
                </div>
                <div className="arena-metric">
                  <p className="arena-kicker">XP</p>
                  <p className="mt-2 text-3xl font-semibold text-slate-100">
                    {player.overallXp}
                  </p>
                </div>
                <div className="arena-metric">
                  <p className="arena-kicker">Matters</p>
                  <p className="mt-2 text-3xl font-semibold text-slate-100">
                    {cases.length}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-6 xl:grid-cols-[0.78fr_1.22fr]">
          <aside className="space-y-6">
            <div className="arena-console">
              <div className="p-5 md:p-6">
                <p className="arena-kicker">Specialty Record</p>
                <h2 className="arena-headline mt-2 text-2xl">Category progression</h2>
                <div className="mt-5 space-y-3">
                  {sortedCategories.map((category) => (
                    <article key={category.categorySlug} className="arena-console-soft p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-semibold text-slate-100">
                            {getCategoryTitle(category.categorySlug)}
                          </p>
                          <p className="mt-2 text-sm text-slate-300">
                            {category.completedCases} completed | unlock{" "}
                            {category.unlockedComplexity}
                          </p>
                          <p className="mt-1 text-sm text-slate-400">
                            Record {category.wins}-{category.losses}-{category.draws}
                          </p>
                        </div>
                        <span className="badge border arena-status arena-status-neutral">
                          {category.rating}
                        </span>
                      </div>
                      {(category.recentPerformance || []).length > 0 && (
                        <p className="mt-3 line-clamp-2 text-xs leading-5 text-slate-400">
                          {category.recentPerformance.slice(0, 2).join(" | ")}
                        </p>
                      )}
                    </article>
                  ))}
                </div>
              </div>
            </div>
          </aside>

          <section className="space-y-6">
            <div className="arena-console">
              <div className="p-5 md:p-6">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                  <div>
                    <p className="arena-kicker">Matter Archive</p>
                    <h2 className="arena-headline mt-2 text-2xl">Cases</h2>
                  </div>
                  <p className="text-sm text-slate-400">
                    {filteredCases.length} of {cases.length} visible matters
                  </p>
                </div>

                <div className="mt-5 grid gap-3 md:grid-cols-3">
                  <label className="form-control">
                    <span className="label-text text-xs uppercase tracking-[0.14em] text-slate-400">
                      Category
                    </span>
                    <select
                      className="select select-bordered min-h-0 bg-slate-950/40 text-sm text-slate-100"
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
                    <span className="label-text text-xs uppercase tracking-[0.14em] text-slate-400">
                      Status
                    </span>
                    <select
                      className="select select-bordered min-h-0 bg-slate-950/40 text-sm text-slate-100"
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
                    <span className="label-text text-xs uppercase tracking-[0.14em] text-slate-400">
                      Outcome
                    </span>
                    <select
                      className="select select-bordered min-h-0 bg-slate-950/40 text-sm text-slate-100"
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
                      detail="This player has not opened a public case record yet."
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
                          className="arena-console-soft block p-4 transition hover:-translate-y-0.5 hover:border-slate-300/45"
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
                                <span className="text-xs uppercase tracking-[0.14em] text-slate-400">
                                  Updated {caseSession.updatedDateLabel}
                                </span>
                              </div>
                              <h3 className="mt-3 text-lg font-semibold leading-tight text-slate-100">
                                {caseSession.title}
                              </h3>
                              <p className="mt-2 line-clamp-2 text-sm leading-6 text-slate-300">
                                {caseSession.premise?.overview ||
                                  "No case overview available."}
                              </p>
                              <div className="mt-3 flex flex-wrap gap-4 text-xs text-slate-400">
                                <span>
                                  {caseSession.premise?.courtName || "Unknown court"}
                                </span>
                                <span>Side played: {getSidePlayed(caseSession)}</span>
                              </div>
                            </div>
                            <div className="flex shrink-0 flex-wrap gap-2 text-xs text-slate-300 lg:max-w-[16rem] lg:justify-end">
                              <span>{getCategoryTitle(caseSession.primaryCategory)}</span>
                              <span>Complexity {caseSession.complexity}</span>
                              <span>{summarizeCount(caseSession.interviewCount, "intake")}</span>
                              <span>{summarizeCount(caseSession.courtroomCount, "round")}</span>
                              <span className="font-semibold text-slate-100">View matter</span>
                            </div>
                          </div>
                        </Link>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          </section>
        </div>
      </section>
    </main>
  );
}
