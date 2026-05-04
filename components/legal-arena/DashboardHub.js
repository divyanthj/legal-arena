"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import ButtonAccount from "@/components/ButtonAccount";
import apiClient from "@/libs/api";
import { DevelopmentAccessPanel } from "@/components/legal-arena/DevelopmentAccessGate";

const statusLabel = {
  interview: "Intake",
  courtroom: "Courtroom",
  verdict: "Verdict Ready",
};

const statusSeverity = {
  interview: "caution",
  courtroom: "neutral",
  verdict: "favorable",
};

const severityClass = {
  neutral: "arena-status-neutral",
  caution: "arena-status-caution",
  critical: "arena-status-critical",
  favorable: "arena-status-favorable",
};

const formatDate = (value) =>
  new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));

const formatCooldownTime = (value, timeZone) => {
  if (!value) {
    return "";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const formatOptions = {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  };

  if (timeZone) {
    formatOptions.timeZone = timeZone;
  }

  return new Intl.DateTimeFormat("en", formatOptions).format(date);
};

const getTemplateUnlockMessage = (template, timeZone) => {
  if (template.unlocked) {
    return template.unlockReason;
  }

  if (template.cooldownEndsAt) {
    const formatted = formatCooldownTime(template.cooldownEndsAt, timeZone);

    return formatted ? `Available again after ${formatted}.` : "Available again soon.";
  }

  return template.unlockReason;
};

const getRecordRatio = (wins, losses, draws) => {
  const total = wins + losses + draws;

  if (total <= 0) {
    return 0;
  }

  return Math.round((wins / total) * 100);
};

export default function DashboardHub({
  initialCases,
  templates,
  categories,
  progression,
  overallLeaderboard,
  categoryLeaderboards,
  isAdmin = false,
  userId = "",
  userName = "Counsel",
  userEmail = "",
  hasArenaAccess = false,
}) {
  const router = useRouter();
  const [browserTimeZone, setBrowserTimeZone] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState(categories[0]?.slug || "");
  const [activeTemplateIndex, setActiveTemplateIndex] = useState(0);
  const [showPaywallModal, setShowPaywallModal] = useState(false);
  const [creating, setCreating] = useState(false);

  const filteredTemplates = useMemo(
    () =>
      templates.filter(
        (template) => !selectedCategory || template.primaryCategory === selectedCategory
      ),
    [selectedCategory, templates]
  );

  const selectedLeaderboard = categoryLeaderboards[selectedCategory] || [];
  const categoryProgress =
    progression.categoryStats.find((item) => item.categorySlug === selectedCategory) || null;
  const recordRatio = getRecordRatio(
    progression.wins,
    progression.losses,
    progression.draws
  );
  const lastActiveCase = initialCases[0] || null;
  const selectedCategoryMeta =
    categories.find((category) => category.slug === selectedCategory) || null;
  const selectedCategoryTitle = selectedCategoryMeta?.title || selectedCategory;
  const currentLeaderboardEntry =
    overallLeaderboard.find((entry) => String(entry.id) === String(userId)) || null;
  const topCategoryEntries = selectedLeaderboard.slice(0, 5);
  const recentVerdicts = initialCases.filter((item) => item.status === "verdict").slice(0, 5);
  const canResumeLastCase =
    lastActiveCase &&
    (lastActiveCase.status === "interview" || lastActiveCase.status === "courtroom");
  const nextCategoryUnlockTarget = Math.max(
    (categoryProgress?.unlockedComplexity || 1) * 2,
    2
  );
  const nextCategoryUnlockProgress = Math.min(
    categoryProgress?.completedCases || 0,
    nextCategoryUnlockTarget
  );
  const nextCategoryUnlockPercent = Math.max(
    10,
    Math.round((nextCategoryUnlockProgress / nextCategoryUnlockTarget) * 100)
  );
  const streakGoal = 3;
  const winStreakProgress = Math.min(progression.wins, streakGoal);
  const winStreakPercent = Math.max(10, Math.round((winStreakProgress / streakGoal) * 100));

  useEffect(() => {
    const detectedTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    setBrowserTimeZone(detectedTimeZone || null);
  }, []);

  useEffect(() => {
    setActiveTemplateIndex(0);
  }, [selectedCategory]);

  const handleCreateCase = async (caseTemplateId) => {
    if (!caseTemplateId) return;
    if (!hasArenaAccess) {
      setShowPaywallModal(true);
      return;
    }

    setCreating(true);

    try {
      const { caseSession } = await apiClient.post("/cases", {
        caseTemplateId,
      });

      router.push(`/dashboard/cases/${caseSession.slug || caseSession.id}`);
    } catch (error) {
      console.error(error);
    } finally {
      setCreating(false);
    }
  };

  const visibleTemplates = filteredTemplates.length > 0 ? filteredTemplates : templates;
  const activeTemplate =
    visibleTemplates.length > 0
      ? visibleTemplates[Math.min(activeTemplateIndex, visibleTemplates.length - 1)]
      : null;
  const carouselCategoryLabel =
    filteredTemplates.length > 0
      ? `${String(selectedCategoryTitle || "available").toLowerCase()} cases`
      : "all available cases";
  const carouselStatus = visibleTemplates.length
    ? `${Math.min(activeTemplateIndex + 1, visibleTemplates.length)}/${
        visibleTemplates.length
      } ${carouselCategoryLabel}`
    : "0/0 available cases";
  const canNavigateTemplates = visibleTemplates.length > 1;

  const goToPreviousTemplate = () => {
    if (!canNavigateTemplates) return;
    setActiveTemplateIndex((current) =>
      current === 0 ? visibleTemplates.length - 1 : current - 1
    );
  };

  const goToNextTemplate = () => {
    if (!canNavigateTemplates) return;
    setActiveTemplateIndex((current) =>
      current >= visibleTemplates.length - 1 ? 0 : current + 1
    );
  };

  useEffect(() => {
    if (activeTemplateIndex >= visibleTemplates.length) {
      setActiveTemplateIndex(Math.max(visibleTemplates.length - 1, 0));
    }
  }, [activeTemplateIndex, visibleTemplates.length]);

  return (
    <main className="arena-app-shell min-h-screen overflow-x-hidden px-4 py-4 md:px-6 md:py-6">
      <section className="mx-auto max-w-[1600px] arena-reveal">
        <div className="grid gap-4 xl:grid-cols-[240px_minmax(0,1fr)_360px]">
          <aside className="arena-surface arena-column-bg flex h-full flex-col overflow-visible">
            <div className="border-b border-white/10 px-5 py-6">
              <p className="arena-kicker">Legal Arena</p>
              <h2 className="arena-headline mt-3 text-3xl uppercase leading-none">
                Command
              </h2>
            </div>

            <nav className="flex-1 space-y-2 px-3 py-4">
              <a
                href="#battle-console"
                className="arena-surface-soft flex items-center justify-between px-4 py-3 text-sm text-white/72 transition hover:border-white/20 hover:text-white"
              >
                <span>Case Intake</span>
                <span className="text-white/35">01</span>
              </a>
              <a
                href="#recent-matters"
                className="arena-surface-soft flex items-center justify-between px-4 py-3 text-sm text-white/72 transition hover:border-white/20 hover:text-white"
              >
                <span>My Matters</span>
                <span className="text-white/35">02</span>
              </a>
              <a
                href="#overall-board"
                className="arena-surface-soft flex items-center justify-between px-4 py-3 text-sm text-white/72 transition hover:border-white/20 hover:text-white"
              >
                <span>Leaderboards</span>
                <span className="text-white/35">03</span>
              </a>
              <a
                href="#specialty-board"
                className="arena-surface-soft flex items-center justify-between px-4 py-3 text-sm text-white/72 transition hover:border-white/20 hover:text-white"
              >
                <span>Specialty Board</span>
                <span className="text-white/35">04</span>
              </a>
              {isAdmin ? (
                <Link
                  href="/dashboard/admin"
                  className="arena-surface-soft flex items-center justify-between px-4 py-3 text-sm text-white/72 transition hover:border-white/20 hover:text-white"
                >
                  <span>Admin Lab</span>
                  <span className="text-white/35">05</span>
                </Link>
              ) : null}
              <Link
                href="/"
                className="arena-surface-soft flex items-center justify-between px-4 py-3 text-sm text-white/72 transition hover:border-white/20 hover:text-white"
              >
                <span>Public Home</span>
                <span className="text-white/35">{isAdmin ? "06" : "05"}</span>
              </Link>
            </nav>

            <div className="border-t border-white/10 px-4 py-4">
              <div className="arena-surface-soft p-4">
                <p className="text-sm font-semibold text-white">{userName}</p>
                <p className="mt-1 text-sm text-white/55">
                  Rank {currentLeaderboardEntry ? `#${currentLeaderboardEntry.rank}` : "Unranked"}
                </p>
                <div className="mt-4 [&_.btn]:w-full [&_.btn]:justify-between [&_.btn]:text-sm">
                  <ButtonAccount />
                </div>
              </div>
            </div>
          </aside>

          <div className="space-y-4">
            <section className="arena-surface arena-scanline arena-column-bg overflow-hidden">
              <div className="p-5 md:p-7">
                <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
                  <div className="space-y-4">
                    <p className="text-sm text-white/74">Welcome back, {userName}</p>
                    <h1 className="arena-headline text-[2.7rem] uppercase leading-[0.92] md:text-6xl">
                      Enter the arena.
                      <br />
                      Win the courtroom.
                    </h1>
                    <p className="max-w-2xl text-sm leading-7 text-white/65 md:text-base">
                      Fight cases, sharpen your specialty, and keep building a record that
                      climbs the board.
                    </p>
                  </div>

                  <div className="space-y-3">
                    <button
                      className="arena-btn-light flex w-full items-center justify-center gap-2 px-5 py-4"
                      onClick={() => handleCreateCase(activeTemplate?.id)}
                      disabled={creating || !activeTemplate?.unlocked}
                    >
                      {creating && <span className="loading loading-spinner loading-xs" />}
                      <span>{lastActiveCase ? "Start New Case" : "Open First Case"}</span>
                    </button>
                    {canResumeLastCase ? (
                      <Link
                        href={`/dashboard/cases/${lastActiveCase.slug || lastActiveCase.id}`}
                        className="arena-btn-dark flex w-full items-center justify-center px-5 py-4"
                      >
                        Continue Last Case
                      </Link>
                    ) : (
                      <Link
                        href="#battle-console"
                        className="arena-btn-dark flex w-full items-center justify-center px-5 py-4"
                      >
                        Browse Case Library
                      </Link>
                    )}
                    <div className="px-1 text-sm text-white/55">
                      {lastActiveCase ? (
                        <>
                          <p>
                            Last played:{" "}
                            <span className="text-white">{lastActiveCase.title}</span>
                          </p>
                          <p className="mt-1">Updated {formatDate(lastActiveCase.updatedAt)}</p>
                        </>
                      ) : (
                        <p>No active matter yet. Pick a dispute below to start your first run.</p>
                      )}
                    </div>
                  </div>
                </div>

                <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                  <div className="arena-stat-card !p-4">
                    <p className="arena-kicker">Overall Rating</p>
                    <p className="mt-2 text-3xl font-semibold text-white">
                      {progression.overallRating}
                    </p>
                    <p className="mt-1 text-sm text-white/50">
                      {progression.overallXp} XP total
                    </p>
                  </div>
                  <div className="arena-stat-card !p-4">
                    <p className="arena-kicker">Specialty Tier</p>
                    <p className="mt-2 text-3xl font-semibold text-white">
                      Tier {categoryProgress?.unlockedComplexity || 1}
                    </p>
                    <p className="mt-1 text-sm text-white/50">{selectedCategoryTitle} track</p>
                  </div>
                  <div className="arena-stat-card !p-4">
                    <p className="arena-kicker">Record</p>
                    <p className="mt-2 text-3xl font-semibold text-white">
                      {progression.wins}-{progression.losses}-{progression.draws}
                    </p>
                    <p className="mt-1 text-sm text-white/50">{recordRatio}% win rate</p>
                  </div>
                  <div className="arena-stat-card !p-4">
                    <p className="arena-kicker">Rank</p>
                    <p className="mt-2 text-3xl font-semibold text-white">
                      {currentLeaderboardEntry ? `#${currentLeaderboardEntry.rank}` : "--"}
                    </p>
                    <p className="mt-1 text-sm text-white/50">
                      {progression.completedCases} completed matters
                    </p>
                  </div>
                </div>
              </div>
            </section>

            <section id="battle-console" className="arena-surface">
              <div className="p-5 md:p-6">
                <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
                  <div>
                    <p className="arena-kicker">Choose Your Battle</p>
                    <h2 className="arena-headline mt-2 text-2xl">Select a live dispute</h2>
                    <p className="mt-2 text-sm text-white/62">
                      Pick a category and enter an available matter.
                    </p>
                  </div>
                  <p className="text-xs uppercase tracking-[0.16em] text-white/42">
                    {carouselStatus}
                  </p>
                </div>

                <div className="mt-5 grid grid-cols-2 gap-2 lg:flex lg:flex-wrap">
                  {categories.map((category) => (
                    <button
                      key={category.slug}
                      className={`badge badge-lg h-auto min-h-10 w-full cursor-pointer whitespace-normal border px-3 py-3 text-center leading-tight transition lg:w-auto ${
                        selectedCategory === category.slug
                          ? "arena-status arena-status-favorable"
                          : "arena-pill"
                      }`}
                      onClick={() => setSelectedCategory(category.slug)}
                    >
                      {category.title}
                    </button>
                  ))}
                </div>

                <div className="mt-5">
                  {activeTemplate ? (
                    <div className="arena-surface-soft arena-reveal min-h-[34rem] overflow-hidden p-4 md:min-h-[36rem] md:p-5 xl:h-[38rem] xl:min-h-0">
                      <div className="grid gap-5 xl:h-full xl:grid-cols-[240px_minmax(0,1fr)_220px]">
                        <div className="min-h-[220px] rounded-[1.5rem] border border-white/10 bg-white/[0.03] p-4 xl:h-full">
                          <div className="flex h-full flex-col justify-between">
                            <div>
                              <p className="arena-kicker">Featured Case</p>
                              <p className="mt-4 text-sm leading-7 text-white/56">
                                {activeTemplate.courtName}
                              </p>
                            </div>
                            <div className="space-y-2 text-sm text-white/70">
                              <p>{activeTemplate.practiceArea}</p>
                              <p>{activeTemplate.primaryCategory}</p>
                              <p>Complexity {activeTemplate.complexity}</p>
                            </div>
                          </div>
                        </div>

                        <div className="min-w-0 xl:flex xl:h-full xl:min-h-0 xl:flex-col xl:overflow-y-auto xl:pr-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="badge badge-outline border-white/15 text-white/80">
                              {activeTemplate.practiceArea}
                            </span>
                            <span className="badge badge-outline border-white/15 text-white/80">
                              {activeTemplate.primaryCategory}
                            </span>
                          </div>
                          <h3 className="mt-4 text-3xl font-semibold leading-tight text-white">
                            {activeTemplate.title}
                          </h3>
                          <p className="mt-3 text-sm leading-7 text-white/70">
                            {activeTemplate.overview}
                          </p>
                          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:mt-6 xl:grid-cols-4">
                            <div>
                              <p className="arena-kicker">Plaintiff</p>
                              <p className="mt-2 text-sm text-white">
                                {activeTemplate.plaintiffName || activeTemplate.clientName}
                              </p>
                            </div>
                            <div>
                              <p className="arena-kicker">Defendant</p>
                              <p className="mt-2 text-sm text-white">
                                {activeTemplate.defendantName || activeTemplate.opponentName}
                              </p>
                            </div>
                            <div>
                              <p className="arena-kicker">Complexity</p>
                              <p className="mt-2 text-sm text-white">
                                Tier {activeTemplate.complexity}
                              </p>
                            </div>
                            <div>
                              <p className="arena-kicker">Status</p>
                              <p
                                className={`mt-2 text-sm ${
                                  activeTemplate.unlocked ? "text-emerald-300" : "text-amber-300"
                                }`}
                              >
                                {activeTemplate.unlocked ? "Ready to enter" : "Locked"}
                              </p>
                            </div>
                          </div>
                        </div>

                        <div className="flex flex-col justify-between gap-4 border-t border-white/10 pt-4 xl:h-full xl:border-l xl:border-t-0 xl:pl-5 xl:pt-0">
                          <div>
                            <p className="arena-kicker">Access</p>
                            <p
                              className={`mt-3 text-sm leading-7 ${
                                activeTemplate.unlocked ? "text-emerald-300" : "text-amber-300"
                              }`}
                            >
                              {getTemplateUnlockMessage(activeTemplate, browserTimeZone)}
                            </p>
                          </div>
                          <div className="space-y-3">
                            <button
                              className="arena-btn-light w-full px-5 py-3"
                              onClick={() => handleCreateCase(activeTemplate.id)}
                              disabled={creating || !activeTemplate.unlocked}
                            >
                              Enter Case
                            </button>
                            <div className="flex justify-end gap-2">
                              <button
                                type="button"
                                className="arena-btn-dark min-h-0 px-3 py-2"
                                onClick={goToPreviousTemplate}
                                disabled={!canNavigateTemplates}
                                aria-label="Show previous case"
                              >
                                &lt;
                              </button>
                              <button
                                type="button"
                                className="arena-btn-dark min-h-0 px-3 py-2"
                                onClick={goToNextTemplate}
                                disabled={!canNavigateTemplates}
                                aria-label="Show next case"
                              >
                                &gt;
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>

                      {canNavigateTemplates ? (
                        <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
                          {visibleTemplates.map((template, index) => (
                            <button
                              key={`case-dot-${template.id}`}
                              type="button"
                              className={`h-2.5 rounded-full transition ${
                                index === activeTemplateIndex
                                  ? "w-8 bg-white"
                                  : "w-2.5 bg-white/20 hover:bg-white/40"
                              }`}
                              onClick={() => setActiveTemplateIndex(index)}
                              aria-label={`Show case ${index + 1} of ${visibleTemplates.length}`}
                            />
                          ))}
                        </div>
                      ) : null}
                    </div>
                  ) : (
                    <div className="arena-surface-soft min-h-[18rem] border-dashed p-8 text-center">
                      <p className="text-lg font-semibold text-white">
                        No case templates available
                      </p>
                      <p className="mt-2 text-sm text-white/62">
                        Check back after new disputes are added to the case library.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </section>

            <section id="recent-matters" className="arena-surface">
              <div className="p-5 md:p-6">
                <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
                  <div>
                    <p className="arena-kicker">Your Recent Matters</p>
                    <h2 className="arena-headline mt-2 text-2xl">Saved transcripts and rulings</h2>
                  </div>
                  <span className="text-xs uppercase tracking-[0.16em] text-white/42">
                    {initialCases.length} tracked matters
                  </span>
                </div>

                <div className="mt-5 space-y-3">
                  {initialCases.length === 0 ? (
                    <div className="arena-surface-soft border-dashed p-8 text-center">
                      <p className="text-lg font-semibold text-white">No matters opened yet</p>
                      <p className="mt-2 text-sm text-white/62">
                        Start with an unlocked category matter and the intake file will be staged.
                      </p>
                    </div>
                  ) : (
                    initialCases.map((item) => {
                      const caseSeverity = statusSeverity[item.status] || "neutral";

                      return (
                        <Link
                          key={item.id}
                          href={`/dashboard/cases/${item.slug || item.id}`}
                          className="arena-surface-soft block p-4 transition hover:-translate-y-0.5 hover:border-white/20"
                        >
                          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <h3 className="text-base font-semibold text-white">{item.title}</h3>
                                <span
                                  className={`badge border arena-status ${
                                    severityClass[caseSeverity]
                                  }`}
                                >
                                  {statusLabel[item.status] || "In Progress"}
                                </span>
                              </div>
                              <div className="mt-2 flex flex-wrap gap-3 text-sm text-white/52">
                                <span>{item.primaryCategory}</span>
                                <span>Complexity {item.complexity}</span>
                                <span>Updated {formatDate(item.updatedAt)}</span>
                              </div>
                            </div>
                            <div className="text-sm text-white/72 lg:text-right">
                              <p>
                                {item.plaintiffName || item.premise?.clientName} vs.{" "}
                                {item.defendantName || item.premise?.opponentName}
                              </p>
                            </div>
                          </div>
                        </Link>
                      );
                    })
                  )}
                </div>
              </div>
            </section>
          </div>

          <aside className="space-y-4">
            <section id="overall-board" className="arena-surface">
              <div className="p-5 md:p-6">
                <p className="arena-kicker">Top Counsel Today</p>
                <h2 className="arena-headline mt-2 text-2xl">Overall board</h2>
                <div className="mt-5 space-y-2">
                  {overallLeaderboard.slice(0, 5).map((entry) => (
                    <Link
                      key={entry.id}
                      href={`/dashboard/players/${entry.id}`}
                      className="arena-surface-soft flex items-center justify-between gap-3 px-4 py-3 transition hover:-translate-y-0.5 hover:border-white/20"
                    >
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-white">
                          <span className="mr-2 text-white/55">{entry.rank}</span>
                          {entry.name}
                        </p>
                        <p className="mt-1 text-sm text-white/50">
                          {entry.completedCases} matters | {entry.wins} wins
                        </p>
                      </div>
                      <span className="text-lg font-semibold text-emerald-300">
                        {entry.overallRating}
                      </span>
                    </Link>
                  ))}
                </div>
                {currentLeaderboardEntry ? (
                  <Link
                    href={`/dashboard/players/${currentLeaderboardEntry.id || userId}`}
                    className="mt-4 block rounded-[1.5rem] border border-white/15 bg-white/[0.03] px-4 py-4 transition hover:-translate-y-0.5 hover:border-white/25"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm text-white/50">Your standing</p>
                        <p className="mt-1 font-semibold text-white">
                          #{currentLeaderboardEntry.rank} {userName}
                        </p>
                      </div>
                      <p className="text-2xl font-semibold text-white">
                        {currentLeaderboardEntry.overallRating}
                      </p>
                    </div>
                  </Link>
                ) : null}
              </div>
            </section>

            <section id="specialty-board" className="arena-surface">
              <div className="p-5 md:p-6">
                <p className="arena-kicker">Specialty Board</p>
                <h2 className="arena-headline mt-2 text-2xl">{selectedCategoryTitle}</h2>
                <div className="mt-5 space-y-2">
                  {topCategoryEntries.length > 0 ? (
                    topCategoryEntries.map((entry) => (
                      <Link
                        key={`${selectedCategory}-${entry.id}`}
                        href={`/dashboard/players/${entry.id}`}
                        className="arena-surface-soft flex items-center justify-between gap-3 px-4 py-3 transition hover:-translate-y-0.5 hover:border-white/20"
                      >
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-white">
                            <span className="mr-2 text-white/55">{entry.rank}</span>
                            {entry.name}
                          </p>
                          <p className="mt-1 text-sm text-white/50">
                            {entry.category?.completedCases || 0} completed
                          </p>
                        </div>
                        <span className="text-lg font-semibold text-white">
                          {entry.category?.rating || 1000}
                        </span>
                      </Link>
                    ))
                  ) : (
                    <div className="arena-surface-soft p-4 text-sm text-white/62">
                      Category rankings will populate after more completed cases land in this
                      track.
                    </div>
                  )}
                </div>
              </div>
            </section>

            <section className="arena-surface">
              <div className="p-5 md:p-6">
                <p className="arena-kicker">Recent Verdicts</p>
                <h2 className="arena-headline mt-2 text-2xl">Closed matters</h2>
                <div className="mt-5 space-y-2">
                  {recentVerdicts.length > 0 ? (
                    recentVerdicts.map((item) => (
                      <Link
                        key={`verdict-${item.id}`}
                        href={`/dashboard/cases/${item.slug || item.id}`}
                        className="arena-surface-soft block px-4 py-3 transition hover:-translate-y-0.5 hover:border-white/20"
                      >
                        <p className="font-semibold text-white">{item.title}</p>
                        <p className="mt-1 text-sm text-white/52">
                          {item.primaryCategory} | {formatDate(item.updatedAt)}
                        </p>
                      </Link>
                    ))
                  ) : (
                    <div className="arena-surface-soft p-4 text-sm text-white/62">
                      Verdicts will appear here once your first matter reaches final ruling.
                    </div>
                  )}
                </div>
              </div>
            </section>

            <section className="arena-surface">
              <div className="p-5 md:p-6">
                <p className="arena-kicker">Active Challenges</p>
                <h2 className="arena-headline mt-2 text-2xl">Progression goals</h2>
                <div className="mt-5 space-y-4">
                  <div className="arena-surface-soft p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="font-semibold text-white">Complete {streakGoal} wins</p>
                        <p className="mt-1 text-sm text-white/52">
                          Build momentum across current matters.
                        </p>
                      </div>
                      <p className="text-sm font-semibold text-white/80">
                        {winStreakProgress} / {streakGoal}
                      </p>
                    </div>
                    <div className="mt-4 arena-progress-track">
                      <div
                        className="arena-progress-fill"
                        style={{ width: `${winStreakPercent}%` }}
                      />
                    </div>
                  </div>

                  <div className="arena-surface-soft p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="font-semibold text-white">
                          Climb {selectedCategoryTitle} to next tier
                        </p>
                        <p className="mt-1 text-sm text-white/52">
                          Complete more cases in this category to unlock harder disputes.
                        </p>
                      </div>
                      <p className="text-sm font-semibold text-white/80">
                        {nextCategoryUnlockProgress} / {nextCategoryUnlockTarget}
                      </p>
                    </div>
                    <div className="mt-4 arena-progress-track">
                      <div
                        className="arena-progress-fill"
                        style={{ width: `${nextCategoryUnlockPercent}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </section>
          </aside>
        </div>
      </section>
      {showPaywallModal ? (
        <dialog className="modal modal-open">
          <div className="modal-box max-h-none max-w-3xl overflow-visible bg-transparent p-0 shadow-none">
            <DevelopmentAccessPanel
              email={userEmail}
              onClose={() => setShowPaywallModal(false)}
            />
          </div>
          <form method="dialog" className="modal-backdrop">
            <button type="button" onClick={() => setShowPaywallModal(false)}>
              close
            </button>
          </form>
        </dialog>
      ) : null}
    </main>
  );
}
