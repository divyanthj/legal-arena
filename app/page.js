import Link from "next/link";
import Image from "next/image";
import connectMongo from "@/libs/mongoose";
import CaseTemplate from "@/models/CaseTemplate";
import { getCategoryTitle } from "@/libs/game/categories";
import { getSEOTags } from "@/libs/seo";
import config from "@/config";

export const dynamic = "force-dynamic";

export const metadata = getSEOTags({
  title: "Legal Arena | Online Lawyer Game & AI Courtroom Simulator",
  description:
    "Play an online lawyer game where you interview clients, build fact sheets, argue courtroom cases against AI, and get a ruling.",
  keywords: [
    "lawyer game",
    "online lawyer game",
    "courtroom game",
    "AI courtroom simulator",
    "legal simulation game",
    "law game",
  ],
  canonicalUrlRelative: "/",
  openGraph: {
    title: "Legal Arena | Online Lawyer Game & AI Courtroom Simulator",
    description:
      "Play courtroom cases against AI: interview your client, build the facts, argue your case, and see how the judge rules.",
  },
});

const navItems = [
  { label: "Lawyer Game", href: "/lawyer-game" },
  { label: "How It Works", href: "#how-it-works" },
  { label: "Features", href: "#features" },
  { label: "Case Library", href: "#case-library" },
  { label: "Leaderboard", href: "#leaderboard" },
];

const featureHighlights = [
  {
    title: "AI Opposing Counsel",
    description: "Argue against counsel responses grounded in the case file and lawbook.",
  },
  {
    title: "Bench Signals",
    description: "Get round-by-round scoring signals, strengths, and weaknesses.",
  },
  {
    title: "Progression",
    description: "Earn XP, ratings, category tiers, and leaderboard standing from verdicts.",
  },
  {
    title: "Structured Matters",
    description: "Practice on authored disputes with parties, claims, evidence, and rules.",
  },
];

const steps = [
  {
    number: "1",
    title: "Pick a Case",
    description: "Choose an unlocked matter from the dashboard and review the dispute, parties, court, and category.",
  },
  {
    number: "2",
    title: "Interview Your Party",
    description: "Ask intake questions, capture risks and proof gaps, and turn the conversation into a working fact sheet.",
  },
  {
    number: "3",
    title: "Argue in Court",
    description: "Submit courtroom arguments, face opposing counsel, and receive a final ruling after the scheduled rounds.",
  },
];

const skillPoints = [
  "Practice intake questions and fact development",
  "Build a court-ready fact sheet before arguing",
  "Use lawbook rules and case facts in courtroom rounds",
  "Track ratings, XP, records, and category tiers",
];

const practiceCards = [
  {
    title: "Intake",
    detail:
      "Ask your represented party questions and watch the private case file fill with summaries, timeline points, risks, proof gaps, and requested relief.",
  },
  {
    title: "Courtroom",
    detail:
      "Draft arguments from your fact sheet, cite the lawbook, confront the weak points, and answer pressure from the other side.",
  },
  {
    title: "Verdict",
    detail:
      "Each completed matter closes with a ruling, highlights, concerns, final score, XP, rating movement, and leaderboard impact.",
  },
];

const categoryFallbacks = [
  { title: "Criminal Law", cases: "Case Track" },
  { title: "Civil Litigation", cases: "Case Track" },
  { title: "Corporate Law", cases: "Case Track" },
  { title: "Constitutional Law", cases: "Case Track" },
  { title: "Family Law", cases: "Case Track" },
  { title: "And More", cases: "Growing Library" },
];

const verdictReasons = [
  "Fact sheet",
  "Lawbook use",
  "Proof gaps",
  "Bench scoring",
];

const loadFeaturedCases = async () => {
  try {
    await connectMongo();

    const [templates, totalActiveCases] = await Promise.all([
      CaseTemplate.find({ status: "active" }).sort({ updatedAt: -1 }).limit(6),
      CaseTemplate.countDocuments({ status: "active" }),
    ]);

    return {
      featuredCases: templates.map((template) => template.toJSON()),
      totalActiveCases,
    };
  } catch (error) {
    console.error("Landing page case load failed:", error.message);
    return {
      featuredCases: [],
      totalActiveCases: 0,
    };
  }
};

const getPlaintiffClaim = (template) =>
  template.canonicalFacts
    ?.flatMap((fact) =>
      (fact.claims || []).filter((claim) => claim.party === "plaintiff")
    )
    .find((claim) => claim.claimedDetail?.trim())?.claimedDetail || "";

const getDefendantClaim = (template) =>
  template.canonicalFacts
    ?.flatMap((fact) =>
      (fact.claims || []).filter((claim) => claim.party === "defendant")
    )
    .find((claim) => claim.claimedDetail?.trim())?.claimedDetail || "";

const trimStatement = (value, fallback) => {
  const text = (value || fallback || "").trim();
  if (!text) return fallback;
  return text.length > 120 ? `${text.slice(0, 117)}...` : text;
};

const Icon = ({ kind, className = "h-5 w-5" }) => {
  const props = {
    className,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "1.8",
    strokeLinecap: "round",
    strokeLinejoin: "round",
    "aria-hidden": "true",
  };

  switch (kind) {
    case "spark":
      return (
        <svg {...props}>
          <path d="M12 3l1.8 4.2L18 9l-4.2 1.8L12 15l-1.8-4.2L6 9l4.2-1.8L12 3Z" />
          <path d="M5 16l.9 2.1L8 19l-2.1.9L5 22l-.9-2.1L2 19l2.1-.9L5 16Z" />
          <path d="M19 14l.9 2.1L22 17l-2.1.9L19 20l-.9-2.1L16 17l2.1-.9L19 14Z" />
        </svg>
      );
    case "bolt":
      return (
        <svg {...props}>
          <path d="M13 2 5 13h5l-1 9 8-11h-5l1-9Z" />
        </svg>
      );
    case "trophy":
      return (
        <svg {...props}>
          <path d="M8 3h8v3a4 4 0 0 1-4 4 4 4 0 0 1-4-4V3Z" />
          <path d="M8 5H5a2 2 0 0 0 2 3h1" />
          <path d="M16 5h3a2 2 0 0 1-2 3h-1" />
          <path d="M12 10v4" />
          <path d="M9 21h6" />
          <path d="M10 18h4v3h-4z" />
        </svg>
      );
    case "brief":
      return (
        <svg {...props}>
          <path d="M3 8h18v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8Z" />
          <path d="M8 8V6a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
          <path d="M3 12h18" />
        </svg>
      );
    case "folder":
      return (
        <svg {...props}>
          <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z" />
        </svg>
      );
    case "pen":
      return (
        <svg {...props}>
          <path d="m4 20 4.5-1 9.7-9.7a1.8 1.8 0 0 0 0-2.6l-.9-.9a1.8 1.8 0 0 0-2.6 0L5 15.5 4 20Z" />
          <path d="m13.5 6.5 4 4" />
        </svg>
      );
    case "gavel":
      return (
        <svg {...props}>
          <path d="m14 4 6 6" />
          <path d="m12 6 6 6" />
          <path d="m3 21 9-9" />
          <path d="m11 13 3 3" />
          <path d="M2 22h8" />
        </svg>
      );
    case "scale":
      return (
        <svg {...props}>
          <path d="M12 4v16" />
          <path d="M7 7h10" />
          <path d="m7 7-3 5h6L7 7Z" />
          <path d="m17 7-3 5h6l-3-5Z" />
          <path d="M8 20h8" />
        </svg>
      );
    case "users":
      return (
        <svg {...props}>
          <path d="M16 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2" />
          <path d="M9.5 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z" />
          <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
      );
    case "star":
      return (
        <svg {...props}>
          <path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2L12 17.2l-5.6 3 1.1-6.2L3 9.6l6.2-.9L12 3Z" />
        </svg>
      );
    default:
      return (
        <svg {...props}>
          <circle cx="12" cy="12" r="9" />
        </svg>
      );
  }
};

export default async function Page() {
  const { featuredCases, totalActiveCases } = await loadFeaturedCases();
  const heroCase = featuredCases[0] || null;
  const displayCases =
    featuredCases.length > 0
      ? featuredCases.slice(0, 6).map((template) => ({
          title: getCategoryTitle(template.primaryCategory),
          cases: `${template.practiceArea || "Live"} Matter`,
        }))
      : categoryFallbacks;

  const plaintiffStatement = trimStatement(
    heroCase ? getPlaintiffClaim(heroCase) || heroCase.openingStatement : "",
    "The defendant breached the duty of care by failing to maintain a safe environment."
  );
  const defendantStatement = trimStatement(
    heroCase ? getDefendantClaim(heroCase) : "",
    "The plaintiff has not established causation and the record leaves material gaps."
  );
  const totalCasesLabel =
    totalActiveCases > 0 ? totalActiveCases.toLocaleString("en-US") : "Growing";
  const homepageSchema = {
    "@context": "https://schema.org",
    "@type": "VideoGame",
    name: config.appName,
    url: `https://${config.domainName}/`,
    description:
      "Legal Arena is an online lawyer game and AI courtroom simulator where players interview clients, build fact sheets, argue cases, and receive rulings.",
    gamePlatform: "Web browser",
    genre: ["Courtroom game", "Legal simulation game", "Educational game"],
    applicationCategory: "GameApplication",
    audience: {
      "@type": "Audience",
      audienceType:
        "People interested in law, courtroom drama, legal shows, debate, and legal reasoning.",
    },
    isAccessibleForFree: true,
  };

  return (
    <main className="arena-landing min-h-screen overflow-hidden bg-[#020202] text-white">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(homepageSchema) }}
      />
      <header className="sticky top-0 z-40 border-b border-white/10 bg-black/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 md:px-8">
          <Link href="/" className="inline-flex items-center gap-3" aria-label="Legal Arena home">
            <Image
              src="/logoAndName.png"
              alt="Legal Arena logo"
              width={160}
              height={36}
              className="h-9 w-auto object-contain"
              priority
            />
          </Link>

          <nav className="hidden items-center gap-8 text-sm text-white/72 lg:flex">
            {navItems.map((item) => (
              <a key={item.href} href={item.href} className="transition hover:text-white">
                {item.label}
              </a>
            ))}
          </nav>

          <div className="flex items-center gap-3">
            <Link
              href="/api/auth/signin"
              className="hidden text-sm text-white/72 transition hover:text-white md:inline-flex"
            >
              Log in
            </Link>
            <Link
              href="/dashboard"
              className="rounded-2xl border border-white/15 bg-white px-5 py-3 text-sm font-semibold text-black transition hover:bg-white/90"
            >
              Start Free
            </Link>
          </div>
        </div>
      </header>

      <section className="arena-column-bg relative">
        <div className="mx-auto max-w-7xl px-5 pb-12 pt-10 md:px-8 md:pb-16 md:pt-16">
          <div className="grid items-start gap-12 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
            <div className="max-w-2xl">
              <p className="arena-kicker">Online lawyer game with AI courtroom cases</p>
              <h1 className="arena-headline mt-6 text-6xl uppercase leading-[0.9] md:text-7xl xl:text-[6.4rem]">
                Play.
                <br />
                Argue.
                <br />
                Win.
              </h1>
              <p className="mt-6 max-w-xl text-lg leading-8 text-white/72 md:text-2xl md:leading-10">
                Step into a lawyer game where you interview your client, build the fact sheet, argue against AI opposing counsel, and see how the judge rules.
              </p>

              <div className="mt-8 flex flex-wrap items-center gap-4">
                <Link
                  href="/dashboard"
                  className="rounded-2xl bg-white px-6 py-4 text-sm font-semibold text-black transition hover:bg-white/90"
                >
                  Play Your First Case
                </Link>
                <a
                  href="#how-it-works"
                  className="rounded-2xl border border-white/15 bg-white/5 px-6 py-4 text-sm font-semibold text-white transition hover:bg-white/10"
                >
                  See How It Works
                </a>
              </div>

              <div className="mt-10 grid gap-4 border-t border-white/10 pt-8 sm:grid-cols-2 xl:grid-cols-4">
                {featureHighlights.map((item, index) => {
                  const iconKinds = ["spark", "bolt", "trophy", "brief"];
                  return (
                    <div key={item.title} className="space-y-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/12 bg-white/5 text-white/75">
                        <Icon kind={iconKinds[index]} />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-white">{item.title}</p>
                        <p className="mt-2 text-sm leading-6 text-white/56">{item.description}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="relative xl:pt-4">
              <div className="arena-glass rounded-[2rem] p-4 md:p-6">
                <div className="grid gap-0 overflow-hidden rounded-[1.5rem] border border-white/10 bg-white/[0.02] lg:grid-cols-[minmax(0,1fr)_120px_minmax(0,1fr)]">
                  <div className="p-6 md:p-8">
                    <p className="text-xs font-semibold uppercase tracking-[0.28em] text-white/45">
                      You
                    </p>
                    <p className="mt-5 text-xl font-semibold text-white">Your Argument</p>
                    <p className="mt-4 text-base leading-8 text-white/72">{plaintiffStatement}</p>
                    <div className="mt-8 flex items-center justify-between rounded-2xl border border-white/10 bg-black/30 px-4 py-3">
                      <div>
                        <p className="text-xs uppercase tracking-[0.24em] text-white/40">
                          Case File
                        </p>
                        <p className="mt-2 text-2xl font-semibold text-white">Draft</p>
                      </div>
                      <div className="rounded-xl border border-white/10 p-3 text-white/55">
                        <Icon kind="brief" />
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-center border-y border-white/10 py-8 text-center lg:border-x lg:border-y-0">
                    <span className="text-5xl font-semibold tracking-tight text-white/88">VS</span>
                  </div>

                  <div className="p-6 md:p-8">
                    <p className="text-xs font-semibold uppercase tracking-[0.28em] text-white/45">
                      AI Opponent
                    </p>
                    <p className="mt-5 text-xl font-semibold text-white">Counter Argument</p>
                    <p className="mt-4 text-base leading-8 text-white/72">{defendantStatement}</p>
                    <div className="mt-8 flex items-center justify-between rounded-2xl border border-white/10 bg-black/30 px-4 py-3">
                      <div>
                        <p className="text-xs uppercase tracking-[0.24em] text-white/40">
                          Response
                        </p>
                        <p className="mt-2 text-2xl font-semibold text-white">Round</p>
                      </div>
                      <div className="rounded-xl border border-white/10 p-3 text-white/55">
                        <Icon kind="scale" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="arena-glass relative -mt-3 ml-auto max-w-[88%] rounded-[1.75rem] p-5 md:-mt-6 md:p-6">
                <p className="text-center text-sm uppercase tracking-[0.26em] text-white/45">
                  Judge&apos;s Verdict
                </p>
                <p className="mt-3 text-center text-3xl font-semibold uppercase tracking-tight text-white">
                  Final Ruling
                </p>
                <p className="mt-3 text-center text-sm leading-6 text-white/62">
                  The bench weighs your fact sheet, courtroom argument, proof gaps, lawbook fit, and opposing counsel response.
                </p>
                <div className="mt-6 flex flex-wrap justify-center gap-2">
                  {verdictReasons.map((reason) => (
                    <span
                      key={reason}
                      className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs uppercase tracking-[0.18em] text-white/55"
                    >
                      {reason}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="how-it-works" className="border-y border-white/10 bg-black/60">
        <div className="mx-auto max-w-7xl px-5 py-16 md:px-8 md:py-20">
          <p className="text-center text-sm font-semibold uppercase tracking-[0.34em] text-white/45">
            How It Works
          </p>
          <div className="mt-12 grid gap-8 lg:grid-cols-3">
            {steps.map((step, index) => {
              const iconKinds = ["folder", "pen", "gavel"];
              return (
                <div key={step.number} className="relative rounded-[1.75rem] border border-white/10 bg-white/[0.03] p-8">
                  <div className="flex items-center justify-between">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-white/12 bg-black/30 text-lg font-semibold text-white">
                      {step.number}
                    </div>
                    <div className="text-white/28">
                      <Icon kind={iconKinds[index]} className="h-8 w-8" />
                    </div>
                  </div>
                  <h2 className="mt-10 text-3xl font-semibold tracking-tight text-white">
                    {step.title}
                  </h2>
                  <p className="mt-4 max-w-sm text-base leading-8 text-white/64">
                    {step.description}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section id="features" className="mx-auto max-w-7xl px-5 py-16 md:px-8 md:py-20">
        <div className="grid gap-10 xl:grid-cols-[minmax(0,0.86fr)_minmax(0,1.14fr)] xl:items-start">
          <div className="xl:pr-6">
            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-white/45">
              A lawyer game that builds real skills
            </p>
            <h2 className="arena-headline mt-5 max-w-lg text-4xl uppercase leading-[0.92] md:text-[4.25rem]">
              Play like court is tomorrow.
            </h2>
            <p className="mt-6 max-w-lg text-lg leading-8 text-white/66">
              Legal Arena turns courtroom drama into an active browser game: analyze the record, build your case, argue under pressure, then run it back stronger.
            </p>
            <div className="mt-8 max-w-md space-y-4">
              {skillPoints.map((point) => (
                <div key={point} className="flex items-start gap-3 text-white/72">
                  <span className="mt-1 flex h-5 w-5 items-center justify-center rounded-full border border-white/15 text-[10px]">
                    +
                  </span>
                  <p className="leading-7">{point}</p>
                </div>
              ))}
            </div>
            <Link
              href="/lawyer-game"
              className="mt-10 inline-flex rounded-2xl border border-white/15 bg-white/5 px-5 py-4 text-sm font-semibold text-white transition hover:bg-white/10"
            >
              Explore the Lawyer Game
            </Link>
          </div>

          <div className="arena-glass overflow-hidden rounded-[2rem] p-5 md:p-7" id="leaderboard">
            <p className="text-sm font-semibold uppercase tracking-[0.28em] text-white/45">
              Dashboard Systems
            </p>
            <div className="mt-6 grid gap-4 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)_minmax(0,0.8fr)]">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
                <div className="rounded-[1.4rem] border border-white/10 bg-black/30 p-5">
                  <p className="text-sm text-white/50">Overall Rating</p>
                  <p className="mt-3 max-w-[8ch] text-[2.15rem] font-semibold leading-[1.05] text-white">
                    1000+
                  </p>
                  <div className="mt-5 h-2 rounded-full bg-white/10">
                    <div className="h-2 w-[52%] rounded-full bg-white" />
                  </div>
                  <p className="mt-3 text-sm text-white/45">XP updates after verdicts</p>
                </div>
                <div className="rounded-[1.4rem] border border-white/10 bg-black/30 p-5">
                  <p className="text-sm text-white/50">Record</p>
                  <div className="mt-4">
                    <p className="text-4xl font-semibold tracking-tight text-white">W-L-D</p>
                    <p className="mt-3 text-sm uppercase tracking-[0.18em] text-white/42">
                      Tracked by matter
                    </p>
                  </div>
                </div>
              </div>

              <div className="min-w-0 rounded-[1.4rem] border border-white/10 bg-black/30 p-5">
                <p className="text-sm text-white/50">Specializations</p>
                <div className="mt-5 space-y-5">
                  {[
                    { name: "Criminal Law", level: "Category tier", width: "78%" },
                    { name: "Corporate Law", level: "Rating track", width: "54%" },
                    { name: "Constitutional Law", level: "Unlock progress", width: "41%" },
                  ].map((item) => (
                    <div key={item.name}>
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-medium leading-snug text-white">{item.name}</p>
                          <p className="text-sm text-white/45">{item.level}</p>
                        </div>
                        <div className="rounded-xl border border-white/10 p-2 text-white/40">
                          <Icon kind="brief" className="h-4 w-4" />
                        </div>
                      </div>
                      <div className="mt-3 h-2 rounded-full bg-white/10">
                        <div className="h-2 rounded-full bg-white" style={{ width: item.width }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="min-w-0 rounded-[1.4rem] border border-white/10 bg-black/30 p-5 text-center">
                <p className="text-sm text-white/50">Leaderboard</p>
                <p className="mt-4 text-5xl font-semibold tracking-tight text-white md:text-6xl">Rank</p>
                <p className="mt-2 text-sm uppercase tracking-[0.2em] text-white/45">Overall + category</p>
                <div className="mt-7 flex justify-center text-white/45">
                  <Icon kind="trophy" className="h-14 w-14" />
                </div>
                <Link
                  href="/dashboard"
                  className="mt-7 inline-flex rounded-2xl border border-white/15 bg-white px-4 py-3 text-sm font-semibold text-black transition hover:bg-white/90"
                >
                  View Leaderboard
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="case-library" className="border-y border-white/10 bg-black/60">
        <div className="mx-auto max-w-7xl px-5 py-16 md:px-8 md:py-20">
          <p className="text-center text-sm font-semibold uppercase tracking-[0.28em] text-white/45">
            Diverse Case Tracks
          </p>
          <p className="mx-auto mt-4 max-w-2xl text-center text-lg leading-8 text-white/62">
            Practice across multiple areas of law with available matters, complexity tiers, and replayable courtroom runs.
          </p>
          <div className="mt-12 grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
            {displayCases.map((category) => (
              <div
                key={`${category.title}-${category.cases}`}
                className="rounded-[1.5rem] border border-white/10 bg-white/[0.03] p-5 text-center"
              >
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl border border-white/10 bg-black/30 text-white/55">
                  <Icon kind="scale" />
                </div>
                <p className="mt-5 text-lg font-semibold text-white">{category.title}</p>
                <p className="mt-2 text-sm text-white/45">{category.cases}</p>
              </div>
            ))}
          </div>

          <div className="mt-14 grid gap-5 lg:grid-cols-3">
            {featuredCases.slice(0, 3).map((template, index) => (
              <div
                key={template.id || `featured-case-${index}`}
                className="rounded-[1.75rem] border border-white/10 bg-white/[0.03] p-6"
              >
                <p className="text-xs uppercase tracking-[0.28em] text-white/42">
                  {getCategoryTitle(template.primaryCategory)}
                </p>
                <h3 className="mt-4 text-2xl font-semibold text-white">{template.title}</h3>
                <p className="mt-4 text-sm leading-7 text-white/62">
                  {trimStatement(
                    template.subtitle || template.overview,
                    "A playable legal matter with intake, argument pressure, lawbook rules, and judge feedback."
                  )}
                </p>
                <div className="mt-6 flex items-center justify-between text-sm text-white/45">
                  <span>{template.practiceArea || "Live matter"}</span>
                  <span>Complexity {template.complexity || 3}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 py-16 md:px-8 md:py-20">
          <p className="text-center text-sm font-semibold uppercase tracking-[0.28em] text-white/45">
          What You Actually Play
        </p>
        <div className="mt-12 grid gap-5 lg:grid-cols-3">
          {practiceCards.map((item, index) => {
            const iconKinds = ["users", "gavel", "star"];

            return (
            <div key={item.title} className="rounded-[1.75rem] border border-white/10 bg-white/[0.03] p-6">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-white/10 bg-black/30 text-white/55">
                  <Icon kind={iconKinds[index]} />
                </div>
                <div>
                  <p className="font-medium text-white">{item.title}</p>
                  <p className="text-sm text-white/45">In the current game loop</p>
                </div>
              </div>
              <p className="mt-6 text-base leading-8 text-white/68">{item.detail}</p>
            </div>
            );
          })}
        </div>

        <div className="mt-12 grid gap-6 border-t border-white/10 pt-8 text-center sm:grid-cols-2 xl:grid-cols-4">
          {[
            { icon: "brief", value: totalCasesLabel, label: "Active Cases" },
            { icon: "users", value: "Intake", label: "Party Interview" },
            { icon: "gavel", value: "Rounds", label: "Courtroom Argument" },
            { icon: "star", value: "XP", label: "Progression" },
          ].map((stat) => (
            <div key={stat.label} className="flex items-center justify-center gap-4">
              <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3 text-white/55">
                <Icon kind={stat.icon} />
              </div>
              <div className="text-left">
                <p className="text-3xl font-semibold text-white">{stat.value}</p>
                <p className="text-sm text-white/45">{stat.label}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="arena-column-bg border-t border-white/10">
        <div className="mx-auto max-w-7xl px-5 py-16 text-center md:px-8 md:py-20">
          <p className="text-sm font-semibold uppercase tracking-[0.28em] text-white/45">
            Ready to step into the arena?
          </p>
          <h2 className="arena-headline mx-auto mt-5 max-w-4xl text-4xl uppercase md:text-6xl">
            Play your first case today.
          </h2>
          <p className="mx-auto mt-5 max-w-2xl text-lg leading-8 text-white/62">
            Build your argument, face the AI, and see whether your reasoning actually holds when someone pushes back.
          </p>
          <Link
            href="/dashboard"
            className="mt-8 inline-flex rounded-2xl bg-white px-6 py-4 text-sm font-semibold text-black transition hover:bg-white/90"
          >
            Start Your First Case
          </Link>
        </div>
      </section>
    </main>
  );
}
