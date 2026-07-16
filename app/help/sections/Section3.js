import Link from "next/link";
import HelpScreenshot from "../components/HelpScreenshot";

export default function Section3({ id }) {
  return (
    <section id={id} className="arena-surface scroll-mt-28">
      <div className="p-6 md:p-8">
      <p className="arena-kicker">04</p>
      <h2 className="arena-headline mt-2 text-3xl">{`Courtroom Playbook`}</h2>
      <p className="mt-4 text-base leading-8 text-white/72">
        {`Finalizing the fact sheet moves a solo matter directly into court. The courtroom stage is a freeform exchange where you submit arguments in rounds, answer AI opposing counsel, and respond to the judge's feedback until the matter reaches a verdict.`}
      </p>
      <ol className="mt-6 space-y-4 pl-6 text-base leading-8 text-white/72">
        <li>
          <strong>{`Open with your cleanest theory:`}</strong>{" "}
          {`Your first argument should connect the best facts in your file to the relief you want. Do not spend the opening turn on background noise if the decisive point is already clear.`}
        </li>
        <li>
          <strong>{`Use the lawbook on the right:`}</strong>{" "}
          {`Each case includes a set of rules in play. Tie your argument to those principles whenever possible. The game tracks whether you rely on the governing rules instead of arguing from vibes alone.`}
        </li>
        <li>
          <strong>{`Read the bench signal after every round:`}</strong>{" "}
          {`The bench signal hints at what just landed or what still feels weak. Treat it like courtroom feedback: tighten your next turn around the signal instead of repeating the same pitch.`}
        </li>
        <li>
          <strong>{`Answer the opponent directly:`}</strong>{" "}
          {`Pressure rises when you confront the other side's best point, explain why it fails, and return to your own theory. Ignoring the live dispute usually leads to weaker rounds.`}
        </li>
        <li>
          <strong>{`Argue from the file you built:`}</strong>{" "}
          {`The transcript and scoring are stronger when you lean on corroborated facts, acknowledge risks honestly, and avoid over-claiming unsupported details.`}
        </li>
        <li>
          <strong>{`Use adjournment for a curable gap:`}</strong>{" "}
          {`You may ask the judge to reopen intake when a specific missing fact, clarification, witness detail, or obtainable record could materially change the case. A denied request does not consume your argument turn. The judge may also adjourn after identifying the same kind of gap.`}
        </li>
      </ol>

      <HelpScreenshot
        src="/help/screenshots/courtroom.png"
        alt="Legal Arena PVP courtroom showing represented parties, persuasion scores, judge signal, focus points, and match status"
        title="Courtroom and judge signal"
        caption="Keep the represented parties straight, watch the judge signal, and use the focus points to answer the live dispute instead of repeating your opening theory."
      />

      <h3 className="mt-8 text-2xl font-semibold text-white">{`After the ruling`}</h3>
      <p className="mt-4 text-base leading-8 text-white/72">
        {`When the case ends, the verdict screen explains who prevailed, what landed, and what still hurt your side. Use that feedback as a study tool, not just a scoreboard.`}
      </p>
      <ul className="mt-5 space-y-3 pl-6 text-base leading-8 text-white/72">
        <li>{`Review the highlights to see which parts of your theory persuaded the court.`}</li>
        <li>{`Review the concerns to find repeated weaknesses in your approach.`}</li>
        <li>{`Check the dashboard leaderboards to measure improvement across overall and category-specific play.`}</li>
        <li>{`Generate more fresh matters in the same specialty to strengthen pattern recognition.`}</li>
        <li>{`If you choose to publish a case report, review it as a public account of the completed simulation. PVP reports require both players' consent.`}</li>
      </ul>

      <div className="arena-surface-soft mt-6 border border-white/10 p-4">
        <span className="text-sm leading-7 text-white/70">
          <strong className="font-medium text-white">Next stop:</strong>{" "}
          If you still have questions about access, generated cases, or side assignment,
          the{" "}
          <Link href="/faq" className="text-white underline underline-offset-4">
            FAQ
          </Link>{" "}
          covers the most common player questions.
        </span>
      </div>
      </div>
    </section>
  );
}
