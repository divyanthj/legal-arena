"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { trackGoal } from "@/libs/datafast";

const REDIRECT_SECONDS = 3;

export default function PurchaseSuccessRedirect() {
  const router = useRouter();
  const [secondsRemaining, setSecondsRemaining] = useState(REDIRECT_SECONDS);
  const purchaseSuccessTrackedRef = useRef(false);

  useEffect(() => {
    if (!purchaseSuccessTrackedRef.current) {
      purchaseSuccessTrackedRef.current = true;
      trackGoal("purchase_success_viewed", {
        provider: "lemonsqueezy",
        source: "checkout_redirect",
      });
    }

    const redirectTimer = window.setTimeout(() => {
      router.replace("/dashboard");
    }, REDIRECT_SECONDS * 1000);

    const countdownTimer = window.setInterval(() => {
      setSecondsRemaining((current) => Math.max(current - 1, 0));
    }, 1000);

    return () => {
      window.clearTimeout(redirectTimer);
      window.clearInterval(countdownTimer);
    };
  }, [router]);

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
            Your early-access purchase is complete. We will redirect you to your
            dashboard shortly.
          </p>
          <div className="mx-auto mt-8 max-w-sm rounded-2xl border border-white/10 bg-white/[0.04] px-5 py-4 text-sm font-semibold text-white/70">
            Redirecting in {secondsRemaining}...
          </div>
          <Link href="/dashboard" className="arena-btn-light mt-8 inline-flex px-6 py-4 text-sm">
            Go to Dashboard
          </Link>
        </div>
      </section>
    </main>
  );
}
