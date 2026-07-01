import Link from "next/link";
import * as HeroIcons from "@heroicons/react/24/outline";
import { getSEOTags } from "@/libs/seo";
import config from "@/config";

export const metadata = getSEOTags({
  title: `Terms and Conditions | ${config.appName}`,
  description: `Terms and conditions for using ${config.appName}.`,
  canonicalUrlRelative: "/tos",
});

const sections = [
  {
    title: "1. Description of Legal Arena",
    body:
      "Legal Arena is a legal strategy game and training simulator that provides interactive case simulations, client-intake exercises, case-building workflows, and simulated courtroom practice tools.",
  },
  {
    title: "2. Ownership and Usage Rights",
    body:
      "When you purchase or use Legal Arena, you receive access to the platform and its features for your own personal or internal use. You may not resell, repackage, redistribute, scrape, or commercially exploit the platform, generated case content, or underlying product experience without permission.",
  },
  {
    title: "3. User Data and Privacy",
    body:
      "We collect and store user data such as name, email, account activity, and payment-related information as necessary to provide the service. Payment details are handled by third-party payment providers. For more detail, review the Privacy Policy.",
  },
  {
    title: "4. Cookies and Analytics",
    body:
      "We may use cookies and analytics tools to understand product usage, improve reliability, monitor performance, and make the experience better for players.",
  },
  {
    title: "5. No Legal Advice",
    body:
      "Legal Arena is a game and training simulator. It is not a lawyer, law firm, legal advice service, or substitute for hiring a licensed attorney for a real dispute.",
  },
  {
    title: "6. Governing Law",
    body:
      "These Terms are governed by the laws of France, unless another jurisdiction is required by applicable consumer protection law.",
  },
  {
    title: "7. Updates to the Terms",
    body:
      "We may update these Terms from time to time. When changes are material, we may notify users by email or through the product.",
  },
];

export default function TermsPage() {
  return (
    <main className="arena-landing min-h-screen overflow-hidden bg-[#020202] text-white">
      <section className="arena-column-bg border-b border-white/10">
        <div className="mx-auto max-w-5xl px-5 py-14 md:px-8 md:py-20">
          <Link href="/" className="arena-pill inline-flex items-center gap-2 px-4 py-2 text-sm">
            <HeroIcons.ArrowLeftIcon className="h-4 w-4" aria-hidden="true" />
            Legal Arena
          </Link>

          <p className="arena-kicker mt-10">Legal</p>
          <h1 className="arena-headline mt-5 max-w-4xl text-5xl uppercase leading-[0.92] md:text-7xl">
            Terms and Conditions
          </h1>
          <p className="mt-6 max-w-3xl text-lg leading-8 text-white/66">
            Last updated: March 15, 2026. These terms govern your use of Legal Arena.
          </p>

          <article className="arena-surface mt-10 p-5 md:p-8">
            <div className="space-y-5">
              {sections.map((section) => (
                <section
                  key={section.title}
                  className="rounded-2xl border border-white/10 bg-black/25 p-5"
                >
                  <h2 className="text-lg font-semibold text-white">{section.title}</h2>
                  <p className="mt-3 text-sm leading-7 text-white/62 md:text-base">
                    {section.body}
                  </p>
                </section>
              ))}
            </div>

            <div className="mt-6 rounded-2xl border border-amber-100/15 bg-amber-100/10 p-5 text-sm leading-7 text-amber-50/82">
              Questions about these Terms? Use the{" "}
              <Link href="/contact" className="font-semibold text-amber-100 underline underline-offset-4">
                contact page
              </Link>
              .
            </div>
          </article>
        </div>
      </section>
    </main>
  );
}
