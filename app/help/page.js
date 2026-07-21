import Section1 from "./sections/Section1";
import Section2 from "./sections/Section2";
import Section3 from "./sections/Section3";
import Section4 from "./sections/Section4";
import Section5 from "./sections/Section5";
import Section6 from "./sections/Section6";
import Section7 from "./sections/Section7";

export default function HelpPage() {
  return (
    <div className="mx-auto space-y-6">
      <section className="arena-surface arena-scanline arena-column-bg overflow-hidden">
        <div className="p-6 md:p-8">
          <p className="arena-kicker">Arena Manual</p>
          <h1 className="arena-headline mt-3 max-w-4xl text-4xl uppercase leading-[0.92] md:text-6xl">
            Learn the arena. Build the file. Win the courtroom.
          </h1>
          <p className="mt-4 max-w-3xl text-sm leading-7 text-white/66 md:text-base">
            A practical guide to generating fresh disputes, building stronger fact sheets,
            negotiating when the deal is right, and turning better intake work into better
            courtroom outcomes.
          </p>
        </div>
      </section>

      <Section1 id="getting-started" />
      <Section2 id="building-your-file" />
      <Section4 id="settlement-strategy" />
      <Section3 id="courtroom-playbook" />
      <Section5 id="asynchronous-pvp-cases" />
      <Section6 id="country-settings" />
      <Section7 id="ratings-xp-leaderboards" />
    </div>
  );
}
