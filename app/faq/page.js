import FAQ from "@/components/FAQ";
import { getSEOTags } from "@/libs/seo";

export const metadata = getSEOTags({
  title: "Legal Arena FAQ | AI Lawyer Game",
  description:
    "Answers to common questions about Legal Arena, the first-of-its-kind AI lawyer game where players interview AI clients, challenge other players, and argue before an AI judge.",
  keywords: [
    "Legal Arena FAQ",
    "lawyer game FAQ",
    "AI lawyer game",
    "AI courtroom game",
  ],
  canonicalUrlRelative: "/faq",
});

const faqSchema = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    {
      "@type": "Question",
      name: "What makes Legal Arena different from a normal legal quiz?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Legal Arena is built around open-ended play. You interview AI clients in your own words, build a case file, argue before an AI judge, and win through better questions and clearer reasoning.",
      },
    },
    {
      "@type": "Question",
      name: "Can I play against another player?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Yes. You can challenge another player to a PVP case. Each side independently interviews their own AI client, then both players argue in court before an AI judge.",
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
      name: "What does lifetime access include?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Lifetime access gives you permanent access to the current product and future Legal Arena updates and changes.",
      },
    },
    {
      "@type": "Question",
      name: "Will there be other pricing plans later?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Legal Arena may introduce other pricing plans in the future, but anyone who buys lifetime access now keeps permanent access through future updates and product changes.",
      },
    },
  ],
};

export default function FAQPage() {
  return (
    <main className="arena-landing min-h-screen overflow-hidden bg-[#020202] text-white">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />
      <section className="arena-column-bg border-b border-white/10">
        <div className="mx-auto max-w-7xl px-5 py-16 md:px-8 md:py-20">
          <p className="arena-kicker">Help Center</p>
          <h1 className="arena-headline mt-5 max-w-4xl text-5xl uppercase leading-[0.92] md:text-7xl">
            Questions players ask before stepping into court.
          </h1>
          <p className="mt-6 max-w-3xl text-lg leading-8 text-white/68 md:text-xl md:leading-9">
            A quick guide to the AI lawyer game: how client interviews work, how
            court arguments work, and what to expect when you open a case.
          </p>
        </div>
      </section>

      <FAQ
        eyebrow="Support"
        title="Frequently Asked Questions"
        intro="If you are wondering how AI client interviews, case access, court arguments, or replays work, the answers are here."
      />
    </main>
  );
}
