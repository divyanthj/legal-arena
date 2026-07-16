import Link from "next/link";
import { ArrowLeftIcon, MagnifyingGlassIcon, ScaleIcon } from "@heroicons/react/24/outline";

export default function Custom404() {
  return (
    <main className="arena-app-shell arena-column-bg flex min-h-screen items-center justify-center px-5 py-16 text-white">
      <section className="arena-glass arena-reveal w-full max-w-2xl rounded-[2rem] p-8 text-center md:p-12">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-amber-200/20 bg-amber-200/10 text-amber-100"><MagnifyingGlassIcon className="h-8 w-8" /></div>
        <p className="arena-kicker mt-8 text-amber-100/65">Docket entry 404</p>
        <h1 className="arena-headline mt-4 text-6xl uppercase leading-[0.9] md:text-7xl">This page is not in the record.</h1>
        <p className="mx-auto mt-6 max-w-lg leading-7 text-white/65">The address may have changed, or the page may no longer be available. Return to Legal Arena or open your case desk.</p>
        <div className="mt-9 flex flex-col justify-center gap-3 sm:flex-row">
          <Link href="/" className="btn arena-btn-dark h-12 rounded-2xl px-6"><ArrowLeftIcon className="h-4 w-4" /> Return home</Link>
          <Link href="/dashboard" className="btn arena-btn-light h-12 rounded-2xl px-6"><ScaleIcon className="h-5 w-5" /> Open case desk</Link>
        </div>
      </section>
    </main>
  );
}
