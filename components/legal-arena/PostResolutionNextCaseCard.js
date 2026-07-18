"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import * as HeroIcons from "@heroicons/react/24/outline";
import config from "@/config";
import apiClient from "@/libs/api";
import { trackGoal } from "@/libs/datafast";
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
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");
  const plan = config.lemonsqueezy.plans[0];
  const sourceCaseId = caseSession?.slug || caseSession?.id || caseSession?._id || "";
  const category = titleCase(caseSession?.primaryCategory);
  const country = caseSession?.caseCountry?.name || caseSession?.caseCountry?.code || "your jurisdiction";
  const isSettlementResolution = Boolean(
    caseSession?.status === "settled" ||
      caseSession?.settlement?.status === "settled" ||
      caseSession?.settlement?.resolution === "settled" ||
      caseSession?.settlement?.accepted === true
  );
  const resolution = isSettlementResolution ? "settlement" : "verdict";

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

  const handleNextCase = async () => {
    if (working || !sourceCaseId) return;
    setWorking(true);
    setError("");
    trackGoal("next_case_clicked", {
      source_case_id: sourceCaseId,
      resolution,
      category: caseSession?.primaryCategory,
    });
    try {
      const response = await apiClient.post("/cases/next", { sourceCaseId });
      const caseRef = response.caseSession?.slug || response.caseSession?.id;
      if (!caseRef) throw new Error("The next case could not be opened.");
      router.push(`/dashboard/cases/${caseRef}`);
    } catch (nextCaseError) {
      setError(nextCaseError?.message || "The next matter could not be generated.");
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
              {hasArenaAccess ? "Next on your docket" : "Your first case is complete"}
            </p>
            <h3 className="mt-2 text-xl font-black leading-tight text-white sm:text-2xl">
              {hasArenaAccess
                ? `Ready for another ${category} matter?`
                : `Turn one ${resolution} into an unlimited career.`}
            </h3>
            <p className="mt-2 max-w-2xl text-sm font-semibold leading-6 text-white/58">
              Get a fresh {category.toLowerCase()} case in {country}, with new parties, facts,
              and evidence at your current level.
            </p>
          </div>
        </div>

        <div className="w-full rounded-2xl border border-white/10 bg-black/24 p-3">
          {hasArenaAccess ? (
            <button
              type="button"
              className="arena-btn-light flex min-h-14 w-full items-center justify-center gap-2 whitespace-nowrap px-5 py-3 text-sm"
              onClick={handleNextCase}
              disabled={working}
            >
              {working ? (
                <span className="loading loading-spinner loading-sm" />
              ) : (
                <HeroIcons.BoltIcon className="h-5 w-5" aria-hidden="true" />
              )}
              {working ? "Generating Next Case..." : "Fight the Next Case"}
            </button>
          ) : (
            <EarlyAccessCheckoutButton
              variantId={plan.variantId}
              label={`Unlock Unlimited · $${plan.price.toFixed(2)}`}
              source="post_resolution_next_case"
              continuationCaseId={sourceCaseId}
              className="flex min-h-14 w-full items-center justify-center gap-2 whitespace-nowrap rounded-xl border-0 bg-[#fee88a] px-4 text-sm font-black normal-case tracking-normal text-black shadow-[0_14px_34px_rgba(245,158,11,0.18)] transition hover:-translate-y-0.5 hover:bg-[#fff0a6] hover:shadow-[0_18px_42px_rgba(245,158,11,0.24)] disabled:translate-y-0 disabled:cursor-wait disabled:bg-[#fee88a]/75"
              showArrow
              onIntent={() =>
                trackGoal("upgrade_clicked_post_resolution", {
                  source_case_id: sourceCaseId,
                  resolution,
                  category: caseSession?.primaryCategory,
                  price: plan.price,
                })
              }
            />
          )}
          <p className="mt-2.5 flex items-center justify-center gap-1.5 text-center text-xs font-semibold text-white/45">
            <HeroIcons.ShieldCheckIcon className="h-4 w-4 text-amber-200/70" aria-hidden="true" />
            {hasArenaAccess
              ? "Same category and jurisdiction · New scenario"
              : "One-time payment · Lifetime access"}
          </p>
          {error ? (
            <p className="mt-2 text-center text-sm font-semibold text-rose-200" role="alert">
              {error}
            </p>
          ) : null}
        </div>
      </div>
    </section>
  );
}
