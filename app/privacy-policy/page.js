import Link from "next/link";
import * as HeroIcons from "@heroicons/react/24/outline";
import { getSEOTags } from "@/libs/seo";
import config from "@/config";

export const metadata = getSEOTags({
  title: `Privacy Policy | ${config.appName}`,
  description: `Privacy policy for ${config.appName}.`,
  canonicalUrlRelative: "/privacy-policy",
});

const sections = [
  {
    title: "1. Information We Collect",
    body:
      "We may collect information you provide directly, including name, email, contact messages, account information, and payment-related information needed to provide access. Payment details are processed by trusted third-party payment providers.",
  },
  {
    title: "2. Product and Usage Data",
    body:
      "We may collect browser type, device information, gameplay interactions, page views, analytics events, cookies, AI feature usage and token counts, and similar signals. When you sign in, analytics activity may be associated with your account identifier across sessions and devices so we can understand journeys, attribution, product performance, and pricing needs.",
  },
  {
    title: "3. How We Use Information",
    body:
      "We use information to operate Legal Arena, process access and payments, respond to support requests, improve game systems, detect abuse, send important updates, and maintain account security.",
  },
  {
    title: "4. Data Sharing",
    body:
      "We do not sell your personal information. We may share limited data with service providers that help us run the product, such as authentication, payment, analytics, hosting, database, and email infrastructure providers.",
  },
  {
    title: "5. Children's Privacy",
    body:
      "Legal Arena is not intended for children under the age of 13. We do not knowingly collect personal information from children under 13.",
  },
  {
    title: "6. Updates to This Policy",
    body:
      "We may update this Privacy Policy as the product changes. Significant updates may be posted on this page or sent by email.",
  },
  {
    title: "7. Contact and Requests",
    body:
      "For privacy questions, correction requests, deletion requests, or account concerns, send a message through the contact page.",
  },
];

export default function PrivacyPolicyPage() {
  return (
    <main className="arena-landing min-h-screen overflow-hidden bg-[#020202] text-white">
      <section className="arena-column-bg border-b border-white/10">
        <div className="mx-auto max-w-5xl px-5 py-14 md:px-8 md:py-20">
          <Link href="/" className="arena-pill inline-flex items-center gap-2 px-4 py-2 text-sm">
            <HeroIcons.ArrowLeftIcon className="h-4 w-4" aria-hidden="true" />
            Legal Arena
          </Link>

          <p className="arena-kicker mt-10">Privacy</p>
          <h1 className="arena-headline mt-5 max-w-4xl text-5xl uppercase leading-[0.92] md:text-7xl">
            Privacy Policy
          </h1>
          <p className="mt-6 max-w-3xl text-lg leading-8 text-white/66">
            Last updated: July 14, 2026. This page explains how Legal Arena collects,
            uses, and protects information.
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

            <div className="mt-6 rounded-2xl border border-emerald-200/15 bg-emerald-300/10 p-5 text-sm leading-7 text-emerald-50/82">
              Need help with a privacy request? Use the{" "}
              <Link href="/contact" className="font-semibold text-emerald-100 underline underline-offset-4">
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
