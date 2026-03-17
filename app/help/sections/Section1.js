import Link from "next/link";

export default function Section1({ id }) {
  return (
    <div id={id} className="scroll-mt-28">
      <h2>{`Getting Started`}</h2>
      <p>
        {`Legal Arena is a courtroom training game built around one repeatable loop: choose a dispute, interview your side, build a usable fact sheet, and then argue the matter in open text against AI-powered opposing counsel.`}
      </p>
      <p>
        {`If you are opening the app for the first time, this section will help you understand what each stage is for and how to get into a case quickly without wasting early turns.`}
      </p>
      <ol>
        <li>
          <strong>{`Sign in and open the dashboard:`}</strong>{" "}
          {`After access is granted, head to the `}
          <Link href="/dashboard" className="link link-primary">
            dashboard
          </Link>
          {`. This is your case hub, leaderboard view, and progression screen.`}
        </li>
        <li>
          <strong>{`Choose a category first:`}</strong>{" "}
          {`The dashboard groups matters by specialty. Picking a category filters the live case library and helps you focus on the practice area where you want to build rating and unlock tougher complexity tiers.`}
        </li>
        <li>
          <strong>{`Read the case card before you click Start Case:`}</strong>{" "}
          {`Each dispute shows its practice area, category, complexity, court, overview, and the parties involved. Use that preview to decide whether you want a straightforward warm-up or a higher-pressure matter.`}
        </li>
        <li>
          <strong>{`Watch the unlock message:`}</strong>{" "}
          {`Some matters are gated by progression. If a case is locked, the dashboard tells you why. If you exited the same matter recently, you may also see a cooldown before it becomes available again.`}
        </li>
        <li>
          <strong>{`Know that side assignment matters:`}</strong>{" "}
          {`A session can place you on either side of the dispute. Once the case opens, Legal Arena clearly tells you which party you represent so you can question your client and frame your theory from the correct angle.`}
        </li>
      </ol>
      <div className="alert mt-6 border border-base-300 bg-base-200">
        <span className="text-sm leading-relaxed">
          <strong className="font-medium text-base-content">Tip:</strong>{" "}
          Start with a category where you already understand the rhythm of the facts.
          Progression compounds faster when you can complete matters cleanly instead of
          bouncing between unfamiliar specialties.
        </span>
      </div>
      <p>
        {`Once you start a case, the game moves into intake mode. That stage is where strong runs are usually won or lost.`}
      </p>
    </div>
  );
}
