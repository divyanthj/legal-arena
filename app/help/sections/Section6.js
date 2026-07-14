import Link from "next/link";
import HelpScreenshot from "../components/HelpScreenshot";

export default function Section6({ id }) {
  return (
    <section id={id} className="arena-surface scroll-mt-28">
      <div className="p-6 md:p-8">
        <p className="arena-kicker">06</p>
        <h2 className="arena-headline mt-2 text-3xl">{`Country Settings and Generated Cases`}</h2>
        <p className="mt-4 text-base leading-8 text-white/72">
          {`Country selection gives a newly generated matter a recognizable local setting without turning Legal Arena into a claim of exact real-world legal advice. It affects the world around the dispute while the game's lawbook and progression rules remain consistent.`}
        </p>

        <ol className="mt-6 space-y-4 pl-6 text-base leading-8 text-white/72">
          <li>
            <strong>{`Your first selection is automatic when possible:`}</strong>{" "}
            {`If you have never chosen a country, Legal Arena uses the country signal supplied by its hosting platform. If that signal is unavailable, the selector starts with the United States.`}
          </li>
          <li>
            <strong>{`Your manual choice persists:`}</strong>{" "}
            {`Selecting India, the United States, or any other supported country saves that choice to your player profile. It remains selected after reloads and across devices. A browser copy is also kept as a fallback.`}
          </li>
          <li>
            <strong>{`The country is locked when a matter is created:`}</strong>{" "}
            {`Changing your profile preference affects future matters only. A case already in intake, settlement, or court keeps the country it started with so names, currency, evidence, dialogue, and portraits do not drift.`}
          </li>
          <li>
            <strong>{`Country and complexity do different jobs:`}</strong>{" "}
            {`A culturally recognizable Indian relationship dispute or a U.S. property dispute can appear at a low pressure level. Higher complexity adds more contested intent, evidence, witnesses, contradictions, and strategic risk; it is not required to unlock local themes.`}
          </li>
          <li>
            <strong>{`Cases stay fictionalized and playable:`}</strong>{" "}
            {`Generated matters use plausible names, courts, occupations, records, communication habits, social settings, and dispute triggers. They remain in English, avoid invented statute numbers and cultural caricatures, and do not promise exact legal accuracy for the selected country.`}
          </li>
          <li>
            <strong>{`Flags follow the matter into your record:`}</strong>{" "}
            {`The selected flag and country appear in previews, active workspaces, PVP briefs, dockets, and lawyer-profile archives for new matters. In lawyer-profile archives, older completed matters created before country selection was introduced are presented as United States matters.`}
          </li>
        </ol>

        <HelpScreenshot
          src="/help/screenshots/country-picker.png"
          alt="Legal Arena country picker expanded into a searchable matrix of country flags"
          title="Country flag picker"
          caption="Search by country name or scan the flag matrix. The selected country is confirmed above the grid and becomes the default for future generated matters."
        />

        <h3 className="mt-8 text-2xl font-semibold text-white">{`Performance and data`}</h3>
        <p className="mt-4 text-base leading-8 text-white/72">
          {`Fresh case generation uses faster processing where available, but a detailed matter can still take a moment to build. Legal Arena records operational AI usage such as model, feature, processing tier, token counts, and latency to improve reliability and plan fair future pricing. The usage ledger does not store raw prompts or generated responses.`}
        </p>
        <p className="mt-4 text-base leading-8 text-white/72">
          {`When you are signed in, analytics activity may be connected to your account identifier so journeys work across sessions and devices. Read the `}
          <Link href="/privacy-policy" className="text-white underline underline-offset-4">
            Privacy Policy
          </Link>
          {` for the current disclosure and contact options.`}
        </p>

        <div className="arena-surface-soft mt-6 border border-white/10 p-4">
          <span className="text-sm leading-7 text-white/70">
            <strong className="font-medium text-white">Troubleshooting:</strong>{" "}
            If the wrong country appears, select the correct flag once while signed in and
            reload the dashboard. The saved profile choice should then override automatic
            location detection.
          </span>
        </div>
      </div>
    </section>
  );
}
