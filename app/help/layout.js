import { Suspense } from "react";
import HelpHeader from "@/components/HelpHeader";
import { getSEOTags } from "@/libs/seo";
import config from "@/config";
import Sidebar from "./sidebar";

const links = [
  { href: "#getting-started", label: "Getting Started" },
  { href: "#building-your-file", label: "Building Your File" },
  { href: "#settlement-strategy", label: "Settlement Strategy" },
  { href: "#courtroom-playbook", label: "Courtroom Playbook" },
  { href: "#asynchronous-pvp-cases", label: "Async PVP Cases" },
  { href: "#country-settings", label: "Country Settings" },
  { href: "#ratings-xp-leaderboards", label: "Ratings, XP & Boards" },
];

export async function generateMetadata() {
  return getSEOTags({
    title: `Help Center & Tutorials | ${config.appName}`,
    description:
      "Detailed tutorials for the Legal Arena lawyer game. Learn how to choose a country and dispute, build a fact sheet, negotiate settlements, argue in court, challenge other players, and understand ratings, XP, and leaderboards.",
    keywords: [
      "Legal Arena help",
      "Legal Arena tutorials",
      "lawyer game guide",
      "courtroom game guide",
      "fact sheet tutorial",
      "settlement tutorial",
      "lawbook guide",
      "PVP case guide",
      "leaderboard guide",
      "country case settings",
    ],
    canonicalUrlRelative: "/help",
    openGraph: {
      title: `Help Center & Tutorials | ${config.appName}`,
      description:
        "Detailed tutorials for Legal Arena covering country-aware case selection, intake, fact sheets, settlements, courtroom rounds, PVP challenges, verdicts, and progression.",
    },
  });
}

export default function HelpLayout({ children }) {
  return (
    <>
      <Suspense
        fallback={<div className="arena-app-shell px-8 py-4 text-white">Loading help...</div>}
      >
        <HelpHeader links={links} />
      </Suspense>

      <main className="arena-app-shell min-h-screen px-4 py-6 md:px-8 md:py-8">
        <section className="mx-auto grid max-w-[1204px] gap-6 xl:grid-cols-[280px_minmax(0,900px)]">
          <div className="hidden xl:block">
            <div className="sticky top-8 h-fit">
              <Sidebar links={links} />
            </div>
          </div>

          <div className="min-w-0 overflow-x-hidden">{children}</div>
        </section>
      </main>
    </>
  );
}
