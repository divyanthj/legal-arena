"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import * as HeroIcons from "@heroicons/react/24/outline";
import ButtonAccount from "@/components/ButtonAccount";
import { useNavigationLoading } from "@/components/NavigationLoadingProvider";
import apiClient from "@/libs/api";
import { trackGoal } from "@/libs/datafast";
import { DevelopmentAccessModal } from "@/components/legal-arena/DevelopmentAccessGate";

const statusLabel = {
  interview: "Intake",
  settlement: "Settlement",
  settled: "Settled",
  courtroom: "Courtroom",
  verdict: "Verdict Ready",
};

const statusSeverity = {
  interview: "caution",
  settlement: "caution",
  settled: "favorable",
  courtroom: "neutral",
  verdict: "favorable",
};

const severityClass = {
  neutral: "arena-status-neutral",
  caution: "arena-status-caution",
  critical: "arena-status-critical",
  favorable: "arena-status-favorable",
};

const challengeStatusLabel = {
  pending: "Pending",
  active: "Intake",
  settlement: "Settlement",
  settled: "Settled",
  courtroom: "Courtroom",
  verdict: "Verdict",
  declined: "Declined",
  expired: "Expired",
};

const getChallengeViewerStatus = (challenge = {}) => {
  if (
    challenge.status === "courtroom" &&
    challenge.viewer?.status !== "ready" &&
    challenge.status !== "verdict"
  ) {
    return "active";
  }

  return challenge.status;
};

const pvpDocketTabs = [
  { value: "needs-response", label: "Needs Response" },
  { value: "sent", label: "Sent" },
  { value: "active-intake", label: "Active Intake" },
  { value: "in-court", label: "In Court" },
  { value: "finished", label: "Finished" },
];

const getChallengeRef = (challenge = {}) => challenge.slug || challenge.id;

const isSameUserId = (left, right) => String(left || "") === String(right || "");

const isIncomingPendingChallenge = (challenge = {}) =>
  challenge.status === "pending" &&
  isSameUserId(challenge.challenged?.userId, challenge.viewer?.userId);

const getPvpDocketTab = (challenge = {}) => {
  if (challenge.status === "pending") {
    return isIncomingPendingChallenge(challenge) ? "needs-response" : "sent";
  }

  if (challenge.status === "active") {
    return "active-intake";
  }

  if (challenge.status === "settlement") {
    return "active-intake";
  }

  if (challenge.status === "courtroom") {
    return "in-court";
  }

  return "finished";
};

const getOpenPvpRound = (challenge = {}) =>
  (challenge.courtroomRounds || []).find((round) => round.status === "open") || null;

const getPvpTurnSummary = (challenge = {}) => {
  if (challenge.status === "pending") {
    return isIncomingPendingChallenge(challenge)
      ? "Accept to begin"
      : "Waiting for opponent";
  }

  if (challenge.status === "active") {
    return challenge.viewer?.status === "ready"
      ? "Waiting for opponent"
      : "Your turn: finish intake";
  }

  if (challenge.status === "courtroom") {
    if (challenge.viewer?.status !== "ready") {
      return "Opponent is in court";
    }

    return getOpenPvpRound(challenge)?.viewerSubmitted
      ? "Waiting for opponent"
      : "Your turn";
  }

  if (challenge.status === "settled") {
    return "View settlement";
  }

  if (challenge.status === "verdict") {
    return "View final ruling";
  }

  if (challenge.status === "expired") {
    return "Expired";
  }

  if (challenge.status === "declined") {
    return "Declined";
  }

  return challengeStatusLabel[challenge.status] || "Open";
};

const isPvpChallengeActionable = (challenge = {}) => {
  if (isIncomingPendingChallenge(challenge)) {
    return true;
  }

  if (challenge.status === "active") {
    return challenge.viewer?.status !== "ready";
  }

  if (challenge.status === "settlement") {
    return true;
  }

  if (challenge.status === "courtroom") {
    if (challenge.viewer?.status !== "ready") {
      return true;
    }

    return !getOpenPvpRound(challenge)?.viewerSubmitted;
  }

  return false;
};

const getPvpUrgencyLabel = (challenge = {}) => {
  if (isIncomingPendingChallenge(challenge)) {
    return "Accept now";
  }

  if (challenge.status === "active") {
    return challenge.viewer?.status === "ready" ? "Waiting" : "Finish intake";
  }

  if (challenge.status === "courtroom") {
    return challenge.viewer?.status === "ready" ? "Your court turn" : "Finish intake";
  }
  if (challenge.status === "settlement") {
    return "Negotiate";
  }

  return "Play";
};

const getPvpActionLabel = (challenge = {}) => {
  if (isIncomingPendingChallenge(challenge)) {
    return "Accept";
  }

  if (challenge.status === "pending") {
    return "View Invite";
  }

  if (challenge.status === "active") {
    return "Resume";
  }

  if (challenge.status === "courtroom") {
    return challenge.viewer?.status === "ready" ? "Enter Court" : "Finish Intake";
  }
  if (challenge.status === "settlement") {
    return "Negotiate";
  }
  if (challenge.status === "settled") {
    return "View Settlement";
  }

  if (challenge.status === "verdict") {
    return "View Verdict";
  }

  return "View";
};

const getPvpStatusTone = (challenge = {}) => {
  if (isIncomingPendingChallenge(challenge) || challenge.status === "courtroom") {
    return "arena-status-caution";
  }

  if (challenge.status === "active") {
    return "arena-status-favorable";
  }

  if (["declined", "expired"].includes(challenge.status)) {
    return "arena-status-critical";
  }

  return "arena-status-neutral";
};

const groupPvpChallenges = (challenges = []) =>
  pvpDocketTabs.reduce(
    (groups, tab) => ({
      ...groups,
      [tab.value]: challenges.filter((challenge) => getPvpDocketTab(challenge) === tab.value),
    }),
    {}
  );

const PvpDocketSection = ({
  challenges = [],
  activeTab,
  onTabChange,
  loadTimedOut = false,
  compact = false,
}) => {
  const groupedChallenges = groupPvpChallenges(challenges);
  const selectedChallenges = groupedChallenges[activeTab] || [];
  const actionableChallenges = challenges.filter(isPvpChallengeActionable);
  const activeCount = actionableChallenges.length;
  const nextActionableChallenge = actionableChallenges[0] || null;
  const nextActionableHref = nextActionableChallenge
    ? `/dashboard/challenges/${getChallengeRef(nextActionableChallenge)}`
    : "";
  const attentionByTab = pvpDocketTabs.reduce(
    (counts, tab) => ({
      ...counts,
      [tab.value]: (groupedChallenges[tab.value] || []).filter(isPvpChallengeActionable)
        .length,
    }),
    {}
  );

  return (
    <section
      id="pvp-docket"
      data-onboarding-target="pvp-docket"
      className={`arena-surface min-w-0 overflow-hidden ${
        activeCount
          ? "border-amber-200/35 bg-[radial-gradient(circle_at_92%_10%,rgba(251,191,36,0.14),transparent_30%),rgba(251,191,36,0.025)] shadow-[0_0_0_1px_rgba(251,191,36,0.08),0_24px_80px_rgba(251,191,36,0.08)]"
          : ""
      }`}
    >
      <div className={compact ? "p-4 md:p-5" : "p-5 md:p-6"}>
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="arena-kicker text-amber-200">My PVP Docket</p>
            <h2 className="arena-headline mt-2 text-2xl">Open player matches</h2>
            <p className="mt-2 text-sm leading-6 text-white/58">
              Play ongoing PVP first so the other player is not left waiting.
            </p>
          </div>
          <span
            className={`inline-flex w-fit rounded-full border px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.14em] ${
              activeCount
                ? "border-amber-200/60 bg-amber-200/16 text-amber-50 shadow-[0_0_28px_rgba(251,191,36,0.18)]"
                : "border-emerald-300/18 bg-emerald-300/[0.055] text-emerald-100/80"
            }`}
          >
            {activeCount ? `${activeCount} waiting on you` : "No PVP waiting"}
          </span>
        </div>

        {nextActionableChallenge ? (
          <Link
            href={nextActionableHref}
            className="mt-5 flex flex-col gap-3 rounded-2xl border border-amber-200/55 bg-amber-200/[0.12] p-4 text-white shadow-[0_18px_60px_rgba(251,191,36,0.12),inset_0_1px_0_rgba(255,255,255,0.08)] transition hover:-translate-y-0.5 hover:border-amber-100 sm:flex-row sm:items-center sm:justify-between"
            onClick={() =>
              trackGoal("pvp_priority_match_opened", {
                status: nextActionableChallenge.status,
                category: nextActionableChallenge.primaryCategory,
                action: getPvpActionLabel(nextActionableChallenge),
              })
            }
          >
            <span className="flex min-w-0 items-start gap-3">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-black/24 text-amber-100">
                <HeroIcons.BoltIcon className="h-7 w-7" aria-hidden="true" />
              </span>
              <span className="min-w-0">
                <span className="block text-xs font-semibold uppercase tracking-[0.18em] text-amber-100/88">
                  Play this first
                </span>
                <span className="mt-1 block truncate text-base font-semibold">
                  {nextActionableChallenge.title}
                </span>
                <span className="mt-1 block text-sm text-white/72">
                  {getPvpTurnSummary(nextActionableChallenge)} vs.{" "}
                  {nextActionableChallenge.opponent?.name || "opposing counsel"}
                </span>
              </span>
            </span>
            <span className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl border border-white/70 bg-white px-4 py-3 text-sm font-bold text-black">
              {getPvpActionLabel(nextActionableChallenge)}
              <HeroIcons.ChevronRightIcon className="h-4 w-4" aria-hidden="true" />
            </span>
          </Link>
        ) : null}

        <div className="mt-5 grid gap-2 sm:grid-cols-5">
          {pvpDocketTabs.map((tab) => {
            const selected = activeTab === tab.value;
            const count = groupedChallenges[tab.value]?.length || 0;
            const attentionCount = attentionByTab[tab.value] || 0;

            return (
              <button
                key={tab.value}
                type="button"
                className={`min-h-11 rounded-xl border px-3 py-2 text-xs font-semibold uppercase tracking-[0.07em] transition ${
                  selected
                    ? "border-amber-200/24 bg-amber-200/[0.075] text-amber-100"
                    : attentionCount
                    ? "border-amber-200/35 bg-amber-200/[0.07] text-amber-100 shadow-[0_0_24px_rgba(251,191,36,0.08)] hover:border-amber-200/60"
                    : "border-white/[0.07] bg-white/[0.025] text-white/52 hover:border-white/12 hover:text-white/78"
                }`}
                onClick={() => {
                  trackGoal("pvp_docket_tab_selected", {
                    tab: tab.value,
                    count,
                  });
                  onTabChange(tab.value);
                }}
              >
                {tab.label} <span className="text-white/42">{count}</span>
                {attentionCount ? (
                  <span className="ml-1 rounded-full bg-amber-200 px-1.5 py-0.5 text-[0.58rem] text-black">
                    {attentionCount}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>

        {loadTimedOut ? (
          <div className="arena-surface-soft mt-5 border-amber-200/18 bg-amber-200/[0.045] p-5 text-sm leading-7 text-amber-50/78">
            PVP docket is still loading. Refresh the dashboard if your matches do not appear.
          </div>
        ) : selectedChallenges.length ? (
          <div className="mt-5 grid gap-3 lg:grid-cols-2">
            {selectedChallenges.map((challenge) => {
              const visibleStatus = getChallengeViewerStatus(challenge);
              const href = `/dashboard/challenges/${getChallengeRef(challenge)}`;
              const needsPlayerAction = isPvpChallengeActionable(challenge);

              return (
                <Link
                  key={challenge.id}
                  href={href}
                  className={`arena-surface-soft block p-4 text-white transition hover:-translate-y-0.5 ${
                    needsPlayerAction
                      ? "border-amber-200/45 bg-amber-200/[0.075] shadow-[0_18px_60px_rgba(251,191,36,0.1)] hover:border-amber-100"
                      : "hover:border-white/18"
                  }`}
                  onClick={() =>
                    trackGoal("pvp_challenge_opened", {
                      status: challenge.status,
                      tab: activeTab,
                      category: challenge.primaryCategory,
                      action: getPvpActionLabel(challenge),
                    })
                  }
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`badge border arena-status ${getPvpStatusTone(challenge)}`}>
                          {challengeStatusLabel[visibleStatus] || visibleStatus}
                        </span>
                        {needsPlayerAction ? (
                          <span className="rounded-full border border-amber-100/40 bg-amber-200 px-2.5 py-1 text-[0.68rem] font-black uppercase tracking-[0.08em] text-black">
                            {getPvpUrgencyLabel(challenge)}
                          </span>
                        ) : null}
                        <span className="rounded-full border border-white/10 bg-black/20 px-2.5 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.08em] text-white/48">
                          {challenge.primaryCategory}
                        </span>
                      </div>
                      <h3 className="mt-3 break-words text-base font-semibold text-white">
                        {challenge.title}
                      </h3>
                      <p className="mt-2 text-sm text-white/52">
                        vs. {challenge.opponent?.name || "Opposing counsel"} | Updated{" "}
                        {formatDate(challenge.updatedAt)}
                      </p>
                      <p
                        className={`mt-2 text-sm font-semibold ${
                          needsPlayerAction ? "text-amber-50" : "text-amber-100/78"
                        }`}
                      >
                        {getPvpTurnSummary(challenge)}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-sm font-semibold text-white/78">
                        {challenge.viewer?.score || 0}-{challenge.opponent?.score || 0}
                      </p>
                      <span
                        className={`mt-3 inline-flex rounded-xl border px-3 py-2 text-xs font-semibold ${
                          needsPlayerAction
                            ? "border-white/70 bg-white text-black"
                            : "border-amber-200/18 bg-amber-200/[0.06] text-amber-100"
                        }`}
                      >
                        {getPvpActionLabel(challenge)}
                      </span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        ) : (
          <div className="arena-surface-soft mt-5 border-dashed p-7 text-center">
            <p className="text-base font-semibold text-white">
              No {pvpDocketTabs.find((tab) => tab.value === activeTab)?.label.toLowerCase()} matches
            </p>
            <p className="mt-2 text-sm leading-6 text-white/56">
              Challenge a player from the Bar Association or a player dossier to start a PVP case.
            </p>
            <Link
              href="/dashboard/bar-association"
              className="arena-btn-dark mt-4 inline-flex px-4 py-2 text-sm"
            >
              Find Players
            </Link>
          </div>
        )}
      </div>
    </section>
  );
};

const normalizeSearchText = (value = "") =>
  String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");

const fuzzyNameMatch = (name = "", query = "") => {
  const normalizedName = normalizeSearchText(name);
  const normalizedQuery = normalizeSearchText(query);

  if (!normalizedQuery) {
    return true;
  }

  if (normalizedName.includes(normalizedQuery)) {
    return true;
  }

  let queryIndex = 0;
  for (const character of normalizedName) {
    if (character === normalizedQuery[queryIndex]) {
      queryIndex += 1;
    }
    if (queryIndex === normalizedQuery.length) {
      return true;
    }
  }

  return false;
};

const formatDate = (value) =>
  new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));

const formatCooldownTime = (value, timeZone) => {
  if (!value) {
    return "";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const formatOptions = {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  };

  if (timeZone) {
    formatOptions.timeZone = timeZone;
  }

  return new Intl.DateTimeFormat("en", formatOptions).format(date);
};

const getTemplateUnlockMessage = (template, timeZone) => {
  if (template.unlocked) {
    return template.unlockReason;
  }

  if (template.cooldownEndsAt) {
    const formatted = formatCooldownTime(template.cooldownEndsAt, timeZone);

    return formatted ? `Available again after ${formatted}.` : "Available again soon.";
  }

  return template.unlockReason;
};

const getRecordRatio = (wins, losses, draws) => {
  const total = wins + losses + draws;

  if (total <= 0) {
    return 0;
  }

  return Math.round((wins / total) * 100);
};

const getArenaHeadshot = (value = "") => {
  const image = String(value || "").trim();

  return image.startsWith("/api/players/avatar/") || image.startsWith("data:image/")
    ? image
    : "/images/profile.jpg";
};

const isDefaultHeadshot = (value = "") => getArenaHeadshot(value) === "/images/profile.jpg";

const LeaderboardPortrait = ({ image = "", name = "", className = "" }) => {
  const headshot = getArenaHeadshot(image);
  const fallbackHeadshot = getArenaHeadshot("");

  return (
    <div
      className={`h-10 w-10 shrink-0 overflow-hidden rounded-full border border-white/15 bg-white/[0.04] shadow-[0_0_0_3px_rgba(255,255,255,0.025)] ${className}`}
    >
      <img
        src={headshot}
        alt={`${name || "Counsel"} headshot`}
        onError={(event) => {
          event.currentTarget.onerror = null;
          event.currentTarget.src = fallbackHeadshot;
        }}
        style={{ objectPosition: "center calc(50% + 1px)" }}
        className={`block h-full w-full object-cover object-center ${
          isDefaultHeadshot(image) ? "scale-[1.62]" : "scale-[1.09]"
        }`}
      />
    </div>
  );
};

const IconTile = ({ icon: Icon, className = "" }) => (
  <span
    className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-white/74 ${className}`}
  >
    <Icon className="h-5 w-5" aria-hidden="true" />
  </span>
);

const categoryIconMap = {
  "rental-dispute": HeroIcons.BuildingOffice2Icon,
  "marital-dispute": HeroIcons.HeartIcon,
  "business-dispute": HeroIcons.BriefcaseIcon,
  "contract-violation": HeroIcons.DocumentCheckIcon,
  employment: HeroIcons.IdentificationIcon,
  property: HeroIcons.HomeModernIcon,
  "personal-injury": HeroIcons.PlusCircleIcon,
  consumer: HeroIcons.ShoppingBagIcon,
  criminal: HeroIcons.ShieldExclamationIcon,
  administrative: HeroIcons.ClipboardDocumentCheckIcon,
};

const compactCategoryLabel = {
  "rental-dispute": "Rental",
  "marital-dispute": "Marital",
  "business-dispute": "Business",
  "contract-violation": "Contract",
  employment: "Work",
  property: "Property",
  "personal-injury": "Injury",
  consumer: "Consumer",
  criminal: "Criminal",
  administrative: "Agency",
};

const getStableCategoryWeight = (category, seed = "") =>
  normalizeSearchText(`${category.slug}-${seed}`)
    .split("")
    .reduce((total, character) => total + character.charCodeAt(0), 0);

const difficultyOptions = [
  { value: "all", label: "All" },
  { value: "easy", label: "Easy" },
  { value: "medium", label: "Medium" },
  { value: "hard", label: "Hard" },
];

const dynamicDifficultyOptions = [
  {
    value: 1,
    label: "Level 1",
    name: "Intro",
    time: "10-15 min",
    summary: "One clear dispute with obvious records and a forgiving opponent.",
    skills: ["Spot the issue", "Ask for proof", "Make a plain argument"],
  },
  {
    value: 2,
    label: "Level 2",
    name: "Beginner",
    time: "15-20 min",
    summary: "Two connected issues with a little ambiguity and a beatable weakness.",
    skills: ["Find contradictions", "Frame a theory", "Handle one risk"],
  },
  {
    value: 3,
    label: "Level 3",
    name: "Medium",
    time: "20-25 min",
    summary: "A moderate case with competing facts and several useful evidence paths.",
    skills: ["Prioritize facts", "Pressure weak proof", "Use lawbook rules"],
  },
  {
    value: 4,
    label: "Level 4",
    name: "Advanced",
    time: "25-35 min",
    summary: "Layered facts, stronger opposition, and more ways to lose focus.",
    skills: ["Control scope", "Weigh credibility", "Concede safely"],
  },
  {
    value: 5,
    label: "Level 5",
    name: "Expert",
    time: "35+ min",
    summary: "Dense proof conflicts with a polished opponent and little room for fluff.",
    skills: ["Build a full theory", "Exploit nuance", "Win hard calls"],
  },
];

const getDifficultyMeta = (complexity = 1) => {
  if (complexity >= 4) {
    return { value: "hard", label: "Hard", className: "text-rose-300 border-rose-300/25 bg-rose-400/10" };
  }

  if (complexity >= 2) {
    return { value: "medium", label: "Medium", className: "text-amber-200 border-amber-200/25 bg-amber-300/10" };
  }

  return { value: "easy", label: "Easy", className: "text-emerald-300 border-emerald-300/25 bg-emerald-400/10" };
};

const getDynamicDifficultyMeta = (complexity = 1) =>
  dynamicDifficultyOptions.find((option) => option.value === Number(complexity)) ||
  dynamicDifficultyOptions[0];

const getPlayerComplexityCap = (playerLevel = 1) => {
  const level = Math.max(1, Number(playerLevel) || 1);

  if (level <= 2) return 1;
  if (level <= 5) return 2;
  if (level <= 8) return 3;
  if (level <= 12) return 4;
  return 5;
};

const getCaseProgress = (caseSession = null) => {
  if (!caseSession) {
    return { label: "Not started", percent: 0, nextStep: "Begin client interview" };
  }

  if (caseSession.status === "courtroom") {
    return { label: "Courtroom", percent: 75, nextStep: "Argue in court" };
  }

  if (caseSession.status === "verdict") {
    return { label: "Verdict ready", percent: 100, nextStep: "Review the ruling" };
  }
  if (caseSession.status === "settled") {
    return { label: "Settled", percent: 100, nextStep: "Review the settlement" };
  }
  if (caseSession.status === "settlement") {
    return { label: "Settlement", percent: 74, nextStep: "Negotiate terms" };
  }

  return { label: "Client interview", percent: 42, nextStep: "Build your fact sheet" };
};

const getComparableId = (value) => {
  if (!value) {
    return "";
  }

  if (typeof value === "object") {
    return String(value.id || value._id || value.slug || "").trim();
  }

  return String(value).trim();
};

const getCaseTemplateIds = (caseSession = {}) =>
  [
    getComparableId(caseSession.caseTemplateId),
    getComparableId(caseSession.template?.id),
    getComparableId(caseSession.template?._id),
    getComparableId(caseSession.scenario?.id),
  ].filter(Boolean);

const getCaseTemplateSlugs = (caseSession = {}) =>
  [
    caseSession.templateSlug,
    caseSession.scenarioId,
    caseSession.template?.slug,
    caseSession.scenario?.slug,
  ]
    .map((value) => getComparableId(value))
    .filter(Boolean);

const caseMatchesTemplate = (caseSession = {}, template = null) => {
  if (!caseSession || !template) {
    return false;
  }

  const templateId = getComparableId(template.id || template._id);
  const templateSlug = getComparableId(template.slug);

  return (
    (templateId && getCaseTemplateIds(caseSession).includes(templateId)) ||
    (templateSlug && getCaseTemplateSlugs(caseSession).includes(templateSlug))
  );
};

const findResumableCaseForTemplate = (caseSessions = [], template = null) =>
  caseSessions.find(
    (caseSession) =>
      (caseSession.status === "interview" || caseSession.status === "courtroom") &&
      caseMatchesTemplate(caseSession, template)
  ) || null;

const onboardingSteps = [
  {
    target: "quick-start-case",
    eyebrow: "Quick Start",
    title: "Start your first case",
    body: "This is the fast lane into your first matter. Click it when you are ready to meet the facts, ask sharp questions, and begin happy lawyering.",
  },
  {
    target: "player-brief",
    eyebrow: "Your Profile",
    title: "Open your lawyer page",
    body: "This player brief is a shortcut to your lawyer profile page. Click it to review your portrait, record, public matters, and specialty progress.",
  },
  {
    target: "case-library",
    eyebrow: "Case Library",
    title: "Pick from live disputes",
    body: "This is your case shelf. Each matter shows the parties, complexity, access, and enough context to decide which legal puzzle deserves your attention.",
  },
  {
    target: "recent-matters",
    eyebrow: "Your Matters",
    title: "Return to active work",
    body: "Your open files and finished rulings live here. Think of it as the desk where yesterday's legal adventures politely wait for you.",
  },
  {
    target: "leaderboards",
    eyebrow: "Progress",
    title: "Track your standing",
    body: "Ratings, records, specialty progress, and leaderboard bragging rights all gather here. Win cleanly, climb steadily, enjoy the robes-without-robes energy.",
  },
];

const getOnboardingTarget = (target) =>
  typeof document === "undefined"
    ? null
    : document.querySelector(`[data-onboarding-target="${target}"]`);

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

const DashboardOnboardingOverlay = ({ isOpen, onComplete }) => {
  const [stepIndex, setStepIndex] = useState(0);
  const [targetRect, setTargetRect] = useState(null);
  const [completing, setCompleting] = useState(false);
  const step = onboardingSteps[stepIndex] || onboardingSteps[0];

  useEffect(() => {
    if (isOpen) {
      setStepIndex(0);
      setTargetRect(null);
    }
  }, [isOpen]);

  const completeTutorial = useCallback(async () => {
    setCompleting(true);

    try {
      await apiClient.post("/onboarding/dashboard-tutorial");
      onComplete();
    } catch (error) {
      console.error(error);
    } finally {
      setCompleting(false);
    }
  }, [onComplete]);

  const findAvailableStepIndex = useCallback((startIndex, direction = 1) => {
    for (
      let index = startIndex;
      index >= 0 && index < onboardingSteps.length;
      index += direction
    ) {
      if (getOnboardingTarget(onboardingSteps[index].target)) {
        return index;
      }
    }

    return -1;
  }, []);

  const measureTarget = useCallback(() => {
    if (!isOpen || !step) {
      return;
    }

    const target = getOnboardingTarget(step.target);

    if (!target) {
      const nextIndex = findAvailableStepIndex(stepIndex + 1, 1);
      const previousIndex =
        nextIndex >= 0 ? -1 : findAvailableStepIndex(stepIndex - 1, -1);

      if (nextIndex >= 0 || previousIndex >= 0) {
        setStepIndex(nextIndex >= 0 ? nextIndex : previousIndex);
      } else {
        completeTutorial();
      }

      return;
    }

    const rect = target.getBoundingClientRect();
    const padding = 8;

    setTargetRect({
      top: clamp(rect.top - padding, padding, window.innerHeight - padding),
      left: clamp(rect.left - padding, padding, window.innerWidth - padding),
      width: Math.min(rect.width + padding * 2, window.innerWidth - padding * 2),
      height: Math.min(rect.height + padding * 2, window.innerHeight - padding * 2),
      centerX: rect.left + rect.width / 2,
      centerY: rect.top + rect.height / 2,
    });
  }, [completeTutorial, findAvailableStepIndex, isOpen, step, stepIndex]);

  useEffect(() => {
    if (!isOpen || !step) {
      return;
    }

    const target = getOnboardingTarget(step.target);

    if (target) {
      target.scrollIntoView({ block: "center", inline: "center", behavior: "smooth" });
    }

    const timeoutId = window.setTimeout(measureTarget, 260);

    window.addEventListener("resize", measureTarget);
    window.addEventListener("scroll", measureTarget, true);

    return () => {
      window.clearTimeout(timeoutId);
      window.removeEventListener("resize", measureTarget);
      window.removeEventListener("scroll", measureTarget, true);
    };
  }, [isOpen, measureTarget, step]);

  useEffect(() => {
    if (isOpen) {
      measureTarget();
    }
  }, [isOpen, measureTarget]);

  if (!isOpen || !targetRect) {
    return null;
  }

  const calloutWidth = Math.min(380, Math.max(280, window.innerWidth - 32));
  const estimatedCalloutHeight = 248;
  const hasRoomBelow = targetRect.top + targetRect.height + estimatedCalloutHeight + 28 < window.innerHeight;
  const calloutTop = hasRoomBelow
    ? targetRect.top + targetRect.height + 22
    : Math.max(16, targetRect.top - estimatedCalloutHeight - 22);
  const calloutLeft = clamp(
    targetRect.centerX - calloutWidth / 2,
    16,
    window.innerWidth - calloutWidth - 16
  );
  const arrowLeft = clamp(targetRect.centerX - calloutLeft - 7, 24, calloutWidth - 24);
  const isFirstStep = stepIndex === 0;
  const isLastStep = stepIndex >= onboardingSteps.length - 1;

  const goToPreviousStep = () => {
    const previousIndex = findAvailableStepIndex(stepIndex - 1, -1);

    if (previousIndex >= 0) {
      setStepIndex(previousIndex);
    }
  };

  const goToNextStep = () => {
    const nextIndex = findAvailableStepIndex(stepIndex + 1, 1);

    if (nextIndex >= 0) {
      setStepIndex(nextIndex);
    } else {
      completeTutorial();
    }
  };

  return (
    <div
      className="fixed inset-0 z-[90]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="dashboard-onboarding-title"
    >
      <div
        className="fixed left-0 right-0 top-0 bg-black/72 backdrop-blur-[3px]"
        style={{ height: targetRect.top }}
      />
      <div
        className="fixed left-0 bg-black/72 backdrop-blur-[3px]"
        style={{
          top: targetRect.top,
          width: targetRect.left,
          height: targetRect.height,
        }}
      />
      <div
        className="fixed right-0 bg-black/72 backdrop-blur-[3px]"
        style={{
          top: targetRect.top,
          left: targetRect.left + targetRect.width,
          height: targetRect.height,
        }}
      />
      <div
        className="fixed bottom-0 left-0 right-0 bg-black/72 backdrop-blur-[3px]"
        style={{ top: targetRect.top + targetRect.height }}
      />
      <div
        className="pointer-events-none fixed rounded-[1.35rem] border border-white/90 bg-transparent shadow-[0_0_0_6px_rgba(255,255,255,0.08),0_20px_80px_rgba(0,0,0,0.55)] transition-all duration-200"
        style={{
          top: targetRect.top,
          left: targetRect.left,
          width: targetRect.width,
          height: targetRect.height,
        }}
      />
      <div
        className="fixed rounded-[1.35rem] border border-white/12 bg-[#111] p-5 text-white shadow-2xl transition-all duration-200"
        style={{
          top: calloutTop,
          left: calloutLeft,
          width: calloutWidth,
        }}
      >
        <span
          className={`absolute h-3.5 w-3.5 rotate-45 border-white/12 bg-[#111] ${
            hasRoomBelow ? "-top-2 border-l border-t" : "-bottom-2 border-b border-r"
          }`}
          style={{ left: arrowLeft }}
          aria-hidden="true"
        />
        <p className="arena-kicker">{step.eyebrow}</p>
        <h2 id="dashboard-onboarding-title" className="mt-2 text-xl font-semibold">
          {step.title}
        </h2>
        <p className="mt-3 text-sm leading-6 text-white/68">{step.body}</p>
        <div className="mt-5 flex items-center justify-between gap-3">
          <p className="text-xs uppercase tracking-[0.16em] text-white/42">
            {stepIndex + 1} / {onboardingSteps.length}
          </p>
          <div className="flex flex-wrap justify-end gap-2">
            <button
              type="button"
              className="arena-btn-dark min-h-0 px-3 py-2 text-sm"
              onClick={completeTutorial}
              disabled={completing}
            >
              Skip
            </button>
            <button
              type="button"
              className="arena-btn-dark min-h-0 px-3 py-2 text-sm"
              onClick={goToPreviousStep}
              disabled={isFirstStep || completing}
            >
              Back
            </button>
            <button
              type="button"
              className="arena-btn-light min-h-0 px-4 py-2 text-sm"
              onClick={isLastStep ? completeTutorial : goToNextStep}
              disabled={completing}
            >
              {isLastStep ? "Finish" : "Next"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default function DashboardHub({
  initialCases,
  templates,
  categories,
  onboarding = {},
  progression,
  dashboardEncouragementNote = "",
  challenges = [],
  challengesLoadTimedOut = false,
  overallLeaderboard,
  categoryLeaderboards,
  isAdmin = false,
  userId = "",
  userName = "Counsel",
  userImage = "",
  userEmail = "",
  hasArenaAccess = false,
  canStartSoloCases = false,
}) {
  const router = useRouter();
  const { startNavigationLoading, stopNavigationLoading } = useNavigationLoading();
  const [browserTimeZone, setBrowserTimeZone] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState(categories[0]?.slug || "");
  const [activeTemplateIndex, setActiveTemplateIndex] = useState(0);
  const [showPlayableOnly, setShowPlayableOnly] = useState(true);
  const [showPaywallModal, setShowPaywallModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [caseLibrarySearch, setCaseLibrarySearch] = useState("");
  const [selectedDifficulty, setSelectedDifficulty] = useState(1);
  const [caseArchiveTab, setCaseArchiveTab] = useState("ongoing");
  const [pvpDocketTab, setPvpDocketTab] = useState("needs-response");
  const [showAllCaseCategories, setShowAllCaseCategories] = useState(false);
  const [lawyerSearch, setLawyerSearch] = useState("");
  const [searchedLawyers, setSearchedLawyers] = useState(null);
  const [lawyerSearchLoading, setLawyerSearchLoading] = useState(false);
  const [isMobileActivationViewport, setIsMobileActivationViewport] = useState(false);
  const dashboardViewedRef = useRef(false);
  const [dashboardTutorialCompleted, setDashboardTutorialCompleted] = useState(
    Boolean(onboarding?.dashboardTutorialCompleted)
  );

  const filteredTemplates = useMemo(
    () =>
      templates.filter(
        (template) =>
          (!selectedCategory || template.primaryCategory === selectedCategory) &&
          (!showPlayableOnly || template.unlocked)
      ),
    [selectedCategory, showPlayableOnly, templates]
  );
  const finishedCases = useMemo(
    () => initialCases.filter((caseSession) => ["verdict", "settled"].includes(caseSession.status)),
    [initialCases]
  );
  const ongoingCases = useMemo(
    () => initialCases.filter((caseSession) => !["verdict", "settled"].includes(caseSession.status)),
    [initialCases]
  );
  const selectedArchiveCases = caseArchiveTab === "finished" ? finishedCases : ongoingCases;
  const pvpAttentionCount = challenges.filter(isPvpChallengeActionable).length;

  useEffect(() => {
    if (dashboardViewedRef.current) {
      return;
    }

    dashboardViewedRef.current = true;
    trackGoal("dashboard_viewed", {
      has_access: hasArenaAccess,
      can_start_solo: canStartSoloCases,
      cases_total: initialCases.length,
      cases_finished: finishedCases.length,
      pvp_total: challenges.length,
      pvp_attention: pvpAttentionCount,
    });
  }, [
    canStartSoloCases,
    challenges,
    finishedCases.length,
    hasArenaAccess,
    initialCases.length,
    pvpAttentionCount,
  ]);

  const selectedLeaderboard = categoryLeaderboards[selectedCategory] || [];
  const categoryProgress =
    progression.categoryStats.find((item) => item.categorySlug === selectedCategory) || null;
  const recordRatio = getRecordRatio(
    progression.wins,
    progression.losses,
    progression.draws
  );
  const lastActiveCase = initialCases[0] || null;
  const selectedCategoryMeta =
    categories.find((category) => category.slug === selectedCategory) || null;
  const selectedCategoryTitle = selectedCategoryMeta?.title || "All cases";
  const mobileFeaturedCategories = useMemo(
    () =>
      [...categories]
        .sort(
          (left, right) =>
            getStableCategoryWeight(left, userId) - getStableCategoryWeight(right, userId)
        )
        .slice(0, 3),
    [categories, userId]
  );
  const visibleMobileCategories = showAllCaseCategories
    ? categories
    : mobileFeaturedCategories;
  const currentLeaderboardEntry =
    overallLeaderboard.find((entry) => String(entry.id) === String(userId)) || null;
  const userPortrait =
    currentLeaderboardEntry?.image ||
    userImage ||
    (/^[a-f\d]{24}$/i.test(String(userId || ""))
      ? `/api/players/avatar/${userId}`
      : "");
  const searchedOverallEntries = useMemo(() => {
    const query = lawyerSearch.trim();
    const entries = query ? searchedLawyers || [] : overallLeaderboard.slice(0, 5);

    return entries.slice(0, 8);
  }, [lawyerSearch, overallLeaderboard, searchedLawyers]);
  const topCategoryEntries = selectedLeaderboard.slice(0, 5);
  const recentVerdicts = initialCases
    .filter((item) => ["verdict", "settled"].includes(item.status))
    .slice(0, 5);
  const canResumeLastCase =
    lastActiveCase &&
    (lastActiveCase.status === "interview" ||
      lastActiveCase.status === "settlement" ||
      lastActiveCase.status === "courtroom");
  const nextCategoryUnlockTarget = Math.max(
    (categoryProgress?.unlockedComplexity || 1) * 2,
    2
  );
  const nextCategoryUnlockProgress = Math.min(
    categoryProgress?.completedCases || 0,
    nextCategoryUnlockTarget
  );
  const nextCategoryUnlockPercent = Math.max(
    10,
    Math.round((nextCategoryUnlockProgress / nextCategoryUnlockTarget) * 100)
  );
  const streakGoal = 3;
  const winStreakProgress = Math.min(progression.wins, streakGoal);
  const winStreakPercent = Math.max(10, Math.round((winStreakProgress / streakGoal) * 100));
  const playerLevel = Math.max(1, Math.floor((progression.overallXp || 0) / 250) + 1);
  const currentLevelXp = (progression.overallXp || 0) % 250;
  const nextLevelProgressPercent = Math.max(8, Math.min(100, currentLevelXp / 2.5));
  const playerComplexityCap = getPlayerComplexityCap(playerLevel);
  const selectedCategoryProgress = categoryProgress || { unlockedComplexity: 1, completedCases: 0 };
  const selectedCategoryCap = Math.max(1, selectedCategoryProgress.unlockedComplexity || 1);
  const selectedCapableComplexity = Math.min(playerComplexityCap, selectedCategoryCap);
  const selectedChallengeComplexityCap = Math.min(5, selectedCapableComplexity + 1);
  const selectedDynamicDifficulty = Math.max(1, Math.min(5, Number(selectedDifficulty) || 1));
  const selectedDynamicDifficultyMeta = getDynamicDifficultyMeta(selectedDynamicDifficulty);
  const selectedDifficultyAvailable = selectedDynamicDifficulty <= selectedChallengeComplexityCap;
  const playerRankLabel = currentLeaderboardEntry ? `#${currentLeaderboardEntry.rank}` : "Unranked";
  const playerRecordLabel = `${progression.wins || 0}-${progression.losses || 0}-${
    progression.draws || 0
  }-${progression.settlements || 0}`;
  const playerEncouragementNote =
    dashboardEncouragementNote ||
    `${userName}, every case you complete makes your advocacy sharper.`;

  useEffect(() => {
    const detectedTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    setBrowserTimeZone(detectedTimeZone || null);
  }, []);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(max-width: 1279px)");
    const updateViewport = () => setIsMobileActivationViewport(mediaQuery.matches);

    updateViewport();
    mediaQuery.addEventListener("change", updateViewport);

    return () => {
      mediaQuery.removeEventListener("change", updateViewport);
    };
  }, []);

  useEffect(() => {
    const query = lawyerSearch.trim();
    if (!query) {
      setSearchedLawyers(null);
      setLawyerSearchLoading(false);
      return;
    }

    let cancelled = false;
    setLawyerSearchLoading(true);
    const timeoutId = window.setTimeout(async () => {
      try {
        const data = await apiClient.get("/leaderboards/overall", {
          params: { q: query, limit: 8 },
        });
        if (!cancelled) {
          setSearchedLawyers(data.leaderboard || []);
        }
      } catch (error) {
        if (!cancelled) {
          setSearchedLawyers(
            overallLeaderboard
              .filter((entry) => fuzzyNameMatch(entry.name, query))
              .slice(0, 8)
          );
        }
      } finally {
        if (!cancelled) {
          setLawyerSearchLoading(false);
        }
      }
    }, 180);

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [lawyerSearch, overallLeaderboard]);

  useEffect(() => {
    const firstUnlockedIndex = filteredTemplates.findIndex((template) => template.unlocked);

    setActiveTemplateIndex(firstUnlockedIndex >= 0 ? firstUnlockedIndex : 0);
  }, [filteredTemplates, selectedCategory, showPlayableOnly]);

  useEffect(() => {
    if (selectedDynamicDifficulty > selectedChallengeComplexityCap) {
      setSelectedDifficulty(selectedChallengeComplexityCap);
    }
  }, [selectedChallengeComplexityCap, selectedDynamicDifficulty]);

  const handleCreateCase = async (caseTemplateId, options = {}) => {
    const dynamicStart = Boolean(options.dynamic || !caseTemplateId);
    const selectedTemplateForAnalytics =
      templates.find((template) => template.id === caseTemplateId) || activeTemplate;
    const dynamicCategory = options.categorySlug || selectedCategory || selectedTemplateForAnalytics?.primaryCategory;
    const dynamicCategoryProgress =
      progression.categoryStats.find((item) => item.categorySlug === dynamicCategory) || null;
    const dynamicComplexity =
      options.complexity ||
      selectedDynamicDifficulty ||
      dynamicCategoryProgress?.unlockedComplexity ||
      selectedTemplateForAnalytics?.complexity ||
      1;

    if (!dynamicStart && !caseTemplateId) return;

    if (!canStartSoloCases) {
      trackGoal("paywall_prompt_viewed", {
        source: "case_start",
        template_id: caseTemplateId,
        category: dynamicStart ? dynamicCategory : selectedTemplateForAnalytics?.primaryCategory,
        generation_mode: dynamicStart ? "dynamic" : "template",
      });
      setShowPaywallModal(true);
      return;
    }

    trackGoal("case_start_clicked", {
      template_id: caseTemplateId || "",
      category: dynamicStart ? dynamicCategory : selectedTemplateForAnalytics?.primaryCategory,
      complexity: dynamicStart ? dynamicComplexity : selectedTemplateForAnalytics?.complexity,
      unlocked: dynamicStart ? true : selectedTemplateForAnalytics?.unlocked,
      generation_mode: dynamicStart ? "dynamic" : "template",
    });
    setCreating(true);
    startNavigationLoading(
      dynamicStart ? "Starting your case" : "Preparing your client intake",
      { failsafeMs: 60000 }
    );

    try {
      const { caseSession } = await apiClient.post(
        "/cases",
        dynamicStart
          ? {
              categorySlug: dynamicCategory,
              complexity: dynamicComplexity,
            }
          : {
              caseTemplateId,
            }
      );

      trackGoal("case_created", {
        template_id: caseTemplateId || "",
        category:
          caseSession.primaryCategory ||
          (dynamicStart ? dynamicCategory : selectedTemplateForAnalytics?.primaryCategory),
        complexity:
          caseSession.complexity ||
          (dynamicStart ? dynamicComplexity : selectedTemplateForAnalytics?.complexity),
        side: caseSession.playerSide,
        generation_mode: dynamicStart ? "dynamic" : "template",
      });
      startNavigationLoading("Creating courtroom portraits", { failsafeMs: 60000 });
      const caseRef = caseSession.slug || caseSession.id;
      const caseHref = `/dashboard/cases/${caseRef}`;
      router.prefetch(caseHref);
      const portraitResults = await Promise.allSettled([
        apiClient.post(`/cases/${caseRef}/client-portrait`),
        apiClient.post(`/cases/${caseRef}/client-portrait?target=opponent`),
      ]);
      portraitResults
        .filter((result) => result.status === "rejected")
        .forEach((result) => console.error(result.reason));

      startNavigationLoading("Opening the matter", { failsafeMs: 60000 });
      router.push(caseHref);
    } catch (error) {
      stopNavigationLoading();
      trackGoal("case_create_failed", {
        template_id: caseTemplateId || "",
        category: dynamicStart ? dynamicCategory : selectedTemplateForAnalytics?.primaryCategory,
        complexity: dynamicStart ? dynamicComplexity : selectedTemplateForAnalytics?.complexity,
        generation_mode: dynamicStart ? "dynamic" : "template",
      });
      console.error(error);
    } finally {
      setCreating(false);
    }
  };

  const visibleTemplates = filteredTemplates;
  const activeTemplate =
    visibleTemplates.length > 0
      ? visibleTemplates[Math.min(activeTemplateIndex, visibleTemplates.length - 1)]
      : null;
  const isNewUser = (progression.completedCases || 0) === 0;
  const shouldSellLifetimeAccess = !hasArenaAccess;
  const searchedLibraryTemplates = useMemo(() => {
    const query = normalizeSearchText(caseLibrarySearch);

    return filteredTemplates.filter((template) => {
      const difficulty = getDifficultyMeta(template.complexity).value;

      if (selectedDifficulty !== "all" && difficulty !== selectedDifficulty) {
        return false;
      }

      if (!query) {
        return true;
      }

      return normalizeSearchText(
        [
          template.title,
          template.overview,
          template.practiceArea,
          template.primaryCategory,
          template.plaintiffName,
          template.clientName,
          template.defendantName,
          template.opponentName,
        ].join(" ")
      ).includes(query);
    });
  }, [caseLibrarySearch, filteredTemplates, selectedDifficulty]);
  const featuredLibraryTemplate =
    searchedLibraryTemplates.find((template) => template.id === activeTemplate?.id) ||
    searchedLibraryTemplates.find((template) => template.unlocked) ||
    searchedLibraryTemplates[0] ||
    null;
  const moreLibraryTemplates = searchedLibraryTemplates
    .filter((template) => template.id !== featuredLibraryTemplate?.id)
    .slice(0, 3);
  const featuredLibraryCase = findResumableCaseForTemplate(
    ongoingCases,
    featuredLibraryTemplate
  );
  const canResumeFeaturedLibraryCase =
    Boolean(featuredLibraryCase) && !shouldSellLifetimeAccess;
  const featuredLibraryCaseProgress = getCaseProgress(featuredLibraryCase);
  const featuredLibraryCaseHref = featuredLibraryCase
    ? `/dashboard/cases/${featuredLibraryCase.slug || featuredLibraryCase.id}`
    : "";
  const firstUnlockedTemplate =
    visibleTemplates.find((template) => template.unlocked) ||
    templates.find((template) => template.unlocked) ||
    null;
  const carouselCategoryLabel =
    selectedCategory
      ? `${String(selectedCategoryTitle || "available").toLowerCase()} cases`
      : "all available cases";
  const carouselStatus = visibleTemplates.length
    ? `${Math.min(activeTemplateIndex + 1, visibleTemplates.length)}/${
        visibleTemplates.length
      } ${carouselCategoryLabel}`
    : "0/0 available cases";
  const canNavigateTemplates = visibleTemplates.length > 1;

  const goToPreviousTemplate = () => {
    if (!canNavigateTemplates) return;
    setActiveTemplateIndex((current) =>
      current === 0 ? visibleTemplates.length - 1 : current - 1
    );
  };

  const selectCaseCategory = (categorySlug = "") => {
    trackGoal("case_category_selected", {
      category: categorySlug || "all",
      playable_only: showPlayableOnly,
    });
    const scrollPosition =
      typeof window !== "undefined"
        ? { left: window.scrollX, top: window.scrollY }
        : null;
    const nextTemplates = templates.filter(
      (template) =>
        (!categorySlug || template.primaryCategory === categorySlug) &&
        (!showPlayableOnly || template.unlocked)
    );
    const firstUnlockedIndex = nextTemplates.findIndex((template) => template.unlocked);

    setSelectedCategory(categorySlug);
    setActiveTemplateIndex(firstUnlockedIndex >= 0 ? firstUnlockedIndex : 0);

    if (scrollPosition) {
      window.requestAnimationFrame(() => {
        window.scrollTo({ ...scrollPosition, behavior: "auto" });
        window.requestAnimationFrame(() => {
          window.scrollTo({ ...scrollPosition, behavior: "auto" });
        });
      });
    }
  };

  const handleGenerateCategoryCase = (category) => {
    if (!category?.slug) {
      return;
    }

    setSelectedCategory(category.slug);
    handleCreateCase(null, {
      dynamic: true,
      source: "category_generate",
      categorySlug: category.slug,
      complexity: selectedDynamicDifficulty,
    });
  };

  const handleGenerateSelectedCategoryCase = () => {
    if (selectedCategoryMeta) {
      handleGenerateCategoryCase(selectedCategoryMeta);
      return;
    }

    handleCreateCase(null, {
      dynamic: true,
      source: "library_generate",
      complexity: selectedDynamicDifficulty,
    });
  };

  const goToNextTemplate = () => {
    if (!canNavigateTemplates) return;
    setActiveTemplateIndex((current) =>
      current >= visibleTemplates.length - 1 ? 0 : current + 1
    );
  };

  useEffect(() => {
    if (activeTemplateIndex >= visibleTemplates.length) {
      setActiveTemplateIndex(Math.max(visibleTemplates.length - 1, 0));
    }
  }, [activeTemplateIndex, visibleTemplates.length]);

  const lastCaseProgress = getCaseProgress(lastActiveCase);
  const desktopHeroCase = ongoingCases[0] || null;
  const desktopHeroCaseProgress = getCaseProgress(desktopHeroCase);
  const canContinueDesktopHeroCase = Boolean(desktopHeroCase) && !shouldSellLifetimeAccess;
  const primaryCtaLabel = shouldSellLifetimeAccess
    ? "Unlock Lifetime Access"
    : canResumeLastCase
    ? "Continue Case"
    : "Start New Case";
  const categoryGenerateLabel = selectedCategoryMeta
    ? `Start ${compactCategoryLabel[selectedCategoryMeta.slug] || selectedCategoryMeta.title} Case`
    : "Start New Case";
  const desktopFeaturedTemplate = activeTemplate || firstUnlockedTemplate;
  const desktopFeatureTitle = canContinueDesktopHeroCase
    ? desktopHeroCase.title
    : shouldSellLifetimeAccess
    ? "Unlock Legal Arena"
    : desktopFeaturedTemplate?.title || "Start a new case";
  const desktopFeatureKicker = canContinueDesktopHeroCase
    ? "Continue Your Case"
    : shouldSellLifetimeAccess
    ? "Unlock Your Arena"
    : isNewUser
    ? "Start Your First Case"
    : "Start New Case";
  const desktopFeatureProgress = canContinueDesktopHeroCase ? desktopHeroCaseProgress.percent : 0;
  const desktopFeatureProgressFill = canContinueDesktopHeroCase
    ? Math.max(8, desktopFeatureProgress)
    : 0;
  const desktopFeatureProgressLabel = canContinueDesktopHeroCase
    ? "Intake Progress"
    : "Ready to start";
  const desktopFeatureStageCountLabel = canContinueDesktopHeroCase
    ? `Stage ${Math.max(1, Math.round(desktopFeatureProgress / 12.5))} of 8`
    : "Not started";
  const desktopFeatureStage = canContinueDesktopHeroCase
    ? desktopHeroCaseProgress.label
    : shouldSellLifetimeAccess
    ? "Lifetime Access"
    : "Client Intake";
  const desktopFeatureBody = canContinueDesktopHeroCase
    ? `${desktopHeroCaseProgress.nextStep}. ${desktopHeroCase.primaryCategory || "Your case"} is ready.`
    : shouldSellLifetimeAccess
    ? "Get permanent access to the case library, player challenges, and future updates."
    : desktopFeaturedTemplate?.overview ||
      "Choose a dispute, interview your client, and prepare for court.";
  const desktopPlaintiffName =
    (canContinueDesktopHeroCase
      ? desktopHeroCase?.plaintiffName || desktopHeroCase?.premise?.clientName
      : desktopFeaturedTemplate?.plaintiffName || desktopFeaturedTemplate?.clientName) ||
    "Plaintiff";
  const desktopDefendantName =
    (canContinueDesktopHeroCase
      ? desktopHeroCase?.defendantName || desktopHeroCase?.premise?.opponentName
      : desktopFeaturedTemplate?.defendantName || desktopFeaturedTemplate?.opponentName) ||
    "Defendant";
  const desktopHasAssignedSide = canContinueDesktopHeroCase && Boolean(desktopHeroCase?.playerSide);
  const desktopRepresentsPlaintiff =
    desktopHasAssignedSide && desktopHeroCase?.playerSide !== "opponent";
  const unlockCards = [
    {
      title: "Earn XP",
      body: "Win your first case and earn 250 XP.",
      icon: HeroIcons.SparklesIcon,
    },
    {
      title: "Climb the Rankings",
      body: "Build your win streak and rise on the board.",
      icon: HeroIcons.ArrowTrendingUpIcon,
    },
    {
      title: "Public Transcript",
      body: "Your completed case becomes part of your record.",
      icon: HeroIcons.DocumentDuplicateIcon,
    },
  ];
  const useActivationDashboard = (progression.completedCases || 0) >= 0;

  if (useActivationDashboard) {
    return (
      <main className="arena-app-shell min-h-screen max-w-full overflow-x-hidden px-3 pb-24 pt-3 md:px-6 md:py-6">
        <section className="mx-auto w-full max-w-[1600px] min-w-0 arena-reveal">
          <div className="grid min-w-0 overflow-visible gap-4 xl:grid-cols-[88px_minmax(0,1fr)]">
            <aside className="relative z-50 hidden min-h-[calc(100vh-3rem)] overflow-visible flex-col items-center justify-between rounded-[1.75rem] border border-white/10 bg-black/34 py-6 shadow-[0_22px_80px_rgba(0,0,0,0.42)] backdrop-blur-xl xl:flex">
              <nav className="relative z-50 flex flex-col items-center gap-4 overflow-visible" aria-label="Dashboard shortcuts">
                {[
                  { href: "#activation-home", label: "Home", icon: HeroIcons.HomeIcon, active: true },
                  { href: "#case-library", label: "Case Library", icon: HeroIcons.BriefcaseIcon },
                  { href: "#pvp-docket", label: "PVP Docket", icon: HeroIcons.UserGroupIcon },
                  { href: "#rankings", label: "Rankings", icon: HeroIcons.ChartBarIcon },
                  { href: "#recent-cases", label: "Saved Transcripts", icon: HeroIcons.ClipboardDocumentListIcon },
                  { href: `/dashboard/players/${userId}`, label: "Player Brief", icon: HeroIcons.UserIcon },
                ].map((item) => {
                  const Icon = item.icon;
                  const RailLink = item.href.startsWith("/") ? Link : "a";

                  return (
                    <RailLink
                      key={item.href}
                      href={item.href}
                      className={`group relative flex h-14 w-14 items-center justify-center rounded-2xl transition ${
                        item.active
                          ? "bg-amber-200/16 text-amber-100 shadow-[0_0_28px_rgba(251,191,36,0.16)]"
                          : "text-white/54 hover:bg-white/[0.04] hover:text-white"
                      }`}
                      aria-label={item.label}
                      title={item.label}
                    >
                      <Icon className="h-6 w-6" aria-hidden="true" />
                      <span className="pointer-events-none absolute left-[4.25rem] z-[100] hidden whitespace-nowrap rounded-lg border border-white/10 bg-black/95 px-3 py-2 text-xs font-semibold text-white/82 shadow-2xl group-hover:block">
                        {item.label}
                      </span>
                    </RailLink>
                  );
                })}
              </nav>

              <div className="flex flex-col items-center gap-3">
                {isAdmin ? (
                  <Link
                    href="/dashboard/admin"
                    className="flex h-12 w-12 items-center justify-center rounded-2xl text-white/54 transition hover:bg-white/[0.04] hover:text-white"
                    aria-label="Admin Lab"
                    title="Admin Lab"
                  >
                    <HeroIcons.WrenchScrewdriverIcon className="h-6 w-6" aria-hidden="true" />
                  </Link>
                ) : null}
                <button
                  type="button"
                  className="flex h-12 w-12 items-center justify-center rounded-2xl text-white/54 transition hover:bg-white/[0.04] hover:text-white"
                  onClick={() => setDashboardTutorialCompleted(false)}
                  aria-label="Take the quick tour"
                  title="Quick tour"
                >
                  <HeroIcons.Cog6ToothIcon className="h-6 w-6" aria-hidden="true" />
                </button>
              </div>
            </aside>

            <div id="activation-home" className="min-w-0 space-y-4">
              <section className="relative isolate overflow-hidden rounded-[1.75rem] border border-white/10 bg-black px-4 pb-5 pt-5 shadow-[0_26px_90px_rgba(0,0,0,0.62)] xl:hidden">
                <img
                  src="/images/court.jpg"
                  alt=""
                  className="absolute inset-0 h-full w-full object-cover opacity-28"
                  style={{ objectPosition: "63% center" }}
                />
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_64%_10%,rgba(255,255,255,0.12),transparent_26%),linear-gradient(90deg,rgba(0,0,0,0.96)_0%,rgba(0,0,0,0.82)_48%,rgba(0,0,0,0.44)_100%),linear-gradient(180deg,rgba(0,0,0,0.3)_0%,rgba(0,0,0,0.96)_82%)]" />

                <div className="relative z-10">
                  <div className="flex items-center justify-between gap-3">
                    <Link
                      href={`/dashboard/players/${userId}`}
                      className="inline-flex min-w-0 items-center gap-2 rounded-xl border border-white/10 bg-white/[0.045] px-3 py-2 text-sm font-semibold text-white/86 backdrop-blur-md transition hover:border-white/20"
                    >
                      <HeroIcons.UserCircleIcon className="h-5 w-5 shrink-0 text-white/72" aria-hidden="true" />
                      <span className="max-w-[8rem] truncate">{userName}</span>
                    </Link>
                    <Link
                      href="#rankings"
                      className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.045] px-3 py-2 text-sm font-semibold text-white/86 backdrop-blur-md transition hover:border-white/20"
                    >
                      <HeroIcons.TrophyIcon className="h-5 w-5 text-amber-200/82" aria-hidden="true" />
                      <span>Rankings</span>
                    </Link>
                  </div>

                  <div className="mt-4 flex items-center justify-center gap-2 text-white/78">
                    <img
                      src="/logoAndName.png"
                      alt=""
                      className="h-8 w-8 rounded-lg border border-white/10 bg-black object-contain"
                    />
                    <p className="text-sm font-semibold uppercase tracking-[0.16em]">
                      Legal Arena
                    </p>
                  </div>

                  <div className="mt-5">
                    <p className="text-[0.72rem] font-semibold uppercase tracking-[0.22em] text-amber-200/90">
                      Start playing
                    </p>
                    <div className="mt-3 space-y-2.5">
                      {canResumeLastCase && !shouldSellLifetimeAccess ? (
                        <Link
                          href={`/dashboard/cases/${lastActiveCase.slug || lastActiveCase.id}`}
                          data-onboarding-target={
                            isMobileActivationViewport ? "quick-start-case" : undefined
                          }
                          className="flex min-h-[5.35rem] items-center gap-3 rounded-2xl border border-amber-200/70 bg-amber-200/[0.12] px-4 py-3 text-left text-white shadow-[0_18px_50px_rgba(0,0,0,0.38),inset_0_1px_0_rgba(255,255,255,0.08)] transition hover:border-amber-100"
                        >
                          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-black/20 text-amber-100">
                            <HeroIcons.PlayCircleIcon className="h-8 w-8" aria-hidden="true" />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block text-base font-semibold uppercase tracking-[0.03em]">
                              {primaryCtaLabel}
                            </span>
                            <span className="mt-1 block text-sm leading-5 text-white/72">
                              {lastCaseProgress.nextStep}
                            </span>
                          </span>
                          <HeroIcons.ChevronRightIcon className="h-6 w-6 shrink-0 text-amber-100" aria-hidden="true" />
                        </Link>
                      ) : (
                        <button
                          data-onboarding-target={
                            isMobileActivationViewport ? "quick-start-case" : undefined
                          }
                          type="button"
                          className="flex min-h-[5.35rem] w-full items-center gap-3 rounded-2xl border border-amber-200/70 bg-amber-200/[0.12] px-4 py-3 text-left text-white shadow-[0_18px_50px_rgba(0,0,0,0.38),inset_0_1px_0_rgba(255,255,255,0.08)] transition hover:border-amber-100 disabled:cursor-not-allowed disabled:opacity-65"
                          onClick={() => {
                            if (shouldSellLifetimeAccess) {
                              setShowPaywallModal(true);
                              return;
                            }

                            handleCreateCase(null, { dynamic: true, source: "quick_start_mobile" });
                          }}
                          disabled={creating}
                        >
                          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-black/20 text-amber-100">
                            {creating && !shouldSellLifetimeAccess ? (
                              <span className="loading loading-spinner loading-sm" />
                            ) : (
                              <HeroIcons.PlayCircleIcon className="h-8 w-8" aria-hidden="true" />
                            )}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block text-base font-semibold uppercase tracking-[0.03em]">
                              {primaryCtaLabel}
                            </span>
                            <span className="mt-1 block text-sm leading-5 text-white/72">
                              {shouldSellLifetimeAccess
                                ? "Get lifetime access to every case."
                                : "Open a new case against AI counsel."}
                            </span>
                          </span>
                          <HeroIcons.ChevronRightIcon className="h-6 w-6 shrink-0 text-amber-100" aria-hidden="true" />
                        </button>
                      )}

                      <Link
                        href="#pvp-docket"
                        className={`flex items-center gap-3 rounded-2xl border px-4 py-3 text-left text-white transition ${
                          pvpAttentionCount
                            ? "border-amber-200/45 bg-amber-200/[0.11] shadow-[0_18px_55px_rgba(251,191,36,0.12)] hover:border-amber-100"
                            : "border-white/10 bg-white/[0.04] hover:border-white/20"
                        }`}
                      >
                        <HeroIcons.UserGroupIcon
                          className={`h-6 w-6 shrink-0 ${
                            pvpAttentionCount ? "text-amber-100" : "text-white/68"
                          }`}
                          aria-hidden="true"
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block font-semibold uppercase tracking-[0.03em]">PVP Docket</span>
                          <span className="mt-1 block text-sm text-white/56">
                            {pvpAttentionCount
                              ? `${pvpAttentionCount} match${
                                  pvpAttentionCount === 1 ? "" : "es"
                                } waiting on you.`
                              : "Accept and resume matches."}
                          </span>
                        </span>
                        {pvpAttentionCount ? (
                          <span className="rounded-full bg-amber-200 px-2 py-1 text-[0.65rem] font-black uppercase tracking-[0.08em] text-black">
                            First
                          </span>
                        ) : null}
                        <HeroIcons.ChevronRightIcon className="h-5 w-5 shrink-0 text-white/55" aria-hidden="true" />
                      </Link>
                      <Link
                        href="#case-library"
                        className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-left text-white transition hover:border-white/20"
                      >
                        <HeroIcons.BriefcaseIcon className="h-6 w-6 shrink-0 text-white/68" aria-hidden="true" />
                        <span className="min-w-0 flex-1">
                          <span className="block font-semibold uppercase tracking-[0.03em]">Case Library</span>
                          <span className="mt-1 block text-sm text-white/56">Browse available disputes.</span>
                        </span>
                        <HeroIcons.ChevronRightIcon className="h-5 w-5 shrink-0 text-white/55" aria-hidden="true" />
                      </Link>
                      <Link
                        href="#recent-cases"
                        className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-left text-white transition hover:border-white/20"
                      >
                        <HeroIcons.ClipboardDocumentListIcon className="h-6 w-6 shrink-0 text-white/68" aria-hidden="true" />
                        <span className="min-w-0 flex-1">
                          <span className="block font-semibold uppercase tracking-[0.03em]">My Cases</span>
                          <span className="mt-1 block text-sm text-white/56">Continue and review progress.</span>
                        </span>
                        <HeroIcons.ChevronRightIcon className="h-5 w-5 shrink-0 text-white/55" aria-hidden="true" />
                      </Link>
                      <Link
                        href="#rankings"
                        className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-left text-white transition hover:border-white/20"
                      >
                        <HeroIcons.ChartBarIcon className="h-6 w-6 shrink-0 text-white/68" aria-hidden="true" />
                        <span className="min-w-0 flex-1">
                          <span className="block font-semibold uppercase tracking-[0.03em]">Rankings</span>
                          <span className="mt-1 block text-sm text-white/56">See the leaderboard.</span>
                        </span>
                        <HeroIcons.ChevronRightIcon className="h-5 w-5 shrink-0 text-white/55" aria-hidden="true" />
                      </Link>
                    </div>
                  </div>

                  <Link
                    href={`/dashboard/players/${userId}`}
                    data-onboarding-target={
                      isMobileActivationViewport ? "player-brief" : undefined
                    }
                    className="mt-4 block rounded-2xl border border-white/10 bg-black/44 p-4 text-white backdrop-blur-md transition hover:border-white/20"
                    aria-label="Open your lawyer profile page"
                  >
                    <div className="flex items-center gap-3">
                      <LeaderboardPortrait image={userPortrait} name={userName} className="h-14 w-14" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-base font-semibold">{userName}</p>
                        <p className="mt-1 text-sm text-amber-200/82">
                          {currentLeaderboardEntry ? `Rank #${currentLeaderboardEntry.rank}` : "Rookie Advocate"}
                        </p>
                        <p className="mt-1 text-xs text-white/52">
                          {progression.wins || 0} Wins | {progression.settlements || 0} Settlements
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-sm font-semibold text-emerald-300">{progression.overallXp || 0} XP</p>
                        <p className="mt-1 text-xs text-white/58">Level {playerLevel}</p>
                      </div>
                    </div>
                    <div className="mt-4 arena-progress-track">
                      <div className="arena-progress-fill" style={{ width: `${nextLevelProgressPercent}%` }} />
                    </div>
                  </Link>

                  <button
                    type="button"
                    className="mt-4 flex w-full items-center gap-4 rounded-2xl border border-white/10 bg-white/[0.035] px-4 py-4 text-left text-white transition hover:border-white/20"
                    onClick={() => setDashboardTutorialCompleted(false)}
                  >
                    <HeroIcons.BoltIcon className="h-8 w-8 shrink-0 text-amber-200" aria-hidden="true" />
                    <span className="min-w-0 flex-1">
                      <span className="block font-semibold">New here?</span>
                      <span className="mt-1 block text-sm text-white/58">Take the quick tour.</span>
                    </span>
                    <span className="rounded-xl border border-amber-200/28 px-3 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-amber-100">
                      Start
                    </span>
                  </button>
                </div>
              </section>

              <section className="hidden xl:block">
                <div className="mb-6 flex items-start justify-between gap-6 px-1">
                  <div className="flex items-center gap-3">
                    <img
                      src="/logoAndName.png"
                      alt=""
                      className="h-10 w-10 rounded-xl border border-white/10 bg-black object-contain"
                    />
                    <div>
                      <p className="text-3xl font-black uppercase tracking-[0.08em] text-white">
                        Legal <span className="text-amber-200">Arena</span>
                      </p>
                    </div>
                  </div>
                  <div className="flex min-w-[320px] items-center gap-4">
                    <LeaderboardPortrait
                      image={userPortrait}
                      name={userName}
                      className="h-16 w-16 border-white/20 shadow-[0_0_0_5px_rgba(255,255,255,0.035)]"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-lg font-semibold text-white">{userName}</p>
                          <p className="mt-0.5 text-sm text-white/62">
                            Level {playerLevel} | {progression.overallXp || 0} XP
                          </p>
                        </div>
                        <ButtonAccount />
                      </div>
                      <div className="mt-3 flex items-center gap-2">
                        <HeroIcons.ShieldCheckIcon
                          className="h-4 w-4 shrink-0 text-emerald-300"
                          aria-hidden="true"
                        />
                        <div className="arena-progress-track h-2">
                          <div
                            className="arena-progress-fill"
                            style={{ width: `${nextLevelProgressPercent}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(340px,0.48fr)]">
                  <article className="arena-surface arena-column-bg relative min-h-[36rem] overflow-hidden border-amber-200/35">
                    <img
                      src="/images/court.jpg"
                      alt=""
                      className="absolute inset-0 h-full w-full object-cover opacity-18"
                      style={{ objectPosition: "center" }}
                    />
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_78%_34%,rgba(251,191,36,0.13),transparent_24%),linear-gradient(90deg,rgba(0,0,0,0.94)_0%,rgba(0,0,0,0.82)_53%,rgba(0,0,0,0.52)_100%),linear-gradient(180deg,rgba(0,0,0,0.12),rgba(0,0,0,0.74))]" />
                    <div className="relative z-10 grid min-h-[36rem] grid-cols-[minmax(0,1fr)_280px] gap-5 p-8">
                      <div className="flex min-w-0 flex-col justify-center">
                        <p className="arena-kicker text-amber-200">{desktopFeatureKicker}</p>
                        <h1 className="mt-6 max-w-3xl break-words text-5xl font-bold leading-tight text-white">
                          {desktopFeatureTitle}
                        </h1>
                        <div className="mt-6 flex flex-wrap items-center gap-4">
                          <span className="rounded-lg border border-emerald-300/30 bg-emerald-300/10 px-4 py-2 text-sm font-semibold text-emerald-200">
                            {desktopFeatureStage}
                          </span>
                          <span className="text-sm text-white/62">
                            {desktopFeatureStageCountLabel}
                          </span>
                        </div>
                        <div className="mt-6 flex max-w-xl items-center gap-4">
                          <span className="text-2xl font-bold text-emerald-300">
                            {desktopFeatureProgress}%
                          </span>
                          <div className="arena-progress-track h-2">
                            <div
                              className="arena-progress-fill"
                              style={{ width: `${desktopFeatureProgressFill}%` }}
                            />
                          </div>
                          <span className="shrink-0 text-sm text-white/62">
                            {desktopFeatureProgressLabel}
                          </span>
                        </div>
                        <p className="mt-6 max-w-xl text-lg leading-8 text-white/70">
                          {desktopFeatureBody}
                        </p>
                        <div className="mt-6 flex flex-wrap gap-3">
                          {desktopHasAssignedSide ? (
                            <span className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.035] px-4 py-2 text-sm text-white/74">
                              <HeroIcons.UserIcon className="h-5 w-5 text-white/52" aria-hidden="true" />
                              {desktopHeroCase?.playerSide === "opponent" ? "Defendant Side" : "Plaintiff Side"}
                            </span>
                          ) : null}
                          <span className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.035] px-4 py-2 text-sm text-white/74">
                            <HeroIcons.BriefcaseIcon className="h-5 w-5 text-white/52" aria-hidden="true" />
                            {desktopHeroCase?.primaryCategory ||
                              desktopFeaturedTemplate?.primaryCategory ||
                              "Case Library"}
                          </span>
                          <span className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.035] px-4 py-2 text-sm text-white/74">
                            <HeroIcons.ScaleIcon className="h-5 w-5 text-white/52" aria-hidden="true" />
                            {desktopHeroCase?.premise?.courtName || "County Civil Court"}
                          </span>
                        </div>
                        <div className="mt-8 flex flex-col items-start gap-4">
                          {canContinueDesktopHeroCase ? (
                            <Link
                              href={`/dashboard/cases/${desktopHeroCase.slug || desktopHeroCase.id}`}
                              data-onboarding-target="quick-start-case"
                              className="inline-flex min-h-[4rem] w-full max-w-md items-center justify-center gap-4 rounded-xl border border-amber-200/45 bg-amber-200 px-6 text-lg font-bold text-black shadow-[0_18px_40px_rgba(251,191,36,0.22)] transition hover:bg-amber-100"
                            >
                              Continue This Case
                              <HeroIcons.ChevronRightIcon className="h-6 w-6" aria-hidden="true" />
                            </Link>
                          ) : (
                            <button
                              data-onboarding-target="quick-start-case"
                              type="button"
                              className="inline-flex min-h-[4rem] w-full max-w-md items-center justify-center gap-4 rounded-xl border border-amber-200/45 bg-amber-200 px-6 text-lg font-bold text-black shadow-[0_18px_40px_rgba(251,191,36,0.22)] transition hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-60"
                              onClick={() => {
                                if (shouldSellLifetimeAccess) {
                                  trackGoal("paywall_prompt_viewed", {
                                    source: "featured_case_mobile",
                                    template_id: featuredLibraryTemplate?.id || "",
                                    category: featuredLibraryTemplate?.primaryCategory || selectedCategory,
                                  });
                                  setShowPaywallModal(true);
                                  return;
                                }

                                handleCreateCase(null, { dynamic: true, source: "quick_start_desktop" });
                              }}
                              disabled={creating}
                            >
                              {creating && !shouldSellLifetimeAccess ? (
                                <span className="loading loading-spinner loading-sm" />
                              ) : null}
                              {primaryCtaLabel}
                              <HeroIcons.ChevronRightIcon className="h-6 w-6" aria-hidden="true" />
                            </button>
                          )}
                          <a
                            href="#case-library"
                            className="inline-flex items-center gap-3 text-sm font-semibold text-white/68 transition hover:text-white"
                          >
                            Browse Case Library
                            <HeroIcons.ChevronRightIcon className="h-4 w-4" aria-hidden="true" />
                          </a>
                        </div>
                      </div>
                      <div className="flex items-center justify-center">
                        <div className="flex w-full max-w-[18rem] flex-col items-center justify-center px-4 text-center">
                          <p className="text-xs font-bold uppercase tracking-[0.18em] text-white/42">
                            Case Matchup
                          </p>
                          <div className="mt-6 w-full space-y-5">
                            <div>
                              <p className="text-[0.65rem] font-bold uppercase tracking-[0.16em] text-white/40">
                                Plaintiff
                              </p>
                              <p
                                className={`mt-2 line-clamp-3 text-4xl font-black leading-[0.95] ${
                                  desktopHasAssignedSide && desktopRepresentsPlaintiff
                                    ? "text-emerald-200 drop-shadow-[0_0_18px_rgba(52,211,153,0.2)]"
                                    : desktopHasAssignedSide
                                      ? "text-white/72"
                                      : "text-white"
                                }`}
                              >
                                {desktopPlaintiffName}
                              </p>
                            </div>
                            <p className="text-sm font-black uppercase tracking-[0.2em] text-amber-200/90">
                              vs
                            </p>
                            <div>
                              <p className="text-[0.65rem] font-bold uppercase tracking-[0.16em] text-white/40">
                                Defendant
                              </p>
                              <p
                                className={`mt-2 line-clamp-3 text-4xl font-black leading-[0.95] ${
                                  desktopHasAssignedSide && !desktopRepresentsPlaintiff
                                    ? "text-emerald-200 drop-shadow-[0_0_18px_rgba(52,211,153,0.2)]"
                                    : desktopHasAssignedSide
                                      ? "text-white/72"
                                      : "text-white"
                                }`}
                              >
                                {desktopDefendantName}
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </article>

                  <Link
                    href={`/dashboard/players/${userId}`}
                    data-onboarding-target="player-brief"
                    className="arena-surface block p-8 text-white transition hover:border-white/20"
                    aria-label="Open your lawyer profile page"
                  >
                    <p className="arena-kicker text-amber-200">Player Brief</p>
                    <div className="mt-8 flex items-center gap-5">
                      <LeaderboardPortrait
                        image={userPortrait}
                        name={userName}
                        className="h-20 w-20 border-white/20 shadow-[0_0_0_7px_rgba(255,255,255,0.035)]"
                      />
                      <div className="min-w-0">
                        <p className="truncate text-3xl font-semibold leading-tight text-white">
                          {userName}
                        </p>
                        <p className="mt-2 inline-flex items-center gap-2 text-amber-200">
                          <HeroIcons.TrophyIcon className="h-5 w-5" aria-hidden="true" />
                          {currentLeaderboardEntry ? `Rank #${currentLeaderboardEntry.rank}` : "Rookie Advocate"}
                        </p>
                      </div>
                    </div>
                    <div className="mt-8 grid grid-cols-3 gap-3">
                      <div className="rounded-xl border border-white/10 bg-white/[0.035] p-4">
                        <p className="text-xs uppercase tracking-[0.12em] text-white/48">Rank</p>
                        <p className="mt-3 text-2xl font-semibold text-white">{playerRankLabel}</p>
                      </div>
                      <div className="rounded-xl border border-white/10 bg-white/[0.035] p-4">
                        <p className="text-xs uppercase tracking-[0.12em] text-white/48">Record</p>
                        <p className="mt-3 text-2xl font-semibold text-white">{playerRecordLabel}</p>
                      </div>
                      <div className="rounded-xl border border-white/10 bg-white/[0.035] p-4">
                        <p className="text-xs uppercase tracking-[0.12em] text-white/48">Cases Won</p>
                        <p className="mt-3 text-2xl font-semibold text-white">{progression.wins || 0}</p>
                      </div>
                    </div>
                    <div className="mt-8">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-semibold text-white">XP Progress</span>
                        <span className="text-white/62">
                          <span className="font-semibold text-emerald-300">
                            {progression.overallXp || 0}
                          </span>{" "}
                          / {playerLevel * 250} XP
                        </span>
                      </div>
                      <div className="mt-3 arena-progress-track h-2">
                        <div
                          className="arena-progress-fill"
                          style={{ width: `${nextLevelProgressPercent}%` }}
                        />
                      </div>
                    </div>
                    <div className="mt-10 rounded-2xl border border-emerald-300/12 bg-emerald-300/[0.055] p-5">
                      <p className="text-lg leading-8 text-white/82">
                        <span className="mr-3 text-3xl font-serif text-emerald-300/75">“</span>
                        {playerEncouragementNote}
                        <span className="ml-2 text-3xl font-serif text-emerald-300/75">”</span>
                      </p>
                    </div>
                  </Link>
                </div>

                <div className="mt-6 grid gap-6 xl:grid-cols-4">
                  {[
                    {
                      href: "#pvp-docket",
                      title: "Open PVP Docket",
                      body: "Accept, resume, and enter player matches.",
                      icon: HeroIcons.UserGroupIcon,
                      tone: "emerald",
                    },
                    {
                      href: "#case-library",
                      title: "Start New Case",
                      body: "Choose a case type and begin your next battle.",
                      icon: HeroIcons.DocumentPlusIcon,
                      tone: "amber",
                    },
                    {
                      href: "#rankings",
                      title: "Rankings",
                      body: "Climb the leaderboard and earn stronger standing.",
                      icon: HeroIcons.TrophyIcon,
                      tone: "amber",
                    },
                    {
                      href: "#recent-cases",
                      title: "Saved Transcripts",
                      body: "Review your transcripts and key case documents.",
                      icon: HeroIcons.DocumentTextIcon,
                      tone: "amber",
                    },
                  ].map((item) => {
                    const Icon = item.icon;

                    return (
                      <a
                        key={item.href}
                        href={item.href}
                        className="arena-surface-soft flex min-h-[10rem] items-center gap-5 p-6 text-white transition hover:border-white/20"
                      >
                        <span
                          className={`flex h-20 w-20 shrink-0 items-center justify-center rounded-full border ${
                            item.tone === "emerald"
                              ? "border-emerald-300/30 bg-emerald-300/10 text-emerald-200"
                              : "border-amber-200/28 bg-amber-200/10 text-amber-100"
                          }`}
                        >
                          <Icon className="h-9 w-9" aria-hidden="true" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-xl font-semibold">{item.title}</span>
                          <span className="mt-2 block text-base leading-7 text-white/62">
                            {item.body}
                          </span>
                        </span>
                        <HeroIcons.ChevronRightIcon
                          className="h-6 w-6 shrink-0 text-white/48"
                          aria-hidden="true"
                        />
                      </a>
                    );
                  })}
                </div>
              </section>

              <PvpDocketSection
                challenges={challenges}
                activeTab={pvpDocketTab}
                onTabChange={setPvpDocketTab}
                loadTimedOut={challengesLoadTimedOut}
              />

              <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1.55fr)_minmax(320px,0.65fr)]">
                <section id="case-library" data-onboarding-target="case-library" className="arena-surface min-w-0 overflow-hidden">
                  <div className="p-4 md:p-6">
                    <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                      <div className="min-w-0">
                        <p className="arena-kicker text-amber-200">Case Library</p>
                        <h2 className="mt-2 text-2xl font-semibold leading-tight text-white md:text-3xl">
                          Pick a case
                        </h2>
                        <p className="mt-2 max-w-2xl text-sm leading-6 text-white/58">
                          Choose a practice area, pick a pressure level, then step into intake.
                        </p>
                      </div>
                      <div className="grid grid-cols-3 gap-2 rounded-2xl border border-white/10 bg-white/[0.025] p-3 text-center">
                        <div className="min-w-[5rem]">
                          <p className="text-[0.62rem] font-semibold uppercase tracking-[0.14em] text-white/38">
                            Player Level
                          </p>
                          <p className="mt-1 text-lg font-semibold text-white">{playerLevel}</p>
                        </div>
                        <div className="min-w-[5rem]">
                          <p className="text-[0.62rem] font-semibold uppercase tracking-[0.14em] text-white/38">
                            Comfort
                          </p>
                          <p className="mt-1 text-lg font-semibold text-emerald-200">
                            {selectedCapableComplexity}
                          </p>
                        </div>
                        <div className="min-w-[5rem]">
                          <p className="text-[0.62rem] font-semibold uppercase tracking-[0.14em] text-white/38">
                            Challenge
                          </p>
                          <p className="mt-1 text-lg font-semibold text-amber-200">
                            {selectedChallengeComplexityCap}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="mt-6">
                      <p className="arena-kicker">Practice Area</p>
                      <h3 className="mt-2 text-xl font-semibold text-white">
                        Pick where the dispute starts
                      </h3>
                    </div>

                    <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                      {categories.map((category) => {
                        const Icon = categoryIconMap[category.slug] || HeroIcons.Squares2X2Icon;
                        const selected = selectedCategory === category.slug;
                        const stat =
                          progression.categoryStats.find((item) => item.categorySlug === category.slug) ||
                          { unlockedComplexity: 1, completedCases: 0 };
                        const categoryCap = Math.min(
                          getPlayerComplexityCap(playerLevel),
                          stat.unlockedComplexity || 1
                        );

                        return (
                          <button
                            key={category.slug}
                            type="button"
                            className={`min-h-[6.25rem] rounded-2xl border p-3 text-left transition ${
                              selected
                                ? "border-emerald-300/70 bg-emerald-300/10 shadow-[0_0_24px_rgba(52,211,153,0.12)]"
                                : "border-white/10 bg-white/[0.025] hover:border-white/20"
                            }`}
                            onClick={() => selectCaseCategory(category.slug)}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <Icon
                                className={`h-6 w-6 shrink-0 ${
                                  selected ? "text-emerald-200" : "text-white/62"
                                }`}
                                aria-hidden="true"
                              />
                              <span className="rounded-full border border-white/10 bg-black/24 px-2 py-1 text-[0.62rem] font-semibold uppercase tracking-[0.08em] text-white/48">
                                Skill {categoryCap}
                              </span>
                            </div>
                            <p className="mt-3 text-sm font-semibold leading-5 text-white">
                              {compactCategoryLabel[category.slug] || category.title}
                            </p>
                            <p className="mt-1 text-xs text-white/45">
                              {stat.completedCases || 0} played by you
                            </p>
                          </button>
                        );
                      })}
                    </div>

                    <div className="mt-6 grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(280px,0.42fr)]">
                      <div>
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                          <div>
                            <p className="arena-kicker">Difficulty</p>
                            <h3 className="mt-2 text-xl font-semibold text-white">
                              Pick pressure level
                            </h3>
                            <p className="mt-2 max-w-xl text-sm leading-6 text-white/56">
                              Recommended: pick your comfort level, or go one level higher for a challenge.
                            </p>
                          </div>
                        </div>
                        <div className="mt-4 grid gap-3 md:grid-cols-5">
                          {dynamicDifficultyOptions.map((option) => {
                            const selected = selectedDynamicDifficulty === option.value;
                            const locked = option.value > selectedChallengeComplexityCap;
                            const stretch =
                              option.value === selectedCapableComplexity + 1 &&
                              option.value <= selectedChallengeComplexityCap;
                            const status = locked ? "Locked" : stretch ? "Stretch" : "Ready";

                            return (
                              <button
                                key={option.value}
                                type="button"
                                disabled={locked}
                                className={`flex min-h-[11.25rem] flex-col rounded-2xl border p-4 text-left transition ${
                                  selected
                                    ? "border-amber-200/70 bg-amber-200/[0.11] shadow-[0_0_28px_rgba(251,191,36,0.14)]"
                                    : locked
                                    ? "cursor-not-allowed border-white/8 bg-white/[0.015] opacity-45"
                                    : "border-white/10 bg-white/[0.025] hover:border-white/22"
                                }`}
                                onClick={() => setSelectedDifficulty(option.value)}
                              >
                                <p className="text-xs font-black uppercase tracking-[0.12em] text-white/42">
                                  {option.label}
                                </p>
                                <p className="mt-1 min-h-[1.75rem] text-lg font-semibold leading-7 text-white">
                                  {option.name}
                                </p>
                                <span
                                  className={`mt-2 inline-flex w-fit rounded-full border px-2 py-1 text-[0.6rem] font-semibold uppercase tracking-[0.08em] ${
                                    locked
                                      ? "border-white/10 text-white/42"
                                      : stretch
                                      ? "border-amber-200/35 bg-amber-200/10 text-amber-100"
                                      : "border-emerald-300/30 bg-emerald-300/10 text-emerald-200"
                                  }`}
                                >
                                  {status}
                                </span>
                                <p className="mt-3 line-clamp-3 text-xs leading-5 text-white/56">
                                  {option.summary}
                                </p>
                                <p className="mt-auto pt-3 text-xs font-semibold text-white/42">
                                  {option.time}
                                </p>
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      <aside className="rounded-2xl border border-white/10 bg-white/[0.025] p-5">
                        <p className="arena-kicker">Preview</p>
                        <h3 className="mt-3 text-2xl font-semibold leading-tight text-white">
                          {selectedCategoryTitle}
                        </h3>
                        <div className="mt-4 flex flex-wrap gap-2">
                          <span className="rounded-full border border-amber-200/30 bg-amber-200/10 px-3 py-1 text-xs font-semibold text-amber-100">
                            {selectedDynamicDifficultyMeta.label}
                          </span>
                          <span className="rounded-full border border-white/10 bg-black/24 px-3 py-1 text-xs font-semibold text-white/58">
                            {selectedDynamicDifficultyMeta.time}
                          </span>
                          {selectedDynamicDifficulty === selectedCapableComplexity + 1 ? (
                            <span className="rounded-full border border-rose-200/25 bg-rose-300/10 px-3 py-1 text-xs font-semibold text-rose-100">
                              Stretch pick
                            </span>
                          ) : null}
                        </div>
                        <p className="mt-4 text-sm leading-6 text-white/58">
                          {selectedDynamicDifficultyMeta.summary}
                        </p>
                        <p className="mt-3 rounded-xl border border-white/8 bg-black/20 px-3 py-2 text-xs leading-5 text-white/48">
                          You may represent either side. Facts and proof will vary.
                        </p>
                        <div className="mt-5 space-y-2">
                          {selectedDynamicDifficultyMeta.skills.map((skill) => (
                            <div
                              key={skill}
                              className="flex items-center gap-2 rounded-xl border border-white/8 bg-black/20 px-3 py-2 text-sm text-white/64"
                            >
                              <HeroIcons.CheckCircleIcon
                                className="h-4 w-4 shrink-0 text-emerald-300/80"
                                aria-hidden="true"
                              />
                              <span>{skill}</span>
                            </div>
                          ))}
                        </div>
                        <button
                          type="button"
                          className="mt-5 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-amber-200/35 bg-amber-200 px-4 py-3 text-sm font-black uppercase tracking-[0.08em] text-black shadow-[0_16px_38px_rgba(251,191,36,0.16)] transition hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-60"
                          onClick={handleGenerateSelectedCategoryCase}
                          disabled={creating || !selectedDifficultyAvailable}
                        >
                          {creating ? (
                            <span className="loading loading-spinner loading-xs" />
                          ) : (
                            <HeroIcons.BoltIcon className="h-4 w-4" aria-hidden="true" />
                          )}
                          <span>{creating ? "Starting" : "Start Case"}</span>
                        </button>
                      </aside>
                    </div>
                  </div>
                </section>

                <section id="legacy-case-library" className="hidden">
                  <div className="md:hidden">
                    <div className="border-b border-white/10 px-4 py-4">
                      <div className="flex items-center justify-between gap-3">
                        <a
                          href="#activation-home"
                          className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/[0.035] text-white/70"
                          aria-label="Back to dashboard home"
                        >
                          <HeroIcons.ArrowLeftIcon className="h-5 w-5" aria-hidden="true" />
                        </a>
                        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-amber-200">
                          Case Library
                        </p>
                        <label className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/[0.035] text-white/70">
                          <span className="sr-only">Playable only</span>
                          <input
                            type="checkbox"
                            className="peer sr-only"
                            checked={showPlayableOnly}
                            onChange={(event) => setShowPlayableOnly(event.target.checked)}
                          />
                          <HeroIcons.AdjustmentsHorizontalIcon
                            className="h-5 w-5 transition peer-checked:text-emerald-300"
                            aria-hidden="true"
                          />
                        </label>
                      </div>
                      <h2 className="mt-5 text-2xl font-semibold leading-tight text-white">
                        Choose your case
                      </h2>
                      <p className="mt-1 text-sm text-white/56">
                        {templates.length}+ cases across {categories.length}+ categories.
                      </p>
                      <div className="relative mt-4">
                        <HeroIcons.MagnifyingGlassIcon
                          className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-white/42"
                          aria-hidden="true"
                        />
                        <input
                          type="search"
                          value={caseLibrarySearch}
                          onChange={(event) => setCaseLibrarySearch(event.target.value)}
                          placeholder="Search cases, topics, or skills..."
                          aria-label="Search cases, topics, or skills"
                          className="h-11 w-full rounded-xl border border-white/10 bg-black/35 pl-10 pr-3 text-sm font-semibold text-white outline-none transition placeholder:text-white/35 focus:border-emerald-300/45"
                        />
                      </div>
                    </div>

                    <div className="px-4 py-4">
                      <div
                        data-onboarding-target="case-categories"
                        className="grid grid-cols-4 gap-1.5"
                      >
                        <button
                          type="button"
                          className={`flex min-h-[4.05rem] min-w-0 flex-col items-center justify-center gap-1 rounded-xl border px-1.5 text-center transition ${
                            !selectedCategory
                              ? "border-emerald-300 bg-emerald-300/10 text-emerald-200 shadow-[0_0_22px_rgba(52,211,153,0.12)]"
                              : "border-white/10 bg-white/[0.03] text-white/70 hover:border-white/20"
                          }`}
                          onClick={() => selectCaseCategory("")}
                        >
                          <HeroIcons.Squares2X2Icon className="h-4 w-4" aria-hidden="true" />
                          <span className="line-clamp-2 text-[0.56rem] font-semibold leading-tight">
                            All
                          </span>
                        </button>
                        {visibleMobileCategories.map((category) => {
                          const Icon = categoryIconMap[category.slug] || HeroIcons.Squares2X2Icon;
                          const selected = selectedCategory === category.slug;

                          return (
                            <button
                              key={category.slug}
                              type="button"
                              className={`flex min-h-[4.05rem] min-w-0 flex-col items-center justify-center gap-1 rounded-xl border px-1.5 text-center transition ${
                                selected
                                  ? "border-emerald-300 bg-emerald-300/10 text-emerald-200 shadow-[0_0_22px_rgba(52,211,153,0.12)]"
                                  : "border-white/10 bg-white/[0.03] text-white/70 hover:border-white/20"
                              }`}
                              onClick={() => selectCaseCategory(category.slug)}
                            >
                              <Icon className="h-4 w-4" aria-hidden="true" />
                              <span className="line-clamp-2 text-[0.56rem] font-semibold leading-tight">
                                {compactCategoryLabel[category.slug] || category.title}
                              </span>
                            </button>
                          );
                        })}
                        <button
                          type="button"
                          className={`flex min-h-[4.05rem] min-w-0 items-center justify-center rounded-xl border px-1.5 text-center transition ${
                            showAllCaseCategories
                              ? "border-amber-200/35 bg-amber-300/10 text-amber-100"
                              : "border-white/10 bg-white/[0.03] text-white/70 hover:border-white/20"
                          }`}
                          onClick={() => setShowAllCaseCategories((current) => !current)}
                          aria-expanded={showAllCaseCategories}
                          aria-label={
                            showAllCaseCategories
                              ? "Hide additional case categories"
                              : "Show additional case categories"
                          }
                        >
                          <HeroIcons.EllipsisHorizontalIcon className="h-6 w-6" aria-hidden="true" />
                        </button>
                      </div>

                      <div className="mt-3 border-t border-white/8 pt-4">
                        <p className="text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-white/42">
                          Difficulty
                        </p>
                        <div className="mt-2 grid grid-cols-4 gap-2">
                          {difficultyOptions.map((option) => (
                            <button
                              key={option.value}
                              type="button"
                              className={`h-9 rounded-lg border text-xs font-semibold transition ${
                                selectedDifficulty === option.value
                                  ? option.value === "all"
                                    ? "border-emerald-300/40 bg-emerald-300/10 text-emerald-200"
                                    : getDifficultyMeta(
                                        option.value === "hard" ? 4 : option.value === "medium" ? 2 : 1
                                      ).className
                                  : "border-white/10 bg-white/[0.025] text-white/58"
                              }`}
                              onClick={() => {
                                setSelectedDifficulty(option.value);
                                setActiveTemplateIndex(0);
                              }}
                            >
                              {option.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      <button
                        type="button"
                        className="mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-amber-200/35 bg-amber-200 px-4 py-3 text-sm font-black uppercase tracking-[0.08em] text-black shadow-[0_16px_38px_rgba(251,191,36,0.16)] transition hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-60"
                        onClick={handleGenerateSelectedCategoryCase}
                        disabled={creating}
                      >
                        {creating ? (
                          <span className="loading loading-spinner loading-xs" />
                        ) : (
                          <HeroIcons.BoltIcon className="h-4 w-4" aria-hidden="true" />
                        )}
                        <span>{creating ? "Generating" : categoryGenerateLabel}</span>
                      </button>

                      <div className="mt-5 flex items-center justify-between gap-3">
                        <p className="text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-white/42">
                          Recommended for you
                        </p>
                        <p className="text-xs font-semibold text-white/60">
                          {searchedLibraryTemplates.length} matches
                        </p>
                      </div>

                      {featuredLibraryTemplate ? (
                        <div className="mt-3 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.035] shadow-[0_18px_55px_rgba(0,0,0,0.34)]">
                          <div className="relative min-h-[11.5rem] p-4">
                            <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_12%,rgba(52,211,153,0.18),transparent_30%),linear-gradient(135deg,rgba(255,255,255,0.08),transparent_34%),linear-gradient(180deg,rgba(0,0,0,0.12),rgba(0,0,0,0.68))]" />
                            <div className="relative z-10">
                              <div className="flex items-start justify-between gap-3">
                                <span
                                  className={`rounded-full border px-2.5 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.08em] ${
                                    getDifficultyMeta(featuredLibraryTemplate.complexity).className
                                  }`}
                                >
                                  {getDifficultyMeta(featuredLibraryTemplate.complexity).label}
                                </span>
                                <button
                                  type="button"
                                  className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-black/25 text-white/70"
                                  aria-label="Save case"
                                >
                                  <HeroIcons.StarIcon className="h-5 w-5" aria-hidden="true" />
                                </button>
                              </div>
                              <h3 className="mt-7 line-clamp-2 text-xl font-semibold leading-tight text-white">
                                {featuredLibraryTemplate.title}
                              </h3>
                              <p className="mt-2 line-clamp-2 text-sm leading-6 text-white/66">
                                {featuredLibraryTemplate.overview}
                              </p>
                              <div className="mt-3 flex flex-wrap gap-2">
                                <span className="rounded-full border border-white/10 bg-black/22 px-2.5 py-1 text-[0.68rem] font-semibold text-white/70">
                                  {selectedCategoryTitle}
                                </span>
                                <span className="rounded-full border border-white/10 bg-black/22 px-2.5 py-1 text-[0.68rem] font-semibold text-white/70">
                                  {featuredLibraryTemplate.practiceArea}
                                </span>
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-3 border-t border-white/10 px-4 py-3">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-emerald-300/30 bg-emerald-300/10 text-xs font-semibold text-emerald-200">
                              {canResumeFeaturedLibraryCase
                                ? `${featuredLibraryCaseProgress.percent}%`
                                : "GO"}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-xs font-semibold text-white/58">
                                {canResumeFeaturedLibraryCase ? "Intake Progress" : "Ready to start"}
                              </p>
                              <div className="mt-2 arena-progress-track">
                                <div
                                  className="arena-progress-fill"
                                  style={{
                                    width: `${
                                      canResumeFeaturedLibraryCase
                                        ? featuredLibraryCaseProgress.percent
                                        : 0
                                    }%`,
                                  }}
                                />
                              </div>
                            </div>
                            <button
                              type="button"
                              className="inline-flex min-h-0 items-center gap-2 rounded-xl border border-amber-200/25 bg-amber-300/14 px-3 py-2.5 text-xs font-semibold text-amber-100 disabled:cursor-not-allowed disabled:opacity-60"
                              onClick={() => {
                                if (shouldSellLifetimeAccess) {
                                  trackGoal("paywall_prompt_viewed", {
                                    source: "featured_case_desktop",
                                    template_id: featuredLibraryTemplate.id,
                                    category: featuredLibraryTemplate.primaryCategory,
                                  });
                                  setShowPaywallModal(true);
                                  return;
                                }

                                if (canResumeFeaturedLibraryCase && featuredLibraryCaseHref) {
                                  startNavigationLoading("Opening the matter", { failsafeMs: 60000 });
                                  router.push(featuredLibraryCaseHref);
                                  return;
                                }

                                handleCreateCase(featuredLibraryTemplate.id);
                              }}
                              disabled={
                                creating ||
                                (!shouldSellLifetimeAccess && !featuredLibraryTemplate.unlocked)
                              }
                            >
                              <span>
                                {shouldSellLifetimeAccess
                                  ? "Unlock"
                                  : canResumeFeaturedLibraryCase
                                  ? "Continue"
                                  : "Enter"}
                              </span>
                              <HeroIcons.ChevronRightIcon className="h-4 w-4" aria-hidden="true" />
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="mt-3 rounded-2xl border border-dashed border-white/12 bg-white/[0.025] p-6 text-center">
                          <p className="text-sm font-semibold text-white">No matching cases</p>
                          <p className="mt-2 text-sm text-white/54">
                            Try a different category, difficulty, or search term.
                          </p>
                        </div>
                      )}

                      {moreLibraryTemplates.length > 0 ? (
                        <div className="mt-6">
                          <p className="text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-white/42">
                            More cases
                          </p>
                          <div className="mt-3 space-y-2.5">
                            {moreLibraryTemplates.map((template) => {
                              const Icon =
                                categoryIconMap[template.primaryCategory] || HeroIcons.BriefcaseIcon;
                              const difficulty = getDifficultyMeta(template.complexity);

                              return (
                                <button
                                  key={`mobile-case-${template.id}`}
                                  type="button"
                                  className="flex w-full items-center gap-3 rounded-xl border border-white/10 bg-white/[0.025] p-3 text-left transition hover:border-white/20"
                                  onClick={() => {
                                    const nextIndex = visibleTemplates.findIndex(
                                      (item) => item.id === template.id
                                    );

                                    if (nextIndex >= 0) {
                                      setActiveTemplateIndex(nextIndex);
                                    }
                                  }}
                                >
                                  <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-black/28 text-white/70">
                                    <Icon className="h-6 w-6" aria-hidden="true" />
                                  </span>
                                  <span className="min-w-0 flex-1">
                                    <span className="flex items-center gap-2">
                                      <span
                                        className={`rounded-full border px-2 py-0.5 text-[0.6rem] font-semibold uppercase tracking-[0.06em] ${difficulty.className}`}
                                      >
                                        {difficulty.label}
                                      </span>
                                      <span className="text-[0.68rem] font-semibold text-white/48">
                                        {template.complexity <= 1 ? "10-15 min" : template.complexity <= 3 ? "20-25 min" : "30+ min"}
                                      </span>
                                    </span>
                                    <span className="mt-1.5 line-clamp-1 block text-sm font-semibold text-white">
                                      {template.title}
                                    </span>
                                    <span className="mt-1 line-clamp-1 block text-xs text-white/48">
                                      {template.practiceArea}
                                    </span>
                                  </span>
                                  <HeroIcons.ChevronRightIcon className="h-5 w-5 shrink-0 text-amber-200/70" aria-hidden="true" />
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      ) : null}
                    </div>
                  </div>

                  <div className="hidden p-4 md:block md:p-6">
                    <div className="flex flex-col gap-4">
                      <div className="min-w-0">
                        <p className="arena-kicker text-amber-200">Case Library</p>
                        <h2 className="mt-2 text-2xl font-semibold leading-tight text-white">
                          Choose your case
                        </h2>
                        <p className="mt-1 text-sm text-white/56">
                          {templates.length}+ cases across {categories.length}+ categories.
                        </p>
                      </div>
                      <div className="grid min-w-0 gap-3 lg:grid-cols-[minmax(0,1fr)_auto]">
                        <div className="relative min-w-0">
                          <HeroIcons.MagnifyingGlassIcon
                            className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-white/42"
                            aria-hidden="true"
                          />
                          <input
                            type="search"
                            value={caseLibrarySearch}
                            onChange={(event) => setCaseLibrarySearch(event.target.value)}
                            placeholder="Search cases, topics, or skills..."
                            aria-label="Search cases, topics, or skills"
                            className="h-11 w-full rounded-xl border border-white/10 bg-black/35 pl-10 pr-3 text-sm font-semibold text-white outline-none transition placeholder:text-white/35 focus:border-emerald-300/45"
                          />
                        </div>
                        <label className="inline-flex h-11 cursor-pointer items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.035] px-3 text-xs font-semibold text-white/78 transition hover:border-white/18 hover:text-white">
                          <input
                            type="checkbox"
                            className="checkbox checkbox-sm rounded border-white/25 bg-black/35 [--chkbg:#34d399] [--chkfg:#050505] checked:border-emerald-300 checked:bg-emerald-300"
                            checked={showPlayableOnly}
                            onChange={(event) => setShowPlayableOnly(event.target.checked)}
                          />
                          <span>Playable only</span>
                        </label>
                      </div>
                    </div>

                    <div
                      data-onboarding-target="case-categories"
                      className="mt-5 grid grid-cols-4 gap-2 lg:grid-cols-6 xl:grid-cols-5 2xl:grid-cols-6"
                    >
                      <button
                        type="button"
                        className={`flex min-h-[4.5rem] min-w-0 flex-col items-center justify-center gap-1.5 rounded-xl border px-2 text-center transition ${
                          !selectedCategory
                            ? "border-emerald-300 bg-emerald-300/10 text-emerald-200 shadow-[0_0_22px_rgba(52,211,153,0.12)]"
                            : "border-white/10 bg-white/[0.03] text-white/70 hover:border-white/20"
                        }`}
                        onClick={() => selectCaseCategory("")}
                      >
                        <HeroIcons.Squares2X2Icon className="h-5 w-5" aria-hidden="true" />
                        <span className="line-clamp-2 text-[0.68rem] font-semibold leading-tight">
                          All
                        </span>
                      </button>
                      {categories.map((category) => {
                        const Icon = categoryIconMap[category.slug] || HeroIcons.Squares2X2Icon;
                        const selected = selectedCategory === category.slug;

                        return (
                          <button
                            key={category.slug}
                            type="button"
                            className={`flex min-h-[4.5rem] min-w-0 flex-col items-center justify-center gap-1.5 rounded-xl border px-2 text-center transition ${
                              selected
                                ? "border-emerald-300 bg-emerald-300/10 text-emerald-200 shadow-[0_0_22px_rgba(52,211,153,0.12)]"
                                : "border-white/10 bg-white/[0.03] text-white/70 hover:border-white/20"
                            }`}
                            onClick={() => selectCaseCategory(category.slug)}
                          >
                            <Icon className="h-5 w-5" aria-hidden="true" />
                            <span className="line-clamp-2 text-[0.68rem] font-semibold leading-tight">
                              {compactCategoryLabel[category.slug] || category.title}
                            </span>
                          </button>
                        );
                      })}
                    </div>

                    <div className="mt-4 flex flex-col gap-3 border-t border-white/8 pt-4 lg:flex-row lg:items-center lg:justify-between">
                      <div>
                        <p className="text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-white/42">
                          Difficulty
                        </p>
                        <div className="mt-2 grid grid-cols-4 gap-2 sm:w-[28rem]">
                          {difficultyOptions.map((option) => (
                            <button
                              key={option.value}
                              type="button"
                              className={`h-9 rounded-lg border text-xs font-semibold transition ${
                                selectedDifficulty === option.value
                                  ? option.value === "all"
                                    ? "border-emerald-300/40 bg-emerald-300/10 text-emerald-200"
                                    : getDifficultyMeta(
                                        option.value === "hard"
                                          ? 4
                                          : option.value === "medium"
                                          ? 2
                                          : 1
                                      ).className
                                  : "border-white/10 bg-white/[0.025] text-white/58 hover:border-white/20"
                              }`}
                              onClick={() => {
                                setSelectedDifficulty(option.value);
                                setActiveTemplateIndex(0);
                              }}
                            >
                              {option.label}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div className="flex flex-col items-start gap-2 lg:items-end">
                        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-white/42">
                          {searchedLibraryTemplates.length} matches
                        </p>
                        <button
                          type="button"
                          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-amber-200/35 bg-amber-200 px-4 py-3 text-sm font-black uppercase tracking-[0.08em] text-black shadow-[0_16px_38px_rgba(251,191,36,0.16)] transition hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-60"
                          onClick={handleGenerateSelectedCategoryCase}
                          disabled={creating}
                        >
                          {creating ? (
                            <span className="loading loading-spinner loading-xs" />
                          ) : (
                            <HeroIcons.BoltIcon className="h-4 w-4" aria-hidden="true" />
                          )}
                          <span>{creating ? "Generating" : categoryGenerateLabel}</span>
                        </button>
                      </div>
                    </div>

                    {featuredLibraryTemplate ? (
                      <div className="mt-5 grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(260px,0.58fr)]">
                        <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.035] shadow-[0_18px_55px_rgba(0,0,0,0.34)]">
                          <div className="relative min-h-[16rem] p-5 md:p-6">
                            <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_12%,rgba(52,211,153,0.18),transparent_30%),radial-gradient(circle_at_84%_18%,rgba(251,191,36,0.12),transparent_28%),linear-gradient(135deg,rgba(255,255,255,0.08),transparent_34%),linear-gradient(180deg,rgba(0,0,0,0.08),rgba(0,0,0,0.72))]" />
                            <div className="relative z-10 flex h-full min-h-[13rem] flex-col">
                              <div className="flex flex-wrap items-start justify-between gap-2">
                                <span
                                  className={`rounded-full border px-2.5 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.08em] ${
                                    getDifficultyMeta(featuredLibraryTemplate.complexity).className
                                  }`}
                                >
                                  {getDifficultyMeta(featuredLibraryTemplate.complexity).label}
                                </span>
                                <span className="max-w-full rounded-full border border-white/10 bg-black/24 px-3 py-1 text-xs font-semibold text-white/62">
                                  {carouselStatus}
                                </span>
                              </div>
                              <div className="mt-auto max-w-3xl">
                                <p className="text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-white/42">
                                  Recommended for you
                                </p>
                                <h3 className="mt-3 line-clamp-2 text-3xl font-semibold leading-tight text-white">
                                  {featuredLibraryTemplate.title}
                                </h3>
                                <p className="mt-3 line-clamp-2 text-sm leading-6 text-white/66">
                                  {featuredLibraryTemplate.overview}
                                </p>
                                <div className="mt-4 flex flex-wrap gap-2">
                                  <span className="rounded-full border border-white/10 bg-black/22 px-2.5 py-1 text-[0.68rem] font-semibold text-white/70">
                                    {selectedCategoryTitle}
                                  </span>
                                  <span className="rounded-full border border-white/10 bg-black/22 px-2.5 py-1 text-[0.68rem] font-semibold text-white/70">
                                    {featuredLibraryTemplate.practiceArea}
                                  </span>
                                  <span className="rounded-full border border-white/10 bg-black/22 px-2.5 py-1 text-[0.68rem] font-semibold text-white/70">
                                    {featuredLibraryTemplate.complexity <= 1
                                      ? "10-15 min"
                                      : featuredLibraryTemplate.complexity <= 3
                                      ? "20-25 min"
                                      : "30+ min"}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>
                          <div className="flex flex-col gap-3 border-t border-white/10 px-5 py-4 sm:flex-row sm:items-center">
                            <div className="flex min-w-0 flex-1 items-center gap-3">
                              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-emerald-300/30 bg-emerald-300/10 text-xs font-semibold text-emerald-200">
                                {canResumeFeaturedLibraryCase
                                  ? `${featuredLibraryCaseProgress.percent}%`
                                  : "GO"}
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="text-xs font-semibold text-white/58">
                                  {canResumeFeaturedLibraryCase ? "Intake Progress" : "Ready to start"}
                                </p>
                                <div className="mt-2 arena-progress-track">
                                  <div
                                    className="arena-progress-fill"
                                    style={{
                                      width: `${
                                        canResumeFeaturedLibraryCase
                                          ? featuredLibraryCaseProgress.percent
                                          : 0
                                      }%`,
                                    }}
                                  />
                                </div>
                              </div>
                            </div>
                            <button
                              type="button"
                              className="inline-flex min-h-0 items-center justify-center gap-2 rounded-xl border border-amber-200/35 bg-amber-200 px-4 py-3 text-sm font-semibold text-black transition hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-60"
                              onClick={() => {
                                if (shouldSellLifetimeAccess) {
                                  setShowPaywallModal(true);
                                  return;
                                }

                                if (canResumeFeaturedLibraryCase && featuredLibraryCaseHref) {
                                  startNavigationLoading("Opening the matter", { failsafeMs: 60000 });
                                  router.push(featuredLibraryCaseHref);
                                  return;
                                }

                                handleCreateCase(featuredLibraryTemplate.id);
                              }}
                              disabled={
                                creating ||
                                (!shouldSellLifetimeAccess && !featuredLibraryTemplate.unlocked)
                              }
                            >
                              {creating && !shouldSellLifetimeAccess ? (
                                <span className="loading loading-spinner loading-xs" />
                              ) : null}
                              <span>
                                {shouldSellLifetimeAccess
                                  ? "Unlock"
                                  : canResumeFeaturedLibraryCase
                                  ? "Continue"
                                  : featuredLibraryTemplate.unlocked
                                  ? "Enter"
                                  : "Locked"}
                              </span>
                              {featuredLibraryTemplate.unlocked || shouldSellLifetimeAccess ? (
                                <HeroIcons.ChevronRightIcon className="h-4 w-4" aria-hidden="true" />
                              ) : (
                                <HeroIcons.LockClosedIcon className="h-4 w-4" aria-hidden="true" />
                              )}
                            </button>
                          </div>
                        </div>

                        <div className="arena-surface-soft min-w-0 p-4">
                          <div className="flex items-center justify-between gap-3">
                            <p className="text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-white/42">
                              More cases
                            </p>
                            <span className="text-xs font-semibold text-white/48">
                              {moreLibraryTemplates.length}
                            </span>
                          </div>
                          <div className="mt-3 space-y-2.5">
                            {moreLibraryTemplates.length > 0 ? (
                              moreLibraryTemplates.map((template) => {
                                const difficulty = getDifficultyMeta(template.complexity);

                                return (
                                  <button
                                    key={`desktop-case-${template.id}`}
                                    type="button"
                                    className="flex w-full items-center gap-3 rounded-xl border border-white/10 bg-white/[0.025] p-3 text-left transition hover:border-white/20"
                                    onClick={() => {
                                      const nextIndex = visibleTemplates.findIndex(
                                        (item) => item.id === template.id
                                      );

                                      if (nextIndex >= 0) {
                                        setActiveTemplateIndex(nextIndex);
                                      }
                                    }}
                                  >
                                    <span className="mt-2.5 h-2 w-2 shrink-0 rounded-full bg-amber-200/75 shadow-[0_0_12px_rgba(251,191,36,0.28)]" />
                                    <span className="min-w-0 flex-1">
                                      <span className="flex flex-wrap items-center gap-2">
                                        <span
                                          className={`rounded-full border px-2 py-0.5 text-[0.6rem] font-semibold uppercase tracking-[0.06em] ${difficulty.className}`}
                                        >
                                          {difficulty.label}
                                        </span>
                                        <span className="text-[0.68rem] font-semibold text-white/48">
                                          {template.complexity <= 1
                                            ? "10-15 min"
                                            : template.complexity <= 3
                                            ? "20-25 min"
                                            : "30+ min"}
                                        </span>
                                      </span>
                                      <span className="mt-1.5 block text-sm font-semibold leading-5 text-white">
                                        {template.title}
                                      </span>
                                      <span className="mt-1 line-clamp-1 block text-xs text-white/48">
                                        {template.practiceArea}
                                      </span>
                                    </span>
                                    <HeroIcons.ChevronRightIcon
                                      className="h-5 w-5 shrink-0 text-amber-200/70"
                                      aria-hidden="true"
                                    />
                                  </button>
                                );
                              })
                            ) : (
                              <div className="rounded-xl border border-dashed border-white/10 bg-black/20 p-4 text-sm text-white/45">
                                No related cases match these filters.
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="mt-5 rounded-2xl border border-dashed border-white/12 bg-white/[0.025] p-8 text-center">
                        <p className="text-lg font-semibold text-white">No matching cases</p>
                        <p className="mt-2 text-sm text-white/62">
                          Try a different category, difficulty, or search term.
                        </p>
                      </div>
                    )}
                  </div>
                </section>

                <section id="progress" className="arena-surface min-w-0">
                  <div className="p-4 md:p-6">
                    <p className="arena-kicker">What you&apos;ll unlock</p>
                    <div className="mt-5 space-y-3">
                      {unlockCards.map((card) => (
                        <div key={card.title} className="arena-surface-soft flex min-w-0 gap-3 p-4">
                          <IconTile icon={card.icon} />
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-white">{card.title}</p>
                            <p className="mt-1 text-sm leading-6 text-white/55">{card.body}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                    <p className="mt-6 text-sm leading-7 text-white/56">
                      Every case you win makes you a stronger advocate.
                    </p>
                  </div>
                </section>

              </div>

              <section
                id="recent-cases"
                data-onboarding-target="recent-matters"
                className="arena-surface overflow-hidden"
              >
                <div className="md:hidden">
                  <div className="border-b border-white/10 px-4 py-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-amber-200">
                          Your Cases
                        </p>
                        <h2 className="mt-2 text-2xl font-semibold leading-tight text-white">
                          Continue your docket
                        </h2>
                      </div>
                      <span className="rounded-full border border-white/10 bg-white/[0.035] px-3 py-1.5 text-xs font-semibold text-white/62">
                        {initialCases.length} total
                      </span>
                    </div>
                    <div className="mt-4 grid grid-cols-2 gap-1 rounded-xl border border-white/[0.055] bg-white/[0.025] p-1">
                      {[
                        { value: "ongoing", label: "Ongoing", count: ongoingCases.length },
                        { value: "finished", label: "Finished", count: finishedCases.length },
                      ].map((tab) => (
                        <button
                          key={`mobile-case-tab-${tab.value}`}
                          type="button"
                          className={`rounded-lg px-3 py-2 text-xs font-semibold uppercase tracking-[0.08em] transition ${
                            caseArchiveTab === tab.value
                              ? "bg-amber-200/[0.09] text-amber-100 shadow-[inset_0_0_0_1px_rgba(251,191,36,0.08)]"
                              : "text-white/42 hover:bg-white/[0.035] hover:text-white/74"
                          }`}
                          onClick={() => setCaseArchiveTab(tab.value)}
                        >
                          {tab.label} {tab.count}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="px-4 py-4">
                    {selectedArchiveCases.length > 0 ? (
                      <Link
                        href={`/dashboard/cases/${selectedArchiveCases[0].slug || selectedArchiveCases[0].id}`}
                        className="block overflow-hidden rounded-2xl border border-white/10 bg-white/[0.035] text-white shadow-[0_18px_55px_rgba(0,0,0,0.34)] transition hover:border-white/20"
                      >
                        <div className="relative min-h-[10.75rem] p-4">
                          <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_8%,rgba(251,191,36,0.16),transparent_28%),radial-gradient(circle_at_82%_18%,rgba(52,211,153,0.12),transparent_28%),linear-gradient(180deg,rgba(255,255,255,0.06),rgba(0,0,0,0.64))]" />
                          <div className="relative z-10">
                            {(() => {
                              const featuredCase = selectedArchiveCases[0];
                              const featuredProgress = getCaseProgress(featuredCase);
                              const featuredSeverity = statusSeverity[featuredCase.status] || "neutral";

                              return (
                                <>
                            <div className="flex items-start justify-between gap-3">
                              <span
                                className={`rounded-full border px-2.5 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.08em] arena-status ${
                                  severityClass[featuredSeverity]
                                }`}
                              >
                                {statusLabel[featuredCase.status] || featuredProgress.label}
                              </span>
                              <span className="flex h-10 w-10 items-center justify-center rounded-full border border-emerald-300/30 bg-emerald-300/10 text-xs font-semibold text-emerald-200">
                                {featuredProgress.percent}%
                              </span>
                            </div>
                            <h3 className="mt-7 line-clamp-2 text-xl font-semibold leading-tight">
                              {featuredCase.title}
                            </h3>
                            <p className="mt-2 text-sm leading-6 text-white/62">
                              {featuredCase.primaryCategory} | Updated {formatDate(featuredCase.updatedAt)}
                            </p>
                                </>
                              );
                            })()}
                          </div>
                        </div>
                        <div className="flex items-center gap-3 border-t border-white/10 px-4 py-3">
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-semibold text-white/58">
                              {caseArchiveTab === "finished" ? "Review the ruling" : "Continue the file"}
                            </p>
                            <div className="mt-2 arena-progress-track">
                              <div
                                className="arena-progress-fill"
                                style={{ width: `${Math.max(8, getCaseProgress(selectedArchiveCases[0]).percent)}%` }}
                              />
                            </div>
                          </div>
                          <span className="inline-flex items-center gap-2 rounded-xl border border-amber-200/25 bg-amber-300/14 px-3 py-2.5 text-xs font-semibold text-amber-100">
                            {caseArchiveTab === "finished" ? "View" : "Continue"}
                            <HeroIcons.ChevronRightIcon className="h-4 w-4" aria-hidden="true" />
                          </span>
                        </div>
                      </Link>
                    ) : (
                      <div className="rounded-2xl border border-dashed border-white/12 bg-white/[0.025] p-6 text-center">
                        <p className="text-sm font-semibold text-white">No cases opened yet</p>
                        <p className="mt-2 text-sm text-white/54">
                          No {caseArchiveTab} cases yet.
                        </p>
                      </div>
                    )}

                    {selectedArchiveCases.length > 1 ? (
                      <div className="mt-6">
                        <p className="text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-white/42">
                          Recent files
                        </p>
                        <div className="mt-3 space-y-2.5">
                          {selectedArchiveCases
                            .slice(1)
                            .slice(0, 5)
                            .map((item) => {
                              const caseProgress = getCaseProgress(item);
                              const caseSeverity = statusSeverity[item.status] || "neutral";
                              const Icon = categoryIconMap[item.primaryCategory] || HeroIcons.DocumentTextIcon;

                              return (
                                <Link
                                  key={item.id}
                                  href={`/dashboard/cases/${item.slug || item.id}`}
                                  className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.025] p-3 text-left transition hover:border-white/20"
                                >
                                  <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-black/28 text-white/70">
                                    <Icon className="h-6 w-6" aria-hidden="true" />
                                  </span>
                                  <span className="min-w-0 flex-1">
                                    <span
                                      className={`rounded-full border px-2 py-0.5 text-[0.6rem] font-semibold uppercase tracking-[0.06em] arena-status ${severityClass[caseSeverity]}`}
                                    >
                                      {statusLabel[item.status] || "In Progress"}
                                    </span>
                                    <span className="mt-1.5 line-clamp-1 block text-sm font-semibold text-white">
                                      {item.title}
                                    </span>
                                    <span className="mt-1 line-clamp-1 block text-xs text-white/48">
                                      {item.primaryCategory} | Updated {formatDate(item.updatedAt)}
                                    </span>
                                  </span>
                                  <span className="shrink-0 text-xs font-semibold text-white/58">
                                    {caseProgress.percent}%
                                  </span>
                                </Link>
                              );
                            })}
                        </div>
                      </div>
                    ) : null}

                    <button
                      type="button"
                      className="mt-4 flex w-full items-center gap-3 rounded-xl border border-white/10 bg-white/[0.025] p-3 text-left text-white transition hover:border-white/20"
                      onClick={() => setDashboardTutorialCompleted(false)}
                    >
                      <HeroIcons.BoltIcon className="h-6 w-6 shrink-0 text-amber-200" aria-hidden="true" />
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-semibold">New here?</span>
                        <span className="mt-1 block text-xs text-white/54">Take the quick tour.</span>
                      </span>
                      <HeroIcons.ChevronRightIcon className="h-5 w-5 shrink-0 text-white/45" aria-hidden="true" />
                    </button>
                  </div>
                </div>

                <div className="hidden p-4 md:block md:p-6">
                  <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
                    <div>
                      <p className="arena-kicker">Your Cases</p>
                      <h2 className="arena-headline mt-2 text-2xl">Saved transcripts and rulings</h2>
                    </div>
                    <span className="text-xs uppercase tracking-[0.16em] text-white/42">
                      {initialCases.length} tracked cases
                    </span>
                  </div>

                  <div className="mt-5 inline-grid grid-cols-2 gap-1 rounded-xl border border-white/[0.055] bg-white/[0.025] p-1">
                    {[
                      { value: "ongoing", label: "Ongoing", count: ongoingCases.length },
                      { value: "finished", label: "Finished", count: finishedCases.length },
                    ].map((tab) => (
                      <button
                        key={`desktop-case-tab-${tab.value}`}
                        type="button"
                        className={`rounded-lg px-4 py-2 text-xs font-semibold uppercase tracking-[0.1em] transition ${
                          caseArchiveTab === tab.value
                            ? "bg-amber-200/[0.09] text-amber-100 shadow-[inset_0_0_0_1px_rgba(251,191,36,0.08)]"
                            : "text-white/42 hover:bg-white/[0.035] hover:text-white/74"
                        }`}
                        onClick={() => setCaseArchiveTab(tab.value)}
                      >
                        {tab.label} <span className="text-white/45">{tab.count}</span>
                      </button>
                    ))}
                  </div>

                  <div className="mt-5 grid gap-3 lg:grid-cols-2">
                    {initialCases.length === 0 ? (
                      <div className="arena-surface-soft border-dashed p-8 text-center lg:col-span-2">
                        <p className="text-lg font-semibold text-white">No cases opened yet</p>
                        <p className="mt-2 text-sm text-white/62">
                          Start with the recommended case and the client interview will open.
                        </p>
                      </div>
                    ) : selectedArchiveCases.length === 0 ? (
                      <div className="arena-surface-soft border-dashed p-8 text-center lg:col-span-2">
                        <p className="text-lg font-semibold text-white">
                          No {caseArchiveTab} cases yet
                        </p>
                        <p className="mt-2 text-sm text-white/62">
                          {caseArchiveTab === "finished"
                            ? "Completed rulings will appear here after verdict."
                            : "Active intake and courtroom matters will appear here."}
                        </p>
                      </div>
                    ) : (
                      selectedArchiveCases.slice(0, 6).map((item) => {
                        const caseProgress = getCaseProgress(item);
                        const caseSeverity = statusSeverity[item.status] || "neutral";

                        return (
                          <Link
                            key={item.id}
                            href={`/dashboard/cases/${item.slug || item.id}`}
                            className="arena-surface-soft block p-4 transition hover:-translate-y-0.5 hover:border-white/20"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <span className={`badge border arena-status ${severityClass[caseSeverity]}`}>
                                  {statusLabel[item.status] || "In Progress"}
                                </span>
                                <h3 className="mt-3 break-words text-base font-semibold text-white">
                                  {item.title}
                                </h3>
                                <p className="mt-2 text-sm text-white/52">
                                  {item.primaryCategory} | Complexity {item.complexity}
                                </p>
                              </div>
                              <span className="text-sm font-semibold text-white/70">
                                {caseProgress.percent}%
                              </span>
                            </div>
                          </Link>
                        );
                      })
                    )}
                  </div>
                </div>
              </section>

              <div id="rankings" data-onboarding-target="leaderboards" className="grid min-w-0 gap-4 xl:grid-cols-2">
                <section className="arena-surface min-w-0">
                  <div className="p-4 md:p-6">
                    <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-end">
                      <div className="min-w-0">
                        <p className="arena-kicker">Rankings</p>
                        <h2 className="arena-headline mt-2 text-2xl">Overall board</h2>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Link
                          href="/dashboard/bar-association"
                          className="arena-btn-dark min-h-0 px-3 py-2 text-sm"
                        >
                          Bar Association
                        </Link>
                        <p className="text-sm font-semibold text-white/70">
                          {currentLeaderboardEntry ? `#${currentLeaderboardEntry.rank}` : "Unranked"}
                        </p>
                      </div>
                    </div>
                    <div className="mt-5 space-y-2">
                      {isNewUser ? (
                        <div className="arena-surface-soft p-5 text-sm leading-7 text-white/62">
                          Complete your first case to start building a public ranking.
                        </div>
                      ) : searchedOverallEntries.length > 0 ? (
                        searchedOverallEntries.slice(0, 5).map((entry) => (
                          <Link
                            key={entry.id}
                            href={`/dashboard/players/${entry.id}`}
                            className="arena-surface-soft flex items-center justify-between gap-3 px-4 py-3 transition hover:-translate-y-0.5 hover:border-white/20"
                          >
                            <div className="flex min-w-0 items-center gap-3">
                              <LeaderboardPortrait image={entry.image} name={entry.name} />
                              <div className="min-w-0">
                                <p className="truncate font-semibold text-white">
                                  <span className="mr-2 text-white/55">#{entry.rank}</span>
                                  {entry.name}
                                </p>
                                <p className="mt-1 text-sm text-white/50">
                                  {entry.completedCases} cases | {entry.wins} wins
                                </p>
                              </div>
                            </div>
                            <span className="text-lg font-semibold text-emerald-300">
                              {entry.overallRating}
                            </span>
                          </Link>
                        ))
                      ) : (
                        <div className="arena-surface-soft p-4 text-sm text-white/62">
                          Rankings will populate after completed cases.
                        </div>
                      )}
                    </div>
                  </div>
                </section>

                <section id="specialty-board" className="arena-surface min-w-0">
                  <div className="p-4 md:p-6">
                    <p className="arena-kicker">Specialty Board</p>
                    <h2 className="arena-headline mt-2 text-2xl">{selectedCategoryTitle}</h2>
                    <div className="mt-5 space-y-2">
                      {isNewUser ? (
                        <div className="arena-surface-soft p-5 text-sm leading-7 text-white/62">
                          Win a case in this category to unlock stronger specialty progress.
                        </div>
                      ) : topCategoryEntries.length > 0 ? (
                        topCategoryEntries.map((entry) => (
                          <Link
                            key={`${selectedCategory}-${entry.id}`}
                            href={`/dashboard/players/${entry.id}`}
                            className="arena-surface-soft flex items-center justify-between gap-3 px-4 py-3 transition hover:-translate-y-0.5 hover:border-white/20"
                          >
                            <div className="flex min-w-0 items-center gap-3">
                              <LeaderboardPortrait image={entry.image} name={entry.name} />
                              <div className="min-w-0">
                                <p className="truncate font-semibold text-white">
                                  <span className="mr-2 text-white/55">{entry.rank}</span>
                                  {entry.name}
                                </p>
                                <p className="mt-1 text-sm text-white/50">
                                  {entry.category?.completedCases || 0} completed
                                </p>
                              </div>
                            </div>
                            <span className="text-lg font-semibold text-white">
                              {entry.category?.rating || 1000}
                            </span>
                          </Link>
                        ))
                      ) : (
                        <div className="arena-surface-soft p-4 text-sm text-white/62">
                          Category rankings will populate after more cases land in this track.
                        </div>
                      )}
                    </div>
                  </div>
                </section>
              </div>
            </div>
          </div>
        </section>
        <nav
          className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-black/86 px-2 pb-[calc(env(safe-area-inset-bottom)+0.45rem)] pt-2 shadow-[0_-18px_50px_rgba(0,0,0,0.45)] backdrop-blur-xl xl:hidden"
          aria-label="Mobile dashboard navigation"
        >
          <div className={`mx-auto grid max-w-md gap-1 ${isAdmin ? "grid-cols-5" : "grid-cols-4"}`}>
            {[
              { href: "#activation-home", label: "Home", icon: HeroIcons.HomeIcon, active: true },
              {
                href: "#recent-cases",
                label: "Cases",
                icon: HeroIcons.BriefcaseIcon,
                active: false,
              },
              {
                href: "#rankings",
                label: "Ranks",
                icon: HeroIcons.TrophyIcon,
                active: false,
              },
              {
                href: `/dashboard/players/${userId}`,
                label: "Profile",
                icon: HeroIcons.UserIcon,
                active: false,
              },
              ...(isAdmin
                ? [
                    {
                      href: "/dashboard/admin",
                      label: "Admin",
                      icon: HeroIcons.WrenchScrewdriverIcon,
                      active: false,
                    },
                  ]
                : []),
            ].map((item) => {
              const Icon = item.icon;
              const NavLink = item.href.startsWith("/") ? Link : "a";

              return (
                <NavLink
                  key={`${item.label}-${item.href}`}
                  href={item.href}
                  className={`flex min-h-[3.6rem] flex-col items-center justify-center gap-1 rounded-xl px-1 text-[0.64rem] font-semibold uppercase tracking-[0.08em] transition ${
                    item.active
                      ? "text-amber-200"
                      : "text-white/62 hover:bg-white/[0.04] hover:text-white"
                  }`}
                >
                  <Icon className="h-5 w-5" aria-hidden="true" />
                  <span className="max-w-full truncate">{item.label}</span>
                </NavLink>
              );
            })}
          </div>
        </nav>
        <DashboardOnboardingOverlay
          isOpen={!dashboardTutorialCompleted}
          onComplete={() => setDashboardTutorialCompleted(true)}
        />
        {showPaywallModal ? (
          <DevelopmentAccessModal
            email={userEmail}
            onClose={() => setShowPaywallModal(false)}
          />
        ) : null}
      </main>
    );
  }

  return (
    <main className="arena-app-shell min-h-screen overflow-x-hidden px-4 py-4 md:px-6 md:py-6">
      <section className="mx-auto max-w-[1600px] arena-reveal">
        <div className="grid gap-4 xl:grid-cols-[240px_minmax(0,1fr)_360px]">
          <aside className="arena-surface arena-column-bg flex h-full flex-col overflow-visible">
            <div className="border-b border-white/10 px-5 py-6">
              <p className="arena-kicker">LEGAL ARENA</p>
              <h2 className="arena-headline mt-3 text-3xl uppercase leading-none">
                Command
              </h2>
            </div>

            <nav className="flex-1 space-y-2 px-3 py-4">
              <a
                href="#battle-console"
                className="arena-surface-soft flex origin-center items-center justify-between !border-white/[0.045] px-4 py-3 text-sm text-white/72 transition hover:scale-[1.01] hover:!border-white/[0.09] hover:text-white"
              >
                <span>Case Intake</span>
                <span className="text-white/35">01</span>
              </a>
              <a
                href="#recent-matters"
                className="arena-surface-soft flex origin-center items-center justify-between !border-white/[0.045] px-4 py-3 text-sm text-white/72 transition hover:scale-[1.01] hover:!border-white/[0.09] hover:text-white"
              >
                <span>My Matters</span>
                <span className="text-white/35">02</span>
              </a>
              <a
                href="#overall-board"
                className="arena-surface-soft flex origin-center items-center justify-between !border-white/[0.045] px-4 py-3 text-sm text-white/72 transition hover:scale-[1.01] hover:!border-white/[0.09] hover:text-white"
              >
                <span>Leaderboards</span>
                <span className="text-white/35">03</span>
              </a>
              <a
                href="#pvp-docket"
                className={`arena-surface-soft flex origin-center items-center justify-between px-4 py-3 text-sm transition hover:scale-[1.01] ${
                  pvpAttentionCount
                    ? "!border-amber-200/30 !bg-amber-200/[0.075] text-amber-50 hover:!border-amber-200/55"
                    : "!border-white/[0.045] text-white/72 hover:!border-white/[0.09] hover:text-white"
                }`}
              >
                <span>PVP Docket</span>
                <span
                  className={
                    pvpAttentionCount
                      ? "rounded-full bg-amber-200 px-2 py-0.5 text-[0.62rem] font-black text-black"
                      : "text-white/35"
                  }
                >
                  {pvpAttentionCount || "04"}
                </span>
              </a>
              <Link
                href="/dashboard/bar-association"
                className="arena-surface-soft flex origin-center items-center justify-between !border-white/[0.045] px-4 py-3 text-sm text-white/72 transition hover:scale-[1.01] hover:!border-white/[0.09] hover:text-white"
              >
                <span>Bar Association</span>
                <span className="text-white/35">05</span>
              </Link>
              <a
                href="#specialty-board"
                className="arena-surface-soft flex origin-center items-center justify-between !border-white/[0.045] px-4 py-3 text-sm text-white/72 transition hover:scale-[1.01] hover:!border-white/[0.09] hover:text-white"
              >
                <span>Specialty Board</span>
                <span className="text-white/35">06</span>
              </a>
              {isAdmin ? (
                <Link
                  href="/dashboard/admin"
                  className="arena-surface-soft flex origin-center items-center justify-between !border-white/[0.045] px-4 py-3 text-sm text-white/72 transition hover:scale-[1.01] hover:!border-white/[0.09] hover:text-white"
                >
                  <span>Admin Lab</span>
                  <span className="text-white/35">07</span>
                </Link>
              ) : null}
              <Link
                href="/"
                className="arena-surface-soft flex origin-center items-center justify-between !border-white/[0.045] px-4 py-3 text-sm text-white/72 transition hover:scale-[1.01] hover:!border-white/[0.09] hover:text-white"
              >
                <span>Public Home</span>
                <span className="text-white/35">{isAdmin ? "08" : "07"}</span>
              </Link>
            </nav>

            <div className="border-t border-white/10 px-4 py-4">
              <div className="arena-surface-soft p-4">
                <p className="text-sm font-semibold text-white">{userName}</p>
                <p className="mt-1 text-sm text-white/55">
                  Rank {currentLeaderboardEntry ? `#${currentLeaderboardEntry.rank}` : "Unranked"}
                </p>
                <div className="mt-4 [&_.btn]:w-full [&_.btn]:justify-between [&_.btn]:text-sm">
                  <ButtonAccount />
                </div>
              </div>
            </div>
          </aside>

          <div className="space-y-4">
            <section className="arena-surface arena-scanline arena-column-bg overflow-hidden">
              <div className="p-5 md:p-7">
                <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
                  <div className="space-y-4">
                    <p className="text-sm text-white/74">Welcome back, {userName}</p>
                    <h1 className="arena-headline text-[2.7rem] uppercase leading-[0.92] md:text-6xl">
                      Enter the arena.
                      <br />
                      Win the courtroom.
                    </h1>
                    <p className="max-w-2xl text-sm leading-7 text-white/65 md:text-base">
                      Fight cases, sharpen your specialty, and keep building a record that
                      climbs the board.
                    </p>
                  </div>

                  <div className="space-y-3">
                    <button
                      data-onboarding-target="quick-start-case"
                      className="arena-btn-light flex w-full items-center justify-center gap-2 px-5 py-4"
                      onClick={() => handleCreateCase(null, { dynamic: true, source: "activation_quick_start" })}
                      disabled={creating}
                    >
                      {creating && <span className="loading loading-spinner loading-xs" />}
                      <span>{lastActiveCase ? "Start New Case" : "Open First Case"}</span>
                    </button>
                    {canResumeLastCase ? (
                      <Link
                        href={`/dashboard/cases/${lastActiveCase.slug || lastActiveCase.id}`}
                        className="arena-btn-dark flex w-full items-center justify-center px-5 py-4"
                      >
                        Continue Last Case
                      </Link>
                    ) : (
                      <Link
                        href="#battle-console"
                        className="arena-btn-dark flex w-full items-center justify-center px-5 py-4"
                      >
                        Browse Case Library
                      </Link>
                    )}
                    <div className="px-1 text-sm text-white/55">
                      {lastActiveCase ? (
                        <>
                          <p>
                            Last played:{" "}
                            <span className="text-white">{lastActiveCase.title}</span>
                          </p>
                          <p className="mt-1">Updated {formatDate(lastActiveCase.updatedAt)}</p>
                        </>
                      ) : (
                        <p>No active matter yet. Pick a dispute below to start your first run.</p>
                      )}
                    </div>
                  </div>
                </div>

                <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                  <div className="arena-stat-card !p-4">
                    <p className="arena-kicker">Overall Rating</p>
                    <p className="mt-2 text-3xl font-semibold text-white">
                      {progression.overallRating}
                    </p>
                    <p className="mt-1 text-sm text-white/50">
                      {progression.overallXp} XP total
                    </p>
                  </div>
                  <div className="arena-stat-card !p-4">
                    <p className="arena-kicker">Specialty Tier</p>
                    <p className="mt-2 text-3xl font-semibold text-white">
                      Tier {categoryProgress?.unlockedComplexity || 1}
                    </p>
                    <p className="mt-1 text-sm text-white/50">{selectedCategoryTitle} track</p>
                  </div>
                  <div className="arena-stat-card !p-4">
                    <p className="arena-kicker">Record</p>
                    <p className="mt-2 text-3xl font-semibold text-white">
                      {progression.wins}-{progression.losses}-{progression.draws}-{progression.settlements || 0}
                    </p>
                    <p className="mt-1 text-sm text-white/50">{recordRatio}% win rate</p>
                  </div>
                  <div className="arena-stat-card !p-4">
                    <p className="arena-kicker">Rank</p>
                    <p className="mt-2 text-3xl font-semibold text-white">
                      {currentLeaderboardEntry ? `#${currentLeaderboardEntry.rank}` : "--"}
                    </p>
                    <p className="mt-1 text-sm text-white/50">
                      {progression.completedCases} completed matters
                    </p>
                  </div>
                </div>
              </div>
            </section>

            <section id="battle-console" className="arena-surface">
              <div className="p-5 md:p-6">
                <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
                  <div>
                    <p className="arena-kicker">Choose Your Battle</p>
                    <h2 className="arena-headline mt-2 text-2xl">Select a live dispute</h2>
                    <p className="mt-2 text-sm text-white/62">
                      Pick a category and enter an available matter.
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-3 md:justify-end">
                    <p className="text-xs uppercase tracking-[0.16em] text-white/42">
                      {carouselStatus}
                    </p>
                    <label className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-white/10 bg-white/[0.035] px-3 py-2 text-xs font-semibold text-white/70 transition hover:border-white/18 hover:text-white">
                      <span>Playable only</span>
                      <input
                        type="checkbox"
                        className="toggle toggle-xs border-white/20 bg-white/10 [--tglbg:#151515] checked:border-emerald-300/40 checked:bg-emerald-400"
                        checked={showPlayableOnly}
                        onChange={(event) => setShowPlayableOnly(event.target.checked)}
                      />
                    </label>
                  </div>
                </div>

                <div
                  data-onboarding-target="case-categories"
                  className="mt-5 grid grid-cols-2 gap-2 lg:flex lg:flex-wrap"
                >
                  <button
                    type="button"
                    className={`badge badge-lg h-auto min-h-10 w-full origin-center cursor-pointer whitespace-normal border px-3 py-3 text-center leading-tight transition lg:w-auto ${
                      !selectedCategory
                        ? "arena-pill arena-pill-selected hover:scale-[1.03]"
                        : "arena-pill hover:scale-[1.01]"
                    }`}
                    onClick={() => selectCaseCategory("")}
                  >
                    All
                  </button>
                  {categories.map((category) => (
                    <button
                      key={category.slug}
                      type="button"
                      className={`badge badge-lg h-auto min-h-10 w-full origin-center cursor-pointer whitespace-normal border px-3 py-3 text-center leading-tight transition lg:w-auto ${
                        selectedCategory === category.slug
                          ? "arena-pill arena-pill-selected hover:scale-[1.03]"
                          : "arena-pill hover:scale-[1.01]"
                      }`}
                      onClick={() => selectCaseCategory(category.slug)}
                    >
                      {category.title}
                    </button>
                  ))}
                </div>

                <div data-onboarding-target="case-library" className="mt-5">
                  {activeTemplate ? (
                    <div className="arena-surface-soft arena-reveal min-h-[34rem] overflow-hidden p-4 md:min-h-[36rem] md:p-5 xl:h-[38rem] xl:min-h-0">
                      <div className="grid gap-5 xl:h-full xl:grid-cols-[240px_minmax(0,1fr)_220px]">
                        <div className="min-h-[220px] rounded-[1.5rem] border border-white/10 bg-white/[0.03] p-4 xl:h-full">
                          <div className="flex h-full flex-col justify-between">
                            <div>
                              <p className="arena-kicker">Featured Case</p>
                              <p className="mt-4 text-sm leading-7 text-white/56">
                                {activeTemplate.courtName}
                              </p>
                            </div>
                            <div className="space-y-2 text-sm text-white/70">
                              <p>{activeTemplate.practiceArea}</p>
                              <p>{activeTemplate.primaryCategory}</p>
                              <p>Complexity {activeTemplate.complexity}</p>
                            </div>
                          </div>
                        </div>

                        <div className="min-w-0 xl:flex xl:h-full xl:min-h-0 xl:flex-col xl:overflow-y-auto xl:pr-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="badge badge-outline border-white/15 text-white/80">
                              {activeTemplate.practiceArea}
                            </span>
                            <span className="badge badge-outline border-white/15 text-white/80">
                              {activeTemplate.primaryCategory}
                            </span>
                          </div>
                          <h3 className="mt-4 h-[7.1rem] overflow-hidden break-words text-3xl font-semibold leading-tight text-white">
                            {activeTemplate.title}
                          </h3>
                          <p className="mt-3 text-sm leading-7 text-white/70">
                            {activeTemplate.overview}
                          </p>
                          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:mt-6 xl:grid-cols-4">
                            <div>
                              <p className="arena-kicker">Plaintiff</p>
                              <p className="mt-2 text-sm text-white">
                                {activeTemplate.plaintiffName || activeTemplate.clientName}
                              </p>
                            </div>
                            <div>
                              <p className="arena-kicker">Defendant</p>
                              <p className="mt-2 text-sm text-white">
                                {activeTemplate.defendantName || activeTemplate.opponentName}
                              </p>
                            </div>
                            <div>
                              <p className="arena-kicker">Complexity</p>
                              <p className="mt-2 text-sm text-white">
                                Tier {activeTemplate.complexity}
                              </p>
                            </div>
                            <div>
                              <p className="arena-kicker">Status</p>
                              <p
                                className={`mt-2 text-sm ${
                                  activeTemplate.unlocked || shouldSellLifetimeAccess
                                    ? "text-emerald-300"
                                    : "text-amber-300"
                                }`}
                              >
                                {shouldSellLifetimeAccess
                                  ? "Included after purchase"
                                  : activeTemplate.unlocked
                                    ? "Ready to enter"
                                    : "Locked"}
                              </p>
                            </div>
                          </div>
                        </div>

                        <div className="flex flex-col justify-between gap-4 border-t border-white/10 pt-4 xl:h-full xl:border-l xl:border-t-0 xl:pl-5 xl:pt-0">
                          <div>
                            <p className="arena-kicker">Access</p>
                            <p
                              className={`mt-3 text-sm leading-7 ${
                                activeTemplate.unlocked ? "text-emerald-300" : "text-amber-300"
                              }`}
                            >
                              {getTemplateUnlockMessage(activeTemplate, browserTimeZone)}
                            </p>
                          </div>
                          <div className="space-y-3">
                            <button
                              className="arena-btn-light w-full px-5 py-3"
                              onClick={() => handleCreateCase(activeTemplate.id)}
                              disabled={creating || !activeTemplate.unlocked}
                            >
                              Enter Case
                            </button>
                            <div className="flex justify-end gap-2">
                              <button
                                type="button"
                                className="arena-btn-dark min-h-0 px-3 py-2"
                                onClick={goToPreviousTemplate}
                                disabled={!canNavigateTemplates}
                                aria-label="Show previous case"
                              >
                                &lt;
                              </button>
                              <button
                                type="button"
                                className="arena-btn-dark min-h-0 px-3 py-2"
                                onClick={goToNextTemplate}
                                disabled={!canNavigateTemplates}
                                aria-label="Show next case"
                              >
                                &gt;
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>

                      {canNavigateTemplates ? (
                        <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
                          {visibleTemplates.map((template, index) => (
                            <button
                              key={`case-dot-${template.id}`}
                              type="button"
                              className={`h-2.5 rounded-full transition ${
                                index === activeTemplateIndex
                                  ? "w-8 bg-white"
                                  : "w-2.5 bg-white/20 hover:bg-white/40"
                              }`}
                              onClick={() => setActiveTemplateIndex(index)}
                              aria-label={`Show case ${index + 1} of ${visibleTemplates.length}`}
                            />
                          ))}
                        </div>
                      ) : null}
                    </div>
                  ) : (
                    <div className="arena-surface-soft min-h-[18rem] border-dashed p-8 text-center">
                      <p className="text-lg font-semibold text-white">
                        No case templates available
                      </p>
                      <p className="mt-2 text-sm text-white/62">
                        {showPlayableOnly
                          ? "Turn off playable only to view locked cases in this category."
                          : "Check back after new disputes are added to the case library."}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </section>

            <PvpDocketSection
              challenges={challenges}
              activeTab={pvpDocketTab}
              onTabChange={setPvpDocketTab}
              loadTimedOut={challengesLoadTimedOut}
            />

            <section
              id="recent-matters"
              data-onboarding-target="recent-matters"
              className="arena-surface"
            >
              <div className="p-5 md:p-6">
                <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
                  <div>
                    <p className="arena-kicker">Your Recent Matters</p>
                    <h2 className="arena-headline mt-2 text-2xl">Saved transcripts and rulings</h2>
                  </div>
                  <span className="text-xs uppercase tracking-[0.16em] text-white/42">
                    {initialCases.length} tracked matters
                  </span>
                </div>

                <div className="mt-5 space-y-3">
                  {initialCases.length === 0 ? (
                    <div className="arena-surface-soft border-dashed p-8 text-center">
                      <p className="text-lg font-semibold text-white">No matters opened yet</p>
                      <p className="mt-2 text-sm text-white/62">
                        Start with an unlocked category matter and the intake file will be staged.
                      </p>
                    </div>
                  ) : (
                    initialCases.map((item) => {
                      const caseSeverity = statusSeverity[item.status] || "neutral";

                      return (
                        <Link
                          key={item.id}
                          href={`/dashboard/cases/${item.slug || item.id}`}
                          className="arena-surface-soft block p-4 transition hover:-translate-y-0.5 hover:border-white/20"
                        >
                          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <h3 className="text-base font-semibold text-white">{item.title}</h3>
                                <span
                                  className={`badge border arena-status ${
                                    severityClass[caseSeverity]
                                  }`}
                                >
                                  {statusLabel[item.status] || "In Progress"}
                                </span>
                              </div>
                              <div className="mt-2 flex flex-wrap gap-3 text-sm text-white/52">
                                <span>{item.primaryCategory}</span>
                                <span>Complexity {item.complexity}</span>
                                <span>Updated {formatDate(item.updatedAt)}</span>
                              </div>
                            </div>
                            <div className="text-sm text-white/72 lg:text-right">
                              <p>
                                {item.plaintiffName || item.premise?.clientName} vs.{" "}
                                {item.defendantName || item.premise?.opponentName}
                              </p>
                            </div>
                          </div>
                        </Link>
                      );
                    })
                  )}
                </div>
              </div>
            </section>

          </div>

          <aside data-onboarding-target="leaderboards" className="space-y-4">
            <section id="overall-board" className="arena-surface">
              <div className="p-5 md:p-6">
                <p className="arena-kicker">Top Counsel Today</p>
                <div className="mt-2">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <h2 className="arena-headline text-2xl">Overall board</h2>
                    <Link
                      href="/dashboard/bar-association"
                      className="arena-btn-dark min-h-0 px-3 py-2 text-sm"
                    >
                      Bar Association
                    </Link>
                  </div>
                  <div className="relative mt-4 w-full">
                    <input
                      type="search"
                      value={lawyerSearch}
                      onChange={(event) => setLawyerSearch(event.target.value)}
                      placeholder="Search lawyers"
                      aria-label="Search lawyers by name"
                      className="h-10 w-full rounded-full border border-white/12 bg-white/[0.04] px-4 pr-16 text-sm font-semibold text-white outline-none transition placeholder:text-white/35 focus:border-sky-300/60"
                    />
                    {lawyerSearchLoading ? (
                      <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/38">
                        ...
                      </span>
                    ) : null}
                  </div>
                </div>
                <div className="mt-5 space-y-2">
                  {lawyerSearchLoading && lawyerSearch.trim() ? (
                    <div className="arena-surface-soft p-4 text-sm text-white/62">
                      Searching lawyers...
                    </div>
                  ) : searchedOverallEntries.length > 0 ? (
                    searchedOverallEntries.map((entry) => (
                      <Link
                        key={entry.id}
                        href={`/dashboard/players/${entry.id}`}
                        className="arena-surface-soft flex items-center justify-between gap-3 px-4 py-3 transition hover:-translate-y-0.5 hover:border-white/20"
                      >
                        <div className="flex min-w-0 items-center gap-3">
                          <LeaderboardPortrait image={entry.image} name={entry.name} />
                          <div className="min-w-0">
                            <p className="truncate font-semibold text-white">
                              <span className="mr-2 text-white/55">#{entry.rank}</span>
                              {entry.name}
                            </p>
                            <p className="mt-1 text-sm text-white/50">
                              {entry.completedCases} matches | {entry.wins} wins
                            </p>
                          </div>
                        </div>
                        <span className="text-lg font-semibold text-emerald-300">
                          {entry.overallRating}
                        </span>
                      </Link>
                    ))
                  ) : (
                    <div className="arena-surface-soft p-4 text-sm text-white/62">
                      No lawyers match that search.
                    </div>
                  )}
                </div>
                {currentLeaderboardEntry ? (
                  <Link
                    href={`/dashboard/players/${currentLeaderboardEntry.id || userId}`}
                    className="mt-4 block rounded-[1.5rem] border border-white/15 bg-white/[0.03] px-4 py-4 transition hover:-translate-y-0.5 hover:border-white/25"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <LeaderboardPortrait
                          image={currentLeaderboardEntry.image}
                          name={userName}
                        />
                        <div className="min-w-0">
                          <p className="text-sm text-white/50">Your standing</p>
                          <p className="mt-1 truncate font-semibold text-white">
                            #{currentLeaderboardEntry.rank} {userName}
                          </p>
                        </div>
                      </div>
                      <p className="text-2xl font-semibold text-white">
                        {currentLeaderboardEntry.overallRating}
                      </p>
                    </div>
                  </Link>
                ) : null}
              </div>
            </section>

            <section id="specialty-board" className="arena-surface">
              <div className="p-5 md:p-6">
                <p className="arena-kicker">Specialty Board</p>
                <h2 className="arena-headline mt-2 text-2xl">{selectedCategoryTitle}</h2>
                <div className="mt-5 space-y-2">
                  {topCategoryEntries.length > 0 ? (
                    topCategoryEntries.map((entry) => (
                      <Link
                        key={`${selectedCategory}-${entry.id}`}
                        href={`/dashboard/players/${entry.id}`}
                        className="arena-surface-soft flex items-center justify-between gap-3 px-4 py-3 transition hover:-translate-y-0.5 hover:border-white/20"
                      >
                        <div className="flex min-w-0 items-center gap-3">
                          <LeaderboardPortrait image={entry.image} name={entry.name} />
                          <div className="min-w-0">
                            <p className="truncate font-semibold text-white">
                              <span className="mr-2 text-white/55">{entry.rank}</span>
                              {entry.name}
                            </p>
                            <p className="mt-1 text-sm text-white/50">
                              {entry.category?.completedCases || 0} completed
                            </p>
                          </div>
                        </div>
                        <span className="text-lg font-semibold text-white">
                          {entry.category?.rating || 1000}
                        </span>
                      </Link>
                    ))
                  ) : (
                    <div className="arena-surface-soft p-4 text-sm text-white/62">
                      Category rankings will populate after more completed cases land in this
                      track.
                    </div>
                  )}
                </div>
              </div>
            </section>

            <section className="arena-surface">
              <div className="p-5 md:p-6">
                <p className="arena-kicker">Recent Outcomes</p>
                <h2 className="arena-headline mt-2 text-2xl">Closed matters</h2>
                <div className="mt-5 space-y-2">
                  {recentVerdicts.length > 0 ? (
                    recentVerdicts.map((item) => (
                      <Link
                        key={`verdict-${item.id}`}
                        href={`/dashboard/cases/${item.slug || item.id}`}
                        className="arena-surface-soft block px-4 py-3 transition hover:-translate-y-0.5 hover:border-white/20"
                      >
                        <p className="font-semibold text-white">{item.title}</p>
                        <p className="mt-1 text-sm text-white/52">
                          {item.primaryCategory} | {formatDate(item.updatedAt)}
                        </p>
                      </Link>
                    ))
                  ) : (
                    <div className="arena-surface-soft p-4 text-sm text-white/62">
                      Outcomes will appear here once your first matter reaches verdict or settlement.
                    </div>
                  )}
                </div>
              </div>
            </section>

            <section className="arena-surface">
              <div className="p-5 md:p-6">
                <p className="arena-kicker">Active Challenges</p>
                <h2 className="arena-headline mt-2 text-2xl">Progression goals</h2>
                <div className="mt-5 space-y-4">
                  <div className="arena-surface-soft p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="font-semibold text-white">Complete {streakGoal} wins</p>
                        <p className="mt-1 text-sm text-white/52">
                          Build momentum across current matters.
                        </p>
                      </div>
                      <p className="text-sm font-semibold text-white/80">
                        {winStreakProgress} / {streakGoal}
                      </p>
                    </div>
                    <div className="mt-4 arena-progress-track">
                      <div
                        className="arena-progress-fill"
                        style={{ width: `${winStreakPercent}%` }}
                      />
                    </div>
                  </div>

                  <div className="arena-surface-soft p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="font-semibold text-white">
                          Climb {selectedCategoryTitle} to next tier
                        </p>
                        <p className="mt-1 text-sm text-white/52">
                          Complete more cases in this category to unlock harder disputes.
                        </p>
                      </div>
                      <p className="text-sm font-semibold text-white/80">
                        {nextCategoryUnlockProgress} / {nextCategoryUnlockTarget}
                      </p>
                    </div>
                    <div className="mt-4 arena-progress-track">
                      <div
                        className="arena-progress-fill"
                        style={{ width: `${nextCategoryUnlockPercent}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </section>
          </aside>
        </div>
      </section>
      <DashboardOnboardingOverlay
        isOpen={!dashboardTutorialCompleted}
        onComplete={() => setDashboardTutorialCompleted(true)}
      />
      {showPaywallModal ? (
        <DevelopmentAccessModal
          email={userEmail}
          onClose={() => setShowPaywallModal(false)}
        />
      ) : null}
    </main>
  );
}
