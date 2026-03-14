import Link from "next/link";
import ButtonSignin from "@/components/ButtonSignin";

export default function Page() {
  return (
    <main className="min-h-screen bg-base-200">
      <header className="border-b border-base-300 bg-base-100/90 backdrop-blur">
        <div className="navbar mx-auto max-w-7xl px-4 md:px-6">
          <div className="flex-1">
            <Link
              href="/"
              className="text-sm font-semibold uppercase tracking-[0.35em] text-base-content/65"
            >
              Legal Arena
            </Link>
          </div>
          <div className="flex-none">
            <ButtonSignin text="Sign In To Play" extraStyle="btn-primary" />
          </div>
        </div>
      </header>

      <section className="hero bg-base-200">
        <div className="hero-content mx-auto grid min-h-[78vh] w-full max-w-7xl gap-12 px-6 py-12 md:grid-cols-[1.1fr_0.9fr] md:px-8">
          <div className="space-y-8 md:pb-12">
            <div className="space-y-4">
              <p className="text-xs uppercase tracking-[0.4em] text-primary/75">
                Legal Arena
              </p>
              <h1 className="font-serif text-5xl leading-none text-base-content md:text-7xl">
                Argue the case. Survive the bench.
              </h1>
              <p className="max-w-2xl text-lg leading-8 text-base-content/75">
                Step into a civil courtroom game where you play the lawyer. First
                you interview your client and turn messy facts into a sharp case
                file. Then you face an AI opponent in open court while a hidden
                judge scores every move.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <ButtonSignin text="Open The Docket" extraStyle="btn-primary" />
              <Link
                href="/api/auth/signin?callbackUrl=%2Fdashboard"
                className="btn btn-outline"
              >
                Go To Sign In
              </Link>
            </div>

            <p className="text-sm text-base-content/60">
              Sign-in is required because cases, transcripts, and verdicts are
              saved to your account.
            </p>

            <div className="grid gap-4 md:grid-cols-3">
              <div className="card border border-base-300 bg-base-100 shadow-sm">
                <div className="card-body p-4">
                  <p className="text-sm uppercase tracking-[0.25em] text-base-content/50">
                    01 Intake
                  </p>
                  <p className="mt-3 text-lg font-semibold">
                    Question the client
                  </p>
                </div>
              </div>
              <div className="card border border-base-300 bg-base-100 shadow-sm">
                <div className="card-body p-4">
                  <p className="text-sm uppercase tracking-[0.25em] text-base-content/50">
                    02 Build
                  </p>
                  <p className="mt-3 text-lg font-semibold">
                    Shape the fact sheet
                  </p>
                </div>
              </div>
              <div className="card border border-base-300 bg-base-100 shadow-sm">
                <div className="card-body p-4">
                  <p className="text-sm uppercase tracking-[0.25em] text-base-content/50">
                    03 Trial
                  </p>
                  <p className="mt-3 text-lg font-semibold">
                    Out-argue opposing counsel
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="card border border-base-300 bg-base-100 shadow-2xl">
            <div className="card-body gap-5 p-6 md:p-8">
              <div className="rounded-box bg-neutral p-5 text-neutral-content">
                <p className="text-sm uppercase tracking-[0.25em] text-primary-content/75">
                  Sample Matter
                </p>
                <h2 className="mt-2 text-3xl font-bold">
                  Security Deposit Showdown
                </h2>
                <p className="mt-3 leading-7 text-neutral-content/75">
                  A tenant cleaned the apartment, photographed the move-out, and
                  still lost most of a deposit to vague repair charges.
                </p>
              </div>

              <div className="space-y-4">
                <div className="rounded-box bg-base-200 p-5 shadow-sm">
                  <p className="font-semibold">Client says</p>
                  <p className="mt-2 text-sm leading-6 text-base-content/75">
                    &ldquo;They told me I only deserved $180 back and never sent a
                    real breakdown until I kept pushing.&rdquo;
                  </p>
                </div>
                <div className="rounded-box bg-primary/10 p-5 shadow-sm">
                  <p className="font-semibold">Your move</p>
                  <p className="mt-2 text-sm leading-6 text-base-content/75">
                    Ask for the move-out photos, inspection checklist, and the date
                    the itemized notice finally arrived.
                  </p>
                </div>
                <div className="rounded-box border border-dashed border-primary/40 bg-base-100 p-5">
                  <p className="font-semibold">Courtroom loop</p>
                  <p className="mt-2 text-sm leading-6 text-base-content/75">
                    Use your fact sheet and the custom lawbook to argue for a
                    proportional remedy while the hidden judge tracks each round.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 pb-24 md:px-8">
        <div className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
          <div className="card border border-base-300 bg-base-100 shadow-xl">
            <div className="card-body p-6">
              <p className="text-sm uppercase tracking-[0.3em] text-base-content/45">
                How It Plays
              </p>
              <h2 className="mt-3 font-serif text-4xl leading-tight text-base-content">
                Structured under the hood, dramatic on the surface.
              </h2>
              <div className="mt-6 space-y-4 text-base leading-7 text-base-content/75">
                <p>
                  The client interview extracts a clean fact sheet from messy
                  testimony. You can edit the file before trial, so the game
                  feels like real prep work instead of random chat.
                </p>
                <p>
                  In court, you argue in free text against opposing counsel while
                  a hidden judge tracks whether you used facts, cited the lawbook,
                  addressed weak spots, and asked for a proportional remedy.
                </p>
              </div>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <div className="card border border-base-300 bg-base-100 shadow-lg">
              <div className="card-body p-6">
                <p className="text-sm uppercase tracking-[0.25em] text-base-content/45">
                  Interview
                </p>
                <p className="mt-3 text-xl font-bold">Client transcript</p>
                <p className="mt-3 text-sm leading-6 text-base-content/70">
                  Ask about dates, records, notices, and contradictions until the
                  story is tight enough for court.
                </p>
              </div>
            </div>
            <div className="card border border-base-300 bg-base-100 shadow-lg">
              <div className="card-body p-6">
                <p className="text-sm uppercase tracking-[0.25em] text-base-content/45">
                  Trial
                </p>
                <p className="mt-3 text-xl font-bold">Courtroom rounds</p>
                <p className="mt-3 text-sm leading-6 text-base-content/70">
                  Fire off your argument, hear the rebuttal, and adjust as the
                  bench signal changes from round to round.
                </p>
              </div>
            </div>
            <div className="card border border-base-300 bg-base-100 shadow-lg">
              <div className="card-body p-6">
                <p className="text-sm uppercase tracking-[0.25em] text-base-content/45">
                  Review
                </p>
                <p className="mt-3 text-xl font-bold">Verdict breakdown</p>
                <p className="mt-3 text-sm leading-6 text-base-content/70">
                  After judgment, review what helped, what hurt, and which parts
                  of the record actually moved the result.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
