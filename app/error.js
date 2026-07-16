"use client";

import Link from "next/link";
import { ArrowPathIcon, ExclamationTriangleIcon, HomeIcon } from "@heroicons/react/24/outline";

export default function Error({ error, reset }) {
  return (
    <main className="arena-app-shell arena-column-bg flex min-h-screen items-center justify-center px-5 py-16 text-white">
      <section className="arena-glass arena-reveal w-full max-w-2xl rounded-[2rem] p-8 text-center md:p-12">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-rose-300/20 bg-rose-950/40 text-rose-100"><ExclamationTriangleIcon className="h-8 w-8" /></div>
        <p className="arena-kicker mt-8 text-rose-100/70">Proceedings interrupted</p>
        <h1 className="arena-headline mt-4 text-6xl uppercase leading-[0.9] md:text-7xl">Something left the record.</h1>
        <p className="mx-auto mt-6 max-w-lg leading-7 text-white/65">The page hit an unexpected error. Your saved case progress is safe; retry the action or return to Legal Arena.</p>
        {error?.message ? <div className="alert mt-7 rounded-2xl border border-rose-300/15 bg-rose-950/25 text-left text-sm text-rose-100/80"><span className="break-words">{error.message}</span></div> : null}
        <div className="mt-9 flex flex-col justify-center gap-3 sm:flex-row">
          <button type="button" className="btn arena-btn-light h-12 rounded-2xl px-6" onClick={reset}><ArrowPathIcon className="h-5 w-5" /> Try again</button>
          <Link href="/" className="btn arena-btn-dark h-12 rounded-2xl px-6"><HomeIcon className="h-5 w-5" /> Return home</Link>
        </div>
      </section>
    </main>
  );
}
