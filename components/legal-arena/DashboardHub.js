"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import ButtonAccount from "@/components/ButtonAccount";
import apiClient from "@/libs/api";

const statusLabel = {
  interview: "Interview",
  courtroom: "In Court",
  verdict: "Verdict Ready",
};

const statusClass = {
  interview: "badge badge-warning badge-outline",
  courtroom: "badge badge-info badge-outline",
  verdict: "badge badge-success badge-outline",
};

const formatDate = (value) =>
  new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));

export default function DashboardHub({
  initialCases,
  templates,
  categories,
  progression,
  overallLeaderboard,
  categoryLeaderboards,
  isAdmin = false,
  userName = "Counsel",
}) {
  const router = useRouter();
  const [selectedCategory, setSelectedCategory] = useState(
    categories[0]?.slug || ""
  );
  const filteredTemplates = useMemo(
    () =>
      templates.filter(
        (template) =>
          !selectedCategory || template.primaryCategory === selectedCategory
      ),
    [selectedCategory, templates]
  );
  const [selectedTemplateId, setSelectedTemplateId] = useState(
    filteredTemplates[0]?.id || templates[0]?.id || ""
  );
  const [creating, setCreating] = useState(false);
  const selectedTemplate =
    templates.find((template) => template.id === selectedTemplateId) || null;

  const selectedLeaderboard = categoryLeaderboards[selectedCategory] || [];
  const categoryProgress =
    progression.categoryStats.find((item) => item.categorySlug === selectedCategory) ||
    null;

  const handleCreateCase = async () => {
    if (!selectedTemplateId) return;

    setCreating(true);

    try {
      const { caseSession } = await apiClient.post("/cases", {
        caseTemplateId: selectedTemplateId,
      });

      router.push(`/dashboard/cases/${caseSession.id}`);
    } catch (error) {
      console.error(error);
    } finally {
      setCreating(false);
    }
  };

  const visibleTemplates =
    filteredTemplates.length > 0 ? filteredTemplates : templates;

  return (
    <main className="min-h-screen bg-base-200 px-4 py-6 md:px-8 md:py-10">
      <section className="mx-auto max-w-7xl space-y-8">
        <div className="card border border-base-300 bg-neutral text-neutral-content shadow-2xl">
          <div className="card-body gap-4 p-0">
            <div className="flex flex-col gap-6 p-6 md:flex-row md:items-start md:justify-between md:p-8">
              <div className="max-w-3xl space-y-4">
                <p className="text-xs uppercase tracking-[0.35em] text-primary-content/75">
                  Legal Arena
                </p>
                <h1 className="font-serif text-4xl leading-tight md:text-6xl">
                  Build a specialty, unlock tougher matters, and climb the board.
                </h1>
                <p className="max-w-2xl text-base text-neutral-content/75 md:text-lg">
                  Welcome back, {userName}. Your matters now come from a live case
                  library with category-based progression, complexity gates, and
                  public rankings.
                </p>
              </div>
              <div className="flex items-start justify-between gap-3 md:flex-col md:items-end">
                <Link href="/" className="btn btn-ghost btn-sm text-neutral-content">
                  Public Home
                </Link>
                {isAdmin && (
                  <Link
                    href="/dashboard/admin"
                    className="btn btn-ghost btn-sm text-neutral-content"
                  >
                    Admin Lab
                  </Link>
                )}
                <ButtonAccount />
              </div>
            </div>

            <div className="stats stats-vertical rounded-none border-t border-white/10 bg-black/20 text-neutral-content lg:stats-horizontal">
              <div className="stat">
                <p className="stat-title uppercase tracking-[0.2em] text-neutral-content/55">
                  Overall Rating
                </p>
                <p className="stat-value text-3xl">{progression.overallRating}</p>
                <p className="stat-desc text-neutral-content/60">
                  {progression.overallXp} XP across {progression.completedCases} completed matters
                </p>
              </div>
              <div className="stat">
                <p className="stat-title uppercase tracking-[0.2em] text-neutral-content/55">
                  Specialty Unlock
                </p>
                <p className="stat-value text-3xl">
                  {categoryProgress?.unlockedComplexity || 1}
                </p>
                <p className="stat-desc text-neutral-content/60">
                  {categoryProgress?.categorySlug || categories[0]?.slug || "general"} complexity tier
                </p>
              </div>
              <div className="stat">
                <p className="stat-title uppercase tracking-[0.2em] text-neutral-content/55">
                  Record
                </p>
                <p className="stat-value text-3xl">
                  {progression.wins}-{progression.losses}-{progression.draws}
                </p>
                <p className="stat-desc text-neutral-content/60">
                  Wins, losses, draws
                </p>
              </div>
            </div>
          </div>
        </div>

        <section className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
          <div className="space-y-6">
            <div className="card border border-base-300 bg-base-100 shadow-xl">
              <div className="card-body p-6">
                <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                  <div>
                    <p className="text-sm uppercase tracking-[0.25em] text-base-content/50">
                      New Case
                    </p>
                    <h2 className="mt-2 text-2xl font-bold">Choose a dispute</h2>
                  </div>
                  <button
                    className="btn btn-primary"
                    onClick={handleCreateCase}
                    disabled={creating || !selectedTemplateId || !selectedTemplate?.unlocked}
                  >
                    {creating && <span className="loading loading-spinner loading-xs" />}
                    Start Case
                  </button>
                </div>

                <div className="mt-5 flex flex-wrap gap-2">
                  {categories.map((category) => (
                    <button
                      key={category.slug}
                      className={`badge badge-lg cursor-pointer border px-4 py-4 ${
                        selectedCategory === category.slug
                          ? "border-primary bg-primary/10"
                          : "border-base-300 bg-base-100"
                      }`}
                      onClick={() => {
                        setSelectedCategory(category.slug);
                        const nextTemplate =
                          templates.find(
                            (item) =>
                              item.primaryCategory === category.slug && item.unlocked
                          ) ||
                          templates.find(
                            (item) => item.primaryCategory === category.slug
                          );
                        if (nextTemplate) {
                          setSelectedTemplateId(nextTemplate.id);
                        }
                      }}
                    >
                      {category.title}
                    </button>
                  ))}
                </div>

                <div className="mt-5 grid gap-4">
                  {visibleTemplates.map((template) => {
                    const selected = template.id === selectedTemplateId;

                    return (
                      <button
                        key={template.id}
                        className={`rounded-box border p-5 text-left transition ${
                          selected
                            ? "border-primary bg-primary/10 shadow-lg"
                            : "border-base-300 bg-base-100 hover:border-primary/40 hover:bg-base-200"
                        }`}
                        onClick={() => setSelectedTemplateId(template.id)}
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="badge badge-outline">
                            {template.practiceArea}
                          </span>
                          <span className="badge badge-outline">
                            {template.primaryCategory}
                          </span>
                          <span className="badge badge-outline">
                            Complexity {template.complexity}
                          </span>
                          <span className="text-xs uppercase tracking-[0.2em] text-base-content/45">
                            {template.courtName}
                          </span>
                        </div>
                        <h3 className="mt-3 text-xl font-bold">{template.title}</h3>
                        <p className="mt-1 text-sm text-base-content/65">
                          {template.subtitle}
                        </p>
                        <p className="mt-3 text-sm leading-6 text-base-content/75">
                          {template.overview}
                        </p>
                        <div className="mt-4 flex flex-wrap gap-4 text-sm">
                          <span>
                            <span className="font-semibold">Plaintiff:</span>{" "}
                            {template.plaintiffName || template.clientName}
                          </span>
                          <span>
                            <span className="font-semibold">Defendant:</span>{" "}
                            {template.defendantName || template.opponentName}
                          </span>
                        </div>
                        <p
                          className={`mt-4 text-sm ${
                            template.unlocked ? "text-success" : "text-warning"
                          }`}
                        >
                          {template.unlockReason}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="card border border-base-300 bg-base-100 shadow-xl">
              <div className="card-body p-6">
                <div className="flex items-end justify-between gap-3">
                  <div>
                    <p className="text-sm uppercase tracking-[0.25em] text-base-content/50">
                      My Cases
                    </p>
                    <h2 className="mt-2 text-2xl font-bold">Recent matters</h2>
                  </div>
                  <span className="text-sm text-base-content/55">
                    Saved transcripts and verdicts
                  </span>
                </div>

                <div className="mt-5 space-y-4">
                  {initialCases.length === 0 ? (
                    <div className="rounded-box border border-dashed border-base-300 bg-base-200/70 p-8 text-center">
                      <p className="text-lg font-semibold">No matters opened yet</p>
                      <p className="mt-2 text-sm text-base-content/65">
                        Start with an unlocked category matter and your client intake
                        file will be prepared for you.
                      </p>
                    </div>
                  ) : (
                    initialCases.map((item) => (
                      <Link
                        key={item.id}
                        href={`/dashboard/cases/${item.id}`}
                        className="block rounded-box border border-base-300 bg-base-100 p-5 transition hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-lg"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <h3 className="text-lg font-bold">{item.title}</h3>
                            <p className="text-sm text-base-content/60">
                              Updated {formatDate(item.updatedAt)}
                            </p>
                          </div>
                          <span className={statusClass[item.status]}>
                            {statusLabel[item.status]}
                          </span>
                        </div>
                        <p className="mt-3 text-sm leading-6 text-base-content/75">
                          {item.premise?.overview}
                        </p>
                        <div className="mt-4 flex flex-wrap gap-4 text-sm text-base-content/70">
                          <span>{item.primaryCategory}</span>
                          <span>Complexity {item.complexity}</span>
                          <span>{item.plaintiffName || item.premise?.clientName}</span>
                          <span>vs.</span>
                          <span>{item.defendantName || item.premise?.opponentName}</span>
                        </div>
                      </Link>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="card border border-base-300 bg-base-100 shadow-xl">
              <div className="card-body p-6">
                <p className="text-sm uppercase tracking-[0.25em] text-base-content/50">
                  Leaderboard
                </p>
                <h2 className="mt-2 text-2xl font-bold">Top lawyers overall</h2>
                <div className="mt-5 space-y-3">
                  {overallLeaderboard.slice(0, 5).map((entry) => (
                    <div
                      key={entry.id}
                      className="rounded-box bg-base-200 p-4"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <p className="font-semibold">
                          #{entry.rank} {entry.name}
                        </p>
                        <span className="badge badge-outline">
                          {entry.overallRating}
                        </span>
                      </div>
                      <p className="mt-2 text-sm text-base-content/70">
                        {entry.completedCases} completed matters · {entry.wins} wins
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="card border border-base-300 bg-base-100 shadow-xl">
              <div className="card-body p-6">
                <p className="text-sm uppercase tracking-[0.25em] text-base-content/50">
                  Specialty Board
                </p>
                <h2 className="mt-2 text-2xl font-bold">Top lawyers by category</h2>
                <div className="mt-5 space-y-3">
                  {selectedLeaderboard.slice(0, 5).map((entry) => (
                    <div
                      key={`${selectedCategory}-${entry.id}`}
                      className="rounded-box bg-base-200 p-4"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <p className="font-semibold">
                          #{entry.rank} {entry.name}
                        </p>
                        <span className="badge badge-outline">
                          {entry.category?.rating || 1000}
                        </span>
                      </div>
                      <p className="mt-2 text-sm text-base-content/70">
                        {entry.category?.completedCases || 0} completed in {selectedCategory} ·
                        unlock {entry.category?.unlockedComplexity || 1}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>
      </section>
    </main>
  );
}
