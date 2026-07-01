import Link from "next/link";
import * as HeroIcons from "@heroicons/react/24/outline";
import ContactForm from "@/components/legal-arena/ContactForm";
import { getSEOTags } from "@/libs/seo";
import config from "@/config";

export const metadata = getSEOTags({
  title: "Contact Legal Arena",
  description:
    "Contact the Legal Arena team for support, billing questions, partnerships, product feedback, or account help.",
  canonicalUrlRelative: "/contact",
  openGraph: {
    title: "Contact Legal Arena",
    description:
      "Reach the Legal Arena team about support, billing, partnerships, feedback, or account help.",
    url: `https://${config.domainName}/contact`,
  },
});

const contactReasons = [
  "Account and billing",
  "Gameplay support",
  "Bug reports",
  "Partnerships",
];

const contactSchema = {
  "@context": "https://schema.org",
  "@type": "ContactPage",
  name: "Contact Legal Arena",
  url: `https://${config.domainName}/contact`,
  description:
    "Contact page for Legal Arena support, account help, billing questions, feedback, partnerships, and press.",
  publisher: {
    "@type": "Organization",
    name: config.appName,
    url: `https://${config.domainName}/`,
  },
};

export default function ContactPage() {
  return (
    <main className="arena-landing min-h-screen overflow-hidden bg-[#020202] text-white">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(contactSchema) }}
      />

      <section className="arena-column-bg border-b border-white/10">
        <div className="mx-auto grid min-h-[calc(100vh-5rem)] max-w-6xl gap-8 px-5 py-12 md:px-8 md:py-16 lg:grid-cols-[minmax(0,0.88fr)_minmax(25rem,0.72fr)] lg:items-center">
          <div className="max-w-2xl">
            <Link
              href="/"
              className="arena-pill inline-flex items-center gap-2 px-4 py-2 text-sm"
            >
              <HeroIcons.ArrowLeftIcon className="h-4 w-4" aria-hidden="true" />
              Legal Arena
            </Link>
            <p className="arena-kicker mt-10">Contact Us</p>
            <h1 className="arena-headline mt-5 max-w-3xl text-5xl uppercase leading-[0.92] md:text-6xl xl:text-7xl">
              Tell us what needs attention.
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-8 text-white/68 md:text-xl md:leading-9">
              Send a short note about support, billing, feedback, bugs, or
              partnerships. It lands in our admin queue and gets routed from
              there.
            </p>

            <div className="mt-9 grid max-w-xl gap-3 sm:grid-cols-2">
              {contactReasons.map((reason) => (
                <div
                  key={reason}
                  className="flex items-center gap-3 rounded-2xl border border-white/10 bg-black/30 px-4 py-3"
                >
                  <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-amber-100/18 bg-amber-100/10 text-amber-100">
                    <HeroIcons.CheckIcon className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <p className="text-sm font-semibold leading-6 text-white/78">{reason}</p>
                </div>
              ))}
            </div>
          </div>

          <div>
            <ContactForm />
          </div>
        </div>
      </section>
    </main>
  );
}
