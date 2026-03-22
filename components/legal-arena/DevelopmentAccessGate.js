import config from "@/config";
import EarlyAccessCheckoutButton from "./EarlyAccessCheckoutButton";

export default function DevelopmentAccessGate({ email = "" }) {
  const plan = config.lemonsqueezy.plans[0];

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(37,99,235,0.14),_transparent_35%),linear-gradient(180deg,#f8fafc_0%,#e2e8f0_100%)] px-4 py-10 md:px-8">
      <section className="mx-auto max-w-2xl">
        <div className="relative">
          <div className="absolute inset-0 scale-[1.03] rounded-[2rem] bg-slate-900/5 blur-2xl" />
          <div className="relative rounded-[2rem] border border-slate-200 bg-white p-8 shadow-[0_24px_80px_rgba(15,23,42,0.12)] md:p-10">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.35em] text-sky-700">
                  Early Access
                </p>
                <h1 className="mt-4 font-serif text-4xl leading-tight text-slate-900 md:text-5xl">
                  Legal Arena is live in early access.
                </h1>
                <p className="mt-4 max-w-xl text-base leading-7 text-slate-600">
                  Get immediate access now while the game is still being built.
                  Your purchase includes the current experience plus all
                  early-access updates as we keep expanding and refining Legal
                  Arena.
                </p>
              </div>
              <span className="shrink-0 rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-amber-800">
                Limited-time
              </span>
            </div>

            <div className="mt-8 flex items-end gap-3">
              <div className="text-xl text-slate-400">
                <span className="relative inline-block">
                  <span className="absolute inset-x-0 top-1/2 h-0.5 -translate-y-1/2 bg-slate-400" />
                  ${plan.priceAnchor.toFixed(2)}
                </span>
              </div>
              <div className="text-5xl font-black tracking-tight text-slate-900">
                ${plan.price.toFixed(2)}
              </div>
              <div className="pb-1 text-xs font-semibold uppercase tracking-[0.25em] text-slate-500">
                USD
              </div>
            </div>

            <ul className="mt-8 space-y-3 text-sm leading-6 text-slate-700">
              {plan.features.map((feature) => (
                <li key={feature.name} className="flex gap-3">
                  <span className="mt-1 inline-flex h-5 w-5 items-center justify-center rounded-full bg-emerald-100 font-semibold text-emerald-700">
                    +
                  </span>
                  <span>{feature.name}</span>
                </li>
              ))}
            </ul>

            <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-600">
              We are still refining content, polish, and progression, so some
              features may change as the game matures.
            </div>

            {email ? (
              <div className="mt-4 rounded-2xl border border-sky-100 bg-sky-50 p-4">
                <p className="text-sm font-semibold text-sky-900">Signed in as</p>
                <p className="mt-1 text-sm text-sky-800">{email}</p>
              </div>
            ) : null}

            <div className="mt-8">
              <EarlyAccessCheckoutButton variantId={plan.variantId} />
            </div>

            <p className="mt-4 text-center text-xs leading-5 text-slate-500">
              One-time payment. Secure checkout via Lemon Squeezy.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
