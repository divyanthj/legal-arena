"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import * as HeroIcons from "@heroicons/react/24/outline";
import config from "@/config";
import apiClient from "@/libs/api";
import { trackGoal } from "@/libs/datafast";
import {
  buildNextCaseCareerBridge,
  buildResolutionAftermath,
} from "@/libs/game/careerNarrative.mjs";
import EarlyAccessCheckoutButton from "./EarlyAccessCheckoutButton";

const titleCase = (value = "") =>
  String(value || "matter")
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());

export default function PostResolutionNextCaseCard({
  caseSession,
  hasArenaAccess = false,
}) {
  const router = useRouter();
  const viewedRef = useRef(false);
  const recommendationViewedRef = useRef(false);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");
  const [recommendation, setRecommendation] = useState(null);
  const [teaser, setTeaser] = useState(null);
  const [recommendationLoading, setRecommendationLoading] = useState(false);
  const plan = config.lemonsqueezy.plans[0];
  const sourceCaseId =
    caseSession?.slug || caseSession?.id || caseSession?._id || "";
  const category = titleCase(caseSession?.primaryCategory);
  const country =
    caseSession?.caseCountry?.name ||
    caseSession?.caseCountry?.code ||
    "your jurisdiction";
  const isSettlementResolution = Boolean(
    caseSession?.status === "settled" ||
      caseSession?.settlement?.status === "settled" ||
      caseSession?.settlement?.resolution === "settled" ||
      caseSession?.settlement?.accepted === true
  );
  const resolution = isSettlementResolution ? "settlement" : "verdict";
  const recommendedCategory = recommendation?.categoryTitle || category;
  const recommendedComplexity =
    Number(recommendation?.complexity) ||
    Math.min(5, (Number(caseSession?.complexity) || 1) + 1);
  const teaserHeadline =
    teaser?.headline ||
    `A fresh ${recommendedCategory.toLowerCase()} matter`;
  const teaserChallenge =
    teaser?.challenge ||
    `Take on new parties, facts, and evidence in ${country}.`;
  const aftermath =
    caseSession?.resolutionAftermath || buildResolutionAftermath({ caseSession });
  const careerBridge = buildNextCaseCareerBridge({
    caseSession,
    aftermath,
    teaser,
    recommendation,
  });

  useEffect(() => {
    if (viewedRef.current || !sourceCaseId) return;
    viewedRef.current = true;
    trackGoal("post_resolution_next_case_offer_viewed", {
      source_case_id: sourceCaseId,
      resolution,
      category: caseSession?.primaryCategory,
      country: caseSession?.caseCountry?.code,
      has_access: hasArenaAccess,
    });
    if (!hasArenaAccess) {
      trackGoal("free_trial_case_resolved", {
        source_case_id: sourceCaseId,
        resolution,
        outcome: caseSession?.verdict?.winner || "settled",
        category: caseSession?.primaryCategory,
        country: caseSession?.caseCountry?.code,
      });
    }
  }, [caseSession, hasArenaAccess, resolution, sourceCaseId]);

  useEffect(() => {
    if (!sourceCaseId) return;

    let cancelled = false;
    setRecommendationLoading(true);

    apiClient
      .get("/cases/next", { params: { sourceCaseId } })
      .then((response) => {
        if (!cancelled) {
          setRecommendation(response?.recommendation || null);
          setTeaser(response?.teaser || null);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setRecommendation(null);
          setTeaser(null);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setRecommendationLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [sourceCaseId]);

  useEffect(() => {
    if (
      recommendationViewedRef.current ||
      !recommendation?.categorySlug
    ) {
      return;
    }

    recommendationViewedRef.current = true;
    trackGoal("next_case_recommendation_viewed", {
      surface: "post_resolution",
      recommendation_kind: recommendation.kind,
      reason_code: recommendation.reasonCode,
      category: recommendation.categorySlug,
      complexity: recommendation.complexity,
      recent_repeat_count: recommendation.recentRepeatCount || 0,
      source_case_id: sourceCaseId,
      teaser_key: teaser?.key || "",
    });
  }, [recommendation, sourceCaseId, teaser?.key]);

  const handleNextCase = async () => {
    if (working || !sourceCaseId) return;
    setWorking(true);
    setError("");
    trackGoal("next_case_clicked", {
      source_case_id: sourceCaseId,
      resolution,
      category: caseSession?.primaryCategory,
      recommended_category: recommendation?.categorySlug || "",
      recommended_complexity: recommendation?.complexity || "",
      teaser_key: teaser?.key || "",
    });
    if (recommendation?.categorySlug) {
      trackGoal("next_case_recommendation_accepted", {
        surface: "post_resolution",
        recommendation_kind: recommendation.kind,
        reason_code: recommendation.reasonCode,
        recommended_category: recommendation.categorySlug,
        recommended_complexity: recommendation.complexity,
        recent_repeat_count: recommendation.recentRepeatCount || 0,
        source_case_id: sourceCaseId,
        teaser_key: teaser?.key || "",
      });
    }

    try {
      const response = await apiClient.post("/cases/next", { sourceCaseId });
      const caseRef = response.caseSession?.slug || response.caseSession?.id;
      if (!caseRef) throw new Error("The next case could not be opened.");
      router.push(`/dashboard/cases/${caseRef}`);
    } catch (nextCaseError) {
      setError(
        nextCaseError?.message || "The next matter could not be generated."
      );
      setWorking(false);
    }
  };

  return (
    <section className="post-resolution-card mt-6 overflow-hidden rounded-2xl border border-amber-200/25 bg-[#100f0d]/95 shadow-[0_22px_60px_rgba(0,0,0,0.24)]">
      <div className="post-resolution-card__layout grid gap-5 p-5 sm:p-6">
        <div className="flex min-w-0 items-start gap-4">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-amber-200/25 bg-amber-200/10 text-amber-200">
            {hasArenaAccess ? (
              <HeroIcons.BoltIcon className="h-5 w-5" aria-hidden="true" />
            ) : (
              <HeroIcons.TrophyIcon className="h-5 w-5" aria-hidden="true" />
            )}
          </span>
          <div className="min-w-0 pt-0.5">
            <p className="arena-kicker text-amber-200">
              {hasArenaAccess
                ? recommendation?.kind === "broaden"
                  ? "Broaden your practice"
                  : recommendation?.kind === "level_up"
                    ? "Level up your practice"
                    : "Next on your docket"
                : "Your next matter is ready"}
            </p>
            <h3 className="mt-2 text-xl font-black leading-tight text-white sm:text-2xl">
              {hasArenaAccess
                ? recommendationLoading
                  ? "Preparing your next challenge..."
                  : `Next: ${recommendedCategory} · Level ${recommendedComplexity}`
                : recommendationLoading
                  ? "Preparing your next challenge..."
                  : `Next: ${teaserHeadline}`}
            </h3>
            <p className="mt-2 max-w-2xl text-sm font-semibold leading-6 text-white/58">
              {hasArenaAccess
                ? recommendation?.reason ||
                  `Take a fresh ${recommendedCategory.toLowerCase()} matter in ${country}, with new parties, facts, and evidence.`
                : `${teaserChallenge} ${recommendedCategory} · Level ${recommendedComplexity} · ${country}.`}
            </p>
            <div className="mt-4 rounded-xl border border-emerald-300/12 bg-emerald-300/[0.045] p-3">
              <p className="text-[0.65rem] font-black uppercase tracking-[0.14em] text-emerald-200">
                Career consequence
              </p>
              <p className="mt-1.5 text-xs font-semibold leading-5 text-white/62">
                {careerBridge}
              </p>
            </div>
          </div>
        </div>

        <div className="w-full rounded-2xl border border-white/10 bg-black/24 p-3">
          {hasArenaAccess ? (
            <button
              type="button"
              className="arena-btn-light flex min-h-14 w-full items-center justify-center gap-2 whitespace-nowrap px-5 py-3 text-sm"
              onClick={handleNextCase}
              disabled={working || recommendationLoading}
            >
              {working || recommendationLoading ? (
                <span className="loading loading-spinner loading-sm" />
              ) : (
                <HeroIcons.BoltIcon className="h-5 w-5" aria-hidden="true" />
              )}
              {working
                ? "Generating Next Case..."
                : recommendationLoading
                  ? "Preparing Recommendation..."
                  : "Take Recommended Case"}
            </button>
          ) : (
            <EarlyAccessCheckoutButton
              variantId={plan.variantId}
              label={`Unlock This Case · $${plan.price.toFixed(2)}`}
              source="post_resolution_next_case"
              continuationCaseId={sourceCaseId}
              className="post-resolution-unlock-cta flex min-h-14 w-full items-center justify-center gap-2 whitespace-nowrap rounded-xl border border-amber-100/55 bg-[#fee88a] px-4 text-base font-black normal-case tracking-normal text-black shadow-[0_16px_38px_rgba(245,158,11,0.22)] transition hover:-translate-y-0.5 hover:shadow-[0_20px_46px_rgba(245,158,11,0.3)] disabled:translate-y-0 disabled:cursor-wait disabled:bg-[#fee88a]/75"
              contentClassName="font-black tracking-[0.01em]"
              showArrow
              onIntent={() =>
                trackGoal("upgrade_clicked_post_resolution", {
                  source_case_id: sourceCaseId,
                  resolution,
                  category: caseSession?.primaryCategory,
                  price: plan.price,
                  teaser_key: teaser?.key || "",
                })
              }
            />
          )}
          <p className="mt-2.5 flex items-center justify-center gap-1.5 text-center text-xs font-semibold text-white/45">
            <HeroIcons.ShieldCheckIcon
              className="h-4 w-4 text-amber-200/70"
              aria-hidden="true"
            />
            {hasArenaAccess
              ? recommendation?.kind === "broaden"
                ? "New practice area · Same jurisdiction"
                : `Level ${recommendedComplexity} · Same jurisdiction`
              : `${recommendedCategory} · Level ${recommendedComplexity} · One-time lifetime access`}
          </p>
          {hasArenaAccess ? (
            <Link
              href="/dashboard#case-library"
              className="mt-3 flex min-h-10 w-full items-center justify-center text-xs font-semibold text-white/52 transition hover:text-white/80"
            >
              Choose a different case
            </Link>
          ) : null}
          {error ? (
            <p
              className="mt-2 text-center text-sm font-semibold text-rose-200"
              role="alert"
            >
              {error}
            </p>
          ) : null}
        </div>
      </div>
    </section>
  );
}
