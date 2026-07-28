import Link from "next/link";
import * as HeroIcons from "@heroicons/react/24/outline";

export const metadata = {
  title: "Legal Arena is offline",
  robots: { index: false, follow: false },
};

export default function OfflinePage() {
  return (
    <main className="arena-app-shell flex min-h-[100dvh] items-center justify-center px-5 py-10 text-white">
      <section className="arena-surface w-full max-w-xl p-7 text-center md:p-10">
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.045]">
          <HeroIcons.WifiIcon className="h-7 w-7 text-white/72" aria-hidden="true" />
        </span>
        <p className="arena-kicker mt-6">Connection paused</p>
        <h1 className="arena-headline mt-3 text-4xl uppercase md:text-5xl">
          The courtroom needs a connection.
        </h1>
        <p className="mx-auto mt-5 max-w-md text-sm leading-7 text-white/62 md:text-base">
          Legal Arena keeps private cases and AI gameplay on the server, so offline play is
          unavailable. Reconnect and return to the same matter safely.
        </p>
        <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
          <Link href="/dashboard" className="arena-btn-light px-6 py-3 text-sm font-black">
            Try the dashboard again
          </Link>
          <Link href="/" className="arena-btn-dark px-6 py-3 text-sm font-black">
            Return home
          </Link>
        </div>
      </section>
    </main>
  );
}

