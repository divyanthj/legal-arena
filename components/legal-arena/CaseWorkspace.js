"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import ButtonAccount from "@/components/ButtonAccount";
import apiClient from "@/libs/api";
import { useCaseVoiceRecorder } from "./useCaseVoiceRecorder";

import {
  formatDateTime,
  joinLines,
  splitLines,
  normalizeCourtroomEntry,
  caseFileFieldClass,
  winnerLabel,
  winnerSignal,
  verdictTone,
  statusTone,
  helpText,
  InfoDot,
  getRuleTooltip,
  buildCanonicalFactLookup,
  resolveFactReference,
  getPlayerPartyName,
  getOpponentPartyName,
  getPlaintiffName,
  getDefendantName,
  getCaseRouteRef,
  clampPercent,
} from "./caseWorkspaceUtils";

export default function CaseWorkspace({ initialCase }) {
  const router = useRouter();
  const [caseSession, setCaseSession] = useState(initialCase);
  const [question, setQuestion] = useState("");
  const [argument, setArgument] = useState("");
  const [working, setWorking] = useState(false);
  const [pendingSpeaker, setPendingSpeaker] = useState("");
  const [optimisticTranscriptEntry, setOptimisticTranscriptEntry] = useState(null);
  const interviewTranscriptRef = useRef(null);
  const courtroomTranscriptRef = useRef(null);
  const {
    recordingQuestion,
    transcribingQuestion,
    recordingArgument,
    transcribingArgument,
    handleQuestionVoiceInput,
    handleArgumentVoiceInput,
  } = useCaseVoiceRecorder({ setQuestion, setArgument });
  const [factSheetDraft, setFactSheetDraft] = useState({
    summary: initialCase.factSheet.summary || "",
    theory: initialCase.factSheet.theory || "",
    desiredRelief: initialCase.factSheet.desiredRelief || "",
    timeline: joinLines(initialCase.factSheet.timeline),
    supportingFacts: joinLines(initialCase.factSheet.supportingFacts),
    risks: joinLines(initialCase.factSheet.risks),
    disputedFacts: joinLines(initialCase.factSheet.disputedFacts),
    corroboratedFacts: joinLines(initialCase.factSheet.corroboratedFacts),
    missingEvidence: joinLines(initialCase.factSheet.missingEvidence || []),
  });

  useEffect(() => {
    setFactSheetDraft({
      summary: caseSession.factSheet.summary || "",
      theory: caseSession.factSheet.theory || "",
      desiredRelief: caseSession.factSheet.desiredRelief || "",
      timeline: joinLines(caseSession.factSheet.timeline),
      supportingFacts: joinLines(caseSession.factSheet.supportingFacts),
      risks: joinLines(caseSession.factSheet.risks),
      disputedFacts: joinLines(caseSession.factSheet.disputedFacts),
      corroboratedFacts: joinLines(caseSession.factSheet.corroboratedFacts),
      missingEvidence: joinLines(caseSession.factSheet.missingEvidence || []),
    });
  }, [caseSession]);


  const buildFactSheetPayload = () => ({
    ...caseSession.factSheet,
    summary: factSheetDraft.summary.trim(),
    theory: factSheetDraft.theory.trim(),
    desiredRelief: factSheetDraft.desiredRelief.trim(),
    timeline: splitLines(factSheetDraft.timeline),
    supportingFacts: splitLines(factSheetDraft.supportingFacts),
    risks: splitLines(factSheetDraft.risks),
    disputedFacts: splitLines(factSheetDraft.disputedFacts),
    corroboratedFacts: splitLines(factSheetDraft.corroboratedFacts),
    missingEvidence: splitLines(factSheetDraft.missingEvidence),
  });

  const visibleInterviewTranscript = optimisticTranscriptEntry
    ? [...caseSession.interviewTranscript, optimisticTranscriptEntry]
    : caseSession.interviewTranscript;

  const visibleCourtroomTranscript = optimisticTranscriptEntry
    ? [...caseSession.courtroomTranscript, optimisticTranscriptEntry]
    : caseSession.courtroomTranscript;
  const normalizedCourtroomTranscript =
    visibleCourtroomTranscript.map(normalizeCourtroomEntry);
  const isInterview = caseSession.status === "interview";
  const isVerdict = caseSession.status === "verdict";
  const isExited = caseSession.status === "exited";

  useEffect(() => {
    if (!isInterview || !interviewTranscriptRef.current) {
      return;
    }

    interviewTranscriptRef.current.scrollTo({
      top: interviewTranscriptRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [isInterview, visibleInterviewTranscript.length, working, pendingSpeaker]);

  useEffect(() => {
    if (isInterview || !courtroomTranscriptRef.current) {
      return;
    }

    courtroomTranscriptRef.current.scrollTo({
      top: courtroomTranscriptRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [isInterview, normalizedCourtroomTranscript.length, working, pendingSpeaker]);

  const handleInterviewSubmit = async (event) => {
    event.preventDefault();
    if (!question.trim()) return;

    const submittedQuestion = question.trim();

    setOptimisticTranscriptEntry({
      role: "player",
      speaker: "You",
      text: submittedQuestion,
      createdAt: new Date().toISOString(),
    });
    setQuestion("");
    setWorking(true);
    setPendingSpeaker(getPlayerPartyName(caseSession));

    try {
      const { caseSession: nextCase } = await apiClient.post(
        `/cases/${getCaseRouteRef(caseSession)}/interview`,
        { question: submittedQuestion }
      );

      setCaseSession(nextCase);
    } catch (error) {
      setQuestion(submittedQuestion);
      console.error(error);
    } finally {
      setOptimisticTranscriptEntry(null);
      setPendingSpeaker("");
      setWorking(false);
    }
  };

  const handleFinalize = async () => {
    setWorking(true);

    try {
      const { caseSession: nextCase } = await apiClient.post(
        `/cases/${getCaseRouteRef(caseSession)}/finalize`,
        {
          factSheet: buildFactSheetPayload(),
        }
      );

      setCaseSession(nextCase);
    } catch (error) {
      console.error(error);
    } finally {
      setWorking(false);
    }
  };

  const handleCourtroomSubmit = async (event) => {
    event.preventDefault();
    if (!argument.trim()) return;

    const submittedArgument = argument.trim();

    setOptimisticTranscriptEntry({
      round: caseSession.score.roundsCompleted + 1,
      speaker: "player",
      text: submittedArgument,
      citedFacts: [],
      citedRules: [],
      citedClaimIds: [],
      createdAt: new Date().toISOString(),
    });
    setArgument("");
    setWorking(true);
    setPendingSpeaker(getOpponentPartyName(caseSession));

    try {
      const { caseSession: nextCase } = await apiClient.post(
        `/cases/${getCaseRouteRef(caseSession)}/courtroom`,
        { argument: submittedArgument }
      );

      setCaseSession(nextCase);
    } catch (error) {
      setArgument(submittedArgument);
      console.error(error);
    } finally {
      setOptimisticTranscriptEntry(null);
      setPendingSpeaker("");
      setWorking(false);
    }
  };

  const handleExitCase = async () => {
    const confirmed = window.confirm(
      "Exit this case? You will not be able to start the same case again for 24 hours."
    );

    if (!confirmed) {
      return;
    }

    setWorking(true);

    try {
      await apiClient.post(`/cases/${getCaseRouteRef(caseSession)}/exit`);
      router.push("/dashboard");
      router.refresh();
    } catch (error) {
      console.error(error);
    } finally {
      setWorking(false);
    }
  };

  const playerPartyName = getPlayerPartyName(caseSession);
  const opponentPartyName = getOpponentPartyName(caseSession);
  const plaintiffName = getPlaintiffName(caseSession);
  const defendantName = getDefendantName(caseSession);
  const sideBadgeLabel =
    caseSession.playerSide === "opponent" ? "Defendant Side" : "Plaintiff Side";
  const verdictStyle =
    verdictTone[caseSession.verdict?.winner] || verdictTone.draw;
  const canonicalFactLookup = buildCanonicalFactLookup(caseSession);

  const pressureTotal = Math.max(caseSession.score.player + caseSession.score.opponent, 1);
  const playerPressurePct = clampPercent((caseSession.score.player / pressureTotal) * 100);
  const opponentPressurePct = clampPercent(
    (caseSession.score.opponent / pressureTotal) * 100
  );

  const courtroomStageLabel = useMemo(() => {
    if (isExited) return "Exited";
    if (isInterview) return "Party Intake";
    if (isVerdict) return "Verdict";
    return `Courtroom Round ${caseSession.score.roundsCompleted + 1}`;
  }, [caseSession.score.roundsCompleted, isExited, isInterview, isVerdict]);

  return (
    <main className="arena-shell min-h-screen px-4 py-6 md:px-8 md:py-10">
      <section className="mx-auto max-w-7xl space-y-6 arena-reveal">
        <div className="arena-console arena-scanline">
          <div className="p-6 md:p-8">
            <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
              <div className="max-w-3xl">
                <div className="flex flex-wrap items-center gap-2">
                  <Link
                    href="/dashboard"
                    className="btn btn-ghost btn-sm border border-slate-500/25 bg-slate-900/30 text-slate-100"
                  >
                    Back to Cases
                  </Link>
                  <span className="badge badge-outline border-slate-400/35 text-slate-100">
                    {caseSession.practiceArea}
                  </span>
                  <span className="badge badge-outline border-slate-400/35 text-slate-100">
                    {caseSession.primaryCategory}
                  </span>
                  <span className="badge badge-outline border-slate-400/35 text-slate-100">
                    Complexity {caseSession.complexity}
                  </span>
                  <span className="badge badge-outline border-slate-400/35 text-slate-100">
                    {sideBadgeLabel}
                  </span>
                </div>
                <h1 className="arena-case-title mt-4 text-4xl leading-tight md:text-5xl">
                  {caseSession.title}
                </h1>
                <p className="mt-3 max-w-2xl text-slate-300">
                  {caseSession.premise.overview}
                </p>
                <div className="mt-4 flex flex-wrap gap-4 text-sm text-slate-300">
                  <span>Plaintiff: {plaintiffName}</span>
                  <span>vs.</span>
                  <span>Defendant: {defendantName}</span>
                  <span>{caseSession.premise.courtName}</span>
                </div>
                <p className="mt-3 text-sm text-slate-300">
                  You represent {playerPartyName} against {opponentPartyName}.
                </p>
              </div>

              <div className="flex flex-col items-start gap-3 md:items-end">
                <span
                  className={`badge border px-3 py-3 arena-status ${
                    statusTone[caseSession.status] || "arena-status-neutral"
                  }`}
                >
                  {courtroomStageLabel}
                </span>
                <ButtonAccount />
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
          <section className="space-y-6">
            {isInterview ? (
              <div className="arena-console">
                <div className="p-6">
                  <div className="flex items-end justify-between gap-3">
                    <div>
                      <p className="arena-kicker">Step 1</p>
                      <h2 className="arena-headline mt-2 text-2xl">
                        Collect your side&apos;s facts
                      </h2>
                    </div>
                    <span className="text-xs uppercase tracking-[0.14em] text-slate-400">
                      Interview {playerPartyName} and tighten the record.
                    </span>
                  </div>

                  <div
                    ref={interviewTranscriptRef}
                    className="arena-scroll mt-5 max-h-[30rem] space-y-4 overflow-y-auto pr-2"
                  >
                    {visibleInterviewTranscript.map((entry, index) => (
                      <article
                        key={`${entry.createdAt}-${index}`}
                        className={`rounded-xl p-4 ${
                          entry.role !== "player"
                            ? "arena-transcript-opponent"
                            : "arena-transcript-player ml-auto max-w-[90%]"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <p className="font-semibold text-slate-100">{entry.speaker}</p>
                          <p className="text-xs text-slate-400">
                            {formatDateTime(entry.createdAt)}
                          </p>
                        </div>
                        <p className="mt-2 whitespace-pre-wrap leading-7 text-slate-100">
                          {entry.text}
                        </p>
                      </article>
                    ))}
                    {working && pendingSpeaker && (
                      <article className="arena-transcript-opponent rounded-xl p-4">
                        <div className="flex items-center justify-between gap-3">
                          <p className="font-semibold text-slate-100">{pendingSpeaker}</p>
                          <span className="loading loading-dots loading-sm" />
                        </div>
                        <p className="mt-2 leading-7 text-slate-100">
                          {pendingSpeaker} is typing...
                        </p>
                      </article>
                    )}
                  </div>

                  <form className="mt-6 space-y-3" onSubmit={handleInterviewSubmit}>
                    <textarea
                      className="textarea textarea-bordered arena-textarea h-32 w-full bg-slate-950/35 text-slate-100"
                      placeholder={`Ask ${playerPartyName} about dates, records, witnesses, notice, or any proof gaps you need to pin down.`}
                      value={question}
                      onChange={(event) => setQuestion(event.target.value)}
                      disabled={transcribingQuestion}
                    />
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="space-y-1 text-sm text-slate-300">
                        <div>
                          Suggested open questions:{" "}
                          {(caseSession.factSheet.openQuestions || [])
                            .slice(0, 3)
                            .join(" | ")}
                        </div>
                        {caseSession.factSheet.missingEvidence?.length > 0 && (
                          <div>
                            Proof gaps:{" "}
                            {caseSession.factSheet.missingEvidence.slice(0, 2).join(" | ")}
                          </div>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          className={`btn border ${
                            recordingQuestion
                              ? "border-rose-400/60 bg-rose-950/40 text-rose-100"
                              : "btn-ghost border-slate-500/35 text-slate-100"
                          }`}
                          disabled={working || transcribingQuestion}
                          onClick={handleQuestionVoiceInput}
                          data-tooltip-id="tooltip"
                          data-tooltip-content={
                            recordingQuestion
                              ? "Stop recording and transcribe"
                              : "Record a question with your microphone"
                          }
                          aria-label={
                            recordingQuestion
                              ? "Stop recording and transcribe"
                              : "Record a question with your microphone"
                          }
                        >
                          {transcribingQuestion ? (
                            <span className="loading loading-spinner loading-xs" />
                          ) : (
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              fill="none"
                              viewBox="0 0 24 24"
                              strokeWidth={1.5}
                              stroke="currentColor"
                              className="h-5 w-5"
                              aria-hidden="true"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M12 18.75a6 6 0 0 0 6-6v-1.5m-12 0v1.5a6 6 0 0 0 6 6Zm0 0v3.75m-3.75 0h7.5M12 15.75a3 3 0 0 1-3-3V6a3 3 0 1 1 6 0v6.75a3 3 0 0 1-3 3Z"
                              />
                            </svg>
                          )}
                          {recordingQuestion ? "Stop" : transcribingQuestion ? "Transcribing" : "Voice"}
                        </button>
                        <button
                          type="button"
                          className="btn btn-ghost border border-rose-400/40 text-rose-200"
                          disabled={working || recordingQuestion || transcribingQuestion}
                          onClick={handleExitCase}
                        >
                          Exit Case
                        </button>
                        <button
                          className="btn btn-primary"
                          disabled={working || recordingQuestion || transcribingQuestion}
                        >
                          {working && (
                            <span className="loading loading-spinner loading-xs" />
                          )}
                          Continue Intake
                        </button>
                      </div>
                    </div>
                  </form>
                </div>
              </div>
            ) : isExited ? (
              <div className="arena-console">
                <div className="p-6">
                  <p className="arena-kicker text-rose-300">Case Exited</p>
                  <h2 className="arena-headline mt-2 text-2xl">This intake was closed</h2>
                  <p className="mt-3 max-w-2xl text-slate-300">
                    You exited this matter during intake. The same case stays unavailable for
                    24 hours before it can be started again.
                  </p>
                  <div className="mt-5">
                    <Link href="/dashboard" className="btn btn-primary">
                      Back to Cases
                    </Link>
                  </div>
                </div>
              </div>
            ) : (
              <div className="arena-console arena-round-transition">
                <div className="p-6">
                  <div className="flex items-end justify-between gap-3">
                    <div>
                      <p className="arena-kicker">Step 2</p>
                      <h2 className="arena-headline mt-2 text-2xl">
                        Freeform courtroom duel
                      </h2>
                    </div>
                    <span className="text-xs uppercase tracking-[0.14em] text-slate-400">
                      Round {caseSession.score.roundsCompleted} of {caseSession.maxCourtRounds}
                    </span>
                  </div>

                  <div className="mt-5 grid gap-4 md:grid-cols-3">
                    <div className="arena-metric">
                      <div className="flex items-center gap-2">
                        <p className="arena-kicker">Your Pressure</p>
                        <InfoDot
                          content={helpText.playerPressure}
                          label="Explain your pressure"
                        />
                      </div>
                      <p className="mt-2 text-3xl font-bold text-slate-100">
                        {caseSession.score.player}
                      </p>
                      <div className="mt-3 arena-progress-track" aria-hidden="true">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-sky-500 to-sky-300"
                          style={{ width: `${playerPressurePct}%` }}
                        />
                      </div>
                    </div>
                    <div className="arena-metric">
                      <div className="flex items-center gap-2">
                        <p className="arena-kicker">Opponent Pressure</p>
                        <InfoDot
                          content={helpText.opponentPressure}
                          label="Explain opponent pressure"
                        />
                      </div>
                      <p className="mt-2 text-3xl font-bold text-slate-100">
                        {caseSession.score.opponent}
                      </p>
                      <div className="mt-3 arena-progress-track" aria-hidden="true">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-amber-500 to-amber-300"
                          style={{ width: `${opponentPressurePct}%` }}
                        />
                      </div>
                    </div>
                    <div className="arena-metric">
                      <p className="arena-kicker">Bench Signal</p>
                      <p className="mt-2 text-sm leading-6 text-slate-100">
                        {caseSession.score.lastBenchSignal ||
                          "The bench is listening. Build the record carefully."}
                      </p>
                    </div>
                  </div>

                  <div
                    ref={courtroomTranscriptRef}
                    className="arena-scroll mt-5 max-h-[30rem] space-y-4 overflow-y-auto pr-2"
                  >
                    {normalizedCourtroomTranscript.length === 0 ? (
                      <div className="arena-console-soft p-5">
                        <p className="font-semibold text-slate-100">Court is now in session.</p>
                        <p className="mt-2 text-sm text-slate-300">
                          Open with your strongest theory and anchor it to lawbook and fact
                          sheet.
                        </p>
                      </div>
                    ) : (
                      normalizedCourtroomTranscript.map((entry, index) => (
                        <article
                          key={`${entry.round}-${entry.speaker}-${index}`}
                          className={`rounded-xl p-4 ${
                            entry.speaker === "player"
                              ? "arena-transcript-player ml-auto max-w-[95%]"
                              : "arena-transcript-opponent"
                          }`}
                        >
                          <div className="flex items-center justify-between gap-3">
                            <p className="font-semibold text-slate-100">
                              {entry.speaker === "player" ? "You" : opponentPartyName}
                            </p>
                            <p className="text-xs text-slate-400">Round {entry.round}</p>
                          </div>
                          <p className="mt-2 whitespace-pre-wrap leading-7 text-slate-100">
                            {entry.text}
                          </p>
                          {entry.speaker === "player" &&
                            (entry.citedFacts.length > 0 ||
                              entry.citedRules.length > 0) && (
                              <div className="mt-3 flex flex-wrap gap-2 text-xs">
                                {entry.citedFacts.map((fact, factIndex) => {
                                  const resolvedFact = resolveFactReference(
                                    fact,
                                    canonicalFactLookup
                                  );

                                  return (
                                    <span
                                      key={`${fact}-${factIndex}`}
                                      className="badge badge-outline badge-sm max-w-[18rem] truncate border-slate-400/45 text-slate-100"
                                      data-tooltip-id="tooltip"
                                      data-tooltip-content={resolvedFact.tooltip}
                                    >
                                      {resolvedFact.badge}
                                    </span>
                                  );
                                })}
                                {entry.citedRules.map((rule) => (
                                  <span
                                    key={rule}
                                    className="badge badge-sm arena-status arena-status-caution border"
                                    data-tooltip-id="tooltip"
                                    data-tooltip-content={getRuleTooltip(rule)}
                                  >
                                    {rule}
                                  </span>
                                ))}
                              </div>
                            )}
                        </article>
                      ))
                    )}
                    {working && pendingSpeaker === opponentPartyName && (
                      <article className="arena-transcript-opponent rounded-xl p-4">
                        <div className="flex items-center justify-between gap-3">
                          <p className="font-semibold text-slate-100">{opponentPartyName}</p>
                          <span className="loading loading-dots loading-sm" />
                        </div>
                        <p className="mt-2 leading-7 text-slate-100">
                          {opponentPartyName} is typing...
                        </p>
                      </article>
                    )}
                  </div>

                  {!isVerdict && (
                    <form className="mt-6 space-y-3" onSubmit={handleCourtroomSubmit}>
                      <textarea
                        className="textarea textarea-bordered arena-textarea h-40 w-full bg-slate-950/35 text-slate-100"
                        placeholder={`Deliver your argument for ${playerPartyName}. Cite the fact sheet, confront the weakest point on ${opponentPartyName}'s side, and tie your position to the lawbook.`}
                        value={argument}
                        onChange={(event) => setArgument(event.target.value)}
                        disabled={transcribingArgument}
                      />
                      <div className="flex flex-wrap items-center justify-end gap-2">
                        <button
                          type="button"
                          className={`btn border ${
                            recordingArgument
                              ? "border-rose-400/60 bg-rose-950/40 text-rose-100"
                              : "btn-ghost border-slate-500/35 text-slate-100"
                          }`}
                          disabled={working || transcribingArgument}
                          onClick={handleArgumentVoiceInput}
                          data-tooltip-id="tooltip"
                          data-tooltip-content={
                            recordingArgument
                              ? "Stop recording and transcribe"
                              : "Record an argument with your microphone"
                          }
                          aria-label={
                            recordingArgument
                              ? "Stop recording and transcribe"
                              : "Record an argument with your microphone"
                          }
                        >
                          {transcribingArgument ? (
                            <span className="loading loading-spinner loading-xs" />
                          ) : (
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              fill="none"
                              viewBox="0 0 24 24"
                              strokeWidth={1.5}
                              stroke="currentColor"
                              className="h-5 w-5"
                              aria-hidden="true"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M12 18.75a6 6 0 0 0 6-6v-1.5m-12 0v1.5a6 6 0 0 0 6 6Zm0 0v3.75m-3.75 0h7.5M12 15.75a3 3 0 0 1-3-3V6a3 3 0 1 1 6 0v6.75a3 3 0 0 1-3 3Z"
                              />
                            </svg>
                          )}
                          {recordingArgument
                            ? "Stop"
                            : transcribingArgument
                            ? "Transcribing"
                            : "Voice"}
                        </button>
                        <button
                          className="btn btn-primary"
                          disabled={working || recordingArgument || transcribingArgument}
                        >
                          {working && (
                            <span className="loading loading-spinner loading-xs" />
                          )}
                          Submit Argument
                        </button>
                      </div>
                    </form>
                  )}
                </div>
              </div>
            )}

            {isVerdict && (
              <div className={`arena-console border ${verdictStyle.card}`}>
                <div className="p-6">
                  <div className="flex flex-wrap items-center gap-3">
                    <p className={`arena-kicker ${verdictStyle.eyebrow}`}>Final Ruling</p>
                    <span className={`badge border arena-status ${verdictStyle.card}`}>
                      {winnerSignal[caseSession.verdict.winner] || winnerSignal.draw}
                    </span>
                  </div>
                  <h2 className="arena-case-title mt-2 text-3xl">
                    {winnerLabel[caseSession.verdict.winner]}
                  </h2>
                  <p className="mt-3 max-w-3xl leading-7 text-slate-300">
                    {caseSession.verdict.summary}
                  </p>
                  <div className="mt-5 grid gap-4 md:grid-cols-2">
                    <div className="arena-console-soft p-4">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-slate-100">What helped your side</p>
                        <InfoDot
                          content={helpText.helpedYourSide}
                          label="Explain what helped your side"
                        />
                      </div>
                      <ul className="mt-3 space-y-2 text-sm text-slate-300">
                        {caseSession.verdict.highlights.map((item) => (
                          <li key={item}>- {item}</li>
                        ))}
                      </ul>
                    </div>
                    <div className="arena-console-soft p-4">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-slate-100">What weakened your side</p>
                        <InfoDot
                          content={helpText.weakenedYourSide}
                          label="Explain what weakened your side"
                        />
                      </div>
                      <ul className="mt-3 space-y-2 text-sm text-slate-300">
                        {caseSession.verdict.concerns.map((item) => (
                          <li key={item}>- {item}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </section>

          <aside className="space-y-6">
            <div className="arena-console">
              <div className="p-6">
                <div className="flex items-end justify-between gap-3">
                  <div>
                    <p className="arena-kicker">Fact Sheet</p>
                    <h2 className="arena-headline mt-2 text-2xl">Case file</h2>
                  </div>
                  <span
                    className={`badge border arena-status ${
                      caseSession.factSheet.ready
                        ? "arena-status-favorable"
                        : "arena-status-caution"
                    }`}
                  >
                    {caseSession.factSheet.ready ? "Court-ready" : "Draft"}
                  </span>
                </div>

                <div className="mt-5 space-y-4">
                  <label className="form-control">
                    <span className="label-text font-semibold text-slate-100">Case summary</span>
                    <textarea
                      className={caseFileFieldClass}
                      value={factSheetDraft.summary}
                      onChange={(event) =>
                        setFactSheetDraft((current) => ({
                          ...current,
                          summary: event.target.value,
                        }))
                      }
                      readOnly={!isInterview}
                    />
                  </label>

                  <label className="form-control">
                    <span className="label-text font-semibold text-slate-100">Theory</span>
                    <textarea
                      className={caseFileFieldClass}
                      value={factSheetDraft.theory}
                      onChange={(event) =>
                        setFactSheetDraft((current) => ({
                          ...current,
                          theory: event.target.value,
                        }))
                      }
                      readOnly={!isInterview}
                    />
                  </label>

                  <label className="form-control">
                    <span className="label-text font-semibold text-slate-100">Timeline</span>
                    <textarea
                      className="textarea textarea-bordered arena-textarea h-28 bg-slate-950/35 text-slate-100"
                      value={factSheetDraft.timeline}
                      onChange={(event) =>
                        setFactSheetDraft((current) => ({
                          ...current,
                          timeline: event.target.value,
                        }))
                      }
                      readOnly={!isInterview}
                    />
                  </label>

                  <label className="form-control">
                    <span className="label-text font-semibold text-slate-100">
                      Supporting facts
                    </span>
                    <textarea
                      className="textarea textarea-bordered arena-textarea h-32 bg-slate-950/35 text-slate-100"
                      value={factSheetDraft.supportingFacts}
                      onChange={(event) =>
                        setFactSheetDraft((current) => ({
                          ...current,
                          supportingFacts: event.target.value,
                        }))
                      }
                      readOnly={!isInterview}
                    />
                  </label>

                  <label className="form-control">
                    <span className="label-text font-semibold text-slate-100">Risks</span>
                    <textarea
                      className={caseFileFieldClass}
                      value={factSheetDraft.risks}
                      onChange={(event) =>
                        setFactSheetDraft((current) => ({
                          ...current,
                          risks: event.target.value,
                        }))
                      }
                      readOnly={!isInterview}
                    />
                  </label>

                  <label className="form-control">
                    <span className="label-text font-semibold text-slate-100">
                      Disputed facts
                    </span>
                    <textarea
                      className={caseFileFieldClass}
                      value={factSheetDraft.disputedFacts}
                      onChange={(event) =>
                        setFactSheetDraft((current) => ({
                          ...current,
                          disputedFacts: event.target.value,
                        }))
                      }
                      readOnly={!isInterview}
                    />
                  </label>

                  <label className="form-control">
                    <span className="label-text font-semibold text-slate-100">
                      Corroborated facts
                    </span>
                    <textarea
                      className={caseFileFieldClass}
                      value={factSheetDraft.corroboratedFacts}
                      onChange={(event) =>
                        setFactSheetDraft((current) => ({
                          ...current,
                          corroboratedFacts: event.target.value,
                        }))
                      }
                      readOnly={!isInterview}
                    />
                  </label>

                  <label className="form-control">
                    <span className="label-text font-semibold text-slate-100">
                      Missing evidence / proof gaps
                    </span>
                    <textarea
                      className={caseFileFieldClass}
                      value={factSheetDraft.missingEvidence}
                      onChange={(event) =>
                        setFactSheetDraft((current) => ({
                          ...current,
                          missingEvidence: event.target.value,
                        }))
                      }
                      readOnly={!isInterview}
                    />
                  </label>

                  <label className="form-control">
                    <span className="label-text font-semibold text-slate-100">
                      Requested relief
                    </span>
                    <textarea
                      className="textarea textarea-bordered arena-textarea h-20 bg-slate-950/35 text-slate-100"
                      value={factSheetDraft.desiredRelief}
                      onChange={(event) =>
                        setFactSheetDraft((current) => ({
                          ...current,
                          desiredRelief: event.target.value,
                        }))
                      }
                      readOnly={!isInterview}
                    />
                  </label>

                  {isInterview && (
                    <button
                      className="btn btn-secondary w-full"
                      onClick={handleFinalize}
                      disabled={working}
                    >
                      {working && (
                        <span className="loading loading-spinner loading-xs" />
                      )}
                      Finalize Fact Sheet
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div className="arena-console">
              <div className="p-6">
                <p className="arena-kicker">Lawbook</p>
                <h2 className="arena-headline mt-2 text-2xl">Rules in play</h2>
                <div className="mt-5 space-y-3">
                  {caseSession.lawbook.map((rule) => (
                    <article key={rule.id} className="arena-console-soft p-4">
                      <p className="font-semibold text-slate-100">{rule.title}</p>
                      <p className="mt-2 text-sm leading-6 text-slate-300">
                        {rule.principle}
                      </p>
                      <p className="mt-2 text-xs uppercase tracking-[0.15em] text-slate-400">
                        {rule.tags.join(" | ")}
                      </p>
                    </article>
                  ))}
                </div>
              </div>
            </div>
          </aside>
        </div>
      </section>
    </main>
  );
}
