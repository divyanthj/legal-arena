"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import ButtonAccount from "@/components/ButtonAccount";
import apiClient from "@/libs/api";
import { sanitizeFactSheet } from "@/libs/game/factSheetSanitizer";
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

const countFieldCharacters = (value = "") => String(value || "").trim().length;

const countListEntries = (value = "") =>
  String(value || "")
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean).length;

export default function CaseWorkspace({ initialCase }) {
  const router = useRouter();
  const initialFactSheet = sanitizeFactSheet(initialCase.factSheet || {});
  const [caseSession, setCaseSession] = useState(() => ({
    ...initialCase,
    factSheet: initialFactSheet,
  }));
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
    summary: initialFactSheet.summary || "",
    theory: initialFactSheet.theory || "",
    desiredRelief: initialFactSheet.desiredRelief || "",
    timeline: joinLines(initialFactSheet.timeline),
    supportingFacts: joinLines(initialFactSheet.supportingFacts),
    risks: joinLines(initialFactSheet.risks),
    disputedFacts: joinLines(initialFactSheet.disputedFacts),
    corroboratedFacts: joinLines(initialFactSheet.corroboratedFacts),
    missingEvidence: joinLines(initialFactSheet.missingEvidence || []),
  });

  useEffect(() => {
    const sanitizedFactSheet = sanitizeFactSheet(caseSession.factSheet || {});
    setFactSheetDraft({
      summary: sanitizedFactSheet.summary || "",
      theory: sanitizedFactSheet.theory || "",
      desiredRelief: sanitizedFactSheet.desiredRelief || "",
      timeline: joinLines(sanitizedFactSheet.timeline),
      supportingFacts: joinLines(sanitizedFactSheet.supportingFacts),
      risks: joinLines(sanitizedFactSheet.risks),
      disputedFacts: joinLines(sanitizedFactSheet.disputedFacts),
      corroboratedFacts: joinLines(sanitizedFactSheet.corroboratedFacts),
      missingEvidence: joinLines(sanitizedFactSheet.missingEvidence || []),
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

      setCaseSession({
        ...nextCase,
        factSheet: sanitizeFactSheet(nextCase.factSheet || {}),
      });
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

      setCaseSession({
        ...nextCase,
        factSheet: sanitizeFactSheet(nextCase.factSheet || {}),
      });
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

      setCaseSession({
        ...nextCase,
        factSheet: sanitizeFactSheet(nextCase.factSheet || {}),
      });
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

  const suggestedQuestions = (caseSession.factSheet.openQuestions || []).slice(0, 4);
  const factSheetCompletionItems = [
    factSheetDraft.summary,
    factSheetDraft.theory,
    factSheetDraft.timeline,
    factSheetDraft.supportingFacts,
    factSheetDraft.risks,
    factSheetDraft.disputedFacts,
    factSheetDraft.corroboratedFacts,
    factSheetDraft.missingEvidence,
    factSheetDraft.desiredRelief,
  ];
  const completedFactSheetItems = factSheetCompletionItems.filter((item) =>
    String(item || "").trim()
  ).length;
  const factSheetProgressPercent = clampPercent(
    (completedFactSheetItems / factSheetCompletionItems.length) * 100
  );
  const roundedFactSheetProgressPercent = Math.round(factSheetProgressPercent);
  const nextFactSheetStep =
    (!factSheetDraft.timeline.trim() && "Add timeline of events") ||
    (!factSheetDraft.supportingFacts.trim() && "Capture supporting facts") ||
    (!factSheetDraft.risks.trim() && "Document key risks") ||
    (!factSheetDraft.missingEvidence.trim() && "List proof gaps") ||
    "Review and finalize fact sheet";
  const isCourtroom = !isInterview && !isExited && !isVerdict;
  const courtroomRoundLabel = `Courtroom Round ${caseSession.score.roundsCompleted + 1}`;
  const heroPanelStyle = {
    backgroundImage: [
      "linear-gradient(90deg, rgba(4,4,4,0.96) 0%, rgba(4,4,4,0.88) 42%, rgba(4,4,4,0.5) 68%, rgba(4,4,4,0.9) 100%)",
      "linear-gradient(180deg, rgba(18,12,6,0.18), rgba(0,0,0,0.1))",
      `url('${isInterview ? "/images/office.jpg" : "/images/court.jpg"}')`,
    ].join(", "),
    backgroundPosition: "center, center, 72% center",
    backgroundRepeat: "no-repeat, no-repeat, no-repeat",
    backgroundSize: "cover, cover, auto 108%",
  };

  const applyArgumentSnippet = (snippet) => {
    setArgument((current) => {
      const trimmedCurrent = String(current || "").trim();
      return trimmedCurrent ? `${trimmedCurrent}\n${snippet}` : snippet;
    });
  };

  return (
    <main className="arena-app-shell min-h-screen px-4 py-6 md:px-8 md:py-10">
      <section className="mx-auto max-w-[1600px] space-y-6 arena-reveal">
        <div
          className="arena-surface arena-scanline arena-column-bg"
          style={heroPanelStyle}
        >
          <div className="p-6 md:p-8">
            <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <Link
                    href="/dashboard"
                    className="arena-btn-dark inline-flex px-4 py-2 text-sm"
                  >
                    Back to Cases
                  </Link>
                  <span className="badge badge-outline border-white/15 text-white/80">
                    {caseSession.practiceArea}
                  </span>
                  <span className="badge badge-outline border-white/15 text-white/80">
                    {caseSession.primaryCategory}
                  </span>
                  <span className="badge badge-outline border-white/15 text-white/80">
                    Complexity {caseSession.complexity}
                  </span>
                  <span className="badge badge-outline border-white/15 text-white/80">
                    {sideBadgeLabel}
                  </span>
                </div>
                <h1 className="arena-headline mt-5 max-w-5xl text-4xl uppercase leading-[0.92] md:text-6xl">
                  {caseSession.title}
                </h1>
                <p className="mt-4 max-w-3xl text-white/66">
                  {caseSession.premise.overview}
                </p>
                <div className="mt-6 grid gap-4 text-sm text-white/58 md:grid-cols-3">
                  <div>
                    <p className="arena-kicker">Plaintiff</p>
                    <p className="mt-2 text-base font-semibold text-white">{plaintiffName}</p>
                  </div>
                  <div>
                    <p className="arena-kicker">Defendant</p>
                    <p className="mt-2 text-base font-semibold text-white">{defendantName}</p>
                  </div>
                  <div>
                    <p className="arena-kicker">Court</p>
                    <p className="mt-2 text-base font-semibold text-white">
                      {caseSession.premise.courtName}
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex flex-col items-start gap-3 xl:items-end">
                <span
                  className={`badge border px-3 py-3 arena-status ${
                    statusTone[caseSession.status] || "arena-status-neutral"
                  }`}
                >
                  {isCourtroom ? courtroomRoundLabel : courtroomStageLabel}
                </span>
                <ButtonAccount />
                <div className="arena-surface-soft w-full p-4 text-sm text-white/60 xl:max-w-[18rem]">
                  {isCourtroom ? (
                    <div className="flex items-center gap-3">
                      <div className="flex h-11 w-11 items-center justify-center rounded-full border border-white/12 bg-white/5 text-white">
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
                            d="M12 3v18m0-18 7.5 4.5M12 3 4.5 7.5M19.5 7.5v9L12 21m7.5-13.5L12 12m0 9-7.5-4.5v-9M12 12 4.5 7.5"
                          />
                        </svg>
                      </div>
                      <div>
                        <p className="arena-kicker">You Represent</p>
                        <p className="mt-1 font-semibold text-white">{playerPartyName}</p>
                        <p className="text-sm text-white/55">{sideBadgeLabel.replace(" Side", "")}</p>
                      </div>
                    </div>
                  ) : (
                    <p>
                      You represent <span className="text-white">{playerPartyName}</span> against{" "}
                      <span className="text-white">{opponentPartyName}</span>.
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
          <section className="space-y-6">
            {isInterview ? (
              <div className="arena-surface">
                <div className="p-6">
                  <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_240px]">
                    <div>
                      <p className="arena-kicker">Step 1</p>
                      <h2 className="arena-headline mt-2 text-2xl">
                        Collect your side&apos;s facts
                      </h2>
                      <p className="mt-3 text-sm text-white/62">
                        Interview {playerPartyName} and tighten the record.
                      </p>
                    </div>
                    <div className="arena-surface-soft p-4">
                      <p className="arena-kicker">Tip</p>
                      <p className="mt-3 text-sm leading-7 text-white/68">
                        Ask clear, open-ended questions about dates, records, witnesses, notice,
                        and any gaps in proof.
                      </p>
                    </div>
                  </div>

                  <div
                    ref={interviewTranscriptRef}
                    className="arena-scroll mt-5 max-h-[26rem] space-y-4 overflow-y-auto pr-2"
                  >
                    {visibleInterviewTranscript.map((entry, index) => (
                      <article
                        key={`${entry.createdAt}-${index}`}
                        className={`rounded-xl border p-4 ${
                          entry.role !== "player"
                            ? "arena-transcript-opponent border-amber-500/30"
                            : "arena-transcript-player ml-auto max-w-[90%] border-white/10"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <p className="font-semibold text-white">
                            {entry.role !== "player"
                              ? `Interview: ${entry.speaker}`
                              : entry.speaker}
                          </p>
                          <p className="text-xs text-white/40">
                            {formatDateTime(entry.createdAt)}
                          </p>
                        </div>
                        <p className="mt-2 whitespace-pre-wrap leading-7 text-white">
                          {entry.text}
                        </p>
                      </article>
                    ))}
                    {working && pendingSpeaker && (
                      <article className="arena-transcript-opponent rounded-xl border border-amber-500/30 p-4">
                        <div className="flex items-center justify-between gap-3">
                          <p className="font-semibold text-white">{pendingSpeaker}</p>
                          <span className="loading loading-dots loading-sm" />
                        </div>
                        <p className="mt-2 leading-7 text-white">
                          {pendingSpeaker} is typing...
                        </p>
                      </article>
                    )}
                  </div>

                  <form className="mt-6 space-y-4" onSubmit={handleInterviewSubmit}>
                    <textarea
                      className="textarea textarea-bordered arena-textarea arena-field h-28 w-full text-slate-100"
                      placeholder={`Ask ${playerPartyName} about dates, records, witnesses, notice, or any proof gaps you need to pin down.`}
                      value={question}
                      onChange={(event) => setQuestion(event.target.value)}
                      disabled={transcribingQuestion}
                    />
                    <div className="flex items-center justify-end text-xs uppercase tracking-[0.14em] text-white/38">
                      {question.trim().length} / 500
                    </div>
                    {suggestedQuestions.length > 0 ? (
                      <div>
                        <p className="text-sm text-white/62">Suggested open questions:</p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {suggestedQuestions.map((item) => (
                            <button
                              key={item}
                              type="button"
                              className="arena-btn-dark min-h-0 px-3 py-2 text-sm"
                              onClick={() => setQuestion(item)}
                            >
                              + {item}
                            </button>
                          ))}
                        </div>
                      </div>
                    ) : null}
                    <div className="flex flex-wrap items-center gap-3">
                      <button
                        type="button"
                        className={`border ${
                          recordingQuestion ? "arena-btn-danger" : "arena-btn-dark"
                        } inline-flex items-center gap-2 px-4 py-3`}
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
                        {recordingQuestion
                          ? "Stop Voice Interview"
                          : transcribingQuestion
                          ? "Transcribing"
                          : "Voice Interview"}
                      </button>
                      <button
                        className="arena-btn-light px-6 py-3"
                        disabled={working || recordingQuestion || transcribingQuestion}
                      >
                        {working && <span className="loading loading-spinner loading-xs" />}
                        Continue Intake
                      </button>
                      <button
                        type="button"
                        className="arena-btn-danger ml-auto px-4 py-3"
                        disabled={working || recordingQuestion || transcribingQuestion}
                        onClick={handleExitCase}
                      >
                        Exit Case
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            ) : isExited ? (
              <div className="arena-surface">
                <div className="p-6">
                  <p className="arena-kicker text-rose-300">Case Exited</p>
                  <h2 className="arena-headline mt-2 text-2xl">This intake was closed</h2>
                  <p className="mt-3 max-w-2xl text-white/66">
                    You exited this matter during intake. The same case stays unavailable for
                    24 hours before it can be started again.
                  </p>
                  <div className="mt-5">
                    <Link href="/dashboard" className="arena-btn-light inline-flex px-5 py-3">
                      Back to Cases
                    </Link>
                  </div>
                </div>
              </div>
            ) : (
              <div className="arena-surface arena-round-transition">
                <div className="p-6">
                  <div className="flex items-end justify-between gap-3">
                    <div>
                      <p className="arena-kicker">Step 2</p>
                      <h2 className="arena-headline mt-2 text-2xl">
                        Freeform courtroom duel
                      </h2>
                      <p className="mt-3 text-sm text-white/62">
                        Deliver your argument to the court.
                      </p>
                    </div>
                    <span className="text-xs uppercase tracking-[0.14em] text-white/42">
                      Round {caseSession.score.roundsCompleted + 1} of {caseSession.maxCourtRounds}
                    </span>
                  </div>

                  <div className="mt-5 grid gap-4 md:grid-cols-3">
                    <div className="arena-stat-card">
                      <div className="flex items-center gap-2">
                        <p className="arena-kicker">Your Pressure</p>
                        <InfoDot
                          content={helpText.playerPressure}
                          label="Explain your pressure"
                        />
                      </div>
                      <p className="mt-2 text-3xl font-bold text-white">
                        {caseSession.score.player}
                        <span className="ml-1 text-sm font-medium text-white/42">/ 100</span>
                      </p>
                      <div className="mt-3 arena-progress-track" aria-hidden="true">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-sky-500 to-sky-300"
                          style={{ width: `${playerPressurePct}%` }}
                        />
                      </div>
                      <p className="mt-3 text-sm text-white/62">
                        Build pressure with strong facts and clear arguments.
                      </p>
                    </div>
                    <div className="arena-stat-card">
                      <div className="flex items-center gap-2">
                        <p className="arena-kicker">Opponent Pressure</p>
                        <InfoDot
                          content={helpText.opponentPressure}
                          label="Explain opponent pressure"
                        />
                      </div>
                      <p className="mt-2 text-3xl font-bold text-white">
                        {caseSession.score.opponent}
                        <span className="ml-1 text-sm font-medium text-white/42">/ 100</span>
                      </p>
                      <div className="mt-3 arena-progress-track" aria-hidden="true">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-amber-500 to-amber-300"
                          style={{ width: `${opponentPressurePct}%` }}
                        />
                      </div>
                      <p className="mt-3 text-sm text-white/62">
                        Weaker arguments increase opponent pressure.
                      </p>
                    </div>
                    <div className="arena-stat-card">
                      <p className="arena-kicker">Bench Signal</p>
                      <p className="mt-2 text-sm leading-7 text-white/76">
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
                      <div className="arena-surface-soft p-5">
                        <p className="font-semibold text-white">Court is now in session.</p>
                        <p className="mt-2 text-sm text-white/62">
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
                            <p className="font-semibold text-white">
                              {entry.speaker === "player" ? "You" : opponentPartyName}
                            </p>
                            <p className="text-xs text-white/40">Round {entry.round}</p>
                          </div>
                          <p className="mt-2 whitespace-pre-wrap leading-7 text-white">
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
                                      className="badge badge-outline badge-sm max-w-[18rem] truncate border-white/15 text-white/82"
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
                          <p className="font-semibold text-white">{opponentPartyName}</p>
                          <span className="loading loading-dots loading-sm" />
                        </div>
                        <p className="mt-2 leading-7 text-white">
                          {opponentPartyName} is typing...
                        </p>
                      </article>
                    )}
                  </div>

                  {!isVerdict && (
                    <form className="mt-6 space-y-4" onSubmit={handleCourtroomSubmit}>
                      <div>
                        <p className="arena-kicker">Your Argument</p>
                        <p className="mt-2 text-sm text-white/52">
                          Deliver your argument for {playerPartyName}. Cite the fact sheet,
                          confront the weakest point on {opponentPartyName}&apos;s side, and tie
                          your position to the law.
                        </p>
                      </div>
                      <textarea
                        className="textarea textarea-bordered arena-textarea arena-field h-40 w-full text-slate-100"
                        placeholder={`Deliver your argument for ${playerPartyName}. Cite the fact sheet, confront the weakest point on ${opponentPartyName}'s side, and tie your position to the lawbook.`}
                        value={argument}
                        onChange={(event) => setArgument(event.target.value)}
                        disabled={transcribingArgument}
                      />
                      <div className="flex items-center justify-end text-xs uppercase tracking-[0.14em] text-white/38">
                        {argument.trim().length} / 2500
                      </div>
                      <div>
                        <p className="arena-kicker">Quick Tools</p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <button
                            type="button"
                            className="arena-btn-dark min-h-0 px-3 py-2 text-sm"
                            onClick={() => applyArgumentSnippet("The record shows the key fact is supported by the available evidence.")}
                          >
                            Insert Fact
                          </button>
                          <button
                            type="button"
                            className="arena-btn-dark min-h-0 px-3 py-2 text-sm"
                            onClick={() => applyArgumentSnippet("Under the lawbook, the burden remains on the claimant to prove that point with reliable proof.")}
                          >
                            Cite Law
                          </button>
                          <button
                            type="button"
                            className="arena-btn-dark min-h-0 px-3 py-2 text-sm"
                            onClick={() => applyArgumentSnippet("The timeline matters here: first the notice, then the condition evidence, then the claimed deduction.")}
                          >
                            Use Timeline
                          </button>
                          <button
                            type="button"
                            className="arena-btn-dark min-h-0 px-3 py-2 text-sm"
                            onClick={() => applyArgumentSnippet("The strongest exhibit is the documentary record created closest in time to the disputed events.")}
                          >
                            Add Exhibit
                          </button>
                          <button
                            type="button"
                            className="arena-btn-dark min-h-0 px-3 py-2 text-sm"
                            onClick={() => setArgument("")}
                          >
                            Clear
                          </button>
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-3">
                        <button
                          type="button"
                          className={`border ${
                            recordingArgument
                              ? "arena-btn-danger"
                              : "arena-btn-dark"
                          } inline-flex items-center gap-2 px-4 py-3`}
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
                            : "Voice Argument"}
                        </button>
                        <button
                          className="arena-btn-light ml-auto px-5 py-3"
                          disabled={working || recordingArgument || transcribingArgument}
                        >
                          {working && (
                            <span className="loading loading-spinner loading-xs" />
                          )}
                          Submit Argument
                        </button>
                      </div>
                      <div className="arena-surface-soft flex items-start gap-3 p-4 text-sm text-white/62">
                        <span className="text-amber-300">Tip:</span>
                        <p>Strong arguments are clear, concise, and backed by facts.</p>
                      </div>
                    </form>
                  )}
                </div>
              </div>
            )}

            {(isInterview || isCourtroom) && (
              <div className="arena-surface">
                <details className="group" open>
                  <summary className="list-none cursor-pointer p-6">
                    <div className="flex items-end justify-between gap-3">
                      <div>
                        <p className="arena-kicker">Lawbook</p>
                        <h2 className="arena-headline mt-2 text-2xl">Rules in play</h2>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-xs uppercase tracking-[0.15em] text-white/40">
                          {caseSession.lawbook.length} rules active
                        </span>
                        <span className="text-sm text-white/55 transition group-open:rotate-180">
                          ˅
                        </span>
                      </div>
                    </div>
                  </summary>
                  <div className="px-6 pb-6">
                    <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-4">
                      {caseSession.lawbook.map((rule) => (
                        <article
                          key={rule.id}
                          className="arena-surface-soft flex min-h-[17rem] flex-col p-4"
                        >
                          <p className="font-semibold text-white">{rule.title}</p>
                          <p className="mt-3 flex-1 text-sm leading-6 text-white/66">
                            {rule.principle}
                          </p>
                          <p className="mt-4 text-xs uppercase tracking-[0.15em] text-white/40">
                            {rule.tags.join(" | ")}
                          </p>
                        </article>
                      ))}
                    </div>
                  </div>
                </details>
              </div>
            )}

            {isVerdict && (
              <div className={`arena-surface border ${verdictStyle.card}`}>
                <div className="p-6">
                  <div className="flex flex-wrap items-center gap-3">
                    <p className={`arena-kicker ${verdictStyle.eyebrow}`}>Final Ruling</p>
                    <span className={`badge border arena-status ${verdictStyle.card}`}>
                      {winnerSignal[caseSession.verdict.winner] || winnerSignal.draw}
                    </span>
                  </div>
                  <h2 className="arena-headline mt-2 text-3xl uppercase">
                    {winnerLabel[caseSession.verdict.winner]}
                  </h2>
                  <p className="mt-3 max-w-3xl leading-7 text-white/66">
                    {caseSession.verdict.summary}
                  </p>
                  <div className="mt-5 grid gap-4 md:grid-cols-2">
                    <div className="arena-surface-soft p-4">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-white">What helped your side</p>
                        <InfoDot
                          content={helpText.helpedYourSide}
                          label="Explain what helped your side"
                        />
                      </div>
                      <ul className="mt-3 space-y-2 text-sm text-white/66">
                        {caseSession.verdict.highlights.map((item) => (
                          <li key={item}>- {item}</li>
                        ))}
                      </ul>
                    </div>
                    <div className="arena-surface-soft p-4">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-white">What weakened your side</p>
                        <InfoDot
                          content={helpText.weakenedYourSide}
                          label="Explain what weakened your side"
                        />
                      </div>
                      <ul className="mt-3 space-y-2 text-sm text-white/66">
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
            <div className="arena-surface">
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
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <span className="label-text font-semibold text-white">Case summary</span>
                      <span className="text-xs text-white/38">
                        {countFieldCharacters(factSheetDraft.summary)} / 1000
                      </span>
                    </div>
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
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <span className="label-text font-semibold text-white">Theory</span>
                      <span className="text-xs text-white/38">
                        {countFieldCharacters(factSheetDraft.theory)} / 1000
                      </span>
                    </div>
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

                  {[
                    ["Timeline", "timeline", factSheetDraft.timeline],
                    ["Supporting facts", "supportingFacts", factSheetDraft.supportingFacts],
                    ["Risks", "risks", factSheetDraft.risks],
                    ["Disputed facts", "disputedFacts", factSheetDraft.disputedFacts],
                    ["Corroborated facts", "corroboratedFacts", factSheetDraft.corroboratedFacts],
                    ["Missing evidence / proof gaps", "missingEvidence", factSheetDraft.missingEvidence],
                  ].map(([label, key, value]) => (
                    <label key={key} className="form-control">
                      <div className="mb-2 flex items-center justify-between gap-3">
                        <span className="label-text font-semibold text-white">{label}</span>
                        <span className="text-xs text-white/38">
                          {countListEntries(value)} entries
                        </span>
                      </div>
                      <textarea
                        className="textarea textarea-bordered arena-textarea arena-field h-24 text-slate-100"
                        value={value}
                        onChange={(event) =>
                          setFactSheetDraft((current) => ({
                            ...current,
                            [key]: event.target.value,
                          }))
                        }
                        readOnly={!isInterview}
                      />
                    </label>
                  ))}

                  <label className="form-control">
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <span className="label-text font-semibold text-white">
                        Requested relief
                      </span>
                      <span className="text-xs text-white/38">
                        {countFieldCharacters(factSheetDraft.desiredRelief)} / 1000
                      </span>
                    </div>
                    <textarea
                      className="textarea textarea-bordered arena-textarea arena-field h-20 text-slate-100"
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
                      className="arena-btn-light w-full px-5 py-3"
                      onClick={handleFinalize}
                      disabled={working}
                    >
                      {working && <span className="loading loading-spinner loading-xs" />}
                      Finalize Fact Sheet
                    </button>
                  )}
                </div>
              </div>
            </div>

            {isInterview ? (
              <>
                <div className="arena-surface">
                  <div className="p-6">
                    <p className="arena-kicker">Intake Progress</p>
                    <h2 className="arena-headline mt-2 text-2xl">Build the record</h2>
                    <div className="mt-5 flex items-center gap-4">
                      <div className="radial-progress text-white" style={{ "--value": roundedFactSheetProgressPercent, "--size": "5rem", "--thickness": "0.5rem" }}>
                        {roundedFactSheetProgressPercent}%
                      </div>
                      <div className="text-sm text-white/62">
                        <p className="font-semibold text-white">Next up</p>
                        <p className="mt-1">{nextFactSheetStep}</p>
                        <p className="mt-2">
                          {completedFactSheetItems} of {factSheetCompletionItems.length} draft
                          sections filled.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="arena-surface">
                  <div className="p-6">
                    <p className="arena-kicker">Case Quick Links</p>
                    <div className="mt-5 space-y-3">
                      <a
                        href="#"
                        className="arena-surface-soft flex items-center justify-between px-4 py-3 text-sm text-white/72"
                      >
                        <span>Case details</span>
                        <span className="text-white/35">{caseSession.premise.courtName}</span>
                      </a>
                      <a
                        href="#"
                        className="arena-surface-soft flex items-center justify-between px-4 py-3 text-sm text-white/72"
                      >
                        <span>Opponent</span>
                        <span className="text-white/35">{opponentPartyName}</span>
                      </a>
                      <a
                        href="#"
                        className="arena-surface-soft flex items-center justify-between px-4 py-3 text-sm text-white/72"
                      >
                        <span>Public case feed</span>
                        <span className="text-white/35">{caseSession.primaryCategory}</span>
                      </a>
                    </div>
                  </div>
                </div>
              </>
            ) : isCourtroom ? null : (
              <div className="arena-surface">
                <details className="group" open>
                  <summary className="list-none cursor-pointer p-6">
                    <div className="flex items-end justify-between gap-3">
                      <div>
                        <p className="arena-kicker">Lawbook</p>
                        <h2 className="arena-headline mt-2 text-2xl">Rules in play</h2>
                      </div>
                      <span className="text-sm text-white/55 transition group-open:rotate-180">
                        ˅
                      </span>
                    </div>
                  </summary>
                  <div className="px-6 pb-6">
                    <div className="space-y-3">
                      {caseSession.lawbook.map((rule) => (
                        <article key={rule.id} className="arena-surface-soft p-4">
                          <p className="font-semibold text-white">{rule.title}</p>
                          <p className="mt-2 text-sm leading-6 text-white/66">
                            {rule.principle}
                          </p>
                          <p className="mt-2 text-xs uppercase tracking-[0.15em] text-white/40">
                            {rule.tags.join(" | ")}
                          </p>
                        </article>
                      ))}
                    </div>
                  </div>
                </details>
              </div>
            )}
          </aside>
        </div>
      </section>
    </main>
  );
}
