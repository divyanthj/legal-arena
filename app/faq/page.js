import FAQ from "@/components/FAQ";

export const metadata = {
  title: "FAQ",
  description:
    "Answers to common questions about Legal Arena, including access, case flow, replay rules, and side assignment.",
};

export default function FAQPage() {
  return (
    <main className="min-h-screen bg-base-200">
      <section className="border-b border-base-300 bg-base-100/90">
        <div className="mx-auto max-w-7xl px-8 py-16">
          <p className="text-sm uppercase tracking-[0.3em] text-base-content/45">
            Help Center
          </p>
          <h1 className="mt-4 font-serif text-5xl leading-tight text-base-content md:text-6xl">
            Questions players ask before stepping into court.
          </h1>
          <p className="mt-5 max-w-3xl text-lg leading-8 text-base-content/75">
            A quick guide to how Legal Arena works, how access is handled, and what
            to expect when you open a case.
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
