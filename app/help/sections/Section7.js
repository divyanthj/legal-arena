const resultChanges = [
  { result: "Win", rating: "+18", note: "Before any underdog bonus" },
  { result: "Draw", rating: "+6", note: "A draw still improves your standing" },
  { result: "Loss", rating: "-8", note: "Rating cannot fall below 800" },
];

const underdogChanges = [
  ["40-49%", "+2"],
  ["30-39%", "+4"],
  ["20-29%", "+6"],
  ["10-19%", "+8"],
  ["0-9%", "+10"],
];

export default function Section7({ id }) {
  return (
    <section id={id} className="arena-surface scroll-mt-28">
      <div className="p-6 md:p-8">
        <p className="arena-kicker">07</p>
        <h2 className="arena-headline mt-2 text-3xl">Ratings, XP, and Leaderboards</h2>
        <p className="mt-4 text-base leading-8 text-white/72">
          Rating is your competitive standing in Legal Arena. Every player begins at 1,000.
          It is not a percentage, a real-world assessment of legal ability, or a traditional
          Elo score: the opponent&apos;s rating does not affect the points awarded.
        </p>

        <h3 className="mt-8 text-2xl font-semibold text-white">How a court verdict changes rating</h3>
        <div className="mt-5 grid gap-3 md:grid-cols-3">
          {resultChanges.map((item) => (
            <div key={item.result} className="arena-surface-soft border border-white/10 p-5">
              <p className="arena-kicker">{item.result}</p>
              <p className="mt-2 text-3xl font-semibold text-white">{item.rating}</p>
              <p className="mt-2 text-sm leading-6 text-white/58">{item.note}</p>
            </div>
          ))}
        </div>

        <p className="mt-5 text-base leading-8 text-white/72">
          A solo court verdict applies the same point change to your overall rating and to
          the specialty rating for that matter&apos;s legal category. This means a contract
          result, for example, changes both your overall standing and your contract standing.
        </p>

        <h3 className="mt-8 text-2xl font-semibold text-white">Underdog win bonus</h3>
        <p className="mt-4 text-base leading-8 text-white/72">
          When you enter court, the current success estimate is locked for that matter. If it
          is below 50% and you win, the following bonus is added on top of the normal +18:
        </p>
        <div className="mt-5 overflow-hidden rounded-2xl border border-white/10">
          <div className="grid grid-cols-2 bg-white/[0.06] px-4 py-3 text-xs font-semibold uppercase tracking-[0.16em] text-white/48">
            <span>Locked chance</span>
            <span>Bonus rating</span>
          </div>
          {underdogChanges.map(([chance, bonus]) => (
            <div
              key={chance}
              className="grid grid-cols-2 border-t border-white/10 px-4 py-3 text-sm text-white/72"
            >
              <span>{chance}</span>
              <span className="font-semibold text-emerald-300">{bonus}</span>
            </div>
          ))}
        </div>

        <div className="arena-surface-soft mt-6 border border-amber-200/20 p-5">
          <p className="font-semibold text-white">Example</p>
          <p className="mt-2 text-sm leading-7 text-white/68">
            A player at 1,000 who wins with a locked 32% success chance receives +18 for the
            win and +4 as an underdog, finishing at 1,022. Losing that matter instead would
            result in a rating of 992.
          </p>
        </div>

        <h3 className="mt-8 text-2xl font-semibold text-white">What does not change rating</h3>
        <ul className="mt-4 space-y-3 pl-6 text-base leading-8 text-white/72">
          <li>
            <strong>PVP challenge results:</strong> They count in your public PVP and combined
            record, but currently do not change your overall or specialty rating.
          </li>
          <li>
            <strong>Settlements:</strong> They count as completed matters and award XP based on
            the matter and settlement quality, but do not add or remove rating.
          </li>
          <li>
            <strong>XP:</strong> XP is a separate, cumulative progression total. It does not
            replace rating and cannot decrease when you lose.
          </li>
        </ul>

        <h3 className="mt-8 text-2xl font-semibold text-white">Why the record may not reproduce the rating</h3>
        <p className="mt-4 text-base leading-8 text-white/72">
          The profile record is shown as wins-losses-draws-settlements and combines solo and
          PVP results. Because PVP results and settlements do not change rating, and underdog
          wins can award extra points, multiplying the visible record by the standard values
          will not always reproduce the displayed rating.
        </p>

        <h3 className="mt-8 text-2xl font-semibold text-white">Leaderboard order and milestones</h3>
        <p className="mt-4 text-base leading-8 text-white/72">
          The overall leaderboard sorts players by rating first, completed matters second,
          and XP third. Specialty leaderboards use the same order within the selected legal
          category. The next rating milestone shown on your profile is a progress target; it
          does not alter the point formula when crossed.
        </p>
      </div>
    </section>
  );
}
