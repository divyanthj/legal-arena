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

const winnerLabel = {
  player: "You prevailed",
  opponent: "Opposing counsel prevailed",
  draw: "The court called it too close",
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

export default function CaseWorkspace({ initialCase }) {
  const router = useRouter();
  const [caseSession, setCaseSession] = useState(initialCase);
  const [question, setQuestion] = useState("");
  const [argument, setArgument] = useState("");
  const [working, setWorking] = useState(false);
  const [pendingSpeaker, setPendingSpeaker] = useState("");
  const [factSheetDraft, setFactSheetDraft] = useState({
    summary: initialCase.factSheet.summary || "",
    theory: initialCase.factSheet.theory || "",
    desiredRelief: initialCase.factSheet.desiredRelief || "",
    timeline: joinLines(initialCase.factSheet.timeline),
    supportingFacts: joinLines(initialCase.factSheet.supportingFacts),
    risks: joinLines(initialCase.factSheet.risks),
    disputedFacts: joinLines(initialCase.factSheet.disputedFacts),
    corroboratedFacts: joinLines(initialCase.factSheet.corroboratedFacts),
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
  });

  const handleInterviewSubmit = async (event) => {
    event.preventDefault();
    if (!question.trim()) return;

    setWorking(true);
    setPendingSpeaker(getPlayerPartyName(caseSession));

    try {
      const { caseSession: nextCase } = await apiClient.post(
        `/cases/${caseSession.id}/interview`,
        { question }
      );

      setCaseSession(nextCase);
      setQuestion("");
    } catch (error) {
      console.error(error);
    } finally {
      setPendingSpeaker("");
      setWorking(false);
    }
  };

  const handleFinalize = async () => {
    setWorking(true);

    try {
      const { caseSession: nextCase } = await apiClient.post(
        `/cases/${caseSession.id}/finalize`,
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

    setWorking(true);
    setPendingSpeaker(getOpponentPartyName(caseSession));

    try {
      const { caseSession: nextCase } = await apiClient.post(
        `/cases/${caseSession.id}/courtroom`,
        { argument }
      );

      setCaseSession(nextCase);
      setArgument("");
    } catch (error) {
      console.error(error);
    } finally {
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
      await apiClient.post(`/cases/${caseSession.id}/exit`);
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
                <p className="mt-3 text-sm text-primary-content/75">
                  You represent {playerPartyName} against {opponentPartyName}.
                </p>
              </div>

              <div className="flex flex-col items-start gap-3 md:items-end">
                <div className="badge badge-lg badge-outline border-white/25 text-neutral-content">
                  {isExited
                    ? "Exited"
                    : isInterview
                    ? "Client Intake"
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
                    {caseSession.interviewTranscript.map((entry, index) => (
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
                      placeholder={`Ask ${playerPartyName} about documents, dates, witnesses, notice, or any weak spots you need to understand.`}
                      value={question}
                      onChange={(event) => setQuestion(event.target.value)}
                    />
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="text-sm text-base-content/60">
                        Suggested open questions:{" "}
                        {caseSession.factSheet.openQuestions.slice(0, 3).join(" | ")}
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
                          Interview Party
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
                      <p className="text-sm uppercase tracking-[0.2em] text-base-content/45">
                        Your Pressure
                      </p>
                      <p className="mt-2 text-3xl font-bold">
                        {caseSession.score.player}
                      </p>
                    </div>
                    <div className="stat rounded-box bg-base-200">
                      <p className="text-sm uppercase tracking-[0.2em] text-base-content/45">
                        Opponent Pressure
                      </p>
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
                    {caseSession.courtroomTranscript.length === 0 ? (
                      <div className="rounded-box bg-base-200 p-5">
                        <p className="font-semibold">Court is now in session.</p>
                        <p className="mt-2 text-sm text-base-content/70">
                          Open with the strongest version of your theory and anchor
                          it to the lawbook and fact sheet.
                        </p>
                      </div>
                    ) : (
                      caseSession.courtroomTranscript.map((entry, index) => (
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
                                {entry.citedFacts.map((fact) => (
                                  <span
                                    key={fact}
                                    className="badge badge-outline badge-sm"
                                  >
                                    Fact
                                  </span>
                                ))}
                                {entry.citedRules.map((rule) => (
                                  <span
                                    key={rule}
                                    className="badge badge-warning badge-sm"
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
              <div className="card border border-success/30 bg-success/10 shadow-xl">
                <div className="card-body p-6">
                  <p className="text-sm uppercase tracking-[0.25em] text-success">
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
                      <p className="font-semibold text-base-content">What landed</p>
                      <ul className="mt-3 space-y-2 text-sm text-base-content/80">
                        {caseSession.verdict.highlights.map((item) => (
                          <li key={item}>- {item}</li>
                        ))}
                      </ul>
                    </div>
                    <div className="rounded-box bg-base-100/90 p-4">
                      <p className="font-semibold text-base-content">
                        What still hurt
                      </p>
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
