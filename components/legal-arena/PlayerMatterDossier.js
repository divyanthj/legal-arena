"use client";

import Link from "next/link";
import { useState } from "react";
import { sanitizeFactSheet } from "@/libs/game/factSheetSanitizer";
import {
  EmptyPanel,
  FactList,
  TranscriptEntry,
  formatDate,
  formatDateTime,
  getCategoryTitle,
  getCourtSpeaker,
  getInterviewSpeaker,
  getMatterId,
  getOutcome,
  getSidePlayed,
  matterTabs,
  normalizeMatter,
  outcomeLabel,
  statusLabel,
  statusTone,
  summarizeCount,
} from "./playerDossierShared";

export default function PlayerMatterDossier({ player, caseSession }) {
  const matter = normalizeMatter(caseSession);
  const [activeTab, setActiveTab] = useState("Case File");
  const factSheet = sanitizeFactSheet(matter.factSheet || {});
  const verdict = matter.verdict || {};
  const hasVerdict = matter.status === "verdict" && Boolean(verdict.summary);
  const playerScore = verdict.finalScore?.player || matter.score?.player || 0;
  const opponentScore = verdict.finalScore?.opponent || matter.score?.opponent || 0;

  return (
    <main className="arena-app-shell min-h-screen overflow-x-hidden px-4 py-6 md:px-8 md:py-10">
      <section className="mx-auto max-w-7xl space-y-6 arena-reveal">
        <div className="arena-surface arena-scanline arena-column-bg">
          <div className="p-6 md:p-8">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
              <div className="max-w-4xl">
                <div className="flex flex-wrap items-center gap-2">
                  <Link
                    href={`/dashboard/players/${player.id}`}
                    className="arena-btn-dark inline-flex px-4 py-2 text-sm"
                  >
                    Back to player dossier
                  </Link>
                  <span className="badge badge-outline border-white/15 text-white/80">
                    Matter Record
                  </span>
                  <span className="badge badge-outline border-white/15 text-white/80">
                    {player.name}
                  </span>
                </div>
                <h1 className="arena-headline mt-5 text-4xl uppercase leading-[0.92] md:text-6xl">
                  {matter.title}
                </h1>
                <p className="mt-3 max-w-3xl text-sm leading-7 text-white/66 md:text-base">
                  {matter.premise?.overview || "No case overview available."}
                </p>
                <div className="mt-4 flex flex-wrap gap-4 text-sm text-white/58">
                  <span>{matter.premise?.courtName || "Unknown court"}</span>
                  <span>Updated {formatDate(matter.updatedAt)}</span>
                  <span>Side played: {getSidePlayed(matter)}</span>
                </div>
              </div>
              <div className="flex flex-wrap gap-2 lg:justify-end">
                <span
                  className={`badge border arena-status ${
                    statusTone[matter.status] || "arena-status-neutral"
                  }`}
                >
                  {statusLabel[matter.status] || matter.status}
                </span>
                <span className="badge border arena-status arena-status-neutral">
                  {outcomeLabel[getOutcome(matter)] || "In Progress"}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-6 xl:grid-cols-[0.72fr_1.28fr]">
          <aside className="space-y-6">
            <div className="arena-surface">
              <div className="p-5 md:p-6">
                <p className="arena-kicker">Matter Snapshot</p>
                <h2 className="arena-headline mt-2 text-2xl">Case posture</h2>
                <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                  <div className="arena-stat-card">
                    <p className="arena-kicker">Category</p>
                    <p className="mt-2 text-sm font-semibold text-white">
                      {getCategoryTitle(matter.primaryCategory)}
                    </p>
                    <p className="mt-1 text-xs text-white/42">
                      {matter.practiceArea} | Complexity {matter.complexity}
                    </p>
                  </div>
                  <div className="arena-stat-card">
                    <p className="arena-kicker">Parties</p>
                    <p className="mt-2 text-sm font-semibold text-white">
                      {matter.plaintiffName || "Unknown"} vs.{" "}
                      {matter.defendantName || "Unknown"}
                    </p>
                  </div>
                  <div className="arena-stat-card">
                    <p className="arena-kicker">Score</p>
                    <p className="mt-2 text-2xl font-semibold text-white">
                      {playerScore}-{opponentScore}
                    </p>
                  </div>
                  <div className="arena-stat-card">
                    <p className="arena-kicker">Transcript</p>
                    <p className="mt-2 text-sm font-semibold text-white">
                      {summarizeCount(matter.interviewCount, "intake")} |{" "}
                      {summarizeCount(matter.courtroomCount, "round")}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </aside>

          <section className="space-y-6">
            <div className="arena-surface">
              <div className="p-5 md:p-6">
                <div className="flex flex-wrap gap-2" role="tablist" aria-label="Matter detail">
                  {matterTabs.map((tab) => (
                    <button
                      key={tab}
                      type="button"
                      className={`min-h-0 border px-3 py-2 ${
                        activeTab === tab
                          ? "arena-status arena-status-favorable"
                          : "arena-btn-dark"
                      }`}
                      onClick={() => setActiveTab(tab)}
                      role="tab"
                      aria-selected={activeTab === tab}
                    >
                      {tab}
                    </button>
                  ))}
                </div>

                <div className="mt-5">
                  {activeTab === "Case File" && (
                    <div className="grid gap-4 lg:grid-cols-2">
                      <div className="arena-surface-soft p-4 lg:col-span-2">
                        <p className="font-semibold text-white">Parties</p>
                        <div className="mt-3 flex flex-wrap gap-4 text-sm text-white/66">
                          <span>Plaintiff: {matter.plaintiffName || "Unknown"}</span>
                          <span>Defendant: {matter.defendantName || "Unknown"}</span>
                          <span>Represented side: {getSidePlayed(matter)}</span>
                        </div>
                      </div>
                      <FactList title="Theory" items={[factSheet.theory]} />
                      <FactList title="Requested relief" items={[factSheet.desiredRelief]} />
                      <FactList title="Timeline" items={factSheet.timeline} />
                      <FactList title="Supporting facts" items={factSheet.supportingFacts} />
                      <FactList title="Risks" items={factSheet.risks} />
                      <FactList title="Disputed facts" items={factSheet.disputedFacts} />
                      <FactList title="Corroborated facts" items={factSheet.corroboratedFacts} />
                      <FactList title="Missing evidence" items={factSheet.missingEvidence} />
                    </div>
                  )}

                  {activeTab === "Interview" && (
                    <div>
                      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                        <p className="arena-kicker">
                          {summarizeCount(matter.interviewCount, "exchange")}
                        </p>
                      </div>
                      <div className="arena-scroll max-h-[34rem] space-y-4 overflow-y-auto pr-2">
                        {(matter.interviewTranscript || []).length === 0 ? (
                          <EmptyPanel
                            title="No exchanges recorded"
                            detail="This matter has no interview transcript entries yet."
                          />
                        ) : (
                          matter.interviewTranscript.map((entry, index) => (
                            <TranscriptEntry
                              key={`${getMatterId(matter)}-interview-${index}`}
                              speaker={getInterviewSpeaker(entry, player.name)}
                              meta={formatDateTime(entry.createdAt)}
                              isPlayer={entry.role === "player"}
                            >
                              {entry.text}
                            </TranscriptEntry>
                          ))
                        )}
                      </div>
                    </div>
                  )}

                  {activeTab === "Courtroom" && (
                    <div>
                      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                        <p className="arena-kicker">
                          {summarizeCount(matter.courtroomCount, "round")}
                        </p>
                      </div>
                      <div className="arena-scroll max-h-[34rem] space-y-4 overflow-y-auto pr-2">
                        {(matter.courtroomTranscript || []).length === 0 ? (
                          <EmptyPanel
                            title="No exchanges recorded"
                            detail="This matter has no courtroom transcript entries yet."
                          />
                        ) : (
                          matter.courtroomTranscript.map((entry, index) => (
                            <TranscriptEntry
                              key={`${getMatterId(matter)}-court-${index}`}
                              speaker={getCourtSpeaker(entry, player.name, matter)}
                              meta={`Round ${entry.round || index + 1}`}
                              isPlayer={entry.speaker === "player"}
                            >
                              {entry.text}
                            </TranscriptEntry>
                          ))
                        )}
                      </div>
                    </div>
                  )}

                  {activeTab === "Verdict" && (
                    <div className="space-y-4">
                      {hasVerdict ? (
                        <>
                          <div className="arena-surface-soft p-4">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="font-semibold text-white">Final ruling</p>
                              <span className="badge border arena-status arena-status-favorable">
                                {outcomeLabel[verdict.winner] || "Drew"}
                              </span>
                            </div>
                            <p className="mt-3 text-sm leading-7 text-white/66">
                              {verdict.summary}
                            </p>
                          </div>
                          <div className="grid gap-4 md:grid-cols-2">
                            <FactList title="What helped" items={verdict.highlights} />
                            <FactList title="What weakened" items={verdict.concerns} />
                          </div>
                        </>
                      ) : (
                        <EmptyPanel
                          title="No verdict yet"
                          detail={`This matter is currently ${
                            statusLabel[matter.status] || "in progress"
                          }.`}
                        />
                      )}
                    </div>
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
