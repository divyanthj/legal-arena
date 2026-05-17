import Link from "next/link";
import { getSEOTags } from "@/libs/seo";
import config from "@/config";

export const metadata = getSEOTags({
  title: "AI Lawyer Game: Interview Clients, Argue in Court | Legal Arena",
  description:
    "Legal Arena is a first-of-its-kind AI lawyer game where you interview AI clients, build a case, argue in court, and get a judge's ruling.",
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
    title: "AI Lawyer Game: Interview Clients, Argue in Court",
    description:
      "A first-of-its-kind AI lawyer game where you talk to clients, prepare the facts, and fight it out in court.",
    url: `https://${config.domainName}/lawyer-game`,
  },
});

const steps = [
  {
    title: "Open a case",
    text: "You are assigned a client with a legal problem. They have a story, a goal, and details you still need to uncover.",
  },
  {
    title: "Interview the AI client",
    text: "Ask questions in your own words. The client answers dynamically, so you have to listen, follow up, and spot what matters.",
  },
  {
    title: "Build your case",
    text: "Turn the interview into a fact sheet: what happened, what helps you, what hurts you, and what you need the judge to do.",
  },
  {
    title: "Fight it out in court",
    text: "Use your facts to argue against AI opposition. The judge decides whether your case holds up.",
  },
  {
    title: "Challenge another player",
    text: "In PVP, each side independently interviews their own AI client, then both players argue the case before an AI judge.",
  },
];

const audiences = [
  "People who have watched courtroom scenes and wanted to be the one making the argument",
  "Players who want a legal game built around open questions and original arguments",
  "Competitive players who want PVP cases where preparation matters before the courtroom fight",
  "Debaters, writers, and strategy players who enjoy persuasion under pressure",
  "Law-curious players who want to think like a lawyer without needing a law degree",
];

const faqs = [
  {
    question: "Is Legal Arena a lawyer game?",
    answer:
      "Yes. Legal Arena is an AI-powered lawyer game. You interview AI clients, build a case from their answers, argue in court, and receive a judge's ruling.",
  },
  {
    question: "Does Legal Arena have PVP?",
    answer:
      "Yes. You can challenge another player to a case. Each player privately interviews their own AI client, builds their side of the case, then both players fight it out in court with an AI judge.",
  },
  {
    question: "Do I need legal experience to play?",
    answer:
      "No. Legal Arena starts from the basics: talk to your client, figure out what happened, choose the strongest facts, and argue clearly.",
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
        "Legal Arena is a first-of-its-kind AI lawyer game where players interview AI clients, build cases, argue in court, and receive rulings.",
      gamePlatform: "Web browser",
      genre: ["AI lawyer game", "Courtroom game", "Legal strategy game"],
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
            <p className="arena-kicker">A first-of-its-kind AI lawyer game</p>
            <h1 className="arena-headline mt-5 max-w-4xl text-5xl uppercase leading-[0.92] md:text-7xl">
              Interview AI clients. Fight in court.
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-white/72 md:text-2xl md:leading-10">
              Legal Arena is a lawyer game built around AI conversation. You talk
              to your client, prepare the case, argue against the other side, and
              find out whether the judge believes you. In PVP, you challenge
              another player and both sides prepare their own clients before court.
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
              The core idea
            </p>
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              {[
                "AI clients you can question",
                "Your own words, not fixed choices",
                "Court arguments that push back",
                "PVP cases with an AI judge",
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
              The fantasy is simple: be the lawyer. Ask better questions, find
              better facts, and make the argument that wins.
            </p>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 py-16 md:px-8 md:py-20">
        <p className="arena-kicker">What is Legal Arena?</p>
        <div className="mt-5 grid gap-10 xl:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
          <h2 className="arena-headline text-4xl uppercase leading-[0.95] md:text-6xl">
            A new kind of game where the client talks back.
          </h2>
          <div className="space-y-5 text-base leading-8 text-white/70 md:text-lg">
            <p>
              Legal Arena is an AI-powered lawyer game. You are not picking from
              a list of dialogue options. You interview an AI client, decide what
              to ask next, and build your case from the answers.
            </p>
            <p>
              Then you take that case to court. You argue, the other side pushes
              back, and the judge explains what worked. It is part legal drama,
              part strategy game, and part improvisational AI conversation.
            </p>
            <p>
              You can also challenge another player. Each of you interviews your
              own AI client independently, prepares your own case file, and then
              fights it out in court while an AI judge evaluates the arguments.
            </p>
          </div>
        </div>
      </section>

      <section className="border-y border-white/10 bg-black/60">
        <div className="mx-auto max-w-7xl px-5 py-16 md:px-8 md:py-20">
          <p className="text-center text-sm font-semibold uppercase tracking-[0.28em] text-white/45">
            How the AI lawyer game works
          </p>
          <div className="mt-12 grid gap-5 lg:grid-cols-5">
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
              Built for people who want to be the lawyer.
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
