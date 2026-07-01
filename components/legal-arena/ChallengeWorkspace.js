"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import * as HeroIcons from "@heroicons/react/24/outline";
import { toast } from "react-hot-toast";
import apiClient from "@/libs/api";
import { trackGoal } from "@/libs/datafast";
import CaseWorkspace from "./CaseWorkspace";

const statusLabel = {
  pending: "Awaiting acceptance",
  active: "Intake",
  settlement: "Settlement",
  settled: "Settled",
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
  if (challenge.status === "settled") {
    return "settled";
  }
  if (challenge.status === "settlement") {
    return "settlement";
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
      submittedByViewer: Boolean(submission.isViewer),
      submittedSide: submission.side || "",
      submittedByName: submission.playerName || "",
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
    challenge.status === "settled"
      ? "settled"
      : challenge.status === "settlement"
      ? "settlement"
      : challenge.status === "verdict"
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
    clientPortrait: viewer.clientPortrait || {},
    opponentPortrait: opponent.clientPortrait || {},
    playerImage: viewer.image || "",
    opponentImage: opponent.image || "",
    plaintiffName: challenge.premise?.clientName,
    defendantName: challenge.premise?.opponentName,
    interviewTranscript: viewer.interviewTranscript || [],
    factSheet: viewer.factSheet || {},
    caseAssessment: viewer.caseAssessment || {},
    settlement: challenge.settlement || {},
    courtroomTranscript,
    score: {
      player: viewer.score || 0,
      opponent: opponent.score || 0,
      roundsCompleted: judgedRounds.length,
      viewerSubmittedCurrentRound: Boolean(openRound?.viewerSubmitted),
      opponentSubmittedCurrentRound: Boolean(
        openRound?.submissions?.some((submission) => !submission.isViewer)
      ),
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
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center bg-[#030508]/88 px-5 text-white backdrop-blur-md"
      role="status"
      aria-live="polite"
      aria-label={title}
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_18%,rgba(255,255,255,0.1),transparent_30%),linear-gradient(180deg,rgba(13,20,31,0.88),rgba(3,5,8,0.96))]" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-white/20" />
      <div className="relative w-full max-w-xl text-center">
        <div className="relative mx-auto grid h-24 w-24 place-items-center">
          <div className="absolute inset-0 rounded-full border border-white/12 bg-white/[0.03] shadow-[0_0_48px_rgba(111,183,255,0.2)]" />
          <div className="absolute inset-2 rounded-full border border-dashed border-white/25 motion-safe:animate-spin motion-safe:[animation-duration:6s]" />
          <div className="absolute h-3 w-3 rounded-full bg-white/90 shadow-[0_0_18px_rgba(255,255,255,0.72)] motion-safe:animate-[arena-orbit_2.8s_linear_infinite]" />
          <Image
            src="/icon.png"
            alt=""
            width={56}
            height={56}
            className="relative h-14 w-14 rounded-2xl shadow-[0_16px_34px_rgba(0,0,0,0.36)] motion-safe:animate-[arena-icon-drift_2.4s_ease-in-out_infinite]"
            aria-hidden="true"
          />
        </div>

        <p className="arena-kicker mt-8 text-white/55">Legal Arena</p>
        <h2 className="arena-headline mt-3 text-3xl uppercase sm:text-4xl">
          {title}
        </h2>
        <div className="mx-auto mt-6 max-w-md space-y-3">
          <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
            <div className="arena-loading-bar h-full w-1/3 rounded-full bg-white/90" />
          </div>
          <p className="text-center text-[0.68rem] font-semibold uppercase tracking-[0.22em] text-white/42">
            PVP Challenge
          </p>
          <p className="text-sm leading-6 text-white/68">{detail}</p>
        </div>
      </div>
    </div>
  );
};

export default function ChallengeWorkspace({ initialChallenge }) {
  const [challenge, setChallenge] = useState(initialChallenge);
  const [busy, setBusy] = useState("");
  const requestedPortraitsRef = useRef(new Set());
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

  useEffect(() => {
    if (!["active", "courtroom", "verdict"].includes(challenge.status)) {
      return;
    }

    const requests = [];
    if (!challenge.viewer?.clientPortrait?.image) {
      requests.push({ target: "client", key: `${challengeRef}:client` });
    }
    if (!challenge.opponent?.clientPortrait?.image) {
      requests.push({ target: "opponent", key: `${challengeRef}:opponent` });
    }

    let cancelled = false;

    const generatePortraits = async () => {
      for (const { target, key } of requests) {
        if (cancelled || requestedPortraitsRef.current.has(key)) {
          continue;
        }

        requestedPortraitsRef.current.add(key);
        try {
          const response = await apiClient.post(
            target === "opponent"
              ? `/challenges/${challengeRef}/client-portrait?target=opponent`
              : `/challenges/${challengeRef}/client-portrait`
          );

          if (!cancelled && response?.challenge) {
            setChallenge(response.challenge);
          }
        } catch (error) {
          console.error("PVP portrait generation failed", error);
        }
      }
    };

    generatePortraits();

    return () => {
      cancelled = true;
    };
  }, [
    challenge.opponent?.clientPortrait?.image,
    challenge.status,
    challenge.viewer?.clientPortrait?.image,
    challengeRef,
  ]);

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
