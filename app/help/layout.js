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
      "Detailed tutorials for Legal Arena. Learn how to choose a dispute, build a fact sheet, argue in court, and improve your courtroom results.",
    keywords: [
      "Legal Arena help",
      "Legal Arena tutorials",
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
      <Suspense fallback={<div className="bg-base-200 px-8 py-4">Loading help...</div>}>
        <HelpHeader links={links} />
      </Suspense>

      <main className="min-h-screen bg-base-200 p-8 pb-24">
        <section className="mx-auto flex max-w-7xl space-x-8">
          <div className="hidden lg:block lg:w-80">
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
