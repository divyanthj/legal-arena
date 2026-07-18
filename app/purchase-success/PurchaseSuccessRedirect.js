"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { trackGoal } from "@/libs/datafast";
import apiClient from "@/libs/api";

const REDIRECT_SECONDS = 3;

export default function PurchaseSuccessRedirect() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextFrom = String(searchParams.get("nextFrom") || "").trim();
  const [secondsRemaining, setSecondsRemaining] = useState(REDIRECT_SECONDS);
  const [activationState, setActivationState] = useState(
    nextFrom ? "activating" : "redirecting"
  );
  const [activationError, setActivationError] = useState("");
  const purchaseSuccessTrackedRef = useRef(false);

  useEffect(() => {
    if (!purchaseSuccessTrackedRef.current) {
      purchaseSuccessTrackedRef.current = true;
      trackGoal("purchase_success_viewed", {
        provider: "lemonsqueezy",
        source: "checkout_redirect",
      });
    }

    if (nextFrom) return undefined;

    const redirectTimer = window.setTimeout(() => router.replace("/dashboard"), REDIRECT_SECONDS * 1000);

    const countdownTimer = window.setInterval(() => {
      setSecondsRemaining((current) => Math.max(current - 1, 0));
    }, 1000);

    return () => {
      window.clearTimeout(redirectTimer);
      window.clearInterval(countdownTimer);
    };
  }, [nextFrom, router]);

  useEffect(() => {
    if (!nextFrom) return undefined;
    let active = true;
    let retryTimer;
    const deadline = Date.now() + 20000;

    const continueToNextCase = async () => {
      try {
        const access = await apiClient.get("/arena/access", { suppressToast: true });
        if (!active) return;
        if (!access.hasArenaAccess) {
          if (Date.now() >= deadline) {
            setActivationState("delayed");
            setActivationError("Payment succeeded, but access is still activating.");
            return;
          }
          retryTimer = window.setTimeout(continueToNextCase, 1200);
          return;
        }

        setActivationState("generating");
        const response = await apiClient.post(
          "/cases/next",
          { sourceCaseId: nextFrom },
          { suppressToast: true }
        );
        const caseRef = response.caseSession?.slug || response.caseSession?.id;
        if (!caseRef) throw new Error("The next case could not be opened.");
        trackGoal("post_purchase_next_case_started", {
          source_case_id: nextFrom,
          reused: Boolean(response.reused),
        });
        router.replace(`/dashboard/cases/${caseRef}`);
      } catch (error) {
        if (!active) return;
        setActivationState("delayed");
        setActivationError(error?.message || "Access is active, but the next case needs another try.");
        trackGoal("post_purchase_next_case_failed", { source_case_id: nextFrom });
      }
    };

    continueToNextCase();
    return () => {
      active = false;
      if (retryTimer) window.clearTimeout(retryTimer);
    };
  }, [nextFrom, router]);

  return (
    <main className="arena-app-shell arena-column-bg min-h-screen px-5 py-16 text-white md:px-8">
      <section className="mx-auto flex min-h-[70vh] max-w-3xl items-center justify-center">
        <div className="arena-surface w-full rounded-[2rem] p-8 text-center shadow-2xl shadow-black/40 md:p-12">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border border-emerald-300/25 bg-emerald-300/10 text-emerald-100">
            <svg
              className="h-8 w-8"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.3"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="m5 12 4 4L19 6" />
            </svg>
          </div>
          <p className="mt-8 text-sm font-semibold uppercase tracking-[0.32em] text-emerald-100/72">
            Payment successful
          </p>
          <h1 className="arena-headline mt-4 text-5xl uppercase leading-[0.92] text-white md:text-6xl">
            Thank you for joining Legal Arena.
          </h1>
          <p className="mx-auto mt-6 max-w-xl text-base leading-8 text-white/68 md:text-lg">
            {nextFrom
              ? activationState === "generating"
                ? "Access unlocked. The court is assembling your next matter now."
                : "Your purchase is complete. We are activating unlimited cases and preparing your next matter."
              : "Your early-access purchase is complete. We will redirect you to your dashboard shortly."}
          </p>
          <div className="mx-auto mt-8 max-w-sm rounded-2xl border border-white/10 bg-white/[0.04] px-5 py-4 text-sm font-semibold text-white/70" role="status" aria-live="polite">
            {nextFrom
              ? activationState === "generating"
                ? "Generating a similar case..."
                : activationState === "delayed"
                ? activationError
                : "Activating your access..."
              : `Redirecting in ${secondsRemaining}...`}
          </div>
          {activationState === "delayed" ? (
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <button type="button" className="arena-btn-light px-6 py-4 text-sm" onClick={() => window.location.reload()}>
                Try Next Case Again
              </button>
              <Link href="/dashboard" className="arena-btn-dark px-6 py-4 text-sm">Go to Dashboard</Link>
            </div>
          ) : !nextFrom ? (
            <Link href="/dashboard" className="arena-btn-light mt-8 inline-flex px-6 py-4 text-sm">
              Go to Dashboard
            </Link>
          ) : null}
        </div>
      </section>
    </main>
  );
}
