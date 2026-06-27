"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import * as HeroIcons from "@heroicons/react/24/outline";
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

const getDifficultyMeta = (complexity = 1) => {
  if (complexity >= 4) {
    return { value: "hard", label: "Hard", className: "text-rose-300 border-rose-300/25 bg-rose-400/10" };
  }

  if (complexity >= 2) {
    return { value: "medium", label: "Medium", className: "text-amber-200 border-amber-200/25 bg-amber-300/10" };
  }

  return { value: "easy", label: "Easy", className: "text-emerald-300 border-emerald-300/25 bg-emerald-400/10" };
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

  return { label: "Client interview", percent: 42, nextStep: "Build your fact sheet" };
};

const gameLoopSteps = [
  {
    title: "Interview Client",
    body: "Ask the right questions to uncover useful facts.",
    icon: HeroIcons.ChatBubbleLeftRightIcon,
  },
  {
    title: "Build Fact Sheet",
    body: "Organize facts, evidence, risks, and key issues.",
    icon: HeroIcons.DocumentTextIcon,
  },
  {
    title: "Argue in Court",
    body: "Present your argument and challenge the other side.",
    icon: HeroIcons.ScaleIcon,
  },
  {
    title: "Get Verdict + XP",
    body: "Receive the ruling, earn XP, and improve your standing.",
    icon: HeroIcons.ShieldCheckIcon,
  },
];

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
  const [selectedDifficulty, setSelectedDifficulty] = useState("all");
  const [showAllCaseCategories, setShowAllCaseCategories] = useState(false);
  const [lawyerSearch, setLawyerSearch] = useState("");
  const [searchedLawyers, setSearchedLawyers] = useState(null);
  const [lawyerSearchLoading, setLawyerSearchLoading] = useState(false);
  const [mobileCommandOpen, setMobileCommandOpen] = useState(false);
  const [isMobileActivationViewport, setIsMobileActivationViewport] = useState(false);
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
  const playerLevel = Math.max(1, Math.floor((progression.overallXp || 0) / 250) + 1);
  const currentLevelXp = (progression.overallXp || 0) % 250;
  const nextLevelProgressPercent = Math.max(8, Math.min(100, currentLevelXp / 2.5));
  const playerRankLabel = currentLeaderboardEntry ? `#${currentLeaderboardEntry.rank}` : "Unranked";
  const playerRecordLabel = `${progression.wins || 0}-${progression.losses || 0}-${
    progression.draws || 0
  }`;
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

  const handleCreateCase = async (caseTemplateId) => {
    if (!caseTemplateId) return;
    if (!canStartSoloCases) {
      setShowPaywallModal(true);
      return;
    }

    setCreating(true);
    startNavigationLoading("Preparing your client intake", { failsafeMs: 60000 });

    try {
      const { caseSession } = await apiClient.post("/cases", {
        caseTemplateId,
      });

      startNavigationLoading("Creating courtroom portraits", { failsafeMs: 60000 });
      const caseRef = caseSession.slug || caseSession.id;
      const portraitResults = await Promise.allSettled([
        apiClient.post(`/cases/${caseRef}/client-portrait`),
        apiClient.post(`/cases/${caseRef}/client-portrait?target=opponent`),
      ]);
      portraitResults
        .filter((result) => result.status === "rejected")
        .forEach((result) => console.error(result.reason));

      startNavigationLoading("Opening the matter", { failsafeMs: 60000 });
      router.push(`/dashboard/cases/${caseRef}`);
    } catch (error) {
      stopNavigationLoading();
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
    .slice(0, 4);
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
    const nextTemplates = templates.filter(
      (template) =>
        (!categorySlug || template.primaryCategory === categorySlug) &&
        (!showPlayableOnly || template.unlocked)
    );
    const firstUnlockedIndex = nextTemplates.findIndex((template) => template.unlocked);

    setSelectedCategory(categorySlug);
    setActiveTemplateIndex(firstUnlockedIndex >= 0 ? firstUnlockedIndex : 0);
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

  const isNewUser = (progression.completedCases || 0) === 0;
  const shouldSellLifetimeAccess = !hasArenaAccess;
  const lastCaseProgress = getCaseProgress(lastActiveCase);
  const primaryTemplateId =
    (activeTemplate?.unlocked ? activeTemplate : firstUnlockedTemplate)?.id || "";
  const primaryCtaLabel = shouldSellLifetimeAccess
    ? "Unlock Lifetime Access"
    : canResumeLastCase
    ? "Continue Case"
    : isNewUser
      ? "Start Your First Case"
      : "Start New Case";
  const heroTitle = shouldSellLifetimeAccess
    ? "Unlock Legal Arena for life."
    : canResumeLastCase
    ? "Continue your case."
    : isNewUser
      ? "Win the courtroom. Start your first case."
      : "Choose your next case.";
  const heroBody = shouldSellLifetimeAccess
    ? "Get permanent access to the AI lawyer game: interview clients, argue cases, challenge players, and keep every future update as the case library grows."
    : canResumeLastCase
    ? `${lastCaseProgress.nextStep} in ${lastActiveCase.title}.`
    : "Interview your client. Build your case. Argue in court. Get the verdict and earn XP.";
  const firstCaseProgressPercent = Math.min(
    100,
    Math.round(((progression.completedCases || 0) / 1) * 100)
  );
  const navItems = [
    { href: "#activation-home", label: "Home", icon: HeroIcons.HomeIcon },
    { href: "#recent-cases", label: "My Cases", icon: HeroIcons.ClipboardDocumentListIcon },
    { href: "#case-library", label: "Case Library", icon: HeroIcons.BookOpenIcon },
    {
      href: "/dashboard/bar-association",
      label: "Bar Association",
      icon: HeroIcons.UserGroupIcon,
    },
    { href: "#progress", label: "My Progress", icon: HeroIcons.ArrowTrendingUpIcon },
    { href: "#rankings", label: "Rankings", icon: HeroIcons.TrophyIcon },
    { href: "#specialty-board", label: "Specialty Board", icon: HeroIcons.ChartBarSquareIcon },
  ];
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
          <div className="grid min-w-0 gap-4 xl:grid-cols-[240px_minmax(0,1fr)]">
            <aside className="arena-surface arena-column-bg hidden h-full min-w-0 flex-col overflow-visible xl:flex">
              <div className="border-b border-white/10 px-4 py-4 md:px-5 md:py-6">
                <div className="flex items-center justify-between gap-3 xl:block">
                  <div>
                    <p className="arena-kicker">LEGAL ARENA</p>
                    <h2 className="arena-headline mt-2 text-xl uppercase leading-none md:mt-3 md:text-2xl">
                      Command
                    </h2>
                  </div>
                  <button
                    type="button"
                    className="arena-btn-dark inline-flex min-h-0 items-center gap-2 px-3 py-2 text-sm xl:hidden"
                    onClick={() => setMobileCommandOpen((current) => !current)}
                    aria-expanded={mobileCommandOpen}
                    aria-controls="mobile-command-panel"
                  >
                    <span>{mobileCommandOpen ? "Hide" : "Menu"}</span>
                    <HeroIcons.ChevronDownIcon
                      className={`h-4 w-4 transition ${mobileCommandOpen ? "rotate-180" : ""}`}
                      aria-hidden="true"
                    />
                  </button>
                </div>
              </div>

              <div
                id="mobile-command-panel"
                className={`${mobileCommandOpen ? "block" : "hidden"} xl:flex xl:flex-1 xl:flex-col`}
              >
                <nav className="flex-1 space-y-2 px-3 py-4">
                  {navItems.map((item, index) => {
                    const Icon = item.icon;
                    const NavLink = item.href.startsWith("/") ? Link : "a";

                    return (
                      <NavLink
                        key={item.href}
                        href={item.href}
                        className={`flex origin-center items-center gap-3 rounded-2xl border px-4 py-3 text-sm font-semibold transition hover:scale-[1.01] ${
                          index === 0
                            ? "border-white/[0.08] bg-white/[0.08] text-white hover:border-white/[0.12]"
                            : "border-white/[0.045] bg-white/[0.025] text-white/64 hover:border-white/[0.09] hover:text-white"
                        }`}
                        onClick={() => setMobileCommandOpen(false)}
                      >
                        <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />
                        <span>{item.label}</span>
                      </NavLink>
                    );
                  })}
                  {isAdmin ? (
                    <Link
                      href="/dashboard/admin"
                      className="flex origin-center items-center gap-3 rounded-2xl border border-white/[0.045] bg-white/[0.025] px-4 py-3 text-sm font-semibold text-white/64 transition hover:scale-[1.01] hover:border-white/[0.09] hover:text-white"
                    >
                      <HeroIcons.WrenchScrewdriverIcon className="h-5 w-5" aria-hidden="true" />
                      <span>Admin Lab</span>
                    </Link>
                  ) : null}
                </nav>

                <div className="space-y-4 border-t border-white/10 px-4 py-4">
                <div className="arena-surface-soft p-4">
                  <div className="flex items-center gap-3">
                    <LeaderboardPortrait image={userPortrait} name={userName} />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-white">{userName}</p>
                      <p className="mt-1 text-xs text-white/52">
                        {currentLeaderboardEntry
                          ? `Rank #${currentLeaderboardEntry.rank}`
                          : "Rookie Advocate"}
                      </p>
                    </div>
                  </div>
                  <div className="mt-4">
                    <div className="flex items-center justify-between text-xs text-white/58">
                      <span>Lvl. {Math.max(1, Math.floor((progression.overallXp || 0) / 250) + 1)}</span>
                      <span>{progression.overallXp || 0} XP</span>
                    </div>
                    <div className="mt-2 arena-progress-track">
                      <div
                        className="arena-progress-fill"
                        style={{
                          width: `${Math.max(8, Math.min(100, ((progression.overallXp || 0) % 250) / 2.5))}%`,
                        }}
                      />
                    </div>
                  </div>
                  <div className="mt-4 [&_.btn]:w-full [&_.btn]:justify-between [&_.btn]:text-sm">
                    <ButtonAccount />
                  </div>
                </div>

                {isNewUser ? (
                  <div className="arena-surface-soft p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-white">
                          {shouldSellLifetimeAccess
                            ? "Unlock lifetime access"
                            : "Complete your first case"}
                        </p>
                        <p className="mt-1 text-xs text-white/52">
                          {shouldSellLifetimeAccess
                            ? "All future updates included"
                            : "Earn 250 XP"}
                        </p>
                      </div>
                      <HeroIcons.RocketLaunchIcon className="h-5 w-5 text-white/64" aria-hidden="true" />
                    </div>
                    <div className="mt-4 arena-progress-track">
                      <div
                        className="arena-progress-fill"
                        style={{ width: `${Math.max(8, firstCaseProgressPercent)}%` }}
                      />
                    </div>
                    <p className="mt-2 text-right text-xs text-white/52">
                      {progression.completedCases || 0} / 1
                    </p>
                  </div>
                ) : null}
              </div>
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

                            handleCreateCase(primaryTemplateId);
                          }}
                          disabled={creating || (!shouldSellLifetimeAccess && !primaryTemplateId)}
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
                          {progression.wins || 0} Wins | {progression.completedCases || 0} Cases
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

              <section className="arena-surface arena-column-bg hidden overflow-hidden xl:block">
                <div className="grid min-h-[22rem] min-w-0 lg:grid-cols-[minmax(0,0.92fr)_minmax(320px,0.78fr)]">
                  <div className="relative z-10 min-w-0 p-5 md:p-9">
                    <p className="text-sm text-white/70">Welcome to Legal Arena, {userName}</p>
                    <h1 className="arena-headline mt-6 max-w-3xl break-words text-3xl leading-[1.02] sm:text-4xl md:mt-7 md:text-6xl md:leading-[0.96]">
                      {heroTitle}
                    </h1>
                    <p className="mt-5 max-w-xl text-base leading-7 text-white/68">
                      {heroBody}
                    </p>

                    <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                      {canResumeLastCase && !shouldSellLifetimeAccess ? (
                        <Link
                          href={`/dashboard/cases/${lastActiveCase.slug || lastActiveCase.id}`}
                          data-onboarding-target={
                            isMobileActivationViewport ? undefined : "quick-start-case"
                          }
                          className="arena-btn-light inline-flex min-w-0 items-center justify-center gap-3 px-4 py-4 sm:px-6"
                        >
                          <span>{primaryCtaLabel}</span>
                          <HeroIcons.ChevronRightIcon className="h-5 w-5" aria-hidden="true" />
                        </Link>
                      ) : (
                        <button
                          data-onboarding-target={
                            isMobileActivationViewport ? undefined : "quick-start-case"
                          }
                          className="arena-btn-light inline-flex min-w-0 items-center justify-center gap-3 px-4 py-4 sm:px-6"
                          onClick={() => {
                            if (shouldSellLifetimeAccess) {
                              setShowPaywallModal(true);
                              return;
                            }

                            handleCreateCase(primaryTemplateId);
                          }}
                          disabled={creating || (!shouldSellLifetimeAccess && !primaryTemplateId)}
                        >
                          {creating && !shouldSellLifetimeAccess ? (
                            <span className="loading loading-spinner loading-xs" />
                          ) : null}
                          <span>{primaryCtaLabel}</span>
                          <HeroIcons.ChevronRightIcon className="h-5 w-5" aria-hidden="true" />
                        </button>
                      )}
                      <Link
                        href="#case-library"
                        className="arena-btn-dark inline-flex min-w-0 items-center justify-center px-4 py-4 sm:px-6"
                      >
                        Browse Case Library
                      </Link>
                    </div>
                    <p className="mt-4 flex items-center gap-2 text-sm text-white/52">
                      <HeroIcons.ShieldCheckIcon className="h-4 w-4" aria-hidden="true" />
                      {shouldSellLifetimeAccess
                        ? "Pay once. Keep permanent access to every future Legal Arena update."
                        : "No commitment. Just your first step."}
                    </p>
                  </div>

                  <div className="relative min-h-[18rem] overflow-hidden border-t border-white/10 sm:min-h-[20rem] lg:border-l lg:border-t-0">
                    <img
                      src="/images/court.jpg"
                      alt=""
                      className="absolute inset-0 h-full w-full object-cover opacity-46"
                    />
                    <div className="absolute inset-0 bg-gradient-to-r from-black via-black/45 to-black/10 lg:bg-gradient-to-l" />
                    <div className="relative z-10 flex h-full min-h-[18rem] items-center p-5 sm:min-h-[20rem] md:p-7">
                      <Link
                        href={`/dashboard/players/${userId}`}
                        data-onboarding-target={
                          isMobileActivationViewport ? undefined : "player-brief"
                        }
                        className="block w-full rounded-[1.35rem] border border-white/10 bg-black/40 p-4 text-white shadow-[0_24px_70px_rgba(0,0,0,0.46)] backdrop-blur-md transition hover:scale-[1.01] hover:border-white/18 focus:outline-none focus:ring-2 focus:ring-white/35 sm:p-5"
                        aria-label="Open your lawyer profile page"
                      >
                        <div className="flex min-w-0 flex-col items-center gap-3 text-center sm:flex-row sm:justify-center sm:gap-4">
                          <LeaderboardPortrait
                            image={userPortrait}
                            name={userName}
                            className="h-16 w-16 border-white/20 shadow-[0_0_0_6px_rgba(255,255,255,0.035)]"
                          />
                          <div className="min-w-0">
                            <p className="arena-kicker">Player Brief</p>
                            <p className="mt-2 truncate text-xl font-semibold leading-tight text-white">
                              {userName}
                            </p>
                            <p className="mt-1 text-sm text-white/56">
                              Level {playerLevel} | {progression.overallXp || 0} XP
                            </p>
                          </div>
                        </div>

                        <div className="mt-5 grid grid-cols-3 gap-2">
                          <div className="rounded-xl border border-white/10 bg-white/[0.035] p-3">
                            <p className="text-[0.65rem] uppercase tracking-[0.16em] text-white/42">Rank</p>
                            <p className="mt-2 text-sm font-semibold text-white">{playerRankLabel}</p>
                          </div>
                          <div className="rounded-xl border border-white/10 bg-white/[0.035] p-3">
                            <p className="text-[0.65rem] uppercase tracking-[0.16em] text-white/42">Record</p>
                            <p className="mt-2 text-sm font-semibold text-white">{playerRecordLabel}</p>
                          </div>
                          <div className="rounded-xl border border-white/10 bg-white/[0.035] p-3">
                            <p className="text-[0.65rem] uppercase tracking-[0.16em] text-white/42">Cases</p>
                            <p className="mt-2 text-sm font-semibold text-white">
                              {progression.completedCases || 0}
                            </p>
                          </div>
                        </div>

                        <div className="mt-5">
                          <div className="flex items-center justify-between gap-3 text-xs text-white/58">
                            <span>Next level</span>
                            <span>{currentLevelXp}/250 XP</span>
                          </div>
                          <div className="mt-2 arena-progress-track">
                            <div
                              className="arena-progress-fill"
                              style={{ width: `${nextLevelProgressPercent}%` }}
                            />
                          </div>
                        </div>

                        <p className="mt-5 rounded-xl border border-emerald-300/10 bg-emerald-300/10 px-4 py-3 text-sm leading-6 text-emerald-50/90">
                          {playerEncouragementNote}
                        </p>
                      </Link>
                    </div>
                  </div>
                </div>
              </section>

              <section className="arena-surface" aria-labelledby="dashboard-how-it-works">
                <div className="p-4 md:p-6">
                  <p className="arena-kicker">How it works</p>
                  <h2 id="dashboard-how-it-works" className="sr-only">
                    How Legal Arena works
                  </h2>
                  <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                    {gameLoopSteps.map((step, index) => (
                      <div key={step.title} className="arena-surface-soft flex min-w-0 gap-3 p-4 sm:gap-4">
                        <IconTile icon={step.icon} />
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-white">
                            {index + 1}. {step.title}
                          </p>
                          <p className="mt-2 text-sm leading-6 text-white/58">{step.body}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </section>

              <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(280px,0.55fr)_minmax(300px,0.68fr)]">
                <section id="case-library" data-onboarding-target="case-library" className="arena-surface min-w-0 overflow-hidden">
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
                              {lastCaseProgress.percent}%
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-xs font-semibold text-white/58">
                                {canResumeLastCase ? "Intake Progress" : "Ready to start"}
                              </p>
                              <div className="mt-2 arena-progress-track">
                                <div
                                  className="arena-progress-fill"
                                  style={{
                                    width: `${canResumeLastCase ? lastCaseProgress.percent : 12}%`,
                                  }}
                                />
                              </div>
                            </div>
                            <button
                              type="button"
                              className="inline-flex min-h-0 items-center gap-2 rounded-xl border border-amber-200/25 bg-amber-300/14 px-3 py-2.5 text-xs font-semibold text-amber-100 disabled:cursor-not-allowed disabled:opacity-60"
                              onClick={() => {
                                if (shouldSellLifetimeAccess) {
                                  setShowPaywallModal(true);
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
                                {canResumeLastCase ? "Continue" : shouldSellLifetimeAccess ? "Unlock" : "Enter"}
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
                    <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
                      <div className="min-w-0" />
                      <div className="flex flex-wrap items-center gap-3 md:justify-end">
                        <p className="max-w-full break-words text-xs uppercase tracking-[0.12em] text-white/42">
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
                      className="mt-5 flex flex-wrap gap-2"
                    >
                      <button
                        className={`badge h-auto min-h-8 max-w-full origin-center cursor-pointer whitespace-normal border px-2.5 py-2 text-center text-xs leading-tight transition sm:text-sm ${
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
                          className={`badge h-auto min-h-8 max-w-full origin-center cursor-pointer whitespace-normal border px-2.5 py-2 text-center text-xs leading-tight transition sm:text-sm ${
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

                    {activeTemplate ? (
                      <div className="mt-5 overflow-hidden rounded-[1.35rem] border border-white/10 bg-white/[0.025]">
                        <div className="grid min-w-0 md:grid-cols-[minmax(0,1fr)_220px]">
                          <div className="min-w-0 p-4 sm:p-5">
                            <span className="badge badge-outline border-white/15 text-white/80">
                              {shouldSellLifetimeAccess
                                ? "Included with lifetime access"
                                : activeTemplate.unlocked
                                  ? "Beginner Friendly"
                                  : "Locked"}
                            </span>
                            <h3 className="mt-4 flex h-[4.75rem] items-start overflow-hidden break-words text-xl font-semibold leading-tight text-white sm:h-[5.625rem] sm:text-2xl">
                              {activeTemplate.title}
                            </h3>

                            <div className="mt-5 grid gap-3 sm:grid-cols-3">
                              <div className="arena-surface-soft p-3">
                                <p className="text-xs text-white/45">Difficulty</p>
                                <p className="mt-1 text-sm font-semibold text-emerald-300">
                                  {activeTemplate.complexity <= 1 ? "Easy" : `Tier ${activeTemplate.complexity}`}
                                </p>
                              </div>
                              <div className="arena-surface-soft p-3">
                                <p className="text-xs text-white/45">Est. Time</p>
                                <p className="mt-1 text-sm font-semibold text-white">15-20 min</p>
                              </div>
                              <div className="arena-surface-soft p-3">
                                <p className="text-xs text-white/45">Skills</p>
                                <p className="mt-1 break-words text-sm font-semibold text-white">
                                  {activeTemplate.practiceArea}
                                </p>
                              </div>
                            </div>

                            <button
                              className="arena-btn-light mt-5 inline-flex w-full min-w-0 items-center justify-center gap-3 px-4 py-4 sm:px-5"
                              onClick={() => {
                                if (shouldSellLifetimeAccess) {
                                  setShowPaywallModal(true);
                                  return;
                                }

                                handleCreateCase(activeTemplate.id);
                              }}
                              disabled={creating || (!shouldSellLifetimeAccess && !activeTemplate.unlocked)}
                            >
                              {creating && !shouldSellLifetimeAccess ? (
                                <span className="loading loading-spinner loading-xs" />
                              ) : null}
                              <span>
                                {shouldSellLifetimeAccess
                                  ? "Unlock Lifetime Access"
                                  : activeTemplate.unlocked
                                  ? isNewUser
                                    ? "Begin Client Interview"
                                    : "Start This Case"
                                  : "Locked"}
                              </span>
                              {activeTemplate.unlocked || shouldSellLifetimeAccess ? (
                                <HeroIcons.ChevronRightIcon className="h-5 w-5" aria-hidden="true" />
                              ) : (
                                <HeroIcons.LockClosedIcon className="h-5 w-5" aria-hidden="true" />
                              )}
                            </button>
                            <div className="mt-3 min-h-[4.5rem]">
                              {!activeTemplate.unlocked ? (
                                <p className="rounded-2xl border border-amber-300/20 bg-amber-500/10 px-4 py-3 text-sm leading-6 text-amber-100/82">
                                  {getTemplateUnlockMessage(activeTemplate, browserTimeZone)}
                                </p>
                              ) : null}
                            </div>
                            <p className="mt-4 text-sm text-white/52">
                              New here? This case is designed to teach the core loop.
                            </p>
                            <div className="mt-4 flex items-center justify-between gap-3 md:hidden">
                              <button
                                type="button"
                                className="arena-btn-dark min-h-0 px-3 py-2"
                                onClick={goToPreviousTemplate}
                                disabled={!canNavigateTemplates}
                                aria-label="Show previous case"
                              >
                                &lt;
                              </button>
                              <p className="min-w-0 text-center text-xs text-white/52">
                                {carouselStatus}
                              </p>
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
                          <div
                            className="relative hidden min-h-[14rem] overflow-hidden border-t border-white/10 md:flex md:flex-col md:justify-center md:border-l md:border-t-0 md:p-5"
                            style={{
                              backgroundImage: [
                                "linear-gradient(180deg, rgba(0,0,0,0.72), rgba(0,0,0,0.88))",
                                "url('/images/office.jpg')",
                              ].join(", "),
                              backgroundPosition: "center, center",
                              backgroundRepeat: "no-repeat, no-repeat",
                              backgroundSize: "cover, cover",
                            }}
                          >
                            <div className="relative z-10">
                              <p className="arena-kicker">Matchup</p>
                              <div className="mt-5 space-y-5">
                                <div>
                                  <p className="text-xs uppercase tracking-[0.16em] text-white/42">
                                    Plaintiff
                                  </p>
                                  <p className="mt-2 break-words text-lg font-semibold leading-tight text-white">
                                    {activeTemplate.plaintiffName || activeTemplate.clientName || "Plaintiff"}
                                  </p>
                                </div>
                                <div className="flex items-center gap-3 text-white/35">
                                  <div className="h-px flex-1 bg-white/10" />
                                  <span className="text-xs font-semibold uppercase tracking-[0.16em]">
                                    vs
                                  </span>
                                  <div className="h-px flex-1 bg-white/10" />
                                </div>
                                <div>
                                  <p className="text-xs uppercase tracking-[0.16em] text-white/42">
                                    Defendant
                                  </p>
                                  <p className="mt-2 break-words text-lg font-semibold leading-tight text-white">
                                    {activeTemplate.defendantName || activeTemplate.opponentName || "Defendant"}
                                  </p>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="hidden flex-col items-stretch justify-between gap-3 border-t border-white/10 px-4 py-4 sm:flex-row sm:items-center sm:px-5 md:flex">
                          <button
                            type="button"
                            className="arena-btn-dark min-h-0 px-3 py-2"
                            onClick={goToPreviousTemplate}
                            disabled={!canNavigateTemplates}
                            aria-label="Show previous case"
                          >
                            &lt;
                          </button>
                          <p className="min-w-0 text-center text-sm text-white/58">
                            {activeTemplate.unlocked
                              ? getTemplateUnlockMessage(activeTemplate, browserTimeZone)
                              : "Use the arrows to pick an available case."}
                          </p>
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
                    ) : (
                      <div className="arena-surface-soft mt-5 border-dashed p-8 text-center">
                        <p className="text-lg font-semibold text-white">No cases available</p>
                        <p className="mt-2 text-sm text-white/62">
                          {showPlayableOnly
                            ? "Turn off playable only to view locked cases in this category."
                            : "Check back after new disputes are added to the case library."}
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

                <section className="arena-surface hidden min-w-0 md:block">
                  <div className="p-4 md:p-6">
                    <p className="arena-kicker">Continue where you left off</p>
                    {lastActiveCase ? (
                      <div className="mt-5 arena-surface-soft p-4">
                        <div className="flex flex-col items-start justify-between gap-4 sm:flex-row">
                          <div className="min-w-0">
                            <span className={`badge border arena-status ${severityClass[statusSeverity[lastActiveCase.status] || "neutral"]}`}>
                              {lastCaseProgress.label}
                            </span>
                            <h3 className="mt-4 text-lg font-semibold leading-tight text-white">
                              {lastActiveCase.title}
                            </h3>
                            <p className="mt-2 text-sm text-white/52">
                              Updated {formatDate(lastActiveCase.updatedAt)}
                            </p>
                          </div>
                          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full border border-white/12 bg-white/[0.03] text-sm font-semibold text-white">
                            {lastCaseProgress.percent}%
                          </div>
                        </div>
                        <div className="mt-5 arena-progress-track">
                          <div
                            className="arena-progress-fill"
                            style={{ width: `${Math.max(8, lastCaseProgress.percent)}%` }}
                          />
                        </div>
                        <Link
                          href={`/dashboard/cases/${lastActiveCase.slug || lastActiveCase.id}`}
                          className="arena-btn-dark mt-5 inline-flex w-full items-center justify-center gap-3 px-5 py-3"
                        >
                          <span>{canResumeLastCase ? "Continue Case" : "View Case"}</span>
                          <HeroIcons.ChevronRightIcon className="h-5 w-5" aria-hidden="true" />
                        </Link>
                      </div>
                    ) : (
                      <div className="mt-5 arena-surface-soft border-dashed p-5 text-sm leading-7 text-white/62">
                        Your first case will appear here as soon as you begin.
                      </div>
                    )}

                    <button
                      type="button"
                      className="mt-4 block w-full overflow-hidden rounded-[1.35rem] border border-white/10 bg-white/[0.025] p-4 text-left transition hover:border-white/20"
                      onClick={() => setDashboardTutorialCompleted(false)}
                    >
                      <p className="text-sm font-semibold text-white">New to Legal Arena?</p>
                      <p className="mt-1 text-sm text-white/58">Take the quick tour.</p>
                    </button>
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
                  </div>

                  <div className="px-4 py-4">
                    {lastActiveCase ? (
                      <Link
                        href={`/dashboard/cases/${lastActiveCase.slug || lastActiveCase.id}`}
                        className="block overflow-hidden rounded-2xl border border-white/10 bg-white/[0.035] text-white shadow-[0_18px_55px_rgba(0,0,0,0.34)] transition hover:border-white/20"
                      >
                        <div className="relative min-h-[10.75rem] p-4">
                          <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_8%,rgba(251,191,36,0.16),transparent_28%),radial-gradient(circle_at_82%_18%,rgba(52,211,153,0.12),transparent_28%),linear-gradient(180deg,rgba(255,255,255,0.06),rgba(0,0,0,0.64))]" />
                          <div className="relative z-10">
                            <div className="flex items-start justify-between gap-3">
                              <span
                                className={`rounded-full border px-2.5 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.08em] arena-status ${
                                  severityClass[statusSeverity[lastActiveCase.status] || "neutral"]
                                }`}
                              >
                                {lastCaseProgress.label}
                              </span>
                              <span className="flex h-10 w-10 items-center justify-center rounded-full border border-emerald-300/30 bg-emerald-300/10 text-xs font-semibold text-emerald-200">
                                {lastCaseProgress.percent}%
                              </span>
                            </div>
                            <h3 className="mt-7 line-clamp-2 text-xl font-semibold leading-tight">
                              {lastActiveCase.title}
                            </h3>
                            <p className="mt-2 text-sm leading-6 text-white/62">
                              {lastActiveCase.primaryCategory} | Updated {formatDate(lastActiveCase.updatedAt)}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 border-t border-white/10 px-4 py-3">
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-semibold text-white/58">
                              {canResumeLastCase ? lastCaseProgress.nextStep : "Review the file"}
                            </p>
                            <div className="mt-2 arena-progress-track">
                              <div
                                className="arena-progress-fill"
                                style={{ width: `${Math.max(8, lastCaseProgress.percent)}%` }}
                              />
                            </div>
                          </div>
                          <span className="inline-flex items-center gap-2 rounded-xl border border-amber-200/25 bg-amber-300/14 px-3 py-2.5 text-xs font-semibold text-amber-100">
                            {canResumeLastCase ? "Continue" : "View"}
                            <HeroIcons.ChevronRightIcon className="h-4 w-4" aria-hidden="true" />
                          </span>
                        </div>
                      </Link>
                    ) : (
                      <div className="rounded-2xl border border-dashed border-white/12 bg-white/[0.025] p-6 text-center">
                        <p className="text-sm font-semibold text-white">No cases opened yet</p>
                        <p className="mt-2 text-sm text-white/54">
                          Start from the case library and your docket will appear here.
                        </p>
                      </div>
                    )}

                    {initialCases.length > 1 ? (
                      <div className="mt-6">
                        <p className="text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-white/42">
                          Recent files
                        </p>
                        <div className="mt-3 space-y-2.5">
                          {initialCases
                            .filter((item) => item.id !== lastActiveCase?.id)
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

                  <div className="mt-5 grid gap-3 lg:grid-cols-2">
                    {initialCases.length === 0 ? (
                      <div className="arena-surface-soft border-dashed p-8 text-center lg:col-span-2">
                        <p className="text-lg font-semibold text-white">No cases opened yet</p>
                        <p className="mt-2 text-sm text-white/62">
                          Start with the recommended case and the client interview will open.
                        </p>
                      </div>
                    ) : (
                      initialCases.slice(0, 6).map((item) => {
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
                href="#pvp-challenges"
                className="arena-surface-soft flex origin-center items-center justify-between !border-white/[0.045] px-4 py-3 text-sm text-white/72 transition hover:scale-[1.01] hover:!border-white/[0.09] hover:text-white"
              >
                <span>PVP Challenges</span>
                <span className="text-white/35">04</span>
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
