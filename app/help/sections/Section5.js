import Link from "next/link";
import HelpScreenshot from "../components/HelpScreenshot";

export default function Section5({ id }) {
  return (
    <section id={id} className="arena-surface scroll-mt-28">
      <div className="p-6 md:p-8">
        <p className="arena-kicker">05</p>
        <h2 className="arena-headline mt-2 text-3xl">{`Asynchronous PVP Cases`}</h2>
        <p className="mt-4 text-base leading-8 text-white/72">
          {`Player-versus-player cases let you challenge another Legal Arena player to argue opposite sides of the same dispute. You do not both need to be online at the same time. A challenge can unfold over hours as each player returns, prepares, and files their next move.`}
        </p>
        <p className="mt-5 text-base leading-8 text-white/72">
          {`Think of it like a slow-burn courtroom match: each side builds a private file, then the lawyers take turns filing arguments in timed courtroom rounds.`}
        </p>

        <ol className="mt-6 space-y-4 pl-6 text-base leading-8 text-white/72">
          <li>
            <strong>{`Challenge from a player profile:`}</strong>{" "}
            {`Open another player's dossier and use the challenge button there. Choose the country, case type, and pressure level, then send the invite. A pending invitation expires after seven days if it is not accepted.`}
          </li>
          <li>
            <strong>{`The sponsor locks the country for both sides:`}</strong>{" "}
            {`The country selected by the player sending the challenge becomes part of that matter. Both players receive culturally consistent names, setting, currency, institutions, and portraits, and neither side can change the country after the challenge is created.`}
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
            <strong>{`Courtroom rounds are turn-based:`}</strong>{" "}
            {`Court opens after both fact sheets are finalized. The plaintiff files the first opening, the defendant responds, and each player may file once per round. When both sides have filed, the round is judged and the next round opens if the case is not finished.`}
          </li>
          <li>
            <strong>{`Watch the courtroom response clock:`}</strong>{" "}
            {`The workspace shows a 24-hour response window during court. Activity refreshes the deadline. If time expires, the court prepares a timeout verdict from the arguments already filed; if neither side filed, the result is a draw.`}
          </li>
          <li>
            <strong>{`Adjournment reopens both private files:`}</strong>{" "}
            {`When the judge grants an adjournment, the response clock stops and both lawyers return to private intake. Filed arguments and scores remain on the record, and court resumes only after both lawyers re-finalize their fact sheets.`}
          </li>
          <li>
            <strong>{`Settlement is available before court:`}</strong>{" "}
            {`A player can send settlement intent after receiving authority from their own client. The other lawyer must obtain authority from their client before negotiations open, and messages then alternate between the two players.`}
          </li>
          <li>
            <strong>{`Quitting is a forfeit:`}</strong>{" "}
            {`Leaving an active PVP intake, settlement, or courtroom match awards the other player the win. Use the docket to wait for the next action instead of quitting when the opponent is offline.`}
          </li>
          <li>
            <strong>{`PVP has its own record:`}</strong>{" "}
            {`Challenge wins, losses, draws, and settlements are stored in dedicated PVP stats. Public profile totals and leaderboards can combine solo and PVP performance, while the PVP docket preserves the head-to-head history.`}
          </li>
        </ol>

        <HelpScreenshot
          src="/help/screenshots/pvp-docket.png"
          alt="Legal Arena PVP docket showing response, sent, intake, settlement, court, and finished match filters"
          title="PVP docket"
          caption="Use the status filters to find the match that needs you. Needs Response and In Court are the most time-sensitive views; Finished keeps completed challenges available for review."
        />

        <h3 className="mt-8 text-2xl font-semibold text-white">{`How to play a strong PVP match`}</h3>
        <ul className="mt-5 space-y-3 pl-6 text-base leading-8 text-white/72">
          <li>{`Use private intake to find proof, pressure points, and risks before your opponent can force the issue in court.`}</li>
          <li>{`Do not assume your opponent has the same file. Their side may have different strengths, different weak spots, and a different story to tell.`}</li>
          <li>{`When a round is revealed, read both arguments carefully before writing the next one. The best PVP turns answer the other lawyer directly while still advancing your own theory.`}</li>
          <li>{`When it is your turn, answer the filed argument directly while advancing your own theory. Asynchronous play rewards patience and clean thinking.`}</li>
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
