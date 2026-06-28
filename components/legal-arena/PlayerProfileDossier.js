"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState } from "react";
import { toast } from "react-hot-toast";
import * as HeroIcons from "@heroicons/react/24/outline";
import apiClient from "@/libs/api";
import ChallengeButton from "./ChallengeButton";
import {
  EmptyPanel,
  formatDate,
  getCategoryTitle,
  getMatterId,
  getSidePlayed,
  getStatusFilterLabel,
  getUniqueOptions,
  isValidDate,
  normalizeMatter,
  outcomeLabel,
  statusLabel,
  statusTone,
  summarizeCount,
} from "./playerDossierShared";
import { CollapseChevron } from "./caseWorkspaceUtils";

const getNextRatingMilestone = (rating = 1000) => {
  const milestones = [1200, 1500, 1800, 2100];
  return milestones.find((value) => value > rating) || rating + 300;
};

const isArenaHeadshot = (value = "") => {
  const image = String(value || "").trim();

  return (
    image.startsWith("/api/players/avatar/") ||
    image.startsWith("data:image/") ||
    image.startsWith("blob:")
  );
};

const getArenaHeadshot = (value = "") =>
  isArenaHeadshot(value) ? String(value || "").trim() : "";

const getCategoryWinRate = (category) => {
  const decidedMatters =
    (category.wins || 0) + (category.losses || 0) + (category.draws || 0);

  return decidedMatters > 0
    ? Math.round(((category.wins || 0) / decidedMatters) * 100)
    : 0;
};

const formatResetDateTime = (value) => {
  if (!isValidDate(value)) {
    return "";
  }

  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
};

export default function PlayerProfileDossier({
  profile,
  viewerUserId = "",
  challengeTemplates = [],
  hasArenaAccess = false,
  isAdmin = false,
}) {
  const router = useRouter();
  const { player, cases = [] } = profile;
  const normalizedCases = useMemo(() => cases.map(normalizeMatter), [cases]);
  const archiveDetailsRef = useRef(null);
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [outcomeFilter, setOutcomeFilter] = useState("all");
  const [avatarPreview, setAvatarPreview] = useState(getArenaHeadshot(player.image));
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarDeleting, setAvatarDeleting] = useState(false);
  const [showResetDialog, setShowResetDialog] = useState(false);
  const [resetting, setResetting] = useState(false);

  const canEditAvatar = String(viewerUserId || "") === String(player.id || "");
  const canViewFullArchive = canEditAvatar || isAdmin;
  const archiveCases = useMemo(
    () =>
      canViewFullArchive
        ? normalizedCases
        : normalizedCases.filter((caseSession) => caseSession.status === "verdict"),
    [canViewFullArchive, normalizedCases]
  );
  const categoryOptions = useMemo(
    () => getUniqueOptions(archiveCases.map((caseSession) => caseSession.primaryCategory)),
    [archiveCases]
  );
  const statusOptions = useMemo(
    () => getUniqueOptions(archiveCases.map((caseSession) => caseSession.status)),
    [archiveCases]
  );
  const outcomeOptions = useMemo(
    () => getUniqueOptions(archiveCases.map((caseSession) => caseSession.outcome || "open")),
    [archiveCases]
  );

  const filteredCases = useMemo(
    () =>
      archiveCases.filter((caseSession) => {
        const outcome = caseSession.outcome || "open";

        return (
          (categoryFilter === "all" || caseSession.primaryCategory === categoryFilter) &&
          (!canViewFullArchive || statusFilter === "all" || caseSession.status === statusFilter) &&
          (outcomeFilter === "all" || outcome === outcomeFilter)
        );
      }),
    [archiveCases, canViewFullArchive, categoryFilter, outcomeFilter, statusFilter]
  );

  const sortedCategories = useMemo(
    () =>
      [...(player.categoryStats || [])].sort((left, right) => {
        if ((right.completedCases || 0) !== (left.completedCases || 0)) {
          return (right.completedCases || 0) - (left.completedCases || 0);
        }

        if ((right.rating || 0) !== (left.rating || 0)) {
          return (right.rating || 0) - (left.rating || 0);
        }

        return getCategoryTitle(left.categorySlug).localeCompare(
          getCategoryTitle(right.categorySlug)
        );
      }),
    [player.categoryStats]
  );
  const activeCategories = useMemo(
    () =>
      sortedCategories.filter(
        (category) =>
          (category.completedCases || 0) > 0 ||
          (category.wins || 0) > 0 ||
          (category.losses || 0) > 0 ||
          (category.draws || 0) > 0
      ),
    [sortedCategories]
  );

  const joinedLabel = isValidDate(player.joinedAt)
    ? `Joined ${formatDate(player.joinedAt)}`
    : "Join date unavailable";
  const nextMilestone = getNextRatingMilestone(player.overallRating || 1000);
  const nextXpMilestone = getNextRatingMilestone(player.overallXp || 0);
  const completedCategories = activeCategories.length;
  const topCategory = activeCategories[0] || null;
  const topSpecialties = activeCategories.slice(0, 3);
  const topSpecialtyMaxCases = Math.max(
    1,
    ...topSpecialties.map((category) => category.completedCases || 0)
  );
  const totalDecidedMatters =
    (player.wins || 0) + (player.losses || 0) + (player.draws || 0);
  const winRate =
    totalDecidedMatters > 0
      ? Math.round(((player.wins || 0) / totalDecidedMatters) * 100)
      : 0;
  const resetAvailableAt = isValidDate(player.gameplayResetAvailableAt)
    ? new Date(player.gameplayResetAvailableAt)
    : null;
  const lastResetLabel = formatResetDateTime(player.lastGameplayResetAt);
  const nextResetLabel = formatResetDateTime(player.gameplayResetAvailableAt);
  const resetCooldownActive =
    Boolean(resetAvailableAt) && resetAvailableAt.getTime() > Date.now();
  const resetCooldownLabel = resetCooldownActive
    ? `Fresh Start opens again ${nextResetLabel || "soon"}.`
    : "";

  const openResetDialog = () => {
    setShowResetDialog(true);
  };

  const handleResetProgress = async () => {
    if (resetting || resetCooldownActive) {
      if (resetCooldownActive) {
        toast(resetCooldownLabel || "Fresh Start is cooling down.");
      }
      return;
    }

    setResetting(true);

    try {
      await apiClient.post("/players/reset");
      toast.success("Clean slate ready. The arena is yours again.");
      setShowResetDialog(false);
      router.refresh();
    } catch (error) {
      toast.error(error?.message || "Could not reset your arena record.");
    } finally {
      setResetting(false);
    }
  };

  const focusArchiveCategory = (categorySlug = "all") => {
    setCategoryFilter(categorySlug);
    setStatusFilter("all");
    setOutcomeFilter("all");
    archiveDetailsRef.current?.setAttribute("open", "");
    document.getElementById("case-archive")?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  };

  const handleAvatarChange = async (event) => {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    if (avatarUploading || avatarDeleting) {
      return;
    }

    const previewUrl = URL.createObjectURL(file);
    setAvatarPreview((current) => {
      if (current?.startsWith("blob:")) {
        URL.revokeObjectURL(current);
      }

      return previewUrl;
    });

    const formData = new FormData();
    formData.append("image", file);
    setAvatarUploading(true);

    try {
      const response = await apiClient.post("/players/avatar", formData);
      setAvatarPreview((current) => {
        if (current?.startsWith("blob:")) {
          URL.revokeObjectURL(current);
        }

        return response.image || "";
      });
      toast.success("Professional headshot generated.");
      router.refresh();
    } catch (error) {
      setAvatarPreview((current) => {
        if (current?.startsWith("blob:")) {
          URL.revokeObjectURL(current);
        }

        return getArenaHeadshot(player.image);
      });
    } finally {
      setAvatarUploading(false);
      event.target.value = "";
    }
  };

  const handleAvatarDelete = async () => {
    if (avatarUploading || avatarDeleting || !avatarPreview) {
      return;
    }

    setAvatarDeleting(true);

    try {
      await apiClient.delete("/players/avatar");
      setAvatarPreview((current) => {
        if (current?.startsWith("blob:")) {
          URL.revokeObjectURL(current);
        }

        return "";
      });
      toast.success("Profile photo removed.");
      router.refresh();
    } catch (error) {
      // apiClient already displays the error toast.
    } finally {
      setAvatarDeleting(false);
    }
  };

  return (
    <main className="arena-app-shell min-h-screen overflow-x-hidden px-3 pb-24 pt-4 md:px-6 md:pb-24 md:pt-6 xl:pb-6">
      <section className="mx-auto grid w-full max-w-[1600px] gap-5 arena-reveal xl:grid-cols-[88px_minmax(0,1fr)]">
        <aside className="relative z-50 hidden min-h-[calc(100vh-3rem)] overflow-visible flex-col items-center justify-between rounded-[1.75rem] border border-white/10 bg-black/34 py-6 shadow-[0_22px_80px_rgba(0,0,0,0.42)] backdrop-blur-xl xl:flex">
          <nav className="relative z-50 flex flex-col items-center gap-4 overflow-visible" aria-label="Dossier navigation">
              {[
                { href: "/dashboard", label: "Dashboard", icon: HeroIcons.HomeIcon },
                { href: "#dossier", label: "Dossier", icon: HeroIcons.FolderIcon, active: true },
                { href: "#case-archive", label: "Cases", icon: HeroIcons.DocumentTextIcon },
                { href: "/dashboard/bar-association", label: "Rankings", icon: HeroIcons.TrophyIcon },
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
          <Link
            href="/dashboard"
            className="flex h-12 w-12 items-center justify-center rounded-2xl text-white/54 transition hover:bg-white/[0.04] hover:text-white"
            aria-label="Back to dashboard"
            title="Back to dashboard"
          >
            <HeroIcons.ArrowLeftOnRectangleIcon className="h-5 w-5" aria-hidden="true" />
          </Link>
        </aside>

        <div className="min-w-0 space-y-5">
          <div className="flex items-center justify-between gap-3 px-1">
            <div className="flex items-center gap-3">
              <Link
                href="/dashboard"
                className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 bg-white/[0.035] text-white transition hover:border-white/20"
                aria-label="Back to dashboard"
              >
                <HeroIcons.ArrowLeftIcon className="h-5 w-5" aria-hidden="true" />
              </Link>
              <p className="text-base font-semibold text-white">Lawyer Dossier</p>
            </div>
            {canEditAvatar ? (
              <button
                type="button"
                className="arena-btn-danger px-4 py-2 text-sm"
                onClick={openResetDialog}
              >
                Fresh Start
              </button>
            ) : (
              <ChallengeButton
                targetPlayerId={player.id}
                targetPlayerName={player.name}
                templates={challengeTemplates}
                hasArenaAccess={hasArenaAccess}
                className="arena-btn-light px-4 py-2 text-sm"
              />
            )}
          </div>
        <div
          id="dossier"
          className="arena-surface arena-scanline arena-column-bg overflow-hidden"
          style={{
            backgroundImage: [
              "linear-gradient(90deg, rgba(4,4,4,0.96) 0%, rgba(4,4,4,0.9) 36%, rgba(4,4,4,0.58) 68%, rgba(4,4,4,0.92) 100%)",
              "linear-gradient(180deg, rgba(38,24,8,0.14), rgba(0,0,0,0.08))",
              "url('/images/office.jpg')",
            ].join(", "),
            backgroundPosition: "center, center, 62% center",
            backgroundRepeat: "no-repeat, no-repeat, no-repeat",
            backgroundSize: "cover, cover, auto 120%",
          }}
        >
          <div className="p-5 md:p-8">
            <div className="grid gap-6 xl:grid-cols-[190px_minmax(0,1fr)_470px] xl:items-center">
              <div className="flex flex-col items-center justify-start xl:pt-2">
                <div className="relative h-36 w-36 md:h-44 md:w-44">
                  <div className="h-full w-full overflow-hidden rounded-full border border-amber-200/35 bg-white/[0.04] shadow-[0_0_0_7px_rgba(255,255,255,0.035)]">
                    <img
                      src={avatarPreview || "/images/profile.jpg"}
                      alt={`${player.name} profile`}
                      style={{ objectPosition: "center calc(50% + 2px)" }}
                      className={`block h-full w-full object-cover object-center transition duration-500 ${
                        avatarUploading
                          ? "scale-[1.07] blur-sm opacity-60"
                          : avatarPreview
                          ? "scale-[1.025]"
                          : "scale-[1.62]"
                      }`}
                    />
                    {avatarUploading ? (
                      <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/28 backdrop-blur-[2px]">
                        <span className="h-11 w-11 animate-spin rounded-full border-2 border-white/20 border-t-white/80" />
                      </div>
                    ) : null}
                  </div>
                  <div className="absolute -bottom-3 left-1/2 grid h-12 w-12 -translate-x-1/2 place-items-center rounded-2xl border border-amber-200/40 bg-black/80 text-sm font-bold text-amber-100 shadow-lg shadow-black/40">
                    I
                  </div>
                  {canEditAvatar && avatarPreview && !avatarUploading ? (
                    <button
                      type="button"
                      className="absolute right-1 top-1 z-10 flex h-8 w-8 items-center justify-center rounded-full border border-white/15 bg-black/80 text-xl font-semibold leading-none text-white shadow-lg shadow-black/40 transition hover:border-rose-300/60 hover:bg-rose-950 focus:outline-none focus:ring-2 focus:ring-rose-300/70 disabled:cursor-not-allowed disabled:opacity-60"
                      aria-label="Delete profile photo"
                      disabled={avatarDeleting}
                      onClick={handleAvatarDelete}
                    >
                      {avatarDeleting ? (
                        <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/20 border-t-white/80" />
                      ) : (
                        "×"
                      )}
                    </button>
                  ) : null}
                </div>
                {canEditAvatar ? (
                  <div className="mt-5 flex flex-col gap-2">
                    <label className="arena-btn-dark flex cursor-pointer items-center justify-center px-4 py-3 text-sm">
                      {avatarUploading ? "Creating Headshot..." : "Upload Image"}
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        disabled={avatarUploading || avatarDeleting}
                        onChange={handleAvatarChange}
                      />
                    </label>
                    <button
                      type="button"
                      className="arena-btn-danger flex items-center justify-center px-4 py-3 text-sm xl:hidden"
                      onClick={openResetDialog}
                    >
                      Fresh Start
                    </button>
                  </div>
                ) : (
                  <div className="mt-5 xl:hidden">
                    <ChallengeButton
                      targetPlayerId={player.id}
                      targetPlayerName={player.name}
                      templates={challengeTemplates}
                      hasArenaAccess={hasArenaAccess}
                      className="arena-btn-light flex w-full items-center justify-center px-4 py-3 text-sm"
                    />
                  </div>
                )}
              </div>

              <div className="min-w-0 text-center xl:text-left">
                <h1 className="break-words text-4xl font-semibold leading-tight text-white md:text-6xl">
                  {player.name}
                </h1>
                <p className="mt-3 inline-flex items-center gap-2 text-base font-semibold text-amber-200">
                  <HeroIcons.SparklesIcon className="h-5 w-5" aria-hidden="true" />
                  Rookie Advocate
                </p>
                <div className="mt-5 grid gap-4 text-sm text-white/58 sm:grid-cols-3 xl:max-w-2xl">
                  <div>
                    <p className="arena-kicker">Record</p>
                    <p className="mt-2 font-semibold text-white">
                      {player.wins}-{player.losses}-{player.draws}
                    </p>
                  </div>
                  <div>
                    <p className="arena-kicker">Joined</p>
                    <p className="mt-2 font-semibold text-white">
                      {joinedLabel.replace("Joined ", "")}
                    </p>
                  </div>
                  <div>
                    <p className="arena-kicker">Public Record</p>
                    <p className="mt-2 font-semibold text-white">
                      {player.completedCases} completed matters
                    </p>
                  </div>
                </div>
                <div className="mt-5 xl:max-w-2xl">
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <span className="text-white/60">XP</span>
                    <span className="font-semibold text-white">
                      {player.overallXp} / {nextXpMilestone}
                    </span>
                  </div>
                  <div className="mt-2 arena-progress-track">
                    <div
                      className="arena-progress-fill"
                      style={{
                        width: `${Math.max(
                          8,
                          Math.min(100, ((player.overallXp || 0) / nextXpMilestone) * 100)
                        )}%`,
                      }}
                    />
                  </div>
                  <p className="mt-3 text-sm text-white/58">Next tier: {nextXpMilestone} XP</p>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                <div className="arena-stat-card !p-5">
                  <HeroIcons.StarIcon className="h-6 w-6 text-amber-200" aria-hidden="true" />
                  <p className="arena-kicker">Rating</p>
                  <p className="mt-3 text-4xl font-semibold text-white">{player.overallRating}</p>
                  <p className="mt-2 text-sm text-white/52">Overall standing</p>
                </div>
                <div className="arena-stat-card !p-5">
                  <HeroIcons.BoltIcon className="h-6 w-6 text-amber-200" aria-hidden="true" />
                  <p className="arena-kicker">XP</p>
                  <p className="mt-3 text-4xl font-semibold text-white">{player.overallXp}</p>
                  <p className="mt-2 text-sm text-white/52">Next tier: {nextXpMilestone}</p>
                </div>
                <div className="arena-stat-card !p-5 sm:col-span-2 xl:col-span-1">
                  <HeroIcons.ScaleIcon className="h-6 w-6 text-amber-200" aria-hidden="true" />
                  <p className="arena-kicker">Matters</p>
                  <p className="mt-3 text-4xl font-semibold text-white">{cases.length}</p>
                  <p className="mt-2 text-sm text-white/52">Tracked archive entries</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-6 xl:grid-cols-[420px_minmax(0,1fr)]">
          <aside className="space-y-6">
            <div className="arena-surface">
              <div className="p-5 md:p-6">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="arena-kicker">Top Specialties</p>
                    <h2 className="arena-headline mt-2 text-2xl">Category progression</h2>
                  </div>
                  <button
                    type="button"
                    className="text-xs font-semibold text-white/58 transition hover:text-white"
                    onClick={() => focusArchiveCategory("all")}
                  >
                    View all
                  </button>
                </div>
                <div className="mt-3 flex flex-wrap gap-3 text-sm text-white/52">
                  <span>{completedCategories}/{sortedCategories.length} categories active</span>
                  <span>{player.completedCases} matters completed</span>
                </div>
                <div className="mt-5 space-y-3">
                  {topSpecialties.length > 0 ? (
                    topSpecialties.map((category, index) => {
                      const progressPercent = Math.max(
                        12,
                        Math.round(
                          ((category.completedCases || 0) / topSpecialtyMaxCases) * 100
                        )
                      );
                      const isTopCategory = index === 0;

                      return (
                        <button
                          key={category.categorySlug}
                          type="button"
                          className="block w-full space-y-2 text-left"
                          onClick={() => focusArchiveCategory(category.categorySlug)}
                        >
                          <div
                            className={`relative min-h-[4.75rem] overflow-hidden rounded-2xl border bg-white/[0.035] ${
                              isTopCategory ? "border-amber-200/40" : "border-white/10"
                            } transition hover:-translate-y-0.5 hover:border-white/25`}
                          >
                            <div
                              className="absolute inset-y-0 left-0 rounded-2xl bg-gradient-to-r from-emerald-400/42 to-amber-300/34"
                              style={{ width: `${progressPercent}%` }}
                            />
                            <div className="relative flex min-h-[4.75rem] items-center justify-between gap-4 px-4 py-3">
                              <div className="min-w-0">
                                <p className="truncate text-sm font-semibold text-white">
                                  {getCategoryTitle(category.categorySlug)}
                                </p>
                                <p className="mt-1 text-xs font-medium text-white/62">
                                  {`${category.completedCases} matters | Record ${category.wins}-${category.losses}-${category.draws}`}
                                </p>
                              </div>
                              <div className="shrink-0 text-right">
                                <p className="text-sm font-semibold text-white">
                                  {category.rating}
                                </p>
                                <p className="mt-1 text-xs font-semibold text-emerald-200">
                                  {getCategoryWinRate(category)}% win
                                </p>
                              </div>
                            </div>
                          </div>
                        </button>
                      );
                    })
                  ) : (
                    <EmptyPanel
                      title="No category record yet"
                      detail="Complete a matter to start building a specialty progression record."
                    />
                  )}
                </div>
              </div>
            </div>
          </aside>

          <section className="space-y-6">
            <div className="arena-surface overflow-hidden">
              <div className="grid gap-4 p-5 md:grid-cols-[minmax(0,1fr)_280px] md:p-6">
                <div>
                  <p className="arena-kicker">Performance Snapshot</p>
                  <h2 className="arena-headline mt-2 text-2xl">Current standing</h2>
                  <p className="mt-3 max-w-2xl text-sm leading-7 text-white/66">
                    {topCategory
                      ? `${player.name} is strongest in ${getCategoryTitle(
                          topCategory.categorySlug
                        )}, with ${topCategory.completedCases} completed matters in that track and a ${winRate}% win rate overall.`
                      : `${player.name} is still building an arena record. Complete more matters to establish a stronger category profile and climb the leaderboard.`}
                  </p>
                </div>
                <div className="arena-surface-soft flex flex-col justify-between p-5">
                  <div>
                    <p className="arena-kicker">Next Rating Milestone</p>
                    <p className="mt-2 text-4xl font-semibold text-white">{nextMilestone}</p>
                    <p className="mt-2 text-sm text-white/56">Top bracket target</p>
                  </div>
                  <div className="mt-6 arena-progress-track">
                    <div
                      className="arena-progress-fill"
                      style={{
                        width: `${Math.max(
                          8,
                          Math.min(
                            100,
                            ((player.overallRating || 0) / nextMilestone) * 100
                          )
                        )}%`,
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>

            <div id="case-archive" className="arena-surface">
              <details ref={archiveDetailsRef} className="group" open>
                <summary className="list-none cursor-pointer p-5 md:p-6">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                    <div>
                      <p className="arena-kicker">Matter Archive</p>
                      <h2 className="arena-headline mt-2 text-2xl">Cases</h2>
                    </div>
                    <div className="flex items-center gap-3">
                      <p className="text-sm text-white/42">
                        {filteredCases.length} of {archiveCases.length} visible matters
                      </p>
                      <CollapseChevron />
                    </div>
                  </div>
                </summary>

                <div className="px-5 pb-5 md:px-6 md:pb-6">
                  <div
                    className={`grid gap-3 ${
                      canViewFullArchive ? "md:grid-cols-3" : "md:grid-cols-2"
                    }`}
                  >
                    <label className="form-control">
                      <span className="label-text text-xs uppercase tracking-[0.14em] text-white/62">
                        Category
                      </span>
                      <select
                        className="arena-select select select-bordered min-h-0 text-sm text-slate-100"
                        value={categoryFilter}
                        onChange={(event) => setCategoryFilter(event.target.value)}
                      >
                        <option value="all">All categories</option>
                        {categoryOptions.map((category) => (
                          <option key={category} value={category}>
                            {getCategoryTitle(category)}
                          </option>
                        ))}
                      </select>
                    </label>
                    {canViewFullArchive ? (
                      <label className="form-control">
                        <span className="label-text text-xs uppercase tracking-[0.14em] text-white/62">
                          Status
                        </span>
                        <select
                          className="arena-select select select-bordered min-h-0 text-sm text-slate-100"
                          value={statusFilter}
                          onChange={(event) => setStatusFilter(event.target.value)}
                        >
                          <option value="all">All statuses</option>
                          {statusOptions.map((status) => (
                            <option key={status} value={status}>
                              {getStatusFilterLabel(status)}
                            </option>
                          ))}
                        </select>
                      </label>
                    ) : null}
                    <label className="form-control">
                      <span className="label-text text-xs uppercase tracking-[0.14em] text-white/62">
                        Outcome
                      </span>
                      <select
                        className="arena-select select select-bordered min-h-0 text-sm text-slate-100"
                        value={outcomeFilter}
                        onChange={(event) => setOutcomeFilter(event.target.value)}
                      >
                        <option value="all">All outcomes</option>
                        {outcomeOptions.map((outcome) => (
                          <option key={outcome} value={outcome}>
                            {outcome === "open"
                              ? "In Progress"
                              : outcomeLabel[outcome] || outcome}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>

                  <div className="mt-5 space-y-3">
                    {archiveCases.length === 0 ? (
                      <EmptyPanel
                        title="No visible matters yet"
                        detail={
                          canViewFullArchive
                            ? "This lawyer has not opened a case record yet."
                            : "This lawyer has not completed a public verdict-ready matter yet."
                        }
                      />
                    ) : filteredCases.length === 0 ? (
                      <EmptyPanel
                        title="No matters match these filters"
                        detail="Clear a filter to bring matters back into the archive."
                      />
                    ) : (
                      filteredCases.map((caseSession) => {
                        const matterId = getMatterId(caseSession);
                        const shouldResumePlayableMatter =
                          canEditAvatar && caseSession.status === "interview";
                        const matterHref = shouldResumePlayableMatter
                          ? `/dashboard/cases/${matterId}`
                          : `/dashboard/players/${player.id}/matters/${matterId}`;

                        return (
                          <Link
                            key={matterId}
                            href={matterHref}
                            className="arena-surface-soft block p-4 transition hover:-translate-y-0.5 hover:border-white/20"
                          >
                            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                              <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span
                                    className={`badge border arena-status ${
                                      statusTone[caseSession.status] || "arena-status-neutral"
                                    }`}
                                  >
                                    {statusLabel[caseSession.status] || caseSession.status}
                                  </span>
                                  <span className="badge border arena-status arena-status-neutral">
                                    {outcomeLabel[caseSession.outcome] || "In Progress"}
                                  </span>
                                  <span className="text-xs uppercase tracking-[0.14em] text-white/42">
                                    Updated {caseSession.updatedDateLabel}
                                  </span>
                                </div>
                                <h3 className="mt-3 text-lg font-semibold leading-tight text-white">
                                  {caseSession.title}
                                </h3>
                                <p className="mt-2 line-clamp-2 text-sm leading-7 text-white/66">
                                  {caseSession.premise?.overview ||
                                    "No case overview available."}
                                </p>
                                <div className="mt-3 flex flex-wrap gap-4 text-xs text-white/42">
                                  <span>
                                    {caseSession.premise?.courtName || "Unknown court"}
                                  </span>
                                  <span>Side played: {getSidePlayed(caseSession)}</span>
                                </div>
                              </div>
                              <div className="flex shrink-0 flex-wrap gap-2 text-xs text-white/56 lg:max-w-[16rem] lg:justify-end">
                                <span>{getCategoryTitle(caseSession.primaryCategory)}</span>
                                <span>Complexity {caseSession.complexity}</span>
                                <span>{summarizeCount(caseSession.interviewCount, "intake")}</span>
                                <span>{summarizeCount(caseSession.courtroomCount, "round")}</span>
                                <span className="font-semibold text-white">
                                  {shouldResumePlayableMatter ? "Resume intake" : "View matter"}
                                </span>
                              </div>
                            </div>
                          </Link>
                        );
                      })
                    )}
                  </div>
                </div>
              </details>
            </div>
          </section>
        </div>
        <div className="arena-surface flex flex-col gap-3 p-5 text-center text-sm text-white/72 md:flex-row md:items-center md:justify-center">
          <HeroIcons.TrophyIcon className="mx-auto h-5 w-5 text-amber-200 md:mx-0" aria-hidden="true" />
          <span className="font-semibold text-white">Keep winning to climb the ranks.</span>
          <span>
            Your next milestone is <span className="text-emerald-300">{nextMilestone} rating</span>.
          </span>
        </div>
        </div>
      </section>
      <nav
        className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-black/86 px-2 pb-[calc(env(safe-area-inset-bottom)+0.45rem)] pt-2 shadow-[0_-18px_50px_rgba(0,0,0,0.45)] backdrop-blur-xl xl:hidden"
        aria-label="Dossier mobile navigation"
      >
        <div className="mx-auto grid max-w-md grid-cols-4 gap-1">
          {[
            { href: "/dashboard", label: "Home", icon: HeroIcons.HomeIcon },
            { href: "#case-archive", label: "Cases", icon: HeroIcons.BriefcaseIcon },
            { href: "/dashboard/bar-association", label: "Ranks", icon: HeroIcons.TrophyIcon },
            { href: "#dossier", label: "Profile", icon: HeroIcons.UserIcon, active: true },
          ].map((item) => {
            const Icon = item.icon;
            const NavLink = item.href.startsWith("/") ? Link : "a";

            return (
              <NavLink
                key={`mobile-${item.label}-${item.href}`}
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
      {showResetDialog ? (
        <dialog className="modal modal-open">
          <div className="modal-box border border-rose-400/30 bg-[#170707] text-white shadow-2xl shadow-black/60">
            <p className="arena-kicker text-rose-300">Fresh Start</p>
            <h3 className="arena-headline mt-2 text-3xl uppercase">
              {resetCooldownActive ? "Fresh Start is cooling down" : "Wipe the slate clean?"}
            </h3>
            {resetCooldownActive ? (
              <div className="mt-4 space-y-3 text-sm leading-7 text-white/68">
                <p>
                  Your clean docket is still settling. Fresh Start can be used once every
                  7 days.
                </p>
                <div className="arena-surface-soft grid gap-3 p-4 sm:grid-cols-2">
                  <div>
                    <p className="arena-kicker">Last Fresh Start</p>
                    <p className="mt-2 font-semibold text-white">
                      {lastResetLabel || "Recently"}
                    </p>
                  </div>
                  <div>
                    <p className="arena-kicker">Next Fresh Start</p>
                    <p className="mt-2 font-semibold text-white">
                      {nextResetLabel || "Soon"}
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <p className="mt-4 text-sm leading-7 text-white/68">
                This clears your case history, transcripts, wins, losses, rating progress,
                and cooldowns. Completed cases reopen, exited cases come back, and your
                lawyer starts over with a clean docket.
              </p>
            )}
            <div className="modal-action flex flex-wrap gap-3">
              {resetCooldownActive ? (
                <button
                  type="button"
                  className="arena-btn-dark px-5 py-3"
                  onClick={() => setShowResetDialog(false)}
                >
                  Okay..
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    className="arena-btn-dark px-5 py-3"
                    disabled={resetting}
                    onClick={() => setShowResetDialog(false)}
                  >
                    Keep My Record
                  </button>
                  <button
                    type="button"
                    className="arena-btn-danger px-5 py-3"
                    disabled={resetting}
                    onClick={handleResetProgress}
                  >
                    {resetting ? "Resetting..." : "Yes, Start Fresh"}
                  </button>
                </>
              )}
            </div>
          </div>
          <form method="dialog" className="modal-backdrop">
            <button
              type="button"
              disabled={resetting}
              onClick={() => setShowResetDialog(false)}
            >
              close
            </button>
          </form>
        </dialog>
      ) : null}
    </main>
  );
}
