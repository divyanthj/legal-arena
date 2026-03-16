import Link from "next/link";
import ButtonSignin from "@/components/ButtonSignin";
import connectMongo from "@/libs/mongoose";
import CaseTemplate from "@/models/CaseTemplate";
import { ensureSeedCaseTemplates } from "@/libs/game/templates";
import { getCategoryTitle } from "@/libs/game/categories";

export const dynamic = "force-dynamic";

const loadFeaturedCases = async () => {
  try {
    await connectMongo();
    await ensureSeedCaseTemplates();

    const templates = await CaseTemplate.find({ status: "active" })
      .sort({ updatedAt: -1 })
      .limit(3);

    return templates.map((template) => template.toJSON());
  } catch (error) {
    console.error("Landing page case load failed:", error.message);
    return [];
  }
};

const getClientClaim = (template) =>
  template.canonicalFacts
    ?.flatMap((fact) =>
      (fact.claims || []).filter((claim) => claim.party === "client")
    )
    .find((claim) => claim.claimedDetail?.trim())?.claimedDetail || "";

const getFactPrompt = (template) =>
  template.canonicalFacts
    ?.slice()
    .sort(
      (left, right) =>
        (right.discoverability?.priority || 0) - (left.discoverability?.priority || 0)
    )
    .slice(0, 2)
    .map((fact) => fact.label)
    .join(" and ") || "";

export default async function Page() {
  const featuredCases = await loadFeaturedCases();
  const heroCase = featuredCases[0] || null;

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

      <section className="mx-auto max-w-7xl px-6 py-12 md:px-8 md:py-16">
        <div className="grid gap-8 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="space-y-8">
            <div className="space-y-4">
              <p className="text-xs uppercase tracking-[0.4em] text-primary/75">
                Legal Arena
              </p>
              <h1 className="font-serif text-5xl leading-none text-base-content md:text-7xl">
                Build the record before the bench breaks it.
              </h1>
              <p className="max-w-2xl text-lg leading-8 text-base-content/75">
                Legal Arena is a courtroom training game where you interview the
                client first, turn messy facts into a usable file, and then argue
                the matter in open text against an AI opponent.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <ButtonSignin text="Open The Docket" extraStyle="btn-primary" />
              <Link href="/dashboard" className="btn btn-outline">
                View Dashboard
              </Link>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div className="card border border-base-300 bg-base-100 shadow-sm">
                <div className="card-body p-4">
                  <p className="text-sm uppercase tracking-[0.25em] text-base-content/50">
                    01 Intake
                  </p>
                  <p className="mt-3 text-lg font-semibold">Question the client</p>
                </div>
              </div>
              <div className="card border border-base-300 bg-base-100 shadow-sm">
                <div className="card-body p-4">
                  <p className="text-sm uppercase tracking-[0.25em] text-base-content/50">
                    02 Build
                  </p>
                  <p className="mt-3 text-lg font-semibold">Shape the fact sheet</p>
                </div>
              </div>
              <div className="card border border-base-300 bg-base-100 shadow-sm">
                <div className="card-body p-4">
                  <p className="text-sm uppercase tracking-[0.25em] text-base-content/50">
                    03 Trial
                  </p>
                  <p className="mt-3 text-lg font-semibold">Out-argue the room</p>
                </div>
              </div>
            </div>
          </div>

          <div className="card border border-base-300 bg-base-100 shadow-2xl">
            <div className="card-body gap-5 p-6 md:p-8">
              <div className="rounded-box bg-neutral p-5 text-neutral-content">
                <p className="text-sm uppercase tracking-[0.25em] text-primary-content/75">
                  Live Case Library
                </p>
                <h2 className="mt-2 text-3xl font-bold">
                  {heroCase ? heroCase.title : "Case library loading"}
                </h2>
                <p className="mt-3 leading-7 text-neutral-content/75">
                  {heroCase
                    ? heroCase.subtitle || heroCase.overview
                    : "Sign in to see the current dispute library and start building your record."}
                </p>
                {heroCase ? (
                  <div className="mt-4 flex flex-wrap gap-2 text-sm text-neutral-content/75">
                    <span className="badge badge-outline">{heroCase.practiceArea}</span>
                    <span className="badge badge-outline">
                      {getCategoryTitle(heroCase.primaryCategory)}
                    </span>
                    <span className="badge badge-outline">
                      Complexity {heroCase.complexity}
                    </span>
                  </div>
                ) : null}
              </div>

              <div className="space-y-4">
                <div className="rounded-box bg-base-200 p-5 shadow-sm">
                  <p className="font-semibold">Client says</p>
                  <p className="mt-2 text-sm leading-6 text-base-content/75">
                    {heroCase
                      ? `"${getClientClaim(heroCase) || heroCase.openingStatement}"`
                      : "Real client-side claims from the active case library appear here."}
                  </p>
                </div>
                <div className="rounded-box bg-primary/10 p-5 shadow-sm">
                  <p className="font-semibold">Your move</p>
                  <p className="mt-2 text-sm leading-6 text-base-content/75">
                    {heroCase
                      ? `Press on ${getFactPrompt(heroCase) || "the timeline and the records"} before you lock the fact sheet.`
                      : "Ask for dates, records, and weak points before you finalize the file."}
                  </p>
                </div>
                <div className="rounded-box border border-dashed border-primary/40 bg-base-100 p-5">
                  <p className="font-semibold">Courtroom loop</p>
                  <p className="mt-2 text-sm leading-6 text-base-content/75">
                    Use your fact sheet and the lawbook to argue for relief while
                    the hidden bench tracks your pressure, proof, and weak spots.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 pb-12 md:px-8">
        <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="card border border-base-300 bg-base-100 shadow-xl">
            <div className="card-body p-6">
              <p className="text-sm uppercase tracking-[0.3em] text-base-content/45">
                How It Plays
              </p>
              <h2 className="mt-3 font-serif text-4xl leading-tight text-base-content">
                Structured underneath, adversarial on the surface.
              </h2>
              <div className="mt-6 space-y-4 text-base leading-7 text-base-content/75">
                <p>
                  The interview stage extracts a usable fact sheet from the client
                  narrative. You can edit the file before trial, so the experience
                  feels like preparation rather than random chat.
                </p>
                <p>
                  In court, you argue in free text against opposing counsel while
                  a hidden judge tracks whether you used corroborated facts, cited
                  rules, answered live disputes, and asked for a proportional remedy.
                </p>
              </div>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            {(featuredCases.length > 0 ? featuredCases : [null, null, null]).map(
              (template, index) => (
                <div
                  key={template?.id || `placeholder-${index}`}
                  className="card border border-base-300 bg-base-100 shadow-lg"
                >
                  <div className="card-body p-6">
                    <p className="text-sm uppercase tracking-[0.25em] text-base-content/45">
                      {template ? getCategoryTitle(template.primaryCategory) : "Case"}
                    </p>
                    <p className="mt-3 text-xl font-bold">
                      {template ? template.title : "More matters coming online"}
                    </p>
                    <p className="mt-3 text-sm leading-6 text-base-content/70">
                      {template
                        ? template.overview
                        : "The landing page will surface real active disputes from the database here."}
                    </p>
                    {template ? (
                      <div className="mt-4 flex flex-wrap gap-2 text-xs text-base-content/60">
                        <span>{template.clientName}</span>
                        <span>vs.</span>
                        <span>{template.opponentName}</span>
                      </div>
                    ) : null}
                  </div>
                </div>
              )
            )}
          </div>
        </div>
      </section>
    </main>
  );
}
