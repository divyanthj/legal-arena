"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import * as HeroIcons from "@heroicons/react/24/outline";
import ButtonAccount from "@/components/ButtonAccount";
import { useNavigationLoading } from "@/components/NavigationLoadingProvider";
import apiClient from "@/libs/api";
import { DevelopmentAccessPanel } from "@/components/legal-arena/DevelopmentAccessGate";

const statusLabel = {
  interview: "Client Interview",
  courtroom: "Courtroom",
  verdict: "Verdict Ready",
};

const formatCaseStatus = (caseSession = null) =>
  caseSession ? statusLabel[caseSession.status] || "In Progress" : "Ready";

const formatCooldownTime = (value, timeZone) => {
  if (!value) {
    return "";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const options = {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  };

  if (timeZone) {
    options.timeZone = timeZone;
  }

  return new Intl.DateTimeFormat("en", options).format(date);
};

const getTemplateUnlockMessage = (template, timeZone) => {
  if (!template) {
    return "";
  }

  if (template.unlocked) {
    return template.unlockReason || "Unlocked";
  }

  if (template.cooldownEndsAt) {
    const formatted = formatCooldownTime(template.cooldownEndsAt, timeZone);
    return formatted ? `Available again after ${formatted}.` : "Available again soon.";
  }

  return template.unlockReason || "Locked";
};

const getPlayerLevel = (progression = {}) =>
  Math.max(1, Math.floor((progression.overallXp || 0) / 250) + 1);

const getPrimaryCategoryTitle = (template = {}, categories = []) =>
  categories.find((category) => category.slug === template.primaryCategory)?.title ||
  template.primaryCategory ||
  "Case";

const MenuAction = ({ icon: Icon, title, body, children, className = "" }) => (
  <div
    className={`rounded-[1.35rem] border border-white/10 bg-black/34 p-4 shadow-[0_18px_60px_rgba(0,0,0,0.28)] backdrop-blur-md ${className}`}
  >
    <div className="flex items-start gap-3">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.06] text-white">
        <Icon className="h-5 w-5" aria-hidden="true" />
      </span>
      <div className="min-w-0 flex-1">
        <h2 className="text-base font-semibold text-white">{title}</h2>
        <p className="mt-1 text-sm leading-6 text-white/58">{body}</p>
      </div>
    </div>
    <div className="mt-4">{children}</div>
  </div>
);

export default function DashboardHub({
  initialCases = [],
  templates = [],
  categories = [],
  progression = {},
  isAdmin = false,
  userName = "Counsel",
  userEmail = "",
  hasArenaAccess = false,
  canStartSoloCases = false,
}) {
  const router = useRouter();
  const { startNavigationLoading, stopNavigationLoading } = useNavigationLoading();
  const [selectedCategory, setSelectedCategory] = useState(categories[0]?.slug || "");
  const [caseFinderOpen, setCaseFinderOpen] = useState(false);
  const [showPaywallModal, setShowPaywallModal] = useState(false);
  const [creatingCaseId, setCreatingCaseId] = useState("");

  const activeCase =
    initialCases.find((caseSession) =>
      ["interview", "courtroom"].includes(caseSession.status)
    ) || null;

  const unlockedTemplates = useMemo(
    () => templates.filter((template) => template.unlocked),
    [templates]
  );

  const selectedCategoryTemplates = useMemo(
    () =>
      templates.filter(
        (template) => !selectedCategory || template.primaryCategory === selectedCategory
      ),
    [selectedCategory, templates]
  );

  const visibleTemplates = selectedCategoryTemplates.length
    ? selectedCategoryTemplates
    : templates;
  const recommendedTemplate =
    visibleTemplates.find((template) => template.unlocked) ||
    unlockedTemplates[0] ||
    templates[0] ||
    null;
  const firstUnlockedTemplate = unlockedTemplates[0] || null;
  const primaryTemplate = recommendedTemplate?.unlocked
    ? recommendedTemplate
    : firstUnlockedTemplate || recommendedTemplate;
  const playerLevel = getPlayerLevel(progression);
  const currentLevelXp = (progression.overallXp || 0) % 250;
  const nextLevelProgressPercent = Math.max(8, Math.min(100, currentLevelXp / 2.5));
  const shouldSellLifetimeAccess = !hasArenaAccess;
  const canStartAnyCase = canStartSoloCases && Boolean(primaryTemplate?.id);
  const completedCases = progression.completedCases || 0;
  const recordLabel = `${progression.wins || 0}-${progression.losses || 0}-${
    progression.draws || 0
  }`;
  const browserTimeZone =
    typeof Intl !== "undefined"
      ? Intl.DateTimeFormat().resolvedOptions().timeZone
      : null;

  const openCaseFinder = () => {
    setCaseFinderOpen(true);
    window.setTimeout(() => {
      document.getElementById("find-cases")?.scrollIntoView({
        block: "start",
        behavior: "smooth",
      });
    }, 80);
  };

  const handleCreateCase = async (caseTemplateId) => {
    if (!caseTemplateId) {
      return;
    }

    if (!canStartSoloCases) {
      setShowPaywallModal(true);
      return;
    }

    setCreatingCaseId(caseTemplateId);
    startNavigationLoading();

    try {
      const { caseSession } = await apiClient.post("/cases", {
        caseTemplateId,
      });
      router.push(`/dashboard/cases/${caseSession.slug || caseSession.id}`);
    } catch (error) {
      console.error(error);
      stopNavigationLoading();
      setCreatingCaseId("");
    }
  };

  const handlePrimaryAction = () => {
    if (activeCase) {
      startNavigationLoading();
      router.push(`/dashboard/cases/${activeCase.slug || activeCase.id}`);
      return;
    }

    if (shouldSellLifetimeAccess || !canStartAnyCase) {
      setShowPaywallModal(true);
      return;
    }

    handleCreateCase(primaryTemplate.id);
  };

  return (
    <main className="arena-app-shell min-h-screen max-w-full overflow-x-hidden bg-black px-3 py-3 text-white sm:px-4 md:px-6 md:py-6">
      <section
        className="relative mx-auto flex min-h-[calc(100vh-1.5rem)] w-full max-w-6xl overflow-hidden rounded-[1.35rem] border border-white/10 bg-black shadow-[0_30px_100px_rgba(0,0,0,0.58)] md:min-h-[calc(100vh-3rem)]"
        aria-label="Legal Arena main menu"
      >
        <div
          className="absolute inset-0 bg-cover bg-center opacity-50"
          style={{ backgroundImage: "url('/images/court.jpg')" }}
          aria-hidden="true"
        />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.18),transparent_34%),linear-gradient(180deg,rgba(0,0,0,0.56),rgba(0,0,0,0.94))]" />

        <div className="relative z-10 flex min-h-full w-full flex-col justify-between p-4 sm:p-5 md:p-7">
          <header className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="arena-kicker">Legal Arena</p>
              <h1 className="arena-headline mt-2 break-words text-4xl uppercase leading-[0.9] sm:text-5xl md:text-7xl">
                Main Menu
              </h1>
            </div>
            <div className="shrink-0 [&_.btn]:min-h-0 [&_.btn]:rounded-full [&_.btn]:px-3 [&_.btn]:py-2 [&_.btn]:text-xs">
              <ButtonAccount />
            </div>
          </header>

          <div className="mt-8 grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-end">
            <section className="max-w-2xl">
              <p className="text-base font-semibold text-white/82">
                Welcome back, {userName}
              </p>
              <p className="mt-3 max-w-xl text-sm leading-7 text-white/62 sm:text-base">
                Pick one move and get into the game. Your files, rankings, and records can
                wait until after the next case starts.
              </p>

              <div className="mt-6 grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl border border-white/10 bg-black/32 p-4 backdrop-blur-md">
                  <p className="text-xs uppercase tracking-[0.16em] text-white/42">Level</p>
                  <p className="mt-2 text-2xl font-semibold text-white">{playerLevel}</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-black/32 p-4 backdrop-blur-md">
                  <p className="text-xs uppercase tracking-[0.16em] text-white/42">Record</p>
                  <p className="mt-2 text-2xl font-semibold text-white">{recordLabel}</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-black/32 p-4 backdrop-blur-md">
                  <p className="text-xs uppercase tracking-[0.16em] text-white/42">Cases</p>
                  <p className="mt-2 text-2xl font-semibold text-white">{completedCases}</p>
                </div>
              </div>

              <div className="mt-5 rounded-full border border-white/10 bg-black/32 p-1 backdrop-blur-md">
                <div
                  className="h-2 rounded-full bg-gradient-to-r from-emerald-300 via-sky-300 to-white"
                  style={{ width: `${nextLevelProgressPercent}%` }}
                />
              </div>
            </section>

            <section className="space-y-3">
              <button
                type="button"
                data-onboarding-target="quick-start-case"
                className="arena-btn-light flex w-full items-center justify-center gap-3 px-5 py-4 text-base"
                onClick={handlePrimaryAction}
                disabled={!activeCase && !shouldSellLifetimeAccess && !primaryTemplate?.id}
              >
                {creatingCaseId && creatingCaseId === primaryTemplate?.id ? (
                  <span className="loading loading-spinner loading-xs" />
                ) : activeCase ? (
                  <HeroIcons.PlayIcon className="h-5 w-5" aria-hidden="true" />
                ) : (
                  <HeroIcons.RocketLaunchIcon className="h-5 w-5" aria-hidden="true" />
                )}
                <span>
                  {shouldSellLifetimeAccess
                    ? "Unlock Access"
                    : activeCase
                      ? "Continue Case"
                      : "Start New Case"}
                </span>
              </button>

              <button
                type="button"
                className="arena-btn-dark flex w-full items-center justify-center gap-3 px-5 py-4"
                onClick={openCaseFinder}
              >
                <HeroIcons.BookOpenIcon className="h-5 w-5" aria-hidden="true" />
                <span>Find Cases</span>
              </button>

              <Link
                href="/dashboard/bar-association"
                className="arena-btn-dark flex w-full items-center justify-center gap-3 px-5 py-4"
              >
                <HeroIcons.UserGroupIcon className="h-5 w-5" aria-hidden="true" />
                <span>Bar Association</span>
              </Link>

              {isAdmin ? (
                <Link
                  href="/dashboard/admin"
                  className="arena-btn-dark flex w-full items-center justify-center gap-3 px-5 py-4"
                >
                  <HeroIcons.WrenchScrewdriverIcon className="h-5 w-5" aria-hidden="true" />
                  <span>Admin Lab</span>
                </Link>
              ) : null}
            </section>
          </div>

          <footer className="mt-8">
            {activeCase ? (
              <div className="rounded-[1.35rem] border border-white/10 bg-black/34 p-4 backdrop-blur-md">
                <p className="text-xs uppercase tracking-[0.16em] text-white/42">
                  Current Case
                </p>
                <p className="mt-2 break-words text-base font-semibold text-white">
                  {activeCase.title}
                </p>
                <p className="mt-1 text-sm text-white/58">{formatCaseStatus(activeCase)}</p>
              </div>
            ) : (
              <p className="text-sm text-white/48">
                {shouldSellLifetimeAccess
                  ? "Unlock once, then start playing every available Legal Arena case."
                  : primaryTemplate
                    ? `Recommended: ${primaryTemplate.title}`
                    : "Cases will appear here when the library is ready."}
              </p>
            )}
          </footer>
        </div>
      </section>

      {caseFinderOpen ? (
        <section id="find-cases" className="mx-auto mt-4 w-full max-w-6xl space-y-4">
          <MenuAction
            icon={HeroIcons.BookOpenIcon}
            title="Find Cases"
            body="Pick a case only when you want more choice. The main menu stays simple."
          >
            <div className="flex gap-2 overflow-x-auto pb-1">
              {categories.map((category) => (
                <button
                  key={category.slug}
                  type="button"
                  className={`shrink-0 rounded-full border px-4 py-2 text-sm font-semibold transition ${
                    selectedCategory === category.slug
                      ? "border-white/35 bg-white text-black"
                      : "border-white/10 bg-white/[0.04] text-white/68 hover:border-white/20 hover:text-white"
                  }`}
                  onClick={() => setSelectedCategory(category.slug)}
                >
                  {category.title}
                </button>
              ))}
            </div>

            {recommendedTemplate ? (
              <div className="mt-4 rounded-[1.35rem] border border-white/10 bg-white/[0.035] p-4">
                <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                  <div className="min-w-0">
                    <p className="text-xs uppercase tracking-[0.16em] text-white/42">
                      Recommended {getPrimaryCategoryTitle(recommendedTemplate, categories)}
                    </p>
                    <h3 className="mt-3 break-words text-2xl font-semibold leading-tight text-white">
                      {recommendedTemplate.title}
                    </h3>
                    <div className="mt-4 flex flex-wrap gap-2 text-sm text-white/58">
                      <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1">
                        Difficulty {recommendedTemplate.complexity || 1}
                      </span>
                      {recommendedTemplate.practiceArea ? (
                        <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1">
                          {recommendedTemplate.practiceArea}
                        </span>
                      ) : null}
                      <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1">
                        15-20 min
                      </span>
                    </div>
                    {!recommendedTemplate.unlocked ? (
                      <p className="mt-4 rounded-2xl border border-amber-300/20 bg-amber-500/10 px-4 py-3 text-sm leading-6 text-amber-100/82">
                        {getTemplateUnlockMessage(recommendedTemplate, browserTimeZone)}
                      </p>
                    ) : null}
                  </div>

                  <button
                    type="button"
                    className="arena-btn-light inline-flex min-w-[12rem] items-center justify-center gap-3 px-5 py-4"
                    onClick={() => {
                      if (shouldSellLifetimeAccess) {
                        setShowPaywallModal(true);
                        return;
                      }
                      handleCreateCase(recommendedTemplate.id);
                    }}
                    disabled={
                      Boolean(creatingCaseId) ||
                      (!shouldSellLifetimeAccess && !recommendedTemplate.unlocked)
                    }
                  >
                    {creatingCaseId === recommendedTemplate.id ? (
                      <span className="loading loading-spinner loading-xs" />
                    ) : recommendedTemplate.unlocked || shouldSellLifetimeAccess ? (
                      <HeroIcons.RocketLaunchIcon className="h-5 w-5" aria-hidden="true" />
                    ) : (
                      <HeroIcons.LockClosedIcon className="h-5 w-5" aria-hidden="true" />
                    )}
                    <span>
                      {shouldSellLifetimeAccess
                        ? "Unlock Access"
                        : recommendedTemplate.unlocked
                          ? "Start This Case"
                          : "Locked"}
                    </span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="mt-4 rounded-[1.35rem] border border-dashed border-white/12 bg-white/[0.025] p-6 text-center text-sm text-white/62">
                No cases are available in this category yet.
              </div>
            )}
          </MenuAction>
        </section>
      ) : null}

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
