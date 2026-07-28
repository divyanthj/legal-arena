import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import * as HeroIcons from "@heroicons/react/24/outline";
import { authOptions } from "@/libs/next-auth";
import {
  COMMUNITY_TERMS_VERSION,
  getCommunityTermsStatus,
} from "@/libs/communitySafety";
import CommunityTermsAcceptance from "@/components/CommunityTermsAcceptance";

export const metadata = {
  title: "Community Rules | Legal Arena",
  robots: { index: true, follow: true },
};

const rules = [
  "Keep arguments inside the fictional matter. Do not threaten, harass, shame, or target another player.",
  "Do not submit sexual exploitation, child-safety violations, hateful content, self-harm encouragement, or instructions for real-world wrongdoing.",
  "Do not reveal another person’s private information or impersonate a real lawyer, court, public official, or Legal Arena staff member.",
  "Do not spam challenges, manipulate rankings, evade blocks, or use automation that disrupts other players.",
  "Report unsafe AI or player content. Legal Arena may review relevant context and restrict accounts or content when needed.",
];

export default async function CommunityGuidelinesPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/signin?callbackUrl=/community-guidelines");
  const status = await getCommunityTermsStatus(session.user.id);

  return (
    <main className="arena-landing min-h-screen bg-[#020202] px-5 py-12 text-white md:px-8 md:py-20">
      <article className="mx-auto max-w-3xl">
        <Link href="/dashboard" className="arena-pill inline-flex items-center gap-2 px-4 py-2 text-sm">
          <HeroIcons.ArrowLeftIcon className="h-4 w-4" />
          Dashboard
        </Link>
        <p className="arena-kicker mt-10">Community safety</p>
        <h1 className="arena-headline mt-4 text-5xl uppercase md:text-7xl">Argue the case. Respect the player.</h1>
        <p className="mt-5 text-sm leading-7 text-white/62">
          Version {COMMUNITY_TERMS_VERSION}. These rules apply to PVP challenges,
          player-visible submissions, profiles, and reports.
        </p>
        <section className="arena-surface mt-8 p-5 md:p-7">
          <ol className="space-y-5">
            {rules.map((rule, index) => (
              <li key={rule} className="flex gap-4 text-sm leading-7 text-white/72">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/8 text-xs font-black">
                  {index + 1}
                </span>
                {rule}
              </li>
            ))}
          </ol>
          <div className="mt-7 border-t border-white/10 pt-6">
            <CommunityTermsAcceptance alreadyAccepted={status.accepted} />
          </div>
        </section>
      </article>
    </main>
  );
}

