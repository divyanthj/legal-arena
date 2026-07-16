"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import Link from "next/link";
import Image from "next/image";
import { ArrowLeftIcon, ArrowRightIcon, EnvelopeIcon, LockClosedIcon, ScaleIcon, SparklesIcon } from "@heroicons/react/24/outline";

const ERROR_MESSAGES = {
  OAuthSignin: "Google sign-in could not be started. Please try again.",
  OAuthCallback: "Google could not complete sign-in. Please try again.",
  OAuthAccountNotLinked: "Use the same sign-in method you originally used for this email.",
  EmailSignin: "We could not send the sign-in email. Check the address and try again.",
  Verification: "That sign-in link has expired or has already been used.",
  AccessDenied: "This account does not currently have access.",
  Configuration: "Sign-in is temporarily unavailable. Please contact support.",
};

export default function SignInPanel({ callbackUrl = "/dashboard", error = "" }) {
  const [email, setEmail] = useState("");
  const [pending, setPending] = useState("");
  const errorMessage = error ? ERROR_MESSAGES[error] || "We could not sign you in. Please try again." : "";

  const startGoogleSignIn = async () => {
    setPending("google");
    await signIn("google", { callbackUrl });
    setPending("");
  };

  const startEmailSignIn = async (event) => {
    event.preventDefault();
    if (!email.trim()) return;
    setPending("email");
    await signIn("email", { email: email.trim(), callbackUrl });
    setPending("");
  };

  return (
    <main className="arena-app-shell arena-column-bg relative min-h-screen overflow-hidden px-5 py-8 text-white md:px-8 md:py-12">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_72%_22%,rgba(85,213,160,0.09),transparent_28%),radial-gradient(circle_at_18%_16%,rgba(251,191,36,0.12),transparent_30%)]" />
      <div className="relative mx-auto flex min-h-[calc(100vh-6rem)] max-w-6xl flex-col">
        <div className="flex items-center justify-between">
          <Link href="/" className="btn btn-ghost btn-sm gap-2 rounded-full border border-white/10 px-4 text-white hover:border-white/20 hover:bg-white/5">
            <ArrowLeftIcon className="h-4 w-4" /> Legal Arena
          </Link>
          <span className="badge badge-outline hidden h-auto rounded-full border-white/10 px-4 py-2 text-[0.65rem] font-semibold uppercase tracking-[0.24em] text-white/60 sm:inline-flex">Secure player access</span>
        </div>

        <div className="grid flex-1 items-center gap-10 py-12 lg:grid-cols-[1fr_0.86fr] lg:gap-20">
          <section className="max-w-2xl arena-reveal">
            <div className="mb-8 flex h-16 w-16 items-center justify-center rounded-2xl border border-amber-200/15 bg-amber-200/10 text-amber-100 shadow-xl shadow-amber-950/20"><ScaleIcon className="h-8 w-8" /></div>
            <p className="arena-kicker text-amber-100/65">Return to chambers</p>
            <h1 className="arena-headline mt-4 text-6xl uppercase leading-[0.88] sm:text-7xl lg:text-8xl">Your next case is waiting.</h1>
            <p className="mt-7 max-w-xl text-base leading-8 text-white/65 md:text-lg">Sign in to continue interviews, build your case file, and step back into the courtroom.</p>
            <div className="mt-9 grid max-w-xl gap-3 sm:grid-cols-2">
              <div className="arena-surface-soft flex items-center gap-3 p-4"><SparklesIcon className="h-5 w-5 text-amber-100" /><span className="text-sm font-medium text-white/75">Progress saved securely</span></div>
              <div className="arena-surface-soft flex items-center gap-3 p-4"><LockClosedIcon className="h-5 w-5 text-emerald-100" /><span className="text-sm font-medium text-white/75">Password-free access</span></div>
            </div>
          </section>

          <section className="arena-glass arena-reveal rounded-[2rem] p-6 sm:p-8 lg:p-10">
            <div className="flex items-start justify-between gap-6 border-b border-white/10 pb-7">
              <div><p className="arena-kicker">Player sign in</p><h2 className="mt-2 text-2xl font-semibold tracking-tight text-white">Open your case desk</h2></div>
              <Image src="/logoAndName.png" alt="Legal Arena" width={124} height={40} className="h-9 w-auto object-contain opacity-90" />
            </div>

            {errorMessage ? <div className="alert mt-6 rounded-2xl border border-rose-300/20 bg-rose-950/35 text-sm text-rose-100"><span>{errorMessage}</span></div> : null}

            <button type="button" className="btn mt-7 h-14 w-full rounded-2xl border border-white/15 bg-white text-base font-semibold text-black shadow-lg shadow-black/25 hover:border-white hover:bg-white/90" disabled={Boolean(pending)} onClick={startGoogleSignIn}>
              {pending === "google" ? <span className="loading loading-spinner loading-sm" /> : null} Continue with Google {pending !== "google" ? <ArrowRightIcon className="h-4 w-4" /> : null}
            </button>

            <div className="divider my-7 text-[0.65rem] font-semibold uppercase tracking-[0.24em] text-white/40 before:bg-white/10 after:bg-white/10">or use email</div>

            <form onSubmit={startEmailSignIn}>
              <label className="form-control w-full">
                <span className="label pb-2 text-[0.68rem] font-semibold uppercase tracking-[0.2em] text-white/60">Email address</span>
                <div className="input input-bordered flex h-14 items-center gap-3 rounded-2xl border-white/10 bg-white/[0.045] text-white focus-within:border-amber-200/40 focus-within:outline-none">
                  <EnvelopeIcon className="h-5 w-5 shrink-0 text-white/45" />
                  <input type="email" className="min-w-0 grow bg-transparent placeholder:text-white/35 focus:outline-none" placeholder="you@example.com" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} />
                </div>
              </label>
              <button type="submit" className="btn arena-btn-light mt-4 h-14 w-full gap-2 rounded-2xl" disabled={Boolean(pending) || !email.trim()}>
                {pending === "email" ? <span className="loading loading-spinner loading-sm" /> : <EnvelopeIcon className="h-5 w-5" />} Email me a secure link
              </button>
            </form>

            <p className="mt-6 text-center text-xs leading-5 text-white/45">By continuing, you agree to our <Link href="/tos" className="text-white/75 underline decoration-white/25 underline-offset-4 hover:text-white">terms</Link> and <Link href="/privacy-policy" className="text-white/75 underline decoration-white/25 underline-offset-4 hover:text-white">privacy policy</Link>.</p>
          </section>
        </div>
      </div>
    </main>
  );
}
