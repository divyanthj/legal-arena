import Link from "next/link";
import { EnvelopeOpenIcon, ArrowLeftIcon } from "@heroicons/react/24/outline";

export default function VerifySignInPage() {
  return (
    <main className="arena-app-shell arena-column-bg flex min-h-screen items-center justify-center px-5 py-16 text-white">
      <section className="arena-glass arena-reveal w-full max-w-xl rounded-[2rem] p-8 text-center md:p-12">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-emerald-200/20 bg-emerald-200/10 text-emerald-100"><EnvelopeOpenIcon className="h-8 w-8" /></div>
        <p className="arena-kicker mt-8 text-emerald-100/70">Secure link dispatched</p>
        <h1 className="arena-headline mt-4 text-5xl uppercase md:text-6xl">Check your inbox.</h1>
        <p className="mx-auto mt-6 max-w-md leading-7 text-white/65">We sent a one-time sign-in link to your email. Open it on this device to return to your case desk.</p>
        <div className="alert mt-8 rounded-2xl border border-white/10 bg-white/[0.04] text-left text-sm text-white/60"><span>The link expires shortly. If it is missing, check spam or return and request another.</span></div>
        <Link href="/signin" className="btn arena-btn-dark mt-8 h-12 rounded-2xl px-6"><ArrowLeftIcon className="h-4 w-4" /> Back to sign in</Link>
      </section>
    </main>
  );
}
