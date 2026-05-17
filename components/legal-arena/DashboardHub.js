"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import ButtonAccount from "@/components/ButtonAccount";
import { useNavigationLoading } from "@/components/NavigationLoadingProvider";
import apiClient from "@/libs/api";
import { DevelopmentAccessPanel } from "@/components/legal-arena/DevelopmentAccessGate";

const statusLabel = {
  interview: "Intake",
  courtroom: "Courtroom",
  verdict: "Verdict Ready",
};

const statusSeverity = {
  interview: "caution",
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

const LeaderboardPortrait = ({ image = "", name = "" }) => {
  const headshot = getArenaHeadshot(image);

  return (
    <div className="h-10 w-10 shrink-0 overflow-hidden rounded-full border border-white/15 bg-white/[0.04] shadow-[0_0_0_3px_rgba(255,255,255,0.025)]">
      <img
        src={headshot}
        alt={`${name || "Counsel"} headshot`}
        style={{ objectPosition: "center calc(50% + 1px)" }}
        className={`block h-full w-full object-cover object-center ${
          isDefaultHeadshot(image) ? "scale-[1.62]" : "scale-[1.09]"
        }`}
      />
    </div>
  );
};

const onboardingSteps = [
  {
    target: "quick-start-case",
    eyebrow: "Quick Start",
    title: "Start your first case",
    body: "This is the fast lane into your first matter. Click it when you are ready to meet the facts, ask sharp questions, and begin happy lawyering.",
  },
  {
    target: "case-categories",
    eyebrow: "Choose a Track",
    title: "Filter by specialty",
    body: "Pick the legal lane you feel like training today. Contract chaos, workplace drama, consumer disputes: choose your flavor of courtroom workout.",
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
  challenges = [],
  overallLeaderboard,
  categoryLeaderboards,
  isAdmin = false,
  userId = "",
  userName = "Counsel",
  userEmail = "",
  hasArenaAccess = false,
}) {
  const router = useRouter();
  const { startNavigationLoading } = useNavigationLoading();
  const [browserTimeZone, setBrowserTimeZone] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState(categories[0]?.slug || "");
  const [activeTemplateIndex, setActiveTemplateIndex] = useState(0);
  const [showPaywallModal, setShowPaywallModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [lawyerSearch, setLawyerSearch] = useState("");
  const [searchedLawyers, setSearchedLawyers] = useState(null);
  const [lawyerSearchLoading, setLawyerSearchLoading] = useState(false);
  const [dashboardTutorialCompleted, setDashboardTutorialCompleted] = useState(
    Boolean(onboarding?.dashboardTutorialCompleted)
  );

  const filteredTemplates = useMemo(
    () =>
      templates.filter(
        (template) => !selectedCategory || template.primaryCategory === selectedCategory
      ),
    [selectedCategory, templates]
  );

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
  const selectedCategoryTitle = selectedCategoryMeta?.title || selectedCategory;
  const currentLeaderboardEntry =
    overallLeaderboard.find((entry) => String(entry.id) === String(userId)) || null;
  const searchedOverallEntries = useMemo(() => {
    const query = lawyerSearch.trim();
    const entries = query ? searchedLawyers || [] : overallLeaderboard.slice(0, 5);

    return entries.slice(0, 8);
  }, [lawyerSearch, overallLeaderboard, searchedLawyers]);
  const topCategoryEntries = selectedLeaderboard.slice(0, 5);
  const recentVerdicts = initialCases.filter((item) => item.status === "verdict").slice(0, 5);
  const canResumeLastCase =
    lastActiveCase &&
    (lastActiveCase.status === "interview" || lastActiveCase.status === "courtroom");
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

  useEffect(() => {
    const detectedTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    setBrowserTimeZone(detectedTimeZone || null);
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
    setActiveTemplateIndex(0);
  }, [selectedCategory]);

  const handleCreateCase = async (caseTemplateId) => {
    if (!caseTemplateId) return;
    if (!hasArenaAccess) {
      setShowPaywallModal(true);
      return;
    }

    setCreating(true);

    try {
      const { caseSession } = await apiClient.post("/cases", {
        caseTemplateId,
      });

      startNavigationLoading("Opening the matter");
      router.push(`/dashboard/cases/${caseSession.slug || caseSession.id}`);
    } catch (error) {
      console.error(error);
    } finally {
      setCreating(false);
    }
  };

  const visibleTemplates = filteredTemplates.length > 0 ? filteredTemplates : templates;
  const activeTemplate =
    visibleTemplates.length > 0
      ? visibleTemplates[Math.min(activeTemplateIndex, visibleTemplates.length - 1)]
      : null;
  const carouselCategoryLabel =
    filteredTemplates.length > 0
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
                className="arena-surface-soft flex items-center justify-between px-4 py-3 text-sm text-white/72 transition hover:border-white/20 hover:text-white"
              >
                <span>Case Intake</span>
                <span className="text-white/35">01</span>
              </a>
              <a
                href="#recent-matters"
                className="arena-surface-soft flex items-center justify-between px-4 py-3 text-sm text-white/72 transition hover:border-white/20 hover:text-white"
              >
                <span>My Matters</span>
                <span className="text-white/35">02</span>
              </a>
              <a
                href="#overall-board"
                className="arena-surface-soft flex items-center justify-between px-4 py-3 text-sm text-white/72 transition hover:border-white/20 hover:text-white"
              >
                <span>Leaderboards</span>
                <span className="text-white/35">03</span>
              </a>
              <a
                href="#pvp-challenges"
                className="arena-surface-soft flex items-center justify-between px-4 py-3 text-sm text-white/72 transition hover:border-white/20 hover:text-white"
              >
                <span>PVP Challenges</span>
                <span className="text-white/35">04</span>
              </a>
              <a
                href="#specialty-board"
                className="arena-surface-soft flex items-center justify-between px-4 py-3 text-sm text-white/72 transition hover:border-white/20 hover:text-white"
              >
                <span>Specialty Board</span>
                <span className="text-white/35">05</span>
              </a>
              {isAdmin ? (
                <Link
                  href="/dashboard/admin"
                  className="arena-surface-soft flex items-center justify-between px-4 py-3 text-sm text-white/72 transition hover:border-white/20 hover:text-white"
                >
                  <span>Admin Lab</span>
                  <span className="text-white/35">06</span>
                </Link>
              ) : null}
              <Link
                href="/"
                className="arena-surface-soft flex items-center justify-between px-4 py-3 text-sm text-white/72 transition hover:border-white/20 hover:text-white"
              >
                <span>Public Home</span>
                <span className="text-white/35">{isAdmin ? "07" : "06"}</span>
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
                      onClick={() => handleCreateCase(activeTemplate?.id)}
                      disabled={creating || !activeTemplate?.unlocked}
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
                      {progression.wins}-{progression.losses}-{progression.draws}
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
                  <p className="text-xs uppercase tracking-[0.16em] text-white/42">
                    {carouselStatus}
                  </p>
                </div>

                <div
                  data-onboarding-target="case-categories"
                  className="mt-5 grid grid-cols-2 gap-2 lg:flex lg:flex-wrap"
                >
                  {categories.map((category) => (
                    <button
                      key={category.slug}
                      className={`badge badge-lg h-auto min-h-10 w-full cursor-pointer whitespace-normal border px-3 py-3 text-center leading-tight transition lg:w-auto ${
                        selectedCategory === category.slug
                          ? "arena-status arena-status-favorable"
                          : "arena-pill"
                      }`}
                      onClick={() => setSelectedCategory(category.slug)}
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
                          <h3 className="mt-4 text-3xl font-semibold leading-tight text-white">
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
                                  activeTemplate.unlocked ? "text-emerald-300" : "text-amber-300"
                                }`}
                              >
                                {activeTemplate.unlocked ? "Ready to enter" : "Locked"}
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
                        Check back after new disputes are added to the case library.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </section>

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

            <section id="pvp-challenges" className="arena-surface">
              <div className="p-5 md:p-6">
                <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
                  <div>
                    <p className="arena-kicker">PVP Challenges</p>
                    <h2 className="arena-headline mt-2 text-2xl">Player matches</h2>
                  </div>
                  <span className="text-xs uppercase tracking-[0.16em] text-white/42">
                    {challenges.length} tracked challenges
                  </span>
                </div>

                <div className="mt-5 space-y-3">
                  {challenges.length === 0 ? (
                    <div className="arena-surface-soft border-dashed p-8 text-center">
                      <p className="text-lg font-semibold text-white">No PVP docket yet</p>
                      <p className="mt-2 text-sm text-white/62">
                        Challenge a player from their dossier or a leaderboard row.
                      </p>
                    </div>
                  ) : (
                    challenges.slice(0, 6).map((challenge) => {
                      const visibleStatus = getChallengeViewerStatus(challenge);
                      const opponentIsInCourt =
                        challenge.status === "courtroom" && visibleStatus === "active";

                      return (
                        <Link
                          key={challenge.id}
                          href={`/dashboard/challenges/${challenge.slug || challenge.id}`}
                          className="arena-surface-soft block p-4 transition hover:-translate-y-0.5 hover:border-white/20"
                        >
                          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <h3 className="text-base font-semibold text-white">
                                  {challenge.title}
                                </h3>
                                <span className="badge border arena-status arena-status-neutral">
                                  {challengeStatusLabel[visibleStatus] || visibleStatus}
                                </span>
                              </div>
                              <p className="mt-2 text-sm text-white/52">
                                vs. {challenge.opponent?.name || "Opposing counsel"} |{" "}
                                {challenge.primaryCategory} | Updated{" "}
                                {formatDate(challenge.updatedAt)}
                              </p>
                              {opponentIsInCourt ? (
                                <p className="mt-2 text-sm font-semibold text-amber-200/80">
                                  Opponent is already in court.
                                </p>
                              ) : null}
                            </div>
                            <p className="text-sm font-semibold text-white/78">
                              {challenge.viewer?.score || 0}-{challenge.opponent?.score || 0}
                            </p>
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
                  <h2 className="arena-headline text-2xl">Overall board</h2>
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
                <p className="arena-kicker">Recent Verdicts</p>
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
                      Verdicts will appear here once your first matter reaches final ruling.
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
        <dialog className="modal modal-open">
          <div className="modal-box max-h-none max-w-3xl overflow-visible bg-transparent p-0 shadow-none">
            <DevelopmentAccessPanel
              email={userEmail}
              onClose={() => setShowPaywallModal(false)}
            />
          </div>
          <form method="dialog" className="modal-backdrop">
            <button type="button" onClick={() => setShowPaywallModal(false)}>
              close
            </button>
          </form>
        </dialog>
      ) : null}
    </main>
  );
}
