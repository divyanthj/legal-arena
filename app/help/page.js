import Section1 from "./sections/Section1";
import Section2 from "./sections/Section2";
import Section3 from "./sections/Section3";

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
            A practical guide to choosing disputes, building stronger fact sheets, and turning
            better intake work into better courtroom outcomes. New players can also start with
            the lawyer game overview for the shortest path into play.
          </p>
        </div>
      </section>

      <Section1 id="getting-started" />
      <Section2 id="building-your-file" />
      <Section3 id="courtroom-playbook" />
    </div>
  );
}
