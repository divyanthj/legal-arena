"use client";

import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { toast } from "react-hot-toast";
import * as HeroIcons from "@heroicons/react/24/outline";
import apiClient from "@/libs/api";
import { LEGAL_CASE_CATEGORIES, DEFAULT_CATEGORY_SLUG } from "@/libs/game/categories";
import { trackGoal } from "@/libs/datafast";
import { useNavigationLoading } from "@/components/NavigationLoadingProvider";
import CountryFlagPicker, {
  CountryBadge,
  useCaseCountrySelection,
} from "./CountryFlagPicker";

const difficultyOptions = [
  {
    value: 1,
    label: "Level 1",
    name: "Intro",
    detail: "A focused dispute with clean facts and a forgiving first round.",
  },
  {
    value: 2,
    label: "Level 2",
    name: "Beginner",
    detail: "A few competing facts, one useful weakness, and room to negotiate.",
  },
  {
    value: 3,
    label: "Level 3",
    name: "Medium",
    detail: "A balanced fight with credibility calls and multiple evidence paths.",
  },
  {
    value: 4,
    label: "Level 4",
    name: "Advanced",
    detail: "Layered facts, stronger opposition, and settlement pressure.",
  },
  {
    value: 5,
    label: "Level 5",
    name: "Expert",
    detail: "Dense proof conflicts where every concession matters.",
  },
];

export default function ChallengeButton({
  targetPlayerId,
  targetPlayerName = "this player",
  hasArenaAccess = false,
  className = "arena-btn-light px-4 py-2 text-sm",
  label = "Challenge",
  onNeedsAccess,
  detectedCountryCode = "US",
  detectedCountrySource = "detected",
}) {
  const router = useRouter();
  const { startNavigationLoading } = useNavigationLoading();
  const [open, setOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState(DEFAULT_CATEGORY_SLUG);
  const [selectedDifficulty, setSelectedDifficulty] = useState(1);
  const [creating, setCreating] = useState(false);
  const {
    countryCode: selectedCountryCode,
    country: selectedCountry,
    selectionSource: countrySelectionSource,
    selectCountry,
  } = useCaseCountrySelection(detectedCountryCode, detectedCountrySource);

  const selectedCategoryMeta = useMemo(
    () =>
      LEGAL_CASE_CATEGORIES.find((category) => category.slug === selectedCategory) ||
      LEGAL_CASE_CATEGORIES.find((category) => category.slug === DEFAULT_CATEGORY_SLUG) ||
      LEGAL_CASE_CATEGORIES[0],
    [selectedCategory]
  );
  const selectedDifficultyMeta =
    difficultyOptions.find((option) => option.value === selectedDifficulty) ||
    difficultyOptions[0];

  const startChallenge = () => {
    if (!hasArenaAccess) {
      trackGoal("pvp_challenge_access_blocked", {
        source: "challenge_button",
      });
      if (onNeedsAccess) {
        onNeedsAccess();
      } else {
        toast.error("Purchase access to sponsor a challenge.");
      }
      return;
    }

    trackGoal("pvp_challenge_modal_opened", {
      source: "challenge_button",
      mode: "dynamic",
    });
    setOpen(true);
  };

  const createChallenge = async () => {
    if (creating) {
      return;
    }

    setCreating(true);
    trackGoal("pvp_challenge_create_started", {
      mode: "dynamic",
      category: selectedCategory,
      complexity: selectedDifficulty,
      country: selectedCountryCode,
      country_source: countrySelectionSource,
    });
    try {
      const response = await apiClient.post("/challenges", {
        challengedId: targetPlayerId,
        categorySlug: selectedCategory,
        complexity: selectedDifficulty,
        countryCode: selectedCountryCode,
      });
      const challenge = response.challenge;
      trackGoal("pvp_challenge_sent", {
        mode: "dynamic",
        category: selectedCategory,
        complexity: selectedDifficulty,
        country: response.challenge.caseCountry?.code || selectedCountryCode,
      });
      toast.success("Challenge sent.");
      setOpen(false);
      startNavigationLoading("Opening challenge");
      const challengeHref = `/dashboard/challenges/${challenge.slug || challenge.id}`;
      router.prefetch(challengeHref);
      router.push(challengeHref);
    } catch (error) {
      trackGoal("pvp_challenge_create_failed", {
        mode: "dynamic",
        category: selectedCategory,
        complexity: selectedDifficulty,
        country: selectedCountryCode,
      });
      toast.error(error?.message || "Could not create challenge.");
    } finally {
      setCreating(false);
    }
  };

  const chooseCategory = (categorySlug) => {
    trackGoal("pvp_challenge_category_selected", {
      category: categorySlug,
      mode: "dynamic",
    });
    setSelectedCategory(categorySlug);
  };

  const chooseDifficulty = (difficulty) => {
    trackGoal("pvp_challenge_difficulty_selected", {
      complexity: difficulty,
      mode: "dynamic",
    });
    setSelectedDifficulty(difficulty);
  };

  const modal =
    open && typeof document !== "undefined"
      ? createPortal(
          <div
            className="fixed inset-0 z-[120] flex min-h-[100dvh] items-start justify-center overflow-y-auto bg-black/82 px-3 py-4 backdrop-blur-md sm:px-4 sm:py-6 md:items-center"
            role="dialog"
            aria-modal="true"
            aria-labelledby="challenge-dialog-title"
          >
            <button
              type="button"
              className="absolute inset-0 cursor-default"
              aria-label="Close challenge dialog"
              disabled={creating}
              onClick={() => setOpen(false)}
            />
            <div className="relative flex max-h-[calc(100dvh-2rem)] w-full max-w-5xl flex-col overflow-hidden rounded-lg bg-[#101010] shadow-[0_30px_120px_rgba(0,0,0,0.78),0_0_0_1px_rgba(255,255,255,0.055)] sm:max-h-[calc(100dvh-3rem)]">
              <div className="shrink-0 bg-white/[0.025] px-5 py-5 md:px-7">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="arena-kicker text-white">Generate a PVP Matter</p>
                    <h3
                      id="challenge-dialog-title"
                      className="mt-2 text-2xl font-semibold leading-tight text-white md:text-3xl"
                    >
                      Challenge {targetPlayerName}
                    </h3>
                    <p className="mt-3 max-w-2xl text-sm font-medium leading-6 text-white/90">
                      Pick the kind of dispute and Legal Arena will create a fresh case
                      for both players, with private client interviews, settlement room,
                      and a courtroom path if negotiations fail.
                    </p>
                  </div>
                  <button
                    type="button"
                    className="arena-btn-dark min-h-0 shrink-0 px-4 py-2 text-sm"
                    disabled={creating}
                    onClick={() => setOpen(false)}
                  >
                    Close
                  </button>
                </div>
              </div>

              <div className="arena-scroll min-h-0 flex-1 overflow-y-auto px-5 pb-5 md:px-7 md:pb-7">
                <div className="grid gap-5 pt-5 lg:grid-cols-[minmax(0,1fr)_320px]">
                  <section className="min-w-0 space-y-5">
                    <div>
                      <CountryFlagPicker
                        id={`pvp-case-country-${targetPlayerId}`}
                        value={selectedCountryCode}
                        detectedCountryCode={detectedCountryCode}
                        disabled={creating}
                        onChange={(countryCode) => {
                          selectCountry(countryCode);
                          trackGoal("pvp_challenge_country_selected", {
                            country: countryCode,
                            source: "challenge_picker",
                          });
                        }}
                      />
                      <p className="mt-2 text-xs font-medium leading-5 text-white/62">
                        This setting is locked for both players once the challenge is sent.
                      </p>
                    </div>

                    <div>
                      <p className="arena-kicker text-white">Case Type</p>
                      <div className="mt-3 grid gap-2 sm:grid-cols-2">
                        {LEGAL_CASE_CATEGORIES.map((category) => {
                          const selected = selectedCategory === category.slug;

                          return (
                            <button
                              key={category.slug}
                              type="button"
                              className={`min-h-[5.75rem] rounded-2xl border p-4 text-left transition ${
                                selected
                                  ? "border-amber-200/70 bg-amber-200/[0.16] text-white shadow-[0_18px_60px_rgba(251,191,36,0.13)]"
                                  : "border-white/12 bg-white/[0.045] text-white hover:border-white/28 hover:bg-white/[0.07]"
                              }`}
                              disabled={creating}
                              onClick={() => chooseCategory(category.slug)}
                            >
                              <span className="flex items-center justify-between gap-3">
                                <span className="text-sm font-semibold">{category.title}</span>
                                {selected ? (
                                  <HeroIcons.CheckCircleIcon
                                    className="h-5 w-5 text-amber-100"
                                    aria-hidden="true"
                                  />
                                ) : null}
                              </span>
                              <span className="mt-2 block text-xs font-medium leading-5 text-white/82">
                                {category.description}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div>
                      <p className="arena-kicker text-white">Difficulty</p>
                      <div className="mt-3 grid gap-2 sm:grid-cols-5">
                        {difficultyOptions.map((option) => {
                          const selected = selectedDifficulty === option.value;

                          return (
                            <button
                              key={option.value}
                              type="button"
                              className={`rounded-2xl border px-3 py-3 text-left transition ${
                                selected
                                  ? "border-white bg-white text-black"
                                  : "border-white/10 bg-white/[0.025] text-white hover:border-white/24"
                              }`}
                              disabled={creating}
                              onClick={() => chooseDifficulty(option.value)}
                            >
                              <span className="block text-sm font-bold">{option.label}</span>
                              <span
                                className={`mt-1 block text-xs ${
                                  selected ? "text-black/80" : "text-white"
                                }`}
                              >
                                {option.name}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </section>

                  <aside className="flex flex-col justify-between rounded-[1.5rem] border border-white/12 bg-white/[0.045] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.035)]">
                    <div>
                      <p className="arena-kicker">PVP Case Brief</p>
                      <h4 className="mt-3 text-2xl font-semibold leading-tight text-white">
                        Fresh {selectedCategoryMeta?.title || "Legal"} Dispute
                      </h4>
                      <p className="mt-3 text-sm font-medium leading-7 text-white/90">
                        A new AI-generated matter will be created for this challenge.
                        You and {targetPlayerName} will each receive a confidential side
                        of the dispute, then prepare independently before settlement or court.
                      </p>

                      <div className="mt-5 space-y-3">
                        <div className="rounded-xl border border-white/12 bg-black/34 p-4">
                          <p className="arena-kicker">Case Country</p>
                          <div className="mt-2">
                            <CountryBadge caseCountry={selectedCountry} />
                          </div>
                        </div>
                        <div className="rounded-xl border border-white/12 bg-black/34 p-4">
                          <p className="arena-kicker">Selected Track</p>
                          <p className="mt-2 font-semibold text-white">
                            {selectedCategoryMeta?.title || "Legal Matter"}
                          </p>
                        </div>
                        <div className="rounded-xl border border-white/12 bg-black/34 p-4">
                          <p className="arena-kicker">Case Level</p>
                          <p className="mt-2 font-semibold text-white">
                            {selectedDifficultyMeta.label} - {selectedDifficultyMeta.name}
                          </p>
                          <p className="mt-2 text-sm font-medium leading-6 text-white">
                            {selectedDifficultyMeta.detail}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="mt-5 rounded-xl border border-emerald-200/35 bg-emerald-300/[0.12] p-4 text-sm font-medium leading-6 text-emerald-50">
                      Infinite PVP cases are generated on demand, so you are no longer
                      limited to the old case library.
                    </div>
                  </aside>
                </div>
                {creating ? (
                  <div className="mt-5 rounded-2xl border border-amber-200/35 bg-amber-200/[0.09] p-4 text-amber-50 shadow-[0_16px_50px_rgba(251,191,36,0.08)]">
                    <div className="flex items-center gap-3">
                      <span className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-amber-100/25 bg-black/28">
                        <span className="absolute h-8 w-8 animate-spin rounded-full border-2 border-amber-100/20 border-t-amber-100" />
                        <HeroIcons.SparklesIcon className="h-4 w-4 text-amber-100" aria-hidden="true" />
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-white">
                          Drafting a fresh PVP matter
                        </p>
                        <p className="mt-1 text-xs font-medium leading-5 text-amber-50/86">
                          Creating the facts, parties, settlement pressure, and courtroom setup.
                        </p>
                      </div>
                    </div>
                    <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-black/35">
                      <div className="h-full w-1/2 animate-pulse rounded-full bg-amber-100 shadow-[0_0_24px_rgba(254,243,199,0.5)]" />
                    </div>
                  </div>
                ) : null}
              </div>

              <div className="shrink-0 border-t border-white/10 bg-black/70 px-5 py-4 backdrop-blur-md md:px-7">
                <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                  <button
                    type="button"
                    className="arena-btn-dark px-5 py-3"
                    disabled={creating}
                    onClick={() => setOpen(false)}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="arena-btn-light inline-flex items-center justify-center gap-2 px-5 py-3"
                    disabled={creating}
                    onClick={createChallenge}
                  >
                    {creating ? (
                      <>
                        <span className="h-4 w-4 animate-spin rounded-full border-2 border-black/25 border-t-black" />
                        <span>Generating case...</span>
                      </>
                    ) : (
                      "Generate & Send Challenge"
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>,
          document.body
        )
      : null;

  return (
    <>
      <button type="button" className={className} onClick={startChallenge}>
        {label}
      </button>
      {modal}
    </>
  );
}
