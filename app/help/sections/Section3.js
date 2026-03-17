import Link from "next/link";

export default function Section3({ id }) {
  return (
    <div id={id} className="scroll-mt-28">
      <h2>{`Courtroom Playbook`}</h2>
      <p>
        {`After the fact sheet is finalized, Legal Arena shifts from investigation to advocacy. The courtroom stage is a freeform exchange where you submit arguments in rounds, respond to the opponent, and try to move the hidden bench in your favor.`}
      </p>
      <ol>
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
      </ol>

      <h3>{`After the ruling`}</h3>
      <p>
        {`When the case ends, the verdict screen explains who prevailed, what landed, and what still hurt your side. Use that feedback as a study tool, not just a scoreboard.`}
      </p>
      <ul>
        <li>{`Review the highlights to see which parts of your theory persuaded the court.`}</li>
        <li>{`Review the concerns to find repeated weaknesses in your approach.`}</li>
        <li>{`Check the dashboard leaderboards to measure improvement across overall and category-specific play.`}</li>
        <li>{`Replay different matters in the same specialty to strengthen pattern recognition.`}</li>
      </ul>

      <div className="alert mt-6 border border-base-300 bg-base-200">
        <span className="text-sm leading-relaxed">
          <strong className="font-medium text-base-content">Next stop:</strong>{" "}
          If you still have questions about access, replays, or how sessions are assigned,
          the{" "}
          <Link href="/faq" className="link link-primary">
            FAQ
          </Link>{" "}
          covers the most common player questions.
        </span>
      </div>
    </div>
  );
}
