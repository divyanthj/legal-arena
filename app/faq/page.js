import FAQ from "@/components/FAQ";
import { getSEOTags } from "@/libs/seo";

export const metadata = getSEOTags({
  title: "Legal Arena FAQ | Lawyer Game & AI Courtroom Simulator",
  description:
    "Answers to common questions about Legal Arena, the online lawyer game where players interview clients, build fact sheets, and argue cases against AI.",
  keywords: [
    "Legal Arena FAQ",
    "lawyer game FAQ",
    "AI courtroom game",
    "courtroom simulator questions",
  ],
  canonicalUrlRelative: "/faq",
});

const faqSchema = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    {
      "@type": "Question",
      name: "Is Legal Arena a lawyer game?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Yes. Legal Arena is an online lawyer game where you interview a client, build a fact sheet, argue against AI opposing counsel, and receive a ruling from the judge.",
      },
    },
    {
      "@type": "Question",
      name: "Do I need legal experience to play?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "No. Legal Arena is built for people interested in law, courtroom drama, legal shows, debate, and strategic argument.",
      },
    },
    {
      "@type": "Question",
      name: "Is Legal Arena legal advice?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "No. Legal Arena is a game and training simulator. It is not a lawyer, law firm, legal advice service, or substitute for hiring an attorney.",
      },
    },
  ],
};

export default function FAQPage() {
  return (
    <main className="min-h-screen bg-base-200">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />
      <section className="border-b border-base-300 bg-base-100/90">
        <div className="mx-auto max-w-7xl px-8 py-16">
          <p className="text-sm uppercase tracking-[0.3em] text-base-content/45">
            Help Center
          </p>
          <h1 className="mt-4 font-serif text-5xl leading-tight text-base-content md:text-6xl">
            Questions players ask before stepping into court.
          </h1>
          <p className="mt-5 max-w-3xl text-lg leading-8 text-base-content/75">
            A quick guide to how the Legal Arena lawyer game works, how access is
            handled, and what to expect when you open a case.
          </p>
        </div>
      </section>

      <FAQ
        eyebrow="Support"
        title="Frequently Asked Questions"
        intro="If you are wondering how side assignment, case access, progression, or replays work, the answers are here."
      />
    </main>
  );
}
