"use client";

import { useEffect, useRef, useState } from "react";
import { signOut } from "next-auth/react";
import * as HeroIcons from "@heroicons/react/24/outline";
import config from "@/config";
import { trackGoal } from "@/libs/datafast";
import EarlyAccessCheckoutButton from "./EarlyAccessCheckoutButton";

const loginHref = `${config.auth.loginUrl}?callbackUrl=${encodeURIComponent(
  config.auth.callbackUrl
)}`;
const MODAL_TRANSITION_MS = 320;

export function DevelopmentAccessPanel({
  email = "",
  showAccountActions = true,
  variant = "page",
  onClose = null,
}) {
  const plan = config.lemonsqueezy.plans[0];
  const isModal = variant === "modal";

  const handleLogout = () => {
    signOut({ callbackUrl: "/" });
  };

  const handleSwitchAccount = () => {
    signOut({
      callbackUrl: loginHref,
    });
  };

  const currentPrice = `$${plan.price.toFixed(2)}`;

  useEffect(() => {
    if (!isModal) {
      return;
    }

    trackGoal("early_access_paywall_modal_viewed", {
      price: plan.price,
      provider: "lemonsqueezy",
      variant_id: plan.variantId,
    });
  }, [isModal, plan.price, plan.variantId]);

  const trackModalInteraction = (action) => {
    if (!isModal) {
      return;
    }

    trackGoal("early_access_paywall_modal_interaction", {
      action,
      price: plan.price,
      provider: "lemonsqueezy",
      variant_id: plan.variantId,
    });
  };

  const handleClose = () => {
    trackModalInteraction("close_button_clicked");
    onClose?.();
  };

  const handleCheckoutIntent = () => {
    if (!isModal) {
      return;
    }

    trackGoal("early_access_paywall_cta_clicked", {
      price: plan.price,
      provider: "lemonsqueezy",
      variant_id: plan.variantId,
      source: "paywall_modal_primary_cta",
    });
  };

  const panelContent = (
    <>
      {isModal && onClose ? (
        <button
          type="button"
          className="btn btn-circle btn-ghost btn-sm absolute right-4 top-4 z-10 border border-white/[0.08] text-white/65 hover:border-white/16 hover:bg-white/[0.06] hover:text-white"
          onClick={handleClose}
          aria-label="Close paywall"
        >
          <HeroIcons.XMarkIcon className="h-5 w-5" aria-hidden="true" />
        </button>
      ) : null}

      <div>
        <p className="text-sm font-semibold uppercase tracking-[0.35em] text-white/45">
          Early Access
        </p>
        <h1 className="arena-headline mt-4 text-4xl uppercase leading-[0.92] text-white md:text-5xl">
          Unlock lifetime access to Legal Arena.
        </h1>
        <p className="mt-4 max-w-xl text-base leading-8 text-white/66">
          Play the full early-access build: AI client interviews, case prep,
          courtroom arguments, PVP challenges, verdicts, XP, and the growing
          case library.
        </p>
      </div>

      <div className="mt-8 flex items-end gap-3">
        <div className="text-5xl font-black tracking-tight text-white">
          ${plan.price.toFixed(2)}
        </div>
        <div className="pb-1 text-xs font-semibold uppercase tracking-[0.25em] text-white/42">
          USD
        </div>
      </div>

      <div className="arena-surface-soft mt-6 rounded-2xl border border-emerald-300/20 bg-emerald-300/10 p-4 text-sm font-semibold leading-7 text-emerald-50">
        Pay once. Keep permanent access to all future Legal Arena updates.
      </div>

      <p className="mt-4 text-sm leading-7 text-white/62">
        Early-access lifetime access is {currentPrice}. Pay once and keep every
        future Legal Arena update while the case library grows.
      </p>

      <ul className="mt-8 space-y-3 text-sm leading-7 text-white/72">
        {plan.features.map((feature) => (
          <li key={feature.name} className="flex gap-3">
            <span className="mt-1 inline-flex h-5 w-5 items-center justify-center rounded-full border border-white/10 bg-white/6 font-semibold text-white">
              +
            </span>
            <span>{feature.name}</span>
          </li>
        ))}
      </ul>

      <div className="arena-surface-soft mt-6 rounded-2xl p-4 text-sm leading-7 text-white/62">
        Your purchase includes the current experience plus every future update
        while we keep expanding cases, polish, and progression.
      </div>

      {showAccountActions && email ? (
        <div className="arena-surface-soft mt-4 rounded-2xl p-4">
          <p className="text-sm font-semibold text-white">Signed in as</p>
          <p className="mt-1 text-sm text-white/72">{email}</p>
          <div className="mt-4 flex flex-wrap gap-3">
            <button
              type="button"
              className="arena-btn-dark px-4 py-2 text-sm"
              onClick={() => {
                trackModalInteraction("switch_account_clicked");
                handleSwitchAccount();
              }}
            >
              Switch account
            </button>
            <button
              type="button"
              className="arena-btn-dark px-4 py-2 text-sm"
              onClick={() => {
                trackModalInteraction("logout_clicked");
                handleLogout();
              }}
            >
              Log out
            </button>
          </div>
        </div>
      ) : null}

      <div className={isModal ? "modal-action mt-8 block" : "mt-8"}>
        <EarlyAccessCheckoutButton
          variantId={plan.variantId}
          label={isModal ? "Unlock Lifetime Access" : `Unlock Lifetime Access for ${currentPrice}`}
          source={isModal ? "paywall_modal_primary_cta" : "early_access_gate_primary_cta"}
          onIntent={handleCheckoutIntent}
          showArrow={isModal}
          className={
            isModal
              ? "btn btn-block min-h-16 rounded-xl border-0 bg-[#fee88a] px-6 text-base font-bold normal-case tracking-normal text-black shadow-[0_18px_42px_rgba(245,158,11,0.16)] transition hover:scale-[1.01] hover:bg-[#fff0a6] hover:shadow-[0_20px_48px_rgba(245,158,11,0.2)] disabled:scale-100 disabled:bg-[#fee88a]/70 md:text-lg"
              : undefined
          }
        />
      </div>

      <p className="mt-4 text-center text-xs leading-5 text-white/42">
        One-time payment. Secure checkout via Lemon Squeezy.
      </p>
    </>
  );

  if (isModal) {
    return (
      <div className="modal-box max-h-[92vh] max-w-3xl overflow-y-auto rounded-[2rem] border border-white/10 bg-[#070707] p-8 text-white shadow-2xl shadow-black/70 md:p-10">
        {panelContent}
      </div>
    );
  }

  return (
    <div className="relative">
      <div className="absolute inset-0 scale-[1.03] rounded-[2rem] bg-white/5 blur-3xl" />
      <div className="arena-surface relative rounded-[2rem] p-8 md:p-10">
        {panelContent}
      </div>
    </div>
  );
}

export function DevelopmentAccessModal({ email = "", onClose }) {
  const [isVisible, setIsVisible] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const closeTimerRef = useRef(null);

  useEffect(() => {
    const frameId = window.requestAnimationFrame(() => setIsVisible(true));

    return () => {
      window.cancelAnimationFrame(frameId);
      if (closeTimerRef.current) {
        window.clearTimeout(closeTimerRef.current);
      }
    };
  }, []);

  const closeWithTransition = () => {
    if (isClosing) {
      return;
    }

    setIsClosing(true);
    setIsVisible(false);
    closeTimerRef.current = window.setTimeout(() => {
      onClose();
    }, MODAL_TRANSITION_MS);
  };

  const handleBackdropClose = () => {
    trackGoal("early_access_paywall_modal_interaction", {
      action: "backdrop_clicked",
      provider: "lemonsqueezy",
      source: "paywall_modal_backdrop",
    });
    closeWithTransition();
  };

  return (
    <dialog className={`modal ${isVisible ? "modal-open" : ""}`}>
      <DevelopmentAccessPanel email={email} variant="modal" onClose={closeWithTransition} />
      <form method="dialog" className="modal-backdrop bg-black/60 backdrop-blur-[2px]">
        <button type="button" onClick={handleBackdropClose}>
          close
        </button>
      </form>
    </dialog>
  );
}

export default function DevelopmentAccessGate({ email = "" }) {
  return (
    <main className="arena-app-shell arena-column-bg min-h-screen px-4 py-10 md:px-8">
      <section className="mx-auto max-w-2xl">
        <DevelopmentAccessPanel email={email} />
      </section>
    </main>
  );
}
