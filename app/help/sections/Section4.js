import Link from "next/link";

export default function Section4({ id }) {
  return (
    <section id={id} className="arena-surface scroll-mt-28">
      <div className="p-6 md:p-8">
        <p className="arena-kicker">04</p>
        <h2 className="arena-headline mt-2 text-3xl">{`Asynchronous PVP Cases`}</h2>
        <p className="mt-4 text-base leading-8 text-white/72">
          {`Player-versus-player cases let you challenge another Legal Arena player to argue opposite sides of the same dispute. You do not both need to be online at the same time. A challenge can unfold over hours as each player returns, prepares, and files their next move.`}
        </p>
        <p className="mt-5 text-base leading-8 text-white/72">
          {`Think of it like a slow-burn courtroom match: each side gets time to build a private file, then both lawyers meet in court through timed rounds that reveal arguments only when the round is ready.`}
        </p>

        <ol className="mt-6 space-y-4 pl-6 text-base leading-8 text-white/72">
          <li>
            <strong>{`Challenge from a player profile:`}</strong>{" "}
            {`Open another player's dossier and use the challenge button there. You choose one of your unlocked cases, then send the invite. The challenged player receives a link and can accept when they are ready.`}
          </li>
          <li>
            <strong>{`One player can sponsor the match:`}</strong>{" "}
            {`The player who sends the challenge provides access for that match. The other player can accept and play that specific PVP case even if they have not purchased full access yet.`}
          </li>
          <li>
            <strong>{`Each side gets a private intake:`}</strong>{" "}
            {`Before court, you interview your own side and build your own fact sheet. Your opponent does the same separately. This keeps preparation strategic: you know your file, but you do not automatically know what the other lawyer discovered or missed.`}
          </li>
          <li>
            <strong>{`Courtroom rounds are simultaneous:`}</strong>{" "}
            {`When both players are ready for court, each round lets both sides submit an argument. If you submit first, your argument is filed but your opponent does not see it yet. Once both sides have submitted, the round is revealed and scored.`}
          </li>
          <li>
            <strong>{`The match can take place over hours:`}</strong>{" "}
            {`You can step away between stages. Check back when your opponent accepts, finishes intake, or files the next courtroom argument. PVP is meant to feel thoughtful rather than rushed.`}
          </li>
          <li>
            <strong>{`PVP has its own record:`}</strong>{" "}
            {`Challenge wins, losses, and draws are tracked separately from your solo case record. That way your practice against AI and your head-to-head matches each tell their own story.`}
          </li>
        </ol>

        <h3 className="mt-8 text-2xl font-semibold text-white">{`How to play a strong PVP match`}</h3>
        <ul className="mt-5 space-y-3 pl-6 text-base leading-8 text-white/72">
          <li>{`Use private intake to find proof, pressure points, and risks before your opponent can force the issue in court.`}</li>
          <li>{`Do not assume your opponent has the same file. Their side may have different strengths, different weak spots, and a different story to tell.`}</li>
          <li>{`When a round is revealed, read both arguments carefully before writing the next one. The best PVP turns answer the other lawyer directly while still advancing your own theory.`}</li>
          <li>{`If your opponent files first, take the time to sharpen your response. Asynchronous play rewards patience and clean thinking.`}</li>
        </ul>

        <div className="arena-surface-soft mt-6 border border-white/10 p-4">
          <span className="text-sm leading-7 text-white/70">
            <strong className="font-medium text-white">Good to know:</strong>{" "}
            PVP challenges are sent from player profiles. Visit the{" "}
            <Link href="/dashboard" className="text-white underline underline-offset-4">
              dashboard
            </Link>{" "}
            to find players through the leaderboards, then open a profile to start a
            challenge.
          </span>
        </div>
      </div>
    </section>
  );
}
