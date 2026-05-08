import Link from "next/link";
import { getSEOTags } from "@/libs/seo";
import config from "@/config";

export const metadata = getSEOTags({
  title: "Lawyer Game: Play Courtroom Cases Against AI | Legal Arena",
  description:
    "Play a lawyer game online: interview clients, organize facts, argue courtroom cases against AI, and get a judge's ruling.",
  keywords: [
    "lawyer game",
    "online lawyer game",
    "courtroom game",
    "courtroom simulator",
    "AI lawyer game",
    "legal simulation game",
    "law game online",
  ],
  canonicalUrlRelative: "/lawyer-game",
  openGraph: {
    title: "Lawyer Game: Play Courtroom Cases Against AI",
    description:
      "Legal Arena is a playable AI courtroom game for people who love law, courtroom drama, debate, and strategic argument.",
    url: `https://${config.domainName}/lawyer-game`,
  },
});

const steps = [
  {
    title: "Choose a case",
    text: "Open a playable dispute with parties, facts, claims, risks, evidence, and a lawbook built for the matter.",
  },
  {
    title: "Interview your client",
    text: "Ask questions, uncover pressure points, and turn a messy story into a fact sheet you can argue from.",
  },
  {
    title: "Argue in court",
    text: "Face AI opposing counsel, answer counterarguments, use the record, and push your theory across the line.",
  },
  {
    title: "Get the ruling",
    text: "The judge scores your fact use, legal reasoning, weak spots, and response to the other side.",
  },
];

const audiences = [
  "People who watch legal dramas and want to try the courtroom pressure themselves",
  "Players looking for a lawyer game with more strategy than tapping the obvious answer",
  "Debaters and writers who enjoy argument, persuasion, and structured thinking",
  "Law students or law-curious players who want realistic practice without pretending it is legal advice",
];

const faqs = [
  {
    question: "Is Legal Arena a lawyer game?",
    answer:
      "Yes. Legal Arena is an online lawyer game where you play through courtroom-style cases by interviewing a client, building a fact sheet, arguing against AI opposing counsel, and receiving a ruling.",
  },
  {
    question: "Do I need legal experience to play?",
    answer:
      "No. Legal Arena is built for people interested in law, legal shows, debate, and courtroom strategy. Legal knowledge helps, but the game explains the case record and lawbook for each matter.",
  },
  {
    question: "Is Legal Arena legal advice?",
    answer:
      "No. Legal Arena is a game and training simulator. It is not a lawyer, law firm, legal advice service, or substitute for hiring an attorney.",
  },
];

const pageSchema = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "VideoGame",
      name: "Legal Arena",
      alternateName: "Legal Arena lawyer game",
      url: `https://${config.domainName}/lawyer-game`,
      description:
        "Legal Arena is an online lawyer game and AI courtroom simulator where players interview clients, build fact sheets, argue cases, and receive rulings.",
      gamePlatform: "Web browser",
      genre: ["Courtroom game", "Lawyer game", "Legal simulation game"],
      applicationCategory: "GameApplication",
      isAccessibleForFree: true,
      publisher: {
        "@type": "Organization",
        name: "Legal Arena",
        url: `https://${config.domainName}/`,
      },
      audience: {
        "@type": "Audience",
        audienceType:
          "People interested in law, courtroom drama, legal shows, debate, and legal reasoning.",
      },
    },
    {
      "@type": "FAQPage",
      mainEntity: faqs.map((faq) => ({
        "@type": "Question",
        name: faq.question,
        acceptedAnswer: {
          "@type": "Answer",
          text: faq.answer,
        },
      })),
    },
  ],
};

export default function LawyerGamePage() {
  return (
    <main className="arena-landing min-h-screen overflow-hidden bg-[#020202] text-white">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(pageSchema) }}
      />

      <section className="arena-column-bg border-b border-white/10">
        <div className="mx-auto grid max-w-7xl gap-12 px-5 py-16 md:px-8 md:py-24 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)] xl:items-center">
          <div>
            <p className="arena-kicker">Online lawyer game</p>
            <h1 className="arena-headline mt-5 max-w-4xl text-5xl uppercase leading-[0.92] md:text-7xl">
              Lawyer Game: Play Courtroom Cases Against AI
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-white/72 md:text-2xl md:leading-10">
              Pick a case, interview your client, build the facts, argue against
              AI opposing counsel, and find out whether your case survives the
              judge.
            </p>
            <div className="mt-8 flex flex-wrap gap-4">
              <Link
                href="/dashboard"
                className="rounded-2xl bg-white px-6 py-4 text-sm font-semibold text-black transition hover:bg-white/90"
              >
                Play Your First Case
              </Link>
              <Link
                href="/help"
                className="rounded-2xl border border-white/15 bg-white/5 px-6 py-4 text-sm font-semibold text-white transition hover:bg-white/10"
              >
                Read the Game Guide
              </Link>
            </div>
          </div>

          <div className="arena-glass rounded-[2rem] p-5 md:p-7">
            <p className="text-sm font-semibold uppercase tracking-[0.28em] text-white/45">
              What makes it different
            </p>
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              {[
                "Open-text arguments",
                "AI opposing counsel",
                "Client intake questions",
                "Fact sheets and rulings",
              ].map((item) => (
                <div
                  key={item}
                  className="rounded-[1.25rem] border border-white/10 bg-black/30 p-5"
                >
                  <p className="text-lg font-semibold text-white">{item}</p>
                </div>
              ))}
            </div>
            <p className="mt-6 text-sm leading-7 text-white/60">
              Legal Arena is designed for play and practice. It is not legal
              advice, and it does not replace a lawyer for a real dispute.
            </p>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 py-16 md:px-8 md:py-20">
        <p className="arena-kicker">What is Legal Arena?</p>
        <div className="mt-5 grid gap-10 xl:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
          <h2 className="arena-headline text-4xl uppercase leading-[0.95] md:text-6xl">
            A browser-based courtroom game for legal strategy.
          </h2>
          <div className="space-y-5 text-base leading-8 text-white/70 md:text-lg">
            <p>
              Legal Arena is a lawyer game built around playable courtroom
              cases. Instead of clicking through a fixed script, you question a
              client, organize the facts, and write arguments in your own words.
            </p>
            <p>
              The game is made for people who enjoy law, legal shows, courtroom
              drama, debate, negotiation, and strategic reasoning. Each run
              gives you a case file, an opponent, a judge, and a chance to test
              whether your argument actually holds up.
            </p>
          </div>
        </div>
      </section>

      <section className="border-y border-white/10 bg-black/60">
        <div className="mx-auto max-w-7xl px-5 py-16 md:px-8 md:py-20">
          <p className="text-center text-sm font-semibold uppercase tracking-[0.28em] text-white/45">
            How the lawyer game works
          </p>
          <div className="mt-12 grid gap-5 lg:grid-cols-4">
            {steps.map((step, index) => (
              <article
                key={step.title}
                className="rounded-[1.5rem] border border-white/10 bg-white/[0.03] p-6"
              >
                <p className="text-sm uppercase tracking-[0.24em] text-white/40">
                  Step {String(index + 1).padStart(2, "0")}
                </p>
                <h2 className="mt-5 text-2xl font-semibold text-white">
                  {step.title}
                </h2>
                <p className="mt-4 text-sm leading-7 text-white/62">{step.text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 py-16 md:px-8 md:py-20">
        <div className="grid gap-10 xl:grid-cols-2 xl:items-start">
          <div>
            <p className="arena-kicker">Who it is for</p>
            <h2 className="arena-headline mt-4 text-4xl uppercase leading-[0.95] md:text-6xl">
              Built for people who want to step into the argument.
            </h2>
          </div>
          <ul className="space-y-4">
            {audiences.map((audience) => (
              <li
                key={audience}
                className="rounded-[1.25rem] border border-white/10 bg-white/[0.03] p-5 text-base leading-7 text-white/70"
              >
                {audience}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="border-t border-white/10 bg-black/60">
        <div className="mx-auto max-w-5xl px-5 py-16 md:px-8 md:py-20">
          <p className="text-center text-sm font-semibold uppercase tracking-[0.28em] text-white/45">
            Common questions
          </p>
          <div className="mt-10 space-y-4">
            {faqs.map((faq) => (
              <article
                key={faq.question}
                className="rounded-[1.5rem] border border-white/10 bg-white/[0.03] p-6"
              >
                <h2 className="text-xl font-semibold text-white">{faq.question}</h2>
                <p className="mt-3 text-base leading-7 text-white/66">
                  {faq.answer}
                </p>
              </article>
            ))}
          </div>
          <div className="mt-10 text-center">
            <Link
              href="/dashboard"
              className="inline-flex rounded-2xl bg-white px-6 py-4 text-sm font-semibold text-black transition hover:bg-white/90"
            >
              Start Playing
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
