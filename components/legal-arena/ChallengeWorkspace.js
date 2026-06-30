"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import * as HeroIcons from "@heroicons/react/24/outline";
import { toast } from "react-hot-toast";
import apiClient from "@/libs/api";
import { trackGoal } from "@/libs/datafast";
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

const sideRoleLabel = (side) => (side === "opponent" ? "Defendant" : "Plaintiff");

const uniqueTextList = (items = []) => {
  const seen = new Set();

  return items
    .map((item) => String(item || "").trim())
    .filter(Boolean)
    .filter((item) => {
      const key = item.toLowerCase();
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
};

const escapeRegExp = (value = "") =>
  String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const replaceOwnSideSubject = (text = "", ownSubjects = []) => {
  let nextText = String(text || "").trim();

  ownSubjects.filter(Boolean).forEach((subject) => {
    const pattern = new RegExp(`(^|[-–—]\\s*)${escapeRegExp(subject)}\\b`, "i");
    nextText = nextText.replace(pattern, (match, prefix = "") => `${prefix}You`);
  });

  return nextText.replace(/^You\s+(kept|clearly|relied|correctly|tied|focused|continued|argued|anchored|engaged|identified|addressed|pressed|showed|used)\b/i, (match, verb) => `You ${verb}`);
};

const normalizeFeedbackForViewer = ({ items = [], viewer = {} }) => {
  const ownSideLabel = viewer.side === "opponent" ? "Defendant" : "Plaintiff";
  const ownSubjects = [
    ownSideLabel,
    "The player",
    viewer.partyName,
    viewer.name,
    viewer.partyName ? `Counsel for ${viewer.partyName}` : "",
    viewer.name ? `Counsel for ${viewer.name}` : "",
  ];

  return uniqueTextList(items.map((item) => replaceOwnSideSubject(item, ownSubjects)));
};

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
  const viewerJudgedSubmissions = judgedRounds
    .flatMap((round) => round.submissions || [])
    .filter((submission) => submission.isViewer);
  const opponentJudgedSubmissions = judgedRounds
    .flatMap((round) => round.submissions || [])
    .filter((submission) => !submission.isViewer);
  const viewerStrengths = normalizeFeedbackForViewer({
    viewer,
    items:
    viewerJudgedSubmissions.flatMap((submission) => submission.judgeNotes?.strengths || [])
  }).slice(0, 5);
  const viewerWeaknesses = normalizeFeedbackForViewer({
    viewer,
    items:
    viewerJudgedSubmissions.flatMap((submission) => submission.judgeNotes?.weaknesses || [])
  }).slice(0, 5);
  const opponentStrengths = uniqueTextList(
    opponentJudgedSubmissions.flatMap((submission) => submission.judgeNotes?.strengths || [])
  ).slice(0, 5);
  const opponentWeaknesses = uniqueTextList(
    opponentJudgedSubmissions.flatMap((submission) => submission.judgeNotes?.weaknesses || [])
  ).slice(0, 5);
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
    playerInterviewSubjectName: viewer.interviewSubjectName || viewer.partyName,
    playerInterviewSubjectRole: viewer.interviewSubjectRole || "",
    opponentInterviewSubjectName: opponent.interviewSubjectName || opponent.partyName,
    opponentInterviewSubjectRole: opponent.interviewSubjectRole || "",
    playerCounselName: viewer.name,
    opponentCounselName: opponent.name,
    clientMemoryExcerpt: viewer.clientMemoryExcerpt || "",
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
        "",
      highlights: viewerStrengths,
      weaknesses: viewerWeaknesses,
    },
    verdict: {
      winner: verdictWinner,
      summary: challenge.verdict?.summary || "",
      highlights:
        viewer.verdict === "loss" && opponentWeaknesses.length
          ? opponentWeaknesses
          : viewerStrengths,
      concerns:
        viewer.verdict === "win" && opponentStrengths.length
          ? opponentStrengths
          : viewerWeaknesses,
      finalScore: {
        player: viewer.score || 0,
        opponent: opponent.score || 0,
      },
    },
  };
};

const OpponentStageNotice = ({ challenge }) => {
  const opponent = challenge.opponent || {};
  const viewer = challenge.viewer || {};
  const viewerRole = sideRoleLabel(viewer.side);
  const opponentRole = sideRoleLabel(opponent.side);
  const viewerParty = viewer.partyName || viewerRole;
  const opponentParty = opponent.partyName || opponentRole;
  const viewerStage = getViewerStage(challenge);
  const openRound = (challenge.courtroomRounds || []).find(
    (round) => round.status === "open"
  );
  const detail =
    viewerStage === "active" && challenge.status === "courtroom"
      ? `${opponent.name} is already in court for ${opponentParty}. Finish intake for ${viewerParty} to join the round.`
      : viewerStage === "active"
      ? opponent.status === "ready"
        ? `${opponent.name} is ready for court as counsel for ${opponentParty}.`
        : `${opponent.name} is still in private intake for ${opponentParty}.`
      : viewerStage === "courtroom"
      ? openRound?.viewerSubmitted
        ? `${opponent.name} still needs to file for ${opponentParty} this round.`
        : `${opponent.name} may file for ${opponentParty} at any time.`
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
            <p className="mt-1 font-semibold text-white">{viewer.name}</p>
            <p className="mt-1 text-xs font-semibold text-sky-100">
              {viewerRole}: {viewerParty}
            </p>
            <p className="mt-1 text-white/60">{viewer.score || 0} pts</p>
          </div>
          <div className="arena-surface-soft p-3">
            <p className="arena-kicker">Opponent</p>
            <p className="mt-1 font-semibold text-white">{opponent.name}</p>
            <p className="mt-1 text-xs font-semibold text-rose-100">
              {opponentRole}: {opponentParty}
            </p>
            <p className="mt-1 text-white/60">{opponent.score || 0} pts</p>
          </div>
        </div>
        <p className="mt-4 text-sm leading-6 text-white/70">{detail}</p>
      </div>
    </div>
  );
};

const ChallengeActionOverlay = ({ action, challengerName }) => {
  const isDeclining = action === "decline";
  const title = isDeclining ? "Declining challenge" : "Opening private intake";
  const detail = isDeclining
    ? "Notifying the other player and clearing this docket from your queue."
    : `${challengerName || "Your opponent"} is being seated. Preparing your confidential case file.`;

  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center rounded-[1.75rem] bg-black/72 p-5 backdrop-blur-md">
      <div
        className="w-full max-w-md arena-surface-soft p-5 text-center shadow-2xl"
        role="status"
        aria-live="polite"
      >
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border border-amber-200/28 bg-amber-200/12 text-amber-100">
          {isDeclining ? (
            <HeroIcons.XMarkIcon className="h-8 w-8" aria-hidden="true" />
          ) : (
            <span className="arena-presenting-gavel" aria-hidden="true">
              <svg viewBox="0 0 48 48" className="arena-presenting-gavel-icon" focusable="false">
                <g className="arena-presenting-gavel-swing">
                  <rect x="8" y="10" width="18" height="8" rx="2.5" fill="currentColor" />
                  <rect x="5" y="8" width="7" height="12" rx="2" fill="currentColor" opacity="0.88" />
                  <rect x="23" y="8" width="7" height="12" rx="2" fill="currentColor" opacity="0.88" />
                  <rect
                    x="23"
                    y="19"
                    width="23"
                    height="6"
                    rx="3"
                    fill="currentColor"
                    transform="rotate(43 23 19)"
                  />
                </g>
                <ellipse cx="14" cy="39" rx="12" ry="3.2" fill="currentColor" opacity="0.42" />
                <rect x="5" y="34" width="18" height="5" rx="2.5" fill="currentColor" opacity="0.58" />
              </svg>
            </span>
          )}
        </div>
        <p className="arena-kicker mt-5">{isDeclining ? "Closing notice" : "Challenge accepted"}</p>
        <h2 className="arena-headline mt-2 text-2xl uppercase">{title}</h2>
        <p className="mx-auto mt-3 max-w-sm text-sm leading-6 text-white/68">{detail}</p>
        <div className="mt-5 h-1.5 overflow-hidden rounded-full bg-white/10">
          <div className="arena-loading-bar h-full w-1/3 rounded-full bg-amber-300/90" />
        </div>
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
    trackGoal(`pvp_challenge_${label}_started`, {
      status: challenge.status,
      category: challenge.primaryCategory,
      side: viewer.side,
    });
    try {
      const response = await action();
      setChallenge(response.challenge);
      trackGoal(`pvp_challenge_${label}_completed`, {
        status: response.challenge?.status,
        category: response.challenge?.primaryCategory || challenge.primaryCategory,
        side: response.challenge?.viewer?.side || viewer.side,
      });
      return response.challenge;
    } catch (error) {
      trackGoal(`pvp_challenge_${label}_failed`, {
        status: challenge.status,
        category: challenge.primaryCategory,
        side: viewer.side,
      });
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
        <section
          className="relative mx-auto max-w-4xl overflow-hidden arena-surface p-6 md:p-8"
          aria-busy={Boolean(busy)}
        >
          {busy ? (
            <ChallengeActionOverlay action={busy} challengerName={challenge.initiator?.name} />
          ) : null}
          <div className="relative z-10">
            <Link href="/dashboard" className="arena-btn-dark inline-flex items-center gap-2 px-4 py-2 text-sm">
              <HeroIcons.ArrowLeftIcon className="h-4 w-4" aria-hidden="true" />
              Back to Dashboard
            </Link>
            <div className="mt-6 flex flex-wrap items-center gap-2">
              <span className="arena-pill px-3 py-1 text-xs font-semibold">PVP Challenge</span>
              <span className="arena-status-caution rounded-full px-3 py-1 text-xs font-semibold">
                {statusLabel[challenge.status] || challenge.status}
              </span>
            </div>
            <h1 className="arena-headline mt-4 text-4xl uppercase md:text-5xl">{challenge.title}</h1>
            <p className="mt-4 max-w-2xl text-base leading-8 text-white/70">
              {challenge.initiator?.name} challenged you to argue{" "}
              {challenge.premise?.clientName} vs. {challenge.premise?.opponentName}.
            </p>
            <div className="mt-6 grid gap-3 md:grid-cols-3">
              <div className="arena-surface-soft p-4">
                <p className="arena-kicker">Challenger</p>
                <p className="mt-2 font-semibold text-white">{challenge.initiator?.name || "Opponent"}</p>
              </div>
              <div className="arena-surface-soft p-4">
                <p className="arena-kicker">Matter</p>
                <p className="mt-2 font-semibold text-white">
                  {challenge.premise?.clientName || "Client"} vs.{" "}
                  {challenge.premise?.opponentName || "Opponent"}
                </p>
              </div>
              <div className="arena-surface-soft p-4">
                <p className="arena-kicker">Your seat</p>
                <p className="mt-2 font-semibold text-white">
                  {viewer.partyName || viewer.side || "Counsel"}
                </p>
              </div>
            </div>
          </div>
          {isPendingInvite ? (
            <div className="relative z-10 mt-6 flex flex-wrap gap-3">
              <button
                type="button"
                className="arena-btn-light inline-flex items-center gap-2 px-5 py-3 disabled:cursor-wait disabled:opacity-80"
                disabled={Boolean(busy)}
                onClick={acceptChallenge}
              >
                <HeroIcons.CheckCircleIcon className="h-5 w-5" aria-hidden="true" />
                {busy === "accept" ? "Accepting..." : "Accept Challenge"}
              </button>
              <button
                type="button"
                className="arena-btn-danger inline-flex items-center gap-2 px-5 py-3 disabled:cursor-wait disabled:opacity-70"
                disabled={Boolean(busy)}
                onClick={declineChallenge}
              >
                <HeroIcons.XCircleIcon className="h-5 w-5" aria-hidden="true" />
                {busy === "decline" ? "Declining..." : "Decline"}
              </button>
            </div>
          ) : (
            <p className="relative z-10 mt-6 text-white/70">
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
        analyticsMode: "pvp",
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
        counselLabels: true,
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
