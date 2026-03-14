"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
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
  scenarios,
  userName = "Counsel",
}) {
  const router = useRouter();
  const [selectedScenarioId, setSelectedScenarioId] = useState(
    scenarios[0]?.id || ""
  );
  const [creating, setCreating] = useState(false);

  const handleCreateCase = async () => {
    if (!selectedScenarioId) return;

    setCreating(true);

    try {
      const { caseSession } = await apiClient.post("/cases", {
        scenarioId: selectedScenarioId,
      });

      router.push(`/dashboard/cases/${caseSession.id}`);
    } catch (error) {
      console.error(error);
    } finally {
      setCreating(false);
    }
  };

  return (
    <main className="min-h-screen bg-base-200 px-4 py-6 md:px-8 md:py-10">
      <section className="mx-auto max-w-6xl space-y-8">
        <div className="card border border-base-300 bg-neutral text-neutral-content shadow-2xl">
          <div className="card-body gap-4 p-0">
            <div className="flex flex-col gap-6 p-6 md:flex-row md:items-start md:justify-between md:p-8">
              <div className="max-w-2xl space-y-4">
                <p className="text-xs uppercase tracking-[0.35em] text-primary-content/75">
                  Legal Arena
                </p>
                <h1 className="font-serif text-4xl leading-tight md:text-6xl">
                  Build a case, pressure-test the record, and win the room.
                </h1>
                <p className="max-w-xl text-base text-neutral-content/75 md:text-lg">
                  Welcome back, {userName}. Each matter starts with client intake,
                  then moves into a three-round courtroom clash against opposing
                  counsel.
                </p>
              </div>
              <div className="flex items-start justify-between gap-3 md:flex-col md:items-end">
                <Link href="/" className="btn btn-ghost btn-sm text-neutral-content">
                  Public Home
                </Link>
                <ButtonAccount />
              </div>
            </div>

            <div className="stats stats-vertical rounded-none border-t border-white/10 bg-black/20 text-neutral-content md:stats-horizontal">
              <div className="stat">
                <p className="stat-title uppercase tracking-[0.2em] text-neutral-content/55">
                  Matters Opened
                </p>
                <p className="stat-value text-3xl">{initialCases.length}</p>
              </div>
              <div className="stat">
                <p className="stat-title uppercase tracking-[0.2em] text-neutral-content/55">
                  Verdicts Issued
                </p>
                <p className="stat-value text-3xl">
                  {initialCases.filter((item) => item.status === "verdict").length}
                </p>
              </div>
              <div className="stat">
                <p className="stat-title uppercase tracking-[0.2em] text-neutral-content/55">
                  Current Focus
                </p>
                <p className="stat-desc mt-2 text-lg font-semibold text-neutral-content">
                  {initialCases[0]?.title || "Open your first case"}
                </p>
              </div>
            </div>
          </div>
        </div>

        <section className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="card border border-base-300 bg-base-100 shadow-xl">
            <div className="card-body p-6">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm uppercase tracking-[0.25em] text-base-content/50">
                    New Case
                  </p>
                  <h2 className="mt-2 text-2xl font-bold">Choose a dispute</h2>
                </div>
                <button
                  className="btn btn-primary"
                  onClick={handleCreateCase}
                  disabled={creating || !selectedScenarioId}
                >
                  {creating && <span className="loading loading-spinner loading-xs" />}
                  Start Case
                </button>
              </div>

              <div className="mt-5 grid gap-4">
                {scenarios.map((scenario) => {
                  const selected = scenario.id === selectedScenarioId;

                  return (
                    <button
                      key={scenario.id}
                      className={`rounded-box border p-5 text-left transition ${
                        selected
                          ? "border-primary bg-primary/10 shadow-lg"
                          : "border-base-300 bg-base-100 hover:border-primary/40 hover:bg-base-200"
                      }`}
                      onClick={() => setSelectedScenarioId(scenario.id)}
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="badge badge-outline">
                          {scenario.practiceArea}
                        </span>
                        <span className="text-xs uppercase tracking-[0.2em] text-base-content/45">
                          {scenario.courtName}
                        </span>
                      </div>
                      <h3 className="mt-3 text-xl font-bold">{scenario.title}</h3>
                      <p className="mt-1 text-sm text-base-content/65">
                        {scenario.subtitle}
                      </p>
                      <p className="mt-3 text-sm leading-6 text-base-content/75">
                        {scenario.overview}
                      </p>
                      <div className="mt-4 flex flex-wrap gap-4 text-sm">
                        <span>
                          <span className="font-semibold">Client:</span>{" "}
                          {scenario.clientName}
                        </span>
                        <span>
                          <span className="font-semibold">Opponent:</span>{" "}
                          {scenario.opponentName}
                        </span>
                      </div>
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
                      Start with one of the disputes on the left and the first
                      client interview will be prepared for you.
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
                        <span>{item.premise?.clientName}</span>
                        <span>vs.</span>
                        <span>{item.premise?.opponentName}</span>
                      </div>
                    </Link>
                  ))
                )}
              </div>
            </div>
          </div>
        </section>
      </section>
    </main>
  );
}
