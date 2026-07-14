import Link from "next/link";
import HelpScreenshot from "../components/HelpScreenshot";

export default function Section1({ id }) {
  return (
    <section id={id} className="arena-surface scroll-mt-28">
      <div className="p-6 md:p-8">
      <p className="arena-kicker">01</p>
      <h2 className="arena-headline mt-2 text-3xl">{`Getting Started`}</h2>
      <p className="mt-4 text-base leading-8 text-white/72">
        {`Legal Arena is built around a repeatable loop: choose a country, practice area, and pressure level; generate a fresh dispute; interview your side; build a usable fact sheet; then settle or argue the matter in court.`}
      </p>
      <p className="mt-5 text-base leading-8 text-white/72">
        {`If you are opening the app for the first time, this section will help you understand what each stage is for and how to get into a case quickly without wasting early turns.`}
      </p>
      <ol className="mt-6 space-y-4 pl-6 text-base leading-8 text-white/72">
        <li>
          <strong>{`Sign in and open the dashboard:`}</strong>{" "}
          {`After access is granted, head to the `}
          <Link href="/dashboard" className="text-white underline underline-offset-4">
            dashboard
          </Link>
          {`. This is your case hub, leaderboard view, and progression screen.`}
        </li>
        <li>
          <strong>{`Choose the case country:`}</strong>{" "}
          {`The selected country shapes the names, setting, institutions, currency, dispute details, and portraits used in newly generated matters. Search the flag grid or select a flag directly. Your choice is saved to your player profile.`}
        </li>
        <li>
          <strong>{`Choose a practice area and pressure level:`}</strong>{" "}
          {`Pick the kind of dispute you want, then choose the available complexity. Country changes the cultural setting; pressure level controls how many issues, contradictions, proof gaps, and tactical decisions the matter contains.`}
        </li>
        <li>
          <strong>{`Use Ready, Stretch, and Locked as your guide:`}</strong>{" "}
          {`Your overall player level and experience in the selected practice area determine the pressure levels available to you. Ready levels sit within your current range, Stretch is one level above it, and higher levels remain locked until your record develops.`}
        </li>
        <li>
          <strong>{`Know that side assignment matters:`}</strong>{" "}
          {`A session can place you on either side of the dispute. Once the case opens, Legal Arena clearly tells you which party you represent so you can question your client and frame your theory from the correct angle.`}
        </li>
      </ol>
      <div className="arena-surface-soft mt-6 border border-emerald-300/20 bg-emerald-300/[0.055] p-4">
        <span className="text-sm leading-7 text-white/72">
          <strong className="font-medium text-white">Cases are unlimited:</strong>{" "}
          Starting a case generates a new matter with a new combination of parties, facts,
          evidence, risks, and tactical openings. You do not need to wait for an old case card
          or a replay cooldown before generating another one.
        </span>
      </div>
      <HelpScreenshot
        src="/help/screenshots/case-selection.png"
        alt="Legal Arena case selection panel showing the country selector, practice areas, pressure levels, and case preview"
        title="Case selection panel"
        caption="Choose the country first, then the practice area and an available pressure level. The preview confirms the setting before a fresh matter is generated."
      />
      <div className="arena-surface-soft mt-6 border border-white/10 p-4">
        <span className="text-sm leading-7 text-white/70">
          <strong className="font-medium text-white">Tip:</strong>{" "}
          Completing verdicts and settlements builds XP and practice-area progress. Staying
          in one area for a few matters is the quickest way to learn its recurring proof and
          strategy patterns, but you can generate a case in any available category.
        </span>
      </div>
      <p className="mt-5 text-base leading-8 text-white/72">
        {`Once you start a case, the game moves into intake mode. That stage is where strong runs are usually won or lost, so begin with a matter whose facts you can read carefully and question patiently.`}
      </p>
      </div>
    </section>
  );
}
