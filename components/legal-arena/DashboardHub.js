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

  return (
    <main className="arena-shell min-h-screen px-4 py-6 md:px-8 md:py-10">
      <section className="mx-auto max-w-7xl space-y-8 arena-reveal">
        <div className="arena-console arena-scanline overflow-hidden">
          <div className="p-6 md:p-8">
            <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
              <div className="max-w-3xl space-y-4">
                <p className="arena-kicker">Legal Arena Command</p>
                <h1 className="arena-headline text-4xl leading-tight md:text-6xl">
                  Operationally sharp advocacy. No room for soft arguments.
                </h1>
                <p className="max-w-2xl text-sm text-slate-300 md:text-base">
                  Welcome back, {userName}. Intake, strategy, and courtroom execution are
                  live below. Choose the matter, build your record, and climb category boards.
                </p>
              </div>
              <div className="flex items-start justify-between gap-3 md:flex-col md:items-end">
                <Link
                  href="/"
                  className="btn btn-ghost btn-sm border border-slate-500/25 bg-slate-900/30 text-slate-100"
                >
                  Public Home
                </Link>
                {isAdmin && (
                  <Link
                    href="/dashboard/admin"
                    className="btn btn-ghost btn-sm border border-slate-500/25 bg-slate-900/30 text-slate-100"
                  >
                    Admin Lab
                  </Link>
                )}
                <ButtonAccount />
              </div>
            </div>

            <div className="mt-8 grid gap-3 lg:grid-cols-3">
              <div className="arena-metric">
                <p className="arena-kicker">Overall Rating</p>
                <p className="mt-2 text-3xl font-semibold text-slate-100">
                  {progression.overallRating}
                </p>
                <p className="mt-1 text-xs text-slate-400">
                  {progression.overallXp} XP across {progression.completedCases} completed matters
                </p>
              </div>
              <div className="arena-metric">
                <p className="arena-kicker">Specialty Unlock</p>
                <p className="mt-2 text-3xl font-semibold text-slate-100">
                  Tier {categoryProgress?.unlockedComplexity || 1}
                </p>
                <p className="mt-1 text-xs text-slate-400">
                  {categoryProgress?.categorySlug || categories[0]?.slug || "general"} track
                </p>
              </div>
              <div className="arena-metric">
                <div className="flex items-center justify-between gap-3">
                  <p className="arena-kicker">Record Integrity</p>
                  <span className="badge arena-status arena-status-favorable badge-sm border">
                    {recordRatio}% wins
                  </span>
                </div>
                <p className="mt-2 text-3xl font-semibold text-slate-100">
                  {progression.wins}-{progression.losses}-{progression.draws}
                </p>
                <div className="mt-3 arena-progress-track" aria-hidden="true">
                  <div className="arena-progress-fill" style={{ width: `${recordRatio}%` }} />
                </div>
              </div>
            </div>
          </div>
        </div>

        <section className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
          <div className="space-y-6">
            <div className="arena-console">
              <div className="p-6">
                <div>
                  <p className="arena-kicker">Case Intake Console</p>
                  <h2 className="arena-headline mt-2 text-2xl">Select a live dispute</h2>
                </div>

                <div className="mt-5 flex flex-wrap gap-2">
                  {categories.map((category) => (
                    <button
                      key={category.slug}
                      className={`badge badge-lg cursor-pointer border px-4 py-4 transition ${
                        selectedCategory === category.slug
                          ? "arena-status arena-status-favorable"
                          : "arena-status arena-status-neutral"
                      }`}
                      onClick={() => setSelectedCategory(category.slug)}
                    >
                      {category.title}
                    </button>
                  ))}
                </div>

                <div className="mt-5 grid gap-4">
                  {visibleTemplates.map((template) => (
                    <div
                      key={template.id}
                      className="arena-console-soft arena-reveal p-5 transition hover:border-slate-300/40"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-4">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="badge badge-outline border-slate-400/35 text-slate-200">
                              {template.practiceArea}
                            </span>
                            <span className="badge badge-outline border-slate-400/35 text-slate-200">
                              {template.primaryCategory}
                            </span>
                            <span className="badge badge-outline border-slate-400/35 text-slate-200">
                              Complexity {template.complexity}
                            </span>
                            <span className="arena-kicker !text-[0.62rem] !tracking-[0.18em] text-slate-400">
                              {template.courtName}
                            </span>
                          </div>
                          <h3 className="mt-3 text-xl font-semibold text-slate-100">{template.title}</h3>
                          <p className="mt-1 text-sm text-slate-300">{template.subtitle}</p>
                          <p className="mt-3 text-sm leading-6 text-slate-300/95">{template.overview}</p>
                          <div className="mt-4 flex flex-wrap gap-4 text-sm text-slate-200">
                            <span>
                              <span className="font-semibold text-slate-100">Plaintiff:</span>{" "}
                              {template.plaintiffName || template.clientName}
                            </span>
                            <span>
                              <span className="font-semibold text-slate-100">Defendant:</span>{" "}
                              {template.defendantName || template.opponentName}
                            </span>
                          </div>
                          <p
                            className={`mt-4 text-sm ${
                              template.unlocked ? "text-emerald-300" : "text-amber-300"
                            }`}
                          >
                            {getTemplateUnlockMessage(template, browserTimeZone)}
                          </p>
                        </div>
                        <button
                          className="btn btn-primary arena-pulse"
                          onClick={() => handleCreateCase(template.id)}
                          disabled={creating || !template.unlocked}
                        >
                          {creating && <span className="loading loading-spinner loading-xs" />}
                          Start Case
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="arena-console">
              <div className="p-6">
                <div className="flex items-end justify-between gap-3">
                  <div>
                    <p className="arena-kicker">Active Dockets</p>
                    <h2 className="arena-headline mt-2 text-2xl">Recent matters</h2>
                  </div>
                  <span className="text-xs uppercase tracking-[0.16em] text-slate-400">
                    Saved transcripts and rulings
                  </span>
                </div>

                <div className="mt-5 space-y-4">
                  {initialCases.length === 0 ? (
                    <div className="arena-console-soft border-dashed p-8 text-center">
                      <p className="text-lg font-semibold text-slate-100">No matters opened yet</p>
                      <p className="mt-2 text-sm text-slate-300">
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
                          className="arena-console-soft block p-5 transition hover:-translate-y-0.5 hover:border-slate-300/45"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <div>
                              <h3 className="text-lg font-semibold text-slate-100">{item.title}</h3>
                              <p className="text-sm text-slate-400">Updated {formatDate(item.updatedAt)}</p>
                            </div>
                            <span
                              className={`badge border arena-status ${
                                severityClass[caseSeverity]
                              }`}
                            >
                              {statusLabel[item.status] || "In Progress"}
                            </span>
                          </div>
                          <p className="mt-3 text-sm leading-6 text-slate-300">{item.premise?.overview}</p>
                          <div className="mt-4 flex flex-wrap gap-4 text-sm text-slate-300">
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
            <div className="arena-console">
              <div className="p-6">
                <p className="arena-kicker">Network Telemetry</p>
                <h2 className="arena-headline mt-2 text-2xl">Top 10 overall counsel</h2>
                <div className="mt-5 space-y-3">
                  {overallLeaderboard.slice(0, 10).map((entry) => (
                    <Link
                      key={entry.id}
                      href={`/dashboard/players/${entry.id}`}
                      className="arena-console-soft block p-4 transition hover:-translate-y-0.5 hover:border-slate-300/45"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <p className="font-semibold text-slate-100">
                          <span className="mr-1 text-slate-300">#{entry.rank}</span>
                          {entry.name}
                        </p>
                        <span className="badge arena-status arena-status-neutral border">
                          {entry.overallRating}
                        </span>
                      </div>
                      <p className="mt-2 text-sm text-slate-300">
                        {entry.completedCases} completed matters | {entry.wins} wins
                      </p>
                    </Link>
                  ))}
                </div>
              </div>
            </div>

            <div className="arena-console">
              <div className="p-6">
                <p className="arena-kicker">Specialty Board</p>
                <h2 className="arena-headline mt-2 text-2xl">Top 10 by category</h2>
                <div className="mt-5 space-y-3">
                  {selectedLeaderboard.slice(0, 10).map((entry) => (
                    <Link
                      key={`${selectedCategory}-${entry.id}`}
                      href={`/dashboard/players/${entry.id}`}
                      className="arena-console-soft block p-4 transition hover:-translate-y-0.5 hover:border-slate-300/45"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <p className="font-semibold text-slate-100">
                          <span className="mr-1 text-slate-300">#{entry.rank}</span>
                          {entry.name}
                        </p>
                        <span className="badge arena-status arena-status-favorable border">
                          {entry.category?.rating || 1000}
                        </span>
                      </div>
                      <p className="mt-2 text-sm text-slate-300">
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
