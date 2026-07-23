"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { toast } from "react-hot-toast";
import * as HeroIcons from "@heroicons/react/24/outline";
import apiClient from "@/libs/api";
import { getCaseReportProgressLabel } from "./caseReportUi";
import { sanitizeFactSheet } from "@/libs/game/factSheetSanitizer";
import {
  verdictTone,
  winnerLabel,
  winnerSignal,
} from "./caseWorkspaceUtils";
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
import MobileSectionNavigator from "./MobileSectionNavigator";

const matterSectionNavigatorItems = [
  { key: "overview", label: "Overview", target: "matter-overview" },
  { key: "ruling", label: "Ruling", target: "matter-ruling" },
  { key: "snapshot", label: "Snapshot", target: "matter-snapshot" },
  { key: "details", label: "Matter details", target: "matter-details" },
];

export default function PlayerMatterDossier({ player, caseSession, canManageCaseReport = false }) {
  const matter = normalizeMatter(caseSession);
  const [activeTab, setActiveTab] = useState("Case File");
  const factSheet = sanitizeFactSheet(matter.factSheet || {});
  const verdict = matter.verdict || {};
  const hasVerdict = matter.status === "verdict" && Boolean(verdict.summary);
  const playerScore = verdict.finalScore?.player || matter.score?.player || 0;
  const opponentScore = verdict.finalScore?.opponent || matter.score?.opponent || 0;
  const verdictStyle = verdictTone[verdict.winner] || verdictTone.draw;
  const reportSourceId = String(matter.id || matter._id || "");
  const reportPath = `/case-reports/caseSession/${reportSourceId}`;
  const [caseReport, setCaseReport] = useState({ status: "loading" });
  const [reportPreferences, setReportPreferences] = useState({
    autoPublishCaseReports: false,
    allowPortraitInCaseReports: false,
  });
  const [reportWorking, setReportWorking] = useState(false);

  useEffect(() => {
    if (!hasVerdict || !canManageCaseReport || !reportSourceId) return;
    let active = true;
    Promise.all([
      apiClient.get(reportPath),
      apiClient.get("/players/case-report-preferences"),
    ]).then(([reportResponse, preferenceResponse]) => {
      if (!active) return;
      setCaseReport(reportResponse.report || { status: "not_started" });
      setReportPreferences(preferenceResponse.preferences || {});
    }).catch(() => { if (active) setCaseReport({ status: "not_started" }); });
    return () => { active = false; };
  }, [canManageCaseReport, hasVerdict, reportPath, reportSourceId]);

  useEffect(() => {
    if (!reportWorking && caseReport.status !== "generating") return;
    const interval = window.setInterval(async () => {
      try {
        const response = await apiClient.get(reportPath);
        if (response.report) setCaseReport(response.report);
      } catch (error) {
        // The publishing request remains authoritative; polling can safely retry.
      }
    }, 1200);
    return () => window.clearInterval(interval);
  }, [caseReport.status, reportPath, reportWorking]);

  const publishReport = async () => {
    setReportWorking(true);
    setCaseReport((current) => ({ ...current, status: "generating" }));
    try {
      const response = await apiClient.post(reportPath);
      setCaseReport(response.report || { status: "not_started" });
      toast.success("Case report published.");
    } catch (error) {
      setCaseReport((current) => ({ ...current, status: "failed", canRetry: true }));
    } finally {
      setReportWorking(false);
    }
  };

  const unpublishReport = async () => {
    if (!window.confirm("Unpublish this report? It cannot be generated again from this case.")) return;
    setReportWorking(true);
    try {
      const response = await apiClient.delete(reportPath);
      setCaseReport(response.report);
      toast.success("Case report unpublished.");
    } finally { setReportWorking(false); }
  };

  const updateReportPreference = async (key, value) => {
    const previous = reportPreferences;
    const next = { ...previous, [key]: value };
    setReportPreferences(next);
    try {
      const response = await apiClient.patch("/players/case-report-preferences", { [key]: value });
      setReportPreferences(response.preferences || next);
    } catch (error) { setReportPreferences(previous); }
  };

  const renderCaseReportPanel = () => canManageCaseReport ? (
    <section className="mt-5 rounded-2xl border border-amber-200/25 bg-black/20 p-4 md:p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <HeroIcons.NewspaperIcon className="h-5 w-5 text-amber-200" aria-hidden="true" />
            <h3 className="font-serif text-xl font-semibold text-white">Publish this case</h3>
          </div>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-white/58">
            Generate a public, search-friendly Legal Arena report featuring your advocacy.
          </p>
        </div>
        {caseReport.status === "published" ? (
          <div className="flex flex-wrap gap-2">
            <Link href={`/blog/${caseReport.slug}`} className="arena-btn-light inline-flex px-4 py-2.5 text-sm">Read report</Link>
            <button type="button" disabled={reportWorking} onClick={unpublishReport} className="arena-btn-dark px-4 py-2.5 text-sm disabled:opacity-50">Unpublish</button>
          </div>
        ) : caseReport.status === "unpublished" ? (
          <span className="badge badge-outline border-white/15 px-3 py-3 text-white/50">Unpublished permanently</span>
        ) : (
          <button type="button" disabled={reportWorking || caseReport.status === "generating" || caseReport.status === "loading"} onClick={publishReport} className="arena-btn-light inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm disabled:cursor-wait disabled:opacity-60">
            {reportWorking || caseReport.status === "generating" || caseReport.status === "loading" ? <HeroIcons.ArrowPathIcon className="h-4 w-4 animate-spin" /> : <HeroIcons.NewspaperIcon className="h-4 w-4" />}
            {caseReport.status === "failed" ? "Retry publication" : caseReport.status === "loading" ? "Loading…" : "Publish case report"}
          </button>
        )}
      </div>
      <div className="mt-4 grid gap-3 border-t border-white/10 pt-4 md:grid-cols-2">
        <label className="flex cursor-pointer items-center justify-between gap-4 rounded-xl border border-white/10 bg-white/[0.03] p-3">
          <span><span className="block text-sm font-semibold text-white/82">Auto-publish future verdicts</span><span className="mt-1 block text-xs text-white/45">Applies to cases you complete later.</span></span>
          <input type="checkbox" className="checkbox checkbox-warning checkbox-sm" checked={Boolean(reportPreferences.autoPublishCaseReports)} onChange={(event) => updateReportPreference("autoPublishCaseReports", event.target.checked)} />
        </label>
        <label className="flex cursor-pointer items-center justify-between gap-4 rounded-xl border border-white/10 bg-white/[0.03] p-3">
          <span><span className="block text-sm font-semibold text-white/82">Use my lawyer portrait</span><span className="mt-1 block text-xs text-white/45">Separate consent for the generated image.</span></span>
          <input type="checkbox" className="checkbox checkbox-warning checkbox-sm" checked={Boolean(reportPreferences.allowPortraitInCaseReports)} onChange={(event) => updateReportPreference("allowPortraitInCaseReports", event.target.checked)} />
        </label>
      </div>
      {getCaseReportProgressLabel(caseReport) ? <p className="mt-3 flex items-center gap-2 text-sm text-amber-100/75">{caseReport.status === "generating" ? <HeroIcons.ArrowPathIcon className="h-4 w-4 animate-spin" /> : null}{getCaseReportProgressLabel(caseReport)}</p> : null}
      {caseReport.status === "failed" ? <p className="mt-3 text-sm text-rose-200">Nothing was published. Fix the reported configuration or generation error, then retry.</p> : null}
    </section>
  ) : null;

  const renderVerdictPanel = () => (
    <div
      className={`arena-surface border ${verdictStyle.card}`}
      data-section-nav-target="matter-ruling"
    >
      <div className="p-5 md:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex flex-wrap items-center gap-3">
            <p className={`arena-kicker ${verdictStyle.eyebrow}`}>Final Ruling</p>
            <span className={`badge border arena-status ${verdictStyle.card}`}>
              {winnerSignal[verdict.winner] || winnerSignal.draw}
            </span>
          </div>
          <Link href="/dashboard" className="arena-btn-light inline-flex px-5 py-3 text-sm">
            Back to Cases
          </Link>
        </div>
        <h2 className="arena-headline mt-2 text-3xl uppercase">
          {winnerLabel[verdict.winner] || winnerLabel.draw}
        </h2>
        <p className="mt-3 max-w-3xl leading-7 text-white/66">{verdict.summary}</p>
        {renderCaseReportPanel()}
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <FactList title="What helped your side" items={verdict.highlights} />
          <FactList title="What weakened your side" items={verdict.concerns} />
        </div>
      </div>
    </div>
  );

  return (
    <main className="arena-app-shell min-h-screen overflow-x-hidden px-4 py-6 md:px-8 md:py-10">
      <section className="mx-auto max-w-7xl space-y-6 arena-reveal">
        <div
          className="arena-surface arena-scanline arena-column-bg"
          data-section-nav-target="matter-overview"
        >
          <div className="p-6 md:p-8">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
              <div className="max-w-4xl">
                <p className="arena-kicker mb-4">LEGAL ARENA</p>
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

        {hasVerdict ? renderVerdictPanel() : null}

        <div className="grid gap-6 xl:grid-cols-[0.72fr_1.28fr]">
          <aside className="space-y-6">
            <div className="arena-surface" data-section-nav-target="matter-snapshot">
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
            <div className="arena-surface" data-section-nav-target="matter-details">
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
                      <FactList title="Case summary" items={factSheet.summary} />
                      <FactList title="Theory" items={factSheet.theory} />
                      <FactList title="Requested relief" items={factSheet.desiredRelief} />
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

                  {activeTab === "Settlement" && (
                    <div className="space-y-4">
                      {(matter.settlement?.finalTerms?.length ||
                        matter.settlement?.currentTerms?.length) ? (
                        <FactList
                          title="Settlement terms"
                          items={
                            matter.settlement?.finalTerms?.length
                              ? matter.settlement.finalTerms
                              : matter.settlement.currentTerms
                          }
                        />
                      ) : null}
                      {matter.settlement?.outcomeSummary ? (
                        <FactList title="Outcome" items={[matter.settlement.outcomeSummary]} />
                      ) : null}
                      <div className="arena-scroll max-h-[34rem] space-y-4 overflow-y-auto pr-2">
                        {(matter.settlement?.transcript || []).length === 0 ? (
                          <EmptyPanel
                            title="No settlement record"
                            detail="This matter has no settlement transcript entries yet."
                          />
                        ) : (
                          matter.settlement.transcript.map((entry, index) => (
                            <TranscriptEntry
                              key={`${getMatterId(matter)}-settlement-${index}`}
                              speaker={entry.role === "player" ? player.name : entry.speaker}
                              meta="Settlement"
                              isPlayer={entry.role === "player"}
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
                        renderVerdictPanel()
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
      <MobileSectionNavigator sections={matterSectionNavigatorItems} />
    </main>
  );
}
