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
  userName = "Counsel",
  userEmail = "",
  hasArenaAccess = false,
}) {
  const router = useRouter();
  const [browserTimeZone, setBrowserTimeZone] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState(categories[0]?.slug || "");
  const [activeTemplateIndex, setActiveTemplateIndex] = useState(0);
  const [showPaywallModal, setShowPaywallModal] = useState(false);
  const filteredTemplates = useMemo(
    () =>
      templates.filter(
        (template) => !selectedCategory || template.primaryCategory === selectedCategory
      ),
    [selectedCategory, templates]
  );
  const [creating, setCreating] = useState(false);

  const selectedLeaderboard = categoryLeaderboards[selectedCategory] || [];
  const categoryProgress =
    progression.categoryStats.find((item) => item.categorySlug === selectedCategory) || null;
  const recordRatio = getRecordRatio(
    progression.wins,
    progression.losses,
    progression.draws
  );

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
  const selectedCategoryTitle =
    categories.find((category) => category.slug === selectedCategory)?.title ||
    selectedCategory;
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
    <main className="arena-app-shell min-h-screen overflow-x-hidden px-4 py-4 md:px-8 md:py-10">
      <section className="mx-auto max-w-7xl space-y-6 arena-reveal md:space-y-8">
        <div className="arena-surface arena-scanline arena-column-bg overflow-hidden">
          <div className="p-5 md:p-8">
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between md:gap-6">
              <div className="max-w-3xl space-y-3 md:space-y-4">
                <p className="arena-kicker">Legal Arena Command</p>
                <h1 className="arena-headline text-[2.4rem] uppercase leading-[0.94] md:text-6xl md:leading-none">
                  Enter the arena.
                  <br />
                  Build the record.
                  <br />
                  Win the room.
                </h1>
                <p className="max-w-2xl text-sm leading-7 text-white/68 md:text-base">
                  Welcome back, {userName}. Intake, strategy, and courtroom execution are
                  live below. Choose the matter, build your record, and climb category boards.
                </p>
              </div>
              <div className="flex min-w-0 flex-wrap items-center gap-2 md:flex-col md:items-end md:gap-3">
                <Link
                  href="/"
                  className="arena-btn-dark inline-flex px-4 py-2 text-xs md:text-sm"
                >
                  Public Home
                </Link>
                {isAdmin && (
                  <Link
                    href="/dashboard/admin"
                    className="arena-btn-dark inline-flex px-4 py-2 text-xs md:text-sm"
                  >
                    Admin Lab
                  </Link>
                )}
                <div className="[&_.btn]:text-xs md:[&_.btn]:text-sm">
                  <ButtonAccount />
                </div>
              </div>
            </div>

            <div className="mt-6 grid gap-2 md:mt-8 md:gap-3 lg:grid-cols-3">
              <div className="arena-stat-card !p-3 md:!p-4">
                <p className="arena-kicker">Overall Rating</p>
                <p className="mt-1 text-2xl font-semibold text-white md:mt-2 md:text-3xl">
                  {progression.overallRating}
                </p>
                <p className="mt-1 text-xs text-white/45">
                  {progression.overallXp} XP across {progression.completedCases} completed matters
                </p>
              </div>
              <div className="arena-stat-card !p-3 md:!p-4">
                <p className="arena-kicker">Specialty Unlock</p>
                <p className="mt-1 text-2xl font-semibold text-white md:mt-2 md:text-3xl">
                  Tier {categoryProgress?.unlockedComplexity || 1}
                </p>
                <p className="mt-1 text-xs text-white/45">
                  {categoryProgress?.categorySlug || categories[0]?.slug || "general"} track
                </p>
              </div>
              <div className="arena-stat-card !p-3 md:!p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="arena-kicker">Record Integrity</p>
                  <span className="badge arena-status arena-status-favorable badge-sm border">
                    {recordRatio}% wins
                  </span>
                </div>
                <p className="mt-1 text-2xl font-semibold text-white md:mt-2 md:text-3xl">
                  {progression.wins}-{progression.losses}-{progression.draws}
                </p>
                <div className="mt-2 arena-progress-track md:mt-3" aria-hidden="true">
                  <div className="arena-progress-fill" style={{ width: `${recordRatio}%` }} />
                </div>
              </div>
            </div>
          </div>
        </div>

        <section className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
          <div className="space-y-6">
            <div className="arena-surface">
              <div className="p-5 md:p-6">
                <div>
                  <p className="arena-kicker">Case Intake Console</p>
                  <h2 className="arena-headline mt-2 text-2xl">Select a live dispute</h2>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap md:mt-5">
                  {categories.map((category) => (
                    <button
                      key={category.slug}
                      className={`badge badge-lg h-auto min-h-10 w-full cursor-pointer whitespace-normal border px-3 py-3 text-center leading-tight transition sm:w-auto sm:px-4 sm:py-4 ${
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

                <div className="mt-3 md:mt-5">
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                    <p className="min-w-0 text-xs uppercase tracking-[0.16em] text-white/42">
                      {carouselStatus}
                    </p>
                    <div className="flex shrink-0 items-center gap-2">
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

                  {activeTemplate ? (
                    <div className="arena-surface-soft arena-reveal min-h-[24rem] p-4 transition hover:border-white/20 md:min-h-[31rem] md:p-5">
                      <div className="flex h-full flex-col gap-4 md:gap-5">
                        <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between">
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="badge badge-outline border-white/15 text-white/80">
                                {activeTemplate.practiceArea}
                              </span>
                              <span className="badge badge-outline border-white/15 text-white/80">
                                {activeTemplate.primaryCategory}
                              </span>
                              <span className="badge badge-outline border-white/15 text-white/80">
                                Complexity {activeTemplate.complexity}
                              </span>
                              <span className="arena-kicker !text-[0.62rem] !tracking-[0.18em] text-white/38">
                                {activeTemplate.courtName}
                              </span>
                            </div>
                            <h3 className="mt-3 text-2xl font-semibold text-white">
                              {activeTemplate.title}
                            </h3>
                            <p className="mt-1 text-sm text-white/62">
                              {activeTemplate.subtitle}
                            </p>
                          </div>
                          <button
                            className="arena-btn-light arena-pulse w-full px-5 py-3 sm:w-auto"
                            onClick={() => handleCreateCase(activeTemplate.id)}
                            disabled={creating || !activeTemplate.unlocked}
                          >
                            {creating && <span className="loading loading-spinner loading-xs" />}
                            Start Case
                          </button>
                        </div>

                        <p className="text-sm leading-7 text-white/74">
                          {activeTemplate.overview}
                        </p>
                        <div className="flex flex-wrap gap-4 text-sm text-white/78">
                          <span>
                            <span className="font-semibold text-white">Plaintiff:</span>{" "}
                            {activeTemplate.plaintiffName || activeTemplate.clientName}
                          </span>
                          <span>
                            <span className="font-semibold text-white">Defendant:</span>{" "}
                            {activeTemplate.defendantName || activeTemplate.opponentName}
                          </span>
                        </div>
                        <p
                          className={`text-sm ${
                            activeTemplate.unlocked ? "text-emerald-300" : "text-amber-300"
                          }`}
                        >
                          {getTemplateUnlockMessage(activeTemplate, browserTimeZone)}
                        </p>
                      </div>
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

                  {canNavigateTemplates && (
                    <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
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
                  )}
                </div>
              </div>
            </div>

            <div className="arena-surface">
              <div className="p-6">
                <div className="flex items-end justify-between gap-3">
                  <div>
                    <p className="arena-kicker">Active Dockets</p>
                    <h2 className="arena-headline mt-2 text-2xl">Recent matters</h2>
                  </div>
                  <span className="text-xs uppercase tracking-[0.16em] text-white/42">
                    Saved transcripts and rulings
                  </span>
                </div>

                <div className="mt-5 space-y-4">
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
                          className="arena-surface-soft block p-5 transition hover:-translate-y-0.5 hover:border-white/20"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <div>
                              <h3 className="text-lg font-semibold text-white">{item.title}</h3>
                              <p className="text-sm text-white/42">Updated {formatDate(item.updatedAt)}</p>
                            </div>
                            <span
                              className={`badge border arena-status ${
                                severityClass[caseSeverity]
                              }`}
                            >
                              {statusLabel[item.status] || "In Progress"}
                            </span>
                          </div>
                          <p className="mt-3 text-sm leading-7 text-white/68">{item.premise?.overview}</p>
                          <div className="mt-4 flex flex-wrap gap-4 text-sm text-white/58">
                            <span>{item.primaryCategory}</span>
                            <span>Complexity {item.complexity}</span>
                            <span>{item.plaintiffName || item.premise?.clientName}</span>
                            <span>vs.</span>
                            <span>{item.defendantName || item.premise?.opponentName}</span>
                          </div>
                        </Link>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="arena-surface">
              <div className="p-6">
                <p className="arena-kicker">Network Telemetry</p>
                <h2 className="arena-headline mt-2 text-2xl">Top 10 overall counsel</h2>
                <div className="mt-5 space-y-3">
                  {overallLeaderboard.slice(0, 10).map((entry) => (
                    <Link
                      key={entry.id}
                      href={`/dashboard/players/${entry.id}`}
                      className="arena-surface-soft block p-4 transition hover:-translate-y-0.5 hover:border-white/20"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <p className="font-semibold text-white">
                          <span className="mr-1 text-white/60">#{entry.rank}</span>
                          {entry.name}
                        </p>
                        <span className="badge arena-status arena-status-neutral border">
                          {entry.overallRating}
                        </span>
                      </div>
                      <p className="mt-2 text-sm text-white/62">
                        {entry.completedCases} completed matters | {entry.wins} wins
                      </p>
                    </Link>
                  ))}
                </div>
              </div>
            </div>

            <div className="arena-surface">
              <div className="p-6">
                <p className="arena-kicker">Specialty Board</p>
                <h2 className="arena-headline mt-2 text-2xl">Top 10 by category</h2>
                <div className="mt-5 space-y-3">
                  {selectedLeaderboard.slice(0, 10).map((entry) => (
                    <Link
                      key={`${selectedCategory}-${entry.id}`}
                      href={`/dashboard/players/${entry.id}`}
                      className="arena-surface-soft block p-4 transition hover:-translate-y-0.5 hover:border-white/20"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <p className="font-semibold text-white">
                          <span className="mr-1 text-white/60">#{entry.rank}</span>
                          {entry.name}
                        </p>
                        <span className="badge arena-status arena-status-favorable border">
                          {entry.category?.rating || 1000}
                        </span>
                      </div>
                      <p className="mt-2 text-sm text-white/62">
                        {entry.category?.completedCases || 0} completed in {selectedCategory} |
                        unlock {entry.category?.unlockedComplexity || 1}
                      </p>
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>
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
