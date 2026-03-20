"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import ButtonAccount from "@/components/ButtonAccount";
import apiClient from "@/libs/api";

const formatDateTime = (value) =>
  new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));

const joinLines = (items = []) => items.join("\n");
const splitLines = (value) =>
  value
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean);

const normalizeCourtroomEntry = (entry = {}) => ({
  ...entry,
  citedFacts: Array.isArray(entry.citedFacts) ? entry.citedFacts : [],
  citedRules: Array.isArray(entry.citedRules) ? entry.citedRules : [],
  citedClaimIds: Array.isArray(entry.citedClaimIds) ? entry.citedClaimIds : [],
});

const winnerLabel = {
  player: "You prevailed",
  opponent: "Opposing counsel prevailed",
  draw: "The court called it too close",
};

const verdictTone = {
  player: {
    card: "border-success/30 bg-success/10",
    eyebrow: "text-success",
  },
  opponent: {
    card: "border-error/30 bg-error/10",
    eyebrow: "text-error",
  },
  draw: {
    card: "border-warning/30 bg-warning/10",
    eyebrow: "text-warning",
  },
};

const ruleExplainers = {
  "burden-of-proof":
    "This rule tracks who had to prove the point at issue and whether the record actually met that burden.",
  "reliable-records":
    "This rule rewards records and concrete documentation over speculation, rough memory, or unsupported estimates.",
  "presumption-and-proof":
    "This rule measures whether the argument overcame the starting presumption with actual proof rather than inference alone.",
  "ordinary-wear-vs-damage":
    "This rule focuses on whether the condition described sounds like routine use or chargeable damage.",
  "notice-and-fair-warning":
    "This rule looks at whether the other side received clear notice of the claimed basis, charges, or theory.",
  "proportional-remedy":
    "This rule asks whether the requested outcome matches what the record actually supports.",
  "credibility-under-pressure":
    "This rule weighs whether the witness's story stayed believable once pressed on specifics and weak spots.",
};

const helpText = {
  playerPressure:
    "Your pressure is the strength your side has built with the court so far. Higher usually means your arguments are landing more effectively.",
  opponentPressure:
    "Opponent pressure is the force the other side is building against you. Higher means the court is currently finding their position more persuasive.",
  helpedYourSide:
    "These are the points the court thought genuinely helped your side's argument or credibility.",
  weakenedYourSide:
    "These are the gaps, mistakes, or unresolved issues the court thought weakened your side.",
  factsUsed:
    "These badges mark facts your argument relied on. Hover to see the specific fact that was picked up from the record.",
  rulesUsed:
    "These badges mark lawbook concepts the round appears to have engaged. Hover to see what each one means.",
};

const InfoDot = ({ content, label }) => (
  <span
    className="inline-flex cursor-pointer items-center justify-center text-base-content/55 transition hover:text-base-content"
    data-tooltip-id="tooltip"
    data-tooltip-content={content}
    aria-label={label || "More information"}
    tabIndex={0}
  >
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
      className="h-4 w-4"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="m11.25 11.25.041-.02a.75.75 0 0 1 1.063.852l-.708 2.836a.75.75 0 0 0 1.063.853l.041-.021M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9-3.75h.008v.008H12V8.25Z"
      />
    </svg>
  </span>
);

const getRuleTooltip = (rule) =>
  ruleExplainers[rule] ||
  `${rule
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ")} is one of the lawbook lenses the court used to evaluate this round.`;

const normalizeFactKey = (value = "") => String(value || "").trim().toLowerCase();

const buildCanonicalFactLookup = (caseSession) =>
  new Map(
    ((caseSession.template && caseSession.template.canonicalFacts) || []).flatMap((fact) => {
      const key = normalizeFactKey(fact.factId);
      if (!key) return [];
      return [[key, fact]];
    })
  );

const resolveFactReference = (factReference, canonicalFactLookup) => {
  const trimmed = String(factReference || "").trim();
  if (!trimmed) {
    return {
      badge: "Fact",
      tooltip: helpText.factsUsed,
    };
  }

  const canonicalFact = canonicalFactLookup.get(normalizeFactKey(trimmed));

  if (canonicalFact) {
    return {
      badge: "Fact",
      tooltip:
        canonicalFact.canonicalDetail ||
        canonicalFact.label ||
        trimmed,
    };
  }

  return {
    badge: "Fact",
    tooltip: trimmed,
  };
};

const getPlayerPartyName = (caseSession) =>
  caseSession.playerPartyName ||
  (caseSession.playerSide === "opponent"
    ? caseSession.premise.opponentName
    : caseSession.premise.clientName);

const getOpponentPartyName = (caseSession) =>
  caseSession.opponentPartyName ||
  (caseSession.playerSide === "opponent"
    ? caseSession.premise.clientName
    : caseSession.premise.opponentName);

const getPlaintiffName = (caseSession) =>
  caseSession.plaintiffName || caseSession.premise.clientName;

const getDefendantName = (caseSession) =>
  caseSession.defendantName || caseSession.premise.opponentName;

const getCaseRouteRef = (caseSession) => caseSession.slug || caseSession.id;

export default function CaseWorkspace({ initialCase }) {
  const router = useRouter();
  const [caseSession, setCaseSession] = useState(initialCase);
  const [question, setQuestion] = useState("");
  const [argument, setArgument] = useState("");
  const [working, setWorking] = useState(false);
  const [pendingSpeaker, setPendingSpeaker] = useState("");
  const [optimisticTranscriptEntry, setOptimisticTranscriptEntry] = useState(null);
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

  const isInterview = caseSession.status === "interview";
  const isVerdict = caseSession.status === "verdict";
  const isExited = caseSession.status === "exited";
  const playerPartyName = getPlayerPartyName(caseSession);
  const opponentPartyName = getOpponentPartyName(caseSession);
  const plaintiffName = getPlaintiffName(caseSession);
  const defendantName = getDefendantName(caseSession);
  const sideBadgeLabel =
    caseSession.playerSide === "opponent" ? "Defendant Side" : "Plaintiff Side";
  const verdictStyle =
    verdictTone[caseSession.verdict?.winner] || verdictTone.draw;
  const canonicalFactLookup = buildCanonicalFactLookup(caseSession);

  return (
    <main className="min-h-screen bg-base-200 px-4 py-6 md:px-8 md:py-10">
      <section className="mx-auto max-w-7xl space-y-6">
        <div className="card border border-base-300 bg-neutral text-neutral-content shadow-2xl">
          <div className="card-body p-6 md:p-8">
            <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
              <div className="max-w-3xl">
                <div className="flex flex-wrap items-center gap-2">
                  <Link
                    href="/dashboard"
                    className="btn btn-ghost btn-sm text-neutral-content"
                  >
                    Back to Cases
                  </Link>
                  <span className="badge badge-outline border-primary/40 text-neutral-content">
                    {caseSession.practiceArea}
                  </span>
                  <span className="badge badge-outline border-primary/40 text-neutral-content">
                    {caseSession.primaryCategory}
                  </span>
                  <span className="badge badge-outline border-primary/40 text-neutral-content">
                    Complexity {caseSession.complexity}
                  </span>
                  <span className="badge badge-outline border-primary/40 text-neutral-content">
                    {sideBadgeLabel}
                  </span>
                </div>
                <h1 className="mt-4 font-serif text-4xl leading-tight md:text-5xl">
                  {caseSession.title}
                </h1>
                <p className="mt-3 max-w-2xl text-neutral-content/75">
                  {caseSession.premise.overview}
                </p>
                <div className="mt-4 flex flex-wrap gap-4 text-sm text-neutral-content/70">
                  <span>Plaintiff: {plaintiffName}</span>
                  <span>vs.</span>
                  <span>Defendant: {defendantName}</span>
                  <span>{caseSession.premise.courtName}</span>
                </div>
                <p className="mt-3 text-sm text-neutral-content/75">
                  You represent {playerPartyName} against {opponentPartyName}.
                </p>
              </div>

              <div className="flex flex-col items-start gap-3 md:items-end">
                <div className="badge badge-lg badge-outline border-white/25 text-neutral-content">
                  {isExited
                    ? "Exited"
                    : isInterview
                    ? "Party Intake"
                    : isVerdict
                      ? "Verdict"
                      : `Courtroom Round ${caseSession.score.roundsCompleted + 1}`}
                </div>
                <ButtonAccount />
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
          <section className="space-y-6">
            {isInterview ? (
              <div className="card border border-base-300 bg-base-100 shadow-xl">
                <div className="card-body p-6">
                  <div className="flex items-end justify-between gap-3">
                    <div>
                      <p className="text-sm uppercase tracking-[0.25em] text-base-content/50">
                        Step 1
                      </p>
                      <h2 className="mt-2 text-2xl font-bold">
                        Collect your side&apos;s facts
                      </h2>
                    </div>
                    <span className="text-sm text-base-content/55">
                      Interview {playerPartyName} and refine the case file.
                    </span>
                  </div>

                  <div className="mt-5 space-y-4">
                    {visibleInterviewTranscript.map((entry, index) => (
                      <article
                        key={`${entry.createdAt}-${index}`}
                        className={`rounded-box p-4 ${
                          entry.role !== "player"
                            ? "bg-base-200"
                            : "ml-auto max-w-[90%] bg-primary/10"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <p className="font-semibold">{entry.speaker}</p>
                          <p className="text-xs text-base-content/45">
                            {formatDateTime(entry.createdAt)}
                          </p>
                        </div>
                        <p className="mt-2 whitespace-pre-wrap leading-7">
                          {entry.text}
                        </p>
                      </article>
                    ))}
                    {working && pendingSpeaker && (
                      <article className="rounded-box bg-base-200 p-4">
                        <div className="flex items-center justify-between gap-3">
                          <p className="font-semibold">{pendingSpeaker}</p>
                          <span className="loading loading-dots loading-sm" />
                        </div>
                        <p className="mt-2 leading-7">{pendingSpeaker} is typing...</p>
                      </article>
                    )}
                  </div>

                  <form className="mt-6 space-y-3" onSubmit={handleInterviewSubmit}>
                    <textarea
                      className="textarea textarea-bordered h-32 w-full"
                      placeholder={`Ask ${playerPartyName} about dates, records, witnesses, notice, or any proof gaps you need to pin down.`}
                      value={question}
                      onChange={(event) => setQuestion(event.target.value)}
                    />
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="space-y-1 text-sm text-base-content/60">
                        <div>
                          Suggested open questions:{" "}
                          {(caseSession.factSheet.openQuestions || [])
                            .slice(0, 3)
                            .join(" | ")}
                        </div>
                        {caseSession.factSheet.missingEvidence?.length > 0 && (
                          <div>
                            Proof gaps:{" "}
                            {caseSession.factSheet.missingEvidence
                              .slice(0, 2)
                              .join(" | ")}
                          </div>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          className="btn btn-ghost text-error"
                          disabled={working}
                          onClick={handleExitCase}
                        >
                          Exit Case
                        </button>
                        <button className="btn btn-primary" disabled={working}>
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
              <div className="card border border-warning/30 bg-warning/10 shadow-xl">
                <div className="card-body p-6">
                  <p className="text-sm uppercase tracking-[0.25em] text-warning">
                    Case Exited
                  </p>
                  <h2 className="mt-2 text-2xl font-bold">This intake was closed</h2>
                  <p className="mt-3 max-w-2xl text-base-content/80">
                    You exited this matter during the interview stage. The same case
                    stays unavailable for 24 hours before it can be started again.
                  </p>
                  <div className="mt-5">
                    <Link href="/dashboard" className="btn btn-primary">
                      Back to Cases
                    </Link>
                  </div>
                </div>
              </div>
            ) : (
              <div className="card border border-base-300 bg-base-100 shadow-xl">
                <div className="card-body p-6">
                  <div className="flex items-end justify-between gap-3">
                    <div>
                      <p className="text-sm uppercase tracking-[0.25em] text-base-content/50">
                        Step 2
                      </p>
                      <h2 className="mt-2 text-2xl font-bold">
                        Freeform courtroom duel
                      </h2>
                    </div>
                    <span className="text-sm text-base-content/55">
                      Round {caseSession.score.roundsCompleted} of{" "}
                      {caseSession.maxCourtRounds}
                    </span>
                  </div>

                  <div className="mt-5 grid gap-4 md:grid-cols-3">
                    <div className="stat rounded-box bg-base-200">
                      <div className="flex items-center gap-2">
                        <p className="text-sm uppercase tracking-[0.2em] text-base-content/45">
                          Your Pressure
                        </p>
                        <InfoDot
                          content={helpText.playerPressure}
                          label="Explain your pressure"
                        />
                      </div>
                      <p className="mt-2 text-3xl font-bold">
                        {caseSession.score.player}
                      </p>
                    </div>
                    <div className="stat rounded-box bg-base-200">
                      <div className="flex items-center gap-2">
                        <p className="text-sm uppercase tracking-[0.2em] text-base-content/45">
                          Opponent Pressure
                        </p>
                        <InfoDot
                          content={helpText.opponentPressure}
                          label="Explain opponent pressure"
                        />
                      </div>
                      <p className="mt-2 text-3xl font-bold">
                        {caseSession.score.opponent}
                      </p>
                    </div>
                    <div className="rounded-box bg-primary/10 p-4">
                      <p className="text-sm uppercase tracking-[0.2em] text-base-content/45">
                        Bench Signal
                      </p>
                      <p className="mt-2 text-sm leading-6">
                        {caseSession.score.lastBenchSignal ||
                          "The bench is listening. Build the record carefully."}
                      </p>
                    </div>
                  </div>

                  <div className="mt-5 space-y-4">
                    {normalizedCourtroomTranscript.length === 0 ? (
                      <div className="rounded-box bg-base-200 p-5">
                        <p className="font-semibold">Court is now in session.</p>
                        <p className="mt-2 text-sm text-base-content/70">
                          Open with the strongest version of your theory and anchor
                          it to the lawbook and fact sheet.
                        </p>
                      </div>
                    ) : (
                      normalizedCourtroomTranscript.map((entry, index) => (
                        <article
                          key={`${entry.round}-${entry.speaker}-${index}`}
                          className={`rounded-box p-4 ${
                            entry.speaker === "player"
                              ? "ml-auto max-w-[95%] bg-primary/10"
                              : "bg-base-200"
                          }`}
                        >
                          <div className="flex items-center justify-between gap-3">
                            <p className="font-semibold">
                              {entry.speaker === "player"
                                ? "You"
                                : opponentPartyName}
                            </p>
                            <p className="text-xs text-base-content/45">
                              Round {entry.round}
                            </p>
                          </div>
                          <p className="mt-2 whitespace-pre-wrap leading-7">
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
                                      className="badge badge-outline badge-sm max-w-[18rem] truncate"
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
                                    className="badge badge-warning badge-sm"
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
                      <article className="rounded-box bg-base-200 p-4">
                        <div className="flex items-center justify-between gap-3">
                          <p className="font-semibold">{opponentPartyName}</p>
                          <span className="loading loading-dots loading-sm" />
                        </div>
                        <p className="mt-2 leading-7">{opponentPartyName} is typing...</p>
                      </article>
                    )}
                  </div>

                  {!isVerdict && (
                    <form className="mt-6 space-y-3" onSubmit={handleCourtroomSubmit}>
                    <textarea
                      className="textarea textarea-bordered h-40 w-full"
                      placeholder={`Deliver your argument for ${playerPartyName}. Cite the fact sheet, confront the weakest point on ${opponentPartyName}'s side, and tie your position to the lawbook.`}
                      value={argument}
                      onChange={(event) => setArgument(event.target.value)}
                    />
                      <div className="flex items-center justify-end">
                        <button className="btn btn-primary" disabled={working}>
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
              <div className={`card border shadow-xl ${verdictStyle.card}`}>
                <div className="card-body p-6">
                  <p
                    className={`text-sm uppercase tracking-[0.25em] ${verdictStyle.eyebrow}`}
                  >
                    Final Ruling
                  </p>
                  <h2 className="mt-2 text-3xl font-bold text-base-content">
                    {winnerLabel[caseSession.verdict.winner]}
                  </h2>
                  <p className="mt-3 max-w-3xl leading-7 text-base-content/80">
                    {caseSession.verdict.summary}
                  </p>
                  <div className="mt-5 grid gap-4 md:grid-cols-2">
                    <div className="rounded-box bg-base-100/90 p-4">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-base-content">
                          What Helped Your Side
                        </p>
                        <InfoDot
                          content={helpText.helpedYourSide}
                          label="Explain what helped your side"
                        />
                      </div>
                      <ul className="mt-3 space-y-2 text-sm text-base-content/80">
                        {caseSession.verdict.highlights.map((item) => (
                          <li key={item}>- {item}</li>
                        ))}
                      </ul>
                    </div>
                    <div className="rounded-box bg-base-100/90 p-4">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-base-content">
                          What Weakened Your Side
                        </p>
                        <InfoDot
                          content={helpText.weakenedYourSide}
                          label="Explain what weakened your side"
                        />
                      </div>
                      <ul className="mt-3 space-y-2 text-sm text-base-content/80">
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
            <div className="card border border-base-300 bg-base-100 shadow-xl">
              <div className="card-body p-6">
                <div className="flex items-end justify-between gap-3">
                  <div>
                    <p className="text-sm uppercase tracking-[0.25em] text-base-content/50">
                      Fact Sheet
                    </p>
                    <h2 className="mt-2 text-2xl font-bold">Case file</h2>
                  </div>
                  <span className="badge badge-outline">
                    {caseSession.factSheet.ready ? "Court-ready" : "Draft"}
                  </span>
                </div>

                <div className="mt-5 space-y-4">
                  <label className="form-control">
                    <span className="label-text font-semibold">Case summary</span>
                    <textarea
                      className="textarea textarea-bordered h-24"
                      value={factSheetDraft.summary}
                      onChange={(event) =>
                        setFactSheetDraft((current) => ({
                          ...current,
                          summary: event.target.value,
                        }))
                      }
                      disabled={!isInterview}
                    />
                  </label>

                  <label className="form-control">
                    <span className="label-text font-semibold">Theory</span>
                    <textarea
                      className="textarea textarea-bordered h-24"
                      value={factSheetDraft.theory}
                      onChange={(event) =>
                        setFactSheetDraft((current) => ({
                          ...current,
                          theory: event.target.value,
                        }))
                      }
                      disabled={!isInterview}
                    />
                  </label>

                  <label className="form-control">
                    <span className="label-text font-semibold">Timeline</span>
                    <textarea
                      className="textarea textarea-bordered h-28"
                      value={factSheetDraft.timeline}
                      onChange={(event) =>
                        setFactSheetDraft((current) => ({
                          ...current,
                          timeline: event.target.value,
                        }))
                      }
                      disabled={!isInterview}
                    />
                  </label>

                  <label className="form-control">
                    <span className="label-text font-semibold">Supporting facts</span>
                    <textarea
                      className="textarea textarea-bordered h-32"
                      value={factSheetDraft.supportingFacts}
                      onChange={(event) =>
                        setFactSheetDraft((current) => ({
                          ...current,
                          supportingFacts: event.target.value,
                        }))
                      }
                      disabled={!isInterview}
                    />
                  </label>

                  <label className="form-control">
                    <span className="label-text font-semibold">Risks</span>
                    <textarea
                      className="textarea textarea-bordered h-24"
                      value={factSheetDraft.risks}
                      onChange={(event) =>
                        setFactSheetDraft((current) => ({
                          ...current,
                          risks: event.target.value,
                        }))
                      }
                      disabled={!isInterview}
                    />
                  </label>

                  <label className="form-control">
                    <span className="label-text font-semibold">Disputed facts</span>
                    <textarea
                      className="textarea textarea-bordered h-24"
                      value={factSheetDraft.disputedFacts}
                      onChange={(event) =>
                        setFactSheetDraft((current) => ({
                          ...current,
                          disputedFacts: event.target.value,
                        }))
                      }
                      disabled={!isInterview}
                    />
                  </label>

                  <label className="form-control">
                    <span className="label-text font-semibold">Corroborated facts</span>
                    <textarea
                      className="textarea textarea-bordered h-24"
                      value={factSheetDraft.corroboratedFacts}
                      onChange={(event) =>
                        setFactSheetDraft((current) => ({
                          ...current,
                          corroboratedFacts: event.target.value,
                        }))
                      }
                      disabled={!isInterview}
                    />
                  </label>

                  <label className="form-control">
                    <span className="label-text font-semibold">
                      Missing evidence / proof gaps
                    </span>
                    <textarea
                      className="textarea textarea-bordered h-24"
                      value={factSheetDraft.missingEvidence}
                      onChange={(event) =>
                        setFactSheetDraft((current) => ({
                          ...current,
                          missingEvidence: event.target.value,
                        }))
                      }
                      disabled={!isInterview}
                    />
                  </label>

                  <label className="form-control">
                    <span className="label-text font-semibold">Requested relief</span>
                    <textarea
                      className="textarea textarea-bordered h-20"
                      value={factSheetDraft.desiredRelief}
                      onChange={(event) =>
                        setFactSheetDraft((current) => ({
                          ...current,
                          desiredRelief: event.target.value,
                        }))
                      }
                      disabled={!isInterview}
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

            <div className="card border border-base-300 bg-base-100 shadow-xl">
              <div className="card-body p-6">
                <p className="text-sm uppercase tracking-[0.25em] text-base-content/50">
                  Lawbook
                </p>
                <h2 className="mt-2 text-2xl font-bold">Rules in play</h2>
                <div className="mt-5 space-y-3">
                  {caseSession.lawbook.map((rule) => (
                    <article key={rule.id} className="rounded-box bg-base-200 p-4">
                      <p className="font-semibold">{rule.title}</p>
                      <p className="mt-2 text-sm leading-6 text-base-content/75">
                        {rule.principle}
                      </p>
                      <p className="mt-2 text-xs uppercase tracking-[0.15em] text-base-content/45">
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
