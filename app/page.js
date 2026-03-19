import Link from "next/link";
import connectMongo from "@/libs/mongoose";
import CaseTemplate from "@/models/CaseTemplate";
import { getCategoryTitle } from "@/libs/game/categories";

export const dynamic = "force-dynamic";

const trustSignals = [
  { value: "1,200+", label: "cases played" },
  { value: "8 min", label: "average session" },
  { value: "3-part", label: "practice loop" },
];

const benefits = [
  "Build airtight fact sheets from messy narratives",
  "Spot weak arguments before they break your case",
  "Practice defending your position under pressure",
  "Improve structured thinking and persuasive writing",
];

const audience = [
  "Law students preparing for litigation",
  "Founders learning structured thinking",
  "Debaters sharpening argument skills",
];

const steps = [
  {
    number: "01",
    title: "Extract the truth",
    description: "Interrogate the client and uncover what actually matters.",
  },
  {
    number: "02",
    title: "Build your case",
    description: "Turn raw facts into a structured legal record.",
  },
  {
    number: "03",
    title: "Fight it out",
    description: "Argue your case in real time against an AI opponent.",
  },
];

const judgeMetrics = [
  "Use of facts",
  "Logical consistency",
  "Handling counterarguments",
  "Weak spots in your reasoning",
];

const loadFeaturedCases = async () => {
  try {
    await connectMongo();

    const templates = await CaseTemplate.find({ status: "active" })
      .sort({ updatedAt: -1 })
      .limit(3);

    return templates.map((template) => template.toJSON());
  } catch (error) {
    console.error("Landing page case load failed:", error.message);
    return [];
  }
};

const getPlaintiffClaim = (template) =>
  template.canonicalFacts
    ?.flatMap((fact) =>
      (fact.claims || []).filter((claim) => claim.party === "plaintiff")
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
      <header className="sticky top-0 z-30 border-b border-base-300 bg-base-100/90 backdrop-blur">
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
            <Link href="/dashboard" className="btn btn-primary">
              Start Playing
            </Link>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-7xl px-6 py-12 md:px-8 md:py-16">
        <div className="grid items-start gap-8 xl:grid-cols-[minmax(0,1.05fr)_minmax(420px,0.95fr)]">
          <div className="space-y-8">
            <div className="space-y-5">
              <p className="text-xs uppercase tracking-[0.4em] text-primary/75">
                AI courtroom simulator
              </p>
              <h1 className="max-w-3xl font-serif text-5xl leading-[0.95] text-base-content md:text-6xl xl:text-7xl">
                Practice real courtroom arguments in an AI-powered simulation game
              </h1>
              <p className="max-w-2xl text-lg leading-8 text-base-content/75">
                Turn messy client stories into structured cases, then defend them
                under pressure in a live trial.
              </p>
              <p className="max-w-2xl text-base leading-7 text-base-content/65">
                Each case plays like a short, replayable match. Test your reasoning,
                adapt your strategy, and try again.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-4">
              <Link href="/dashboard" className="btn btn-primary">
                Play Your First Case
              </Link>
              <p className="text-sm text-base-content/60">
                One clear loop: investigate, organize, argue.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              {trustSignals.map((signal) => (
                <div
                  key={signal.label}
                  className="rounded-box border border-base-300 bg-base-100 p-4 shadow-sm"
                >
                  <p className="text-2xl font-bold text-base-content">{signal.value}</p>
                  <p className="mt-2 text-sm uppercase tracking-[0.2em] text-base-content/55">
                    {signal.label}
                  </p>
                </div>
              ))}
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              {steps.map((step) => (
                <div
                  key={step.number}
                  className="card border border-base-300 bg-base-100 shadow-sm"
                >
                  <div className="card-body min-h-40 p-5">
                    <p className="text-sm uppercase tracking-[0.25em] text-base-content/50">
                      Step {step.number}
                    </p>
                    <p className="mt-3 text-lg font-semibold">{step.title}</p>
                    <p className="mt-2 text-sm leading-6 text-base-content/70">
                      {step.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="card border border-base-300 bg-base-100 shadow-2xl">
            <div className="card-body gap-5 p-6 md:p-8">
              <div className="rounded-box bg-neutral p-5 text-neutral-content">
                <p className="text-sm uppercase tracking-[0.25em] text-primary-content/75">
                  Playable case
                </p>
                <h2 className="mt-2 text-3xl font-bold">
                  {heroCase ? heroCase.title : "The Lease Dispute Duel"}
                </h2>
                <p className="mt-3 leading-7 text-neutral-content/75">
                  {heroCase
                    ? heroCase.subtitle || heroCase.overview
                    : "A fast courtroom scenario designed to show how intake, fact-building, and live argument come together."}
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
                <div className="mt-5 flex flex-wrap items-center gap-4">
                  <Link href="/dashboard" className="btn btn-primary">
                    Play This Case
                  </Link>
                  <div className="text-sm text-neutral-content/65">
                    <p>Takes 3 to 5 minutes.</p>
                    <p>Replay with different strategies.</p>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div className="rounded-box bg-base-200 p-5 shadow-sm">
                  <p className="font-semibold">Plaintiff says</p>
                  <p className="mt-2 text-sm leading-6 text-base-content/75">
                    {heroCase
                      ? `"${getPlaintiffClaim(heroCase) || heroCase.openingStatement}"`
                      : "The tenant claims the other side broke the agreement and left the record full of contradictions."}
                  </p>
                </div>
                <div className="rounded-box bg-primary/10 p-5 shadow-sm">
                  <p className="font-semibold">Your move</p>
                  <p className="mt-2 text-sm leading-6 text-base-content/75">
                    {heroCase
                      ? `Press on ${getFactPrompt(heroCase) || "the timeline and the records"} before you lock the fact sheet.`
                      : "Ask for dates, records, and missing proof before you finalize the file."}
                  </p>
                </div>
                <div className="rounded-box border border-dashed border-primary/40 bg-base-100 p-5">
                  <p className="font-semibold">Hidden judge</p>
                  <div className="mt-3 grid gap-2 text-sm text-base-content/75 sm:grid-cols-2">
                    {judgeMetrics.map((metric) => (
                      <p key={metric}>- {metric}</p>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 pb-12 md:px-8">
        <div className="grid gap-6 xl:grid-cols-[minmax(320px,0.9fr)_minmax(0,1.1fr)]">
          <div className="card border border-base-300 bg-base-100 shadow-xl">
            <div className="card-body p-6">
              <p className="text-sm uppercase tracking-[0.3em] text-base-content/45">
                What you get
              </p>
              <h2 className="mt-3 font-serif text-4xl leading-tight text-base-content">
                Train like a litigator
              </h2>
              <div className="mt-6 space-y-3 text-base leading-7 text-base-content/75">
                {benefits.map((benefit) => (
                  <p key={benefit}>- {benefit}</p>
                ))}
              </div>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {(featuredCases.length > 0 ? featuredCases : [null, null, null]).map(
              (template, index) => (
                <div
                  key={template?.id || `placeholder-${index}`}
                  className="card border border-base-300 bg-base-100 shadow-lg"
                >
                  <div className="card-body min-h-72 p-6">
                    <p className="text-sm uppercase tracking-[0.25em] text-base-content/45">
                      {template ? getCategoryTitle(template.primaryCategory) : "Case"}
                    </p>
                    <p className="mt-3 text-xl font-bold">
                      {template ? template.title : "More matters coming online"}
                    </p>
                    <p className="mt-3 text-sm leading-6 text-base-content/70">
                      {template
                        ? template.overview
                        : "New courtroom scenarios rotate in so there is always another argument to test."}
                    </p>
                    {template ? (
                      <div className="mt-4 flex flex-wrap gap-2 text-xs text-base-content/60">
                        <span>{template.plaintiffName || template.clientName}</span>
                        <span>vs.</span>
                        <span>{template.defendantName || template.opponentName}</span>
                      </div>
                    ) : null}
                  </div>
                </div>
              )
            )}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 pb-12 md:px-8">
        <div className="grid gap-6 xl:grid-cols-2">
          <div className="card border border-base-300 bg-base-100 shadow-lg">
            <div className="card-body p-6">
              <p className="text-sm uppercase tracking-[0.3em] text-base-content/45">
                Who this is for
              </p>
              <h2 className="mt-3 font-serif text-4xl leading-tight text-base-content">
                Built for people who need to think under pressure
              </h2>
              <div className="mt-6 space-y-3 text-base leading-7 text-base-content/75">
                {audience.map((item) => (
                  <p key={item}>- {item}</p>
                ))}
              </div>
            </div>
          </div>

          <div className="card border border-base-300 bg-neutral text-neutral-content shadow-lg">
            <div className="card-body p-6">
              <p className="text-sm uppercase tracking-[0.3em] text-primary-content/70">
                Why it works
              </p>
              <h2 className="mt-3 font-serif text-4xl leading-tight text-neutral-content">
                Think clearly. Argue better. Win decisions.
              </h2>
              <p className="mt-6 text-base leading-7 text-neutral-content/75">
                Legal Arena turns abstract argument practice into a repeatable
                simulation: gather facts, pressure test your logic, and learn what
                makes a case hold up when someone pushes back.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 pb-16 md:px-8 md:pb-20">
        <div className="rounded-[2rem] border border-base-300 bg-base-100 px-6 py-10 text-center shadow-xl md:px-10">
          <p className="text-sm uppercase tracking-[0.3em] text-base-content/45">
            Ready to test your argument skills?
          </p>
          <h2 className="mt-4 font-serif text-4xl leading-tight text-base-content md:text-5xl">
            Start your first case and see where your reasoning holds.
          </h2>
          <div className="mt-8 flex justify-center">
            <Link href="/dashboard" className="btn btn-primary">
              Play Your First Case
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
