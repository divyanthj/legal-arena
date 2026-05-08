import { Suspense } from "react";
import HelpHeader from "@/components/HelpHeader";
import { getSEOTags } from "@/libs/seo";
import config from "@/config";
import Sidebar from "./sidebar";

const links = [
  { href: "#getting-started", label: "Getting Started" },
  { href: "#building-your-file", label: "Building Your File" },
  { href: "#courtroom-playbook", label: "Courtroom Playbook" },
];

export async function generateMetadata() {
  return getSEOTags({
    title: `Help Center & Tutorials | ${config.appName}`,
    description:
      "Detailed tutorials for the Legal Arena lawyer game. Learn how to choose a dispute, build a fact sheet, argue in court, and improve your courtroom results.",
    keywords: [
      "Legal Arena help",
      "Legal Arena tutorials",
      "lawyer game guide",
      "courtroom game guide",
      "fact sheet tutorial",
      "lawbook guide",
      "leaderboard guide",
    ],
    canonicalUrlRelative: "/help",
    openGraph: {
      title: `Help Center & Tutorials | ${config.appName}`,
      description:
        "Detailed tutorials for Legal Arena covering case selection, intake, fact sheets, courtroom rounds, verdicts, and progression.",
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
        <section className="mx-auto grid max-w-[1600px] gap-6 xl:grid-cols-[280px_minmax(0,1fr)]">
          <div className="hidden xl:block">
            <div className="sticky top-8 h-fit">
              <Sidebar links={links} />
            </div>
          </div>

          <div className="flex-1 overflow-x-hidden">{children}</div>
        </section>
      </main>
    </>
  );
}
