"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { toast } from "react-hot-toast";
import apiClient from "@/libs/api";
import CaseWorkspace from "./CaseWorkspace";

const statusLabel = {
  pending: "Awaiting acceptance",
  active: "Intake",
  courtroom: "In court",
  verdict: "Verdict",
  declined: "Declined",
  expired: "Expired",
  ready: "Ready for court",
};

const getChallengeRef = (challenge) => challenge.slug || challenge.id;

const getViewerStage = (challenge = {}) => {
  if (challenge.status === "verdict") {
    return "verdict";
  }

  if (challenge.status === "courtroom" && challenge.viewer?.status !== "ready") {
    return "active";
  }

  return challenge.status || "active";
};

const challengeToCaseSession = (challenge = {}) => {
  const viewer = challenge.viewer || {};
  const opponent = challenge.opponent || {};
  const judgedRounds = (challenge.courtroomRounds || []).filter(
    (round) => round.status === "judged"
  );
  const openRound = (challenge.courtroomRounds || []).find(
    (round) => round.status === "open"
  );
  const visibleRounds = [
    ...judgedRounds,
    ...(openRound ? [openRound] : []),
  ];
  const courtroomTranscript = visibleRounds.flatMap((round) =>
    (round.submissions || []).map((submission) => ({
      round: round.round,
      speaker: submission.isViewer ? "player" : "opponent",
      text: submission.text,
      citedFacts: submission.citedFacts || [],
      citedClaimIds: submission.citedClaimIds || [],
      citedRules: submission.citedRules || [],
      judgeNotes: submission.judgeNotes || {},
      createdAt: submission.submittedAt || round.judgedAt || challenge.updatedAt,
    }))
  );
  const verdictWinner =
    viewer.verdict === "win"
      ? "player"
      : viewer.verdict === "loss"
      ? "opponent"
      : viewer.verdict === "draw"
      ? "draw"
      : "";
  const viewerReady = viewer.status === "ready";
  const status =
    challenge.status === "verdict"
      ? "verdict"
      : challenge.status === "courtroom" && viewerReady
      ? "courtroom"
      : ["active", "courtroom"].includes(challenge.status)
      ? "interview"
      : challenge.status || "interview";

  return {
    id: challenge.id,
    slug: getChallengeRef(challenge),
    title: challenge.title,
    caseTemplateId: challenge.templateSnapshot,
    templateSnapshot: challenge.templateSnapshot,
    canonicalStory: challenge.canonicalStory,
    templateSlug: challenge.templateSlug,
    scenarioId: challenge.templateSlug,
    practiceArea: challenge.practiceArea,
    primaryCategory: challenge.primaryCategory,
    complexity: challenge.complexity,
    playerSide: viewer.side,
    status,
    lawbookVersion: challenge.lawbookVersion,
    maxCourtRounds: challenge.maxCourtRounds,
    template: challenge.templateSnapshot,
    lawbook: challenge.lawbook,
    judgeProfile: challenge.judgeProfile,
    premise: {
      clientName: challenge.premise?.clientName,
      opponentName: challenge.premise?.opponentName,
      courtName: challenge.premise?.courtName,
      overview: challenge.premise?.overview || "",
      desiredRelief: viewer.objective || challenge.premise?.desiredRelief || "",
    },
    playerPartyName: viewer.partyName,
    opponentPartyName: opponent.partyName,
    plaintiffName: challenge.premise?.clientName,
    defendantName: challenge.premise?.opponentName,
    interviewTranscript: viewer.interviewTranscript || [],
    factSheet: viewer.factSheet || {},
    caseAssessment: viewer.caseAssessment || {},
    courtroomTranscript,
    score: {
      player: viewer.score || 0,
      opponent: opponent.score || 0,
      roundsCompleted: judgedRounds.length,
      viewerSubmittedCurrentRound: Boolean(openRound?.viewerSubmitted),
      lastBenchSignal:
        judgedRounds[judgedRounds.length - 1]?.benchSummary ||
        openRound?.benchSummary ||
        (openRound?.viewerSubmitted
          ? "Your argument is filed. Waiting for the other player."
          : ""),
      highlights: [],
      weaknesses: [],
    },
    verdict: {
      winner: verdictWinner,
      summary: challenge.verdict?.summary || "",
      highlights: [],
      concerns: [],
      finalScore: {
        player: viewer.score || 0,
        opponent: opponent.score || 0,
      },
    },
  };
};

const OpponentStageNotice = ({ challenge }) => {
  const opponent = challenge.opponent || {};
  const viewerStage = getViewerStage(challenge);
  const openRound = (challenge.courtroomRounds || []).find(
    (round) => round.status === "open"
  );
  const detail =
    viewerStage === "active" && challenge.status === "courtroom"
      ? `${opponent.name} is already in court. Finish intake to join the round.`
      : viewerStage === "active"
      ? opponent.status === "ready"
        ? `${opponent.name} is ready for court.`
        : `${opponent.name} is still in private intake.`
      : viewerStage === "courtroom"
      ? openRound?.viewerSubmitted
        ? `${opponent.name} still needs to file this round.`
        : `${opponent.name} may file this round at any time.`
      : viewerStage === "verdict"
      ? "This challenge is complete."
      : statusLabel[viewerStage] || viewerStage;

  return (
    <div className="arena-surface">
      <div className="p-4 sm:p-6">
        <p className="arena-kicker">PVP Status</p>
        <h2 className="arena-headline mt-2 text-2xl">
          {statusLabel[viewerStage] || viewerStage}
        </h2>
        <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
          <div className="arena-surface-soft p-3">
            <p className="arena-kicker">You</p>
            <p className="mt-1 font-semibold text-white">{challenge.viewer?.name}</p>
            <p className="text-white/60">{challenge.viewer?.score || 0} pts</p>
          </div>
          <div className="arena-surface-soft p-3">
            <p className="arena-kicker">Opponent</p>
            <p className="mt-1 font-semibold text-white">{opponent.name}</p>
            <p className="text-white/60">{opponent.score || 0} pts</p>
          </div>
        </div>
        <p className="mt-4 text-sm leading-6 text-white/70">{detail}</p>
      </div>
    </div>
  );
};

export default function ChallengeWorkspace({ initialChallenge }) {
  const [challenge, setChallenge] = useState(initialChallenge);
  const [busy, setBusy] = useState("");
  const challengeRef = getChallengeRef(challenge);
  const viewer = challenge.viewer || {};
  const isPendingInvite =
    challenge.status === "pending" &&
    String(challenge.challenged?.userId) === String(viewer.userId);

  const caseSession = useMemo(() => challengeToCaseSession(challenge), [challenge]);

  const runAction = async (label, action) => {
    setBusy(label);
    try {
      const response = await action();
      setChallenge(response.challenge);
      return response.challenge;
    } catch (error) {
      toast.error(error?.message || "Challenge action failed.");
      return null;
    } finally {
      setBusy("");
    }
  };

  const acceptChallenge = () =>
    runAction("accept", () => apiClient.post(`/challenges/${challengeRef}/accept`));

  const declineChallenge = () =>
    runAction("decline", () => apiClient.post(`/challenges/${challengeRef}/decline`));

  if (isPendingInvite || ["pending", "declined", "expired"].includes(challenge.status)) {
    return (
      <main className="arena-app-shell min-h-screen px-4 py-6 md:px-8 md:py-10">
        <section className="mx-auto max-w-3xl arena-surface p-6 md:p-8">
          <Link href="/dashboard" className="arena-btn-dark inline-flex px-4 py-2 text-sm">
            Back to Dashboard
          </Link>
          <p className="arena-kicker mt-6">PVP Challenge</p>
          <h1 className="arena-headline mt-2 text-4xl uppercase">{challenge.title}</h1>
          <p className="mt-4 text-base leading-8 text-white/70">
            {challenge.initiator?.name} challenged you to argue{" "}
            {challenge.premise?.clientName} vs. {challenge.premise?.opponentName}.
          </p>
          {isPendingInvite ? (
            <div className="mt-6 flex flex-wrap gap-3">
              <button
                type="button"
                className="arena-btn-light px-5 py-3"
                disabled={Boolean(busy)}
                onClick={acceptChallenge}
              >
                {busy === "accept" ? "Accepting..." : "Accept Challenge"}
              </button>
              <button
                type="button"
                className="arena-btn-danger px-5 py-3"
                disabled={Boolean(busy)}
                onClick={declineChallenge}
              >
                {busy === "decline" ? "Declining..." : "Decline"}
              </button>
            </div>
          ) : (
            <p className="mt-6 text-white/70">
              Status: {statusLabel[challenge.status] || challenge.status}
            </p>
          )}
        </section>
      </main>
    );
  }

  return (
    <CaseWorkspace
      initialCase={caseSession}
      workspaceNotice={<OpponentStageNotice challenge={challenge} />}
      apiConfig={{
        basePath: `/challenges/${challengeRef}`,
        finalizePath: "ready",
        finalizeSuccessMessage:
          viewer.side === "client" || challenge.opponent?.status === "ready"
            ? "Fact sheet finalized. Court is open."
            : "Fact sheet finalized. Waiting for your opponent.",
        intakeLocked: challenge.status === "active" && viewer.status === "ready",
        intakeLockedMessage: `${viewer.name || "You"} are ready for court. Waiting for ${
          challenge.opponent?.name || "the other player"
        } to finish private intake.`,
        exitPath: "quit",
        exitLabel: "Quit Challenge",
        exitPendingLabel: "Quitting...",
        exitConfirm:
          "Quit this PVP challenge? The court will consider revealed rounds so far, and the player who stays receives a staying bonus.",
        exitStaysInWorkspace: true,
        realtimeRefresh: true,
        realtimeRefreshPath: `/challenges/${challengeRef}`,
        realtimeRefreshIntervalMs: 4000,
        courtroomSubmitOnly: true,
        requirePlaintiffOpening: true,
        turnBasedCourtroom: true,
        responseToCase: (response) => {
          if (response?.challenge) {
            setChallenge(response.challenge);
            return challengeToCaseSession(response.challenge);
          }

          return null;
        },
      }}
    />
  );
}
