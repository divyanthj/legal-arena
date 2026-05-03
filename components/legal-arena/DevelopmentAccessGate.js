"use client";

import { signOut } from "next-auth/react";
import config from "@/config";
import EarlyAccessCheckoutButton from "./EarlyAccessCheckoutButton";

const loginHref = `${config.auth.loginUrl}?callbackUrl=${encodeURIComponent(
  config.auth.callbackUrl
)}`;

export function DevelopmentAccessPanel({
  email = "",
  onClose = null,
  showAccountActions = true,
}) {
  const plan = config.lemonsqueezy.plans[0];

  const handleLogout = () => {
    signOut({ callbackUrl: "/" });
  };

  const handleSwitchAccount = () => {
    signOut({
      callbackUrl: loginHref,
    });
  };

  return (
    <div className="relative">
      <div className="absolute inset-0 scale-[1.03] rounded-[2rem] bg-white/5 blur-3xl" />
      <div className="arena-surface relative rounded-[2rem] p-8 md:p-10">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.35em] text-white/45">
              Early Access
            </p>
            <h1 className="arena-headline mt-4 text-4xl uppercase leading-[0.92] text-white md:text-5xl">
              Legal Arena is live in early access.
            </h1>
            <p className="mt-4 max-w-xl text-base leading-8 text-white/66">
              Get immediate access now while the game is still being built. Your
              purchase includes the current experience plus all early-access
              updates as we keep expanding and refining Legal Arena.
            </p>
          </div>
          <div className="flex items-start gap-3">
            <span className="shrink-0 rounded-full border border-white/10 bg-white/6 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-white/72">
              Limited-time
            </span>
            {onClose ? (
              <button
                type="button"
                className="arena-btn-dark px-3 py-2 text-white/72"
                onClick={onClose}
                aria-label="Close paywall"
              >
                X
              </button>
            ) : null}
          </div>
        </div>

        <div className="mt-8 flex items-end gap-3">
          <div className="text-xl text-white/35">
            <span className="relative inline-block">
              <span className="absolute inset-x-0 top-1/2 h-0.5 -translate-y-1/2 bg-white/35" />
              ${plan.priceAnchor.toFixed(2)}
            </span>
          </div>
          <div className="text-5xl font-black tracking-tight text-white">
            ${plan.price.toFixed(2)}
          </div>
          <div className="pb-1 text-xs font-semibold uppercase tracking-[0.25em] text-white/42">
            USD
          </div>
        </div>

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
          We are still refining content, polish, and progression, so some
          features may change as the game matures.
        </div>

        {showAccountActions && email ? (
          <div className="arena-surface-soft mt-4 rounded-2xl p-4">
            <p className="text-sm font-semibold text-white">Signed in as</p>
            <p className="mt-1 text-sm text-white/72">{email}</p>
            <div className="mt-4 flex flex-wrap gap-3">
              <button
                type="button"
                className="arena-btn-dark px-4 py-2 text-sm"
                onClick={handleSwitchAccount}
              >
                Switch account
              </button>
              <button
                type="button"
                className="arena-btn-dark px-4 py-2 text-sm"
                onClick={handleLogout}
              >
                Log out
              </button>
            </div>
          </div>
        ) : null}

        <div className="mt-8">
          <EarlyAccessCheckoutButton variantId={plan.variantId} />
        </div>

        <p className="mt-4 text-center text-xs leading-5 text-white/42">
          One-time payment. Secure checkout via Lemon Squeezy.
        </p>
      </div>
    </div>
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
