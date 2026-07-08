import Link from "next/link";
import Image from "next/image";
import connectMongo from "@/libs/mongoose";
import CaseTemplate from "@/models/CaseTemplate";
import { getCategoryTitle } from "@/libs/game/categories";
import {
  getActiveFreeGameplayAnnouncement,
  getAdminOpsConfig,
  getFreeGameplayCampaignStatus,
} from "@/libs/adminOps";
import { getSEOTags } from "@/libs/seo";
import config from "@/config";
import {
  isIndependenceDayPromoActive,
} from "@/libs/independenceDayPromo";
import IndependenceDayPromoBanner from "@/components/legal-arena/IndependenceDayPromoBanner";
import LandingCategoryCarousel from "@/components/legal-arena/LandingCategoryCarousel";

export const dynamic = "force-dynamic";

const searchIntentKeywords = [
  "Ace Attorney alternative",
  "Ace Attorney style game",
  "games like Ace Attorney",
  "Phoenix Wright alternative",
  "courtroom visual novel game",
  "objection style lawyer game",
  "detective courtroom game",
];

export const metadata = getSEOTags({
  title: "Legal Arena | AI Lawyer Game",
  description:
    "Play an AI lawyer game with endless legal matters, client interviews, settlement talks, courtroom arguments, and player challenges.",
  keywords: [
    "lawyer game",
    "online lawyer game",
    "courtroom game",
    "AI courtroom simulator",
    "legal simulation game",
    "law game",
    ...searchIntentKeywords,
  ],
  canonicalUrlRelative: "/",
  openGraph: {
    title: "Legal Arena | AI Lawyer Game",
    description:
      "Interview AI clients, negotiate settlements, build your case, and argue in court before an AI judge.",
  },
});

const navItems = [
  { label: "How It Works", href: "#how-it-works" },
  { label: "Features", href: "#features" },
  { label: "Case Library", href: "#case-library" },
];

const featureHighlights = [
  {
    title: "AI Clients",
    description: "Question characters who answer like people with messy memories, motives, and missing details.",
    iconKind: "profile",
  },
  {
    title: "Real Arguments",
    description: "Write your own questions and courtroom arguments instead of choosing from canned options.",
    iconKind: "bolt",
  },
  {
    title: "AI Courtroom",
    description: "Face pushback from the other side, adapt your theory, and try to persuade the judge.",
    iconKind: "gavel",
  },
  {
    title: "Verdicts",
    description: "Every case ends with a ruling that explains what helped you and what weakened your side.",
    iconKind: "scale",
  },
  {
    title: "Out-of-Court Settlements",
    description: "Make offers, test leverage, and resolve matters out of court before the fight reaches a verdict.",
    iconKind: "handshake",
  },
  {
    title: "PVP Cases",
    description: "Challenge another player, prepare separately, and argue both sides before an AI judge.",
    iconKind: "swords",
  },
];

const steps = [
  {
    number: "1",
    title: "Meet Your Client",
    description: "Open a case and find out who you represent, what happened, and what your client wants from the court.",
  },
  {
    number: "2",
    title: "Interview the AI",
    description: "Ask your client questions in your own words. Push for facts, dates, proof, risks, and the story behind the dispute.",
  },
  {
    number: "3",
    title: "Negotiate or Fight",
    description: "Push for a settlement when the leverage is right, or take the dispute into court and argue it through.",
  },
  {
    number: "4",
    title: "Challenge Players",
    description: "In PVP, each player independently interviews their own AI client, then both sides meet in court before an AI judge.",
  },
];

const skillPoints = [
  "Talk to AI clients in your own words",
  "Uncover facts, contradictions, and missing details",
  "Negotiate settlements before the case reaches a ruling",
  "Argue against an AI opponent or another player",
  "Play fresh legal matters without running out of cases",
];

const practiceCards = [
  {
    title: "Client Interview",
    detail:
      "Your client is powered by AI. Ask follow-up questions, dig into weak spots, and decide what story you can actually prove.",
    iconKind: "profile",
  },
  {
    title: "Case Prep",
    detail:
      "Turn a messy interview into a working file: the timeline, strongest facts, disputed points, risks, and what your side is asking for.",
    iconKind: "folder",
  },
  {
    title: "Court Fight",
    detail:
      "Argue against AI opposition, respond to attacks, and get a ruling that tells you whether your strategy held up.",
    iconKind: "gavel",
  },
  {
    title: "Settlement Talks",
    detail:
      "Send offers, read the other side, and decide whether a deal is smarter than risking everything in court.",
    iconKind: "handshake",
  },
  {
    title: "PVP Gameplay",
    detail:
      "Challenge another player to the same dispute. You each prepare privately with your own AI client, then fight it out in court with an AI judge.",
    iconKind: "swords",
  },
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
    case "profile":
      return (
        <svg {...props}>
          <circle cx="12" cy="8" r="4" />
          <path d="M4.5 21a7.5 7.5 0 0 1 15 0" />
        </svg>
      );
    case "infinity":
      return (
        <svg {...props}>
          <path d="M7.5 8.5c-2 0-3.5 1.5-3.5 3.5s1.5 3.5 3.5 3.5c1.6 0 3-1.2 4.5-3.5 1.5-2.3 2.9-3.5 4.5-3.5 2 0 3.5 1.5 3.5 3.5s-1.5 3.5-3.5 3.5c-1.6 0-3-1.2-4.5-3.5-1.5-2.3-2.9-3.5-4.5-3.5Z" />
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
    case "handshake":
      return (
        <svg {...props}>
          <path d="m7 12 3.4 3.4a2 2 0 0 0 2.8 0L17 11.6" />
          <path d="m3 10 4-4 4 4" />
          <path d="m21 10-4-4-4 4" />
          <path d="M7 6h10" />
          <path d="m5 12 4.2 4.2" />
          <path d="m19 12-4.2 4.2" />
        </svg>
      );
    case "swords":
      return (
        <svg {...props}>
          <path d="m4 20 6.5-6.5" />
          <path d="m14 10 6-6" />
          <path d="M15 4h5v5" />
          <path d="m20 20-6.5-6.5" />
          <path d="M10 10 4 4" />
          <path d="M4 9V4h5" />
          <path d="m8 16-2 2" />
          <path d="m16 16 2 2" />
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
  const [{ featuredCases, totalActiveCases }, adminOpsConfig] = await Promise.all([
    loadFeaturedCases(),
    getAdminOpsConfig().catch((error) => {
      console.error("Landing page campaign config load failed:", error.message);
      return null;
    }),
  ]);
  const freeGameplayAnnouncement = getActiveFreeGameplayAnnouncement(
    adminOpsConfig?.freeGameplayCampaign
  );
  const freeGameplayCampaignStatus = getFreeGameplayCampaignStatus(
    adminOpsConfig?.freeGameplayCampaign
  );
  const freeGameplayCampaignActive = freeGameplayCampaignStatus.active;
  const independenceDayPromoActive = isIndependenceDayPromoActive();
  const campaignCtaLabel =
    freeGameplayAnnouncement?.ctaLabel ||
    (freeGameplayCampaignActive ? "Play Free Case" : "Start Free");
  const totalCasesLabel =
    totalActiveCases > 0 ? totalActiveCases.toLocaleString("en-US") : "Growing";
  const infiniteCasesStat = (
    <span className="inline-flex items-baseline gap-2">
      <span className="text-white/34 line-through decoration-2">{totalCasesLabel}</span>
      <span aria-label="Infinite">&infin;</span>
    </span>
  );
  const homepageSchema = {
    "@context": "https://schema.org",
    "@type": "VideoGame",
    name: config.appName,
    url: `https://${config.domainName}/`,
    description:
      "Legal Arena is a first-of-its-kind AI lawyer game where players interview AI clients, negotiate settlements, build cases, argue in court, and receive rulings.",
    gamePlatform: "Web browser",
    genre: ["AI lawyer game", "Courtroom game", "Legal strategy game"],
    keywords: [
      "AI lawyer game",
      "online courtroom game",
      "legal strategy game",
      "courtroom visual novel",
      ...searchIntentKeywords,
    ],
    disambiguatingDescription:
      "An independent browser-based AI lawyer game for players searching for courtroom games, legal strategy games, or Ace Attorney-style experiences. Legal Arena is not affiliated with Ace Attorney, Phoenix Wright, or Capcom.",
    applicationCategory: "GameApplication",
    audience: {
      "@type": "Audience",
      audienceType:
        "People interested in law, courtroom drama, legal shows, debate, legal reasoning, detective courtroom games, and interactive legal stories.",
    },
    isAccessibleForFree: true,
  };

  return (
    <main className="arena-landing arena-app-shell min-h-screen overflow-hidden text-white">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(homepageSchema) }}
      />
      <header className="sticky top-0 z-40 border-b border-white/10 bg-[#050505]/88 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 md:px-8">
          <Link href="/" className="inline-flex items-center gap-3" aria-label="Legal Arena home">
            <Image
              src="/logoAndName.png"
              alt="Legal Arena logo"
              width={36}
              height={36}
              className="h-9 w-auto object-contain"
              priority
            />
            <span className="text-sm font-semibold uppercase tracking-[0.18em] text-white">
              LEGAL ARENA
            </span>
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
              className="arena-btn-light inline-flex px-5 py-3 text-sm"
            >
              {campaignCtaLabel}
            </Link>
          </div>
        </div>
      </header>

      <section className="arena-column-bg relative">
        <div className="mx-auto max-w-7xl px-5 pb-12 pt-10 md:px-8 md:pb-16 md:pt-16">
          {freeGameplayAnnouncement ? (
            <div className="arena-surface-soft mx-auto mb-8 flex max-w-5xl flex-col gap-4 border-emerald-300/22 bg-emerald-300/[0.055] px-5 py-4 text-left md:flex-row md:items-center md:justify-between">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-emerald-100/72">
                  Free Gameplay Campaign
                </p>
                <h2 className="mt-2 text-xl font-semibold leading-tight text-white">
                  {freeGameplayAnnouncement.title}
                </h2>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-emerald-50/78">
                  {freeGameplayAnnouncement.body}
                </p>
              </div>
              <Link
                href={freeGameplayAnnouncement.ctaHref || "/dashboard"}
                className="arena-btn-light inline-flex shrink-0 justify-center px-5 py-3 text-sm"
              >
                {freeGameplayAnnouncement.ctaLabel || "Try a Case"}
              </Link>
            </div>
          ) : null}
          <div className="arena-surface-soft mx-auto mb-8 flex max-w-5xl flex-col gap-4 border-amber-200/22 bg-amber-200/[0.055] px-5 py-4 text-left md:flex-row md:items-center md:justify-between">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-amber-100/72">
                Infinite cases and out-of-court settlements are live
              </p>
              <h2 className="mt-2 text-xl font-semibold leading-tight text-white">
                More disputes. More strategy. More ways to win.
              </h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-amber-50/78">
                Play fresh legal matters, negotiate settlements, build stronger
                case files, and decide whether to deal or fight in court.
              </p>
            </div>
            <div className="flex w-full shrink-0 flex-col gap-3 md:w-auto">
              <WhatsNewDialog buttonLabel="See what's new" />
            </div>
          </div>
          <div className="mx-auto max-w-6xl">
            <div className="mx-auto max-w-4xl text-center">
              <p className="arena-kicker">A first-of-its-kind AI lawyer game</p>
              <h1 className="arena-headline mt-6 text-6xl uppercase leading-[0.9] md:text-7xl xl:text-[6.4rem]">
                Be the lawyer.
              </h1>
              <p className="mx-auto mt-6 max-w-3xl text-lg leading-8 text-white/72 md:text-2xl md:leading-10">
                Interview AI clients. Negotiate when the deal is worth it. Build your case and fight it out in court before an AI judge, against the AI or another player.
              </p>

              <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
                <Link
                  href="/dashboard"
                  className="arena-btn-light px-6 py-4 text-sm"
                >
                  {freeGameplayCampaignActive ? campaignCtaLabel : "Try a Case"}
                </Link>
                <a
                  href="#how-it-works"
                  className="arena-btn-dark px-6 py-4 text-sm"
                >
                  How the Game Works
                </a>
              </div>

              <div className="mt-10 grid gap-6 border-t border-white/10 pt-8 sm:grid-cols-2 xl:grid-cols-6">
                {featureHighlights.map((item, index) => {
                  return (
                    <div
                      key={item.title}
                      className="mx-auto flex h-full max-w-xs flex-col items-center space-y-3 text-center xl:max-w-none"
                    >
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-amber-200/16 bg-amber-200/[0.055] text-amber-100/82">
                        <Icon kind={item.iconKind} />
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
          </div>
        </div>
      </section>

      <section id="how-it-works" className="border-y border-white/10 bg-black/45">
        <div className="mx-auto max-w-7xl px-5 py-16 md:px-8 md:py-20">
          <p className="text-center text-sm font-semibold uppercase tracking-[0.34em] text-white/45">
            How It Works
          </p>
          <div className="mt-12 grid gap-8 lg:grid-cols-4">
            {steps.map((step, index) => {
              const iconKinds = ["folder", "pen", "gavel"];
              return (
                <div key={step.number} className="arena-surface-soft relative p-8">
                  <div className="flex items-center justify-between">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-amber-200/18 bg-amber-200/[0.055] text-lg font-semibold text-amber-100">
                      {step.number}
                    </div>
                    <div className="text-white/32">
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
              Why this couldn&apos;t exist before
            </p>
            <h2 className="arena-headline mt-5 max-w-lg text-4xl uppercase leading-[0.92] md:text-[4.25rem]">
              AI makes lawyer games possible.
            </h2>
            <p className="mt-6 max-w-lg text-lg leading-8 text-white/66">
              For years, legal games had to be scripted: fixed clues, fixed dialogue, fixed outcomes. Legal Arena is different. You interview AI clients, ask your own questions, discover facts in your own way, negotiate when the pressure shifts, and argue before an AI judge. No dialogue trees. No preset path. Just your words, your strategy, and the matter in front of you.
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
              href="/dashboard"
              className="arena-btn-dark mt-10 inline-flex px-5 py-4 text-sm"
            >
              Start Playing
            </Link>
          </div>

          <div className="arena-glass overflow-hidden rounded-[2rem] p-3 md:p-4" id="leaderboard">
            <video
              className="aspect-video w-full rounded-[1.45rem] border border-white/10 bg-black object-cover shadow-2xl"
              src="/media/gameplay-showcase.mp4"
              poster="/media/gameplay-showcase-poster.jpg"
              autoPlay
              muted
              loop
              playsInline
              preload="metadata"
              aria-label="Legal Arena gameplay showing AI client interviews, case building, court arguments, and a verdict."
            />
          </div>
        </div>
      </section>

      <section id="case-library" className="border-y border-white/10 bg-black/45">
        <div className="mx-auto max-w-7xl px-5 py-16 md:px-8 md:py-20">
          <p className="text-center text-sm font-semibold uppercase tracking-[0.28em] text-white/45">
            Cases You Can Play
          </p>
          <p className="mx-auto mt-4 max-w-2xl text-center text-lg leading-8 text-white/62">
            Each matter gives you a client, a dispute, an opponent, and a choice: negotiate a settlement or take the fight to court. New legal stories keep opening up as you play.
          </p>
          <LandingCategoryCarousel />

          <div className="mt-14 grid gap-5 lg:grid-cols-3">
            {featuredCases.slice(0, 3).map((template, index) => (
              <div
                key={template.id || `featured-case-${index}`}
                className="arena-surface-soft p-6"
              >
                <p className="text-xs uppercase tracking-[0.28em] text-white/42">
                  {getCategoryTitle(template.primaryCategory)}
                </p>
                <h3 className="mt-4 text-2xl font-semibold text-white">{template.title}</h3>
                <p className="mt-4 text-sm leading-7 text-white/62">
                  {trimStatement(
                    template.subtitle || template.overview,
                    "A playable legal matter with client interviews, negotiation pressure, courtroom strategy, and judge feedback."
                  )}
                </p>
                <div className="mt-6 flex items-center justify-between text-sm text-white/45">
                  <span>{template.practiceArea || "Live matter"}</span>
              <span>Ready to play</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 py-16 md:px-8 md:py-20">
          <p className="text-center text-sm font-semibold uppercase tracking-[0.28em] text-white/45">
            What You Actually Do
        </p>
          <div className="mt-12 grid gap-5 md:grid-cols-2 xl:grid-cols-5">
          {practiceCards.map((item, index) => {
            return (
            <div key={item.title} className="arena-surface-soft p-6">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-emerald-300/16 bg-emerald-300/[0.045] text-emerald-100/72">
                  <Icon kind={item.iconKind} />
                </div>
                <div>
                  <p className="font-medium text-white">{item.title}</p>
                  <p className="text-sm text-white/45">Part of every legal battle</p>
                </div>
              </div>
              <p className="mt-6 text-base leading-8 text-white/68">{item.detail}</p>
            </div>
            );
          })}
        </div>

        <div className="mt-12 grid gap-6 border-t border-white/10 pt-8 text-center sm:grid-cols-2 xl:grid-cols-5">
          {[
            { icon: "infinity", value: infiniteCasesStat, label: "Legal Matters" },
            { icon: "profile", value: "AI", label: "Client Interviews" },
            { icon: "handshake", value: "Deal", label: "Settlement Talks" },
            { icon: "gavel", value: "Court", label: "Argument Battles" },
            { icon: "swords", value: "PVP", label: "Player Challenges" },
          ].map((stat) => (
            <div key={stat.label} className="flex items-center justify-center gap-4">
              <div className="rounded-xl border border-amber-200/14 bg-amber-200/[0.045] p-3 text-amber-100/72">
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
            Interview the client. Make the deal. Win the argument.
          </h2>
          <p className="mx-auto mt-5 max-w-2xl text-lg leading-8 text-white/62">
            This is not a law quiz. It is a playable legal battle where your questions, offers, facts, and arguments shape the outcome against AI opponents or another player.
          </p>
          <Link
            href="/dashboard"
            className="arena-btn-light mt-8 inline-flex px-6 py-4 text-sm"
          >
            Start Your First Case
          </Link>
        </div>
      </section>
    </main>
  );
}
