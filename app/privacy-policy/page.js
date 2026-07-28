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
      "We collect information you provide directly, including your name, email, profile image, contact and deletion requests, account preferences, PVP submissions, reports, and gameplay activity. Payment card details are processed by Lemon Squeezy; Legal Arena receives transaction and entitlement metadata rather than complete card details.",
  },
  {
    title: "2. Voice, AI, and Generated Content",
    body:
      "When you choose microphone input, the recording is sent through Legal Arena to OpenAI for transcription and is not intentionally stored by Legal Arena after the request completes. Questions, arguments, fictional case context, and related gameplay data are processed by AI providers to generate clients, negotiations, images, and rulings. Generated content and safety-report excerpts may be stored with the relevant matter.",
  },
  {
    title: "3. Device, Analytics, and Advertising Data",
    body:
      "We collect browser and device information, IP-derived country signals, page views, gameplay events, referral and advertising attribution, cookies, AI feature usage, model names, token counts, latency, and reliability signals. DataFast, Plausible, and Google advertising services may process analytics or attribution data. Signed-in analytics may be associated with your account identifier across sessions and devices.",
  },
  {
    title: "4. How We Use Information",
    body:
      "We use information to authenticate accounts, provide solo and PVP gameplay, personalize progression, process lifetime access, restore purchases, generate and moderate content, respond to support and deletion requests, prevent fraud and abuse, send operational or opted-in messages, analyze product performance, and secure the service.",
  },
  {
    title: "5. Service Providers and Sharing",
    body:
      "We do not sell personal information. Limited data is processed by providers supporting authentication, AI and transcription, Lemon Squeezy payments, hosting, MongoDB database services, private file storage, analytics and advertising attribution, and transactional email. PVP submissions are visible to the other participant, and a case report is published only through the product's consent controls.",
  },
  {
    title: "6. Retention and Account Deletion",
    body:
      "Gameplay and account information is kept while the account is active and as needed to operate, secure, and improve Legal Arena. You can permanently delete a signed-in account from Account settings or use the public account-deletion page. Private account data is removed; shared PVP records are anonymized for the other participant; related public case reports are unpublished. Providers may retain payment or security records where legally required.",
  },
  {
    title: "7. Security and Your Choices",
    body:
      "Legal Arena uses HTTPS and limits private gameplay APIs to authenticated users. You can type instead of granting microphone access, manage browser cookies and permissions, unsubscribe from marketing email, report unsafe AI or player content, block PVP players, correct profile preferences, and request access or deletion through the available account and contact controls.",
  },
  {
    title: "8. Adults Only",
    body:
      "Legal Arena is intended for adults aged 18 and over. It includes open-ended fictional disputes and AI- and player-generated text that may address mature legal themes. We do not knowingly provide accounts to children.",
  },
  {
    title: "9. Updates and Contact",
    body:
      "We may update this policy as the product or providers change and will revise the date above. For privacy questions, correction, access, or deletion, use the contact page or the dedicated account-deletion page.",
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
            Last updated: July 28, 2026. This page explains how Legal Arena collects,
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
              {" "}or{" "}
              <Link href="/account-deletion" className="font-semibold text-emerald-100 underline underline-offset-4">
                account-deletion page
              </Link>
              .
            </div>
          </article>
        </div>
      </section>
    </main>
  );
}
