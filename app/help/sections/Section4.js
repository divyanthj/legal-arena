export default function Section4({ id }) {
  return (
    <section id={id} className="arena-surface scroll-mt-28">
      <div className="p-6 md:p-8">
        <p className="arena-kicker">03</p>
        <h2 className="arena-headline mt-2 text-3xl">{`Settlement Strategy`}</h2>
        <p className="mt-4 text-base leading-8 text-white/72">
          {`Settlement is not just haggling with the other side. In Legal Arena, it is a two-way negotiation loop: you communicate with your client, translate their goals and limits into terms, present those terms to opposing counsel, then bring the response back to your client before deciding the next move.`}
        </p>
        <p className="mt-5 text-base leading-8 text-white/72">
          {`That means you are not only trying to win a deal. You are managing trust, risk, expectations, and leverage on both sides of the conversation.`}
        </p>

        <ol className="mt-6 space-y-4 pl-6 text-base leading-8 text-white/72">
          <li>
            <strong>{`Start with your client's real interests:`}</strong>{" "}
            {`Before sending terms, understand what your client actually needs. Money, timing, confidentiality, apology language, future conduct, and certainty can matter as much as a courtroom win.`}
          </li>
          <li>
            <strong>{`Convert goals into concrete terms:`}</strong>{" "}
            {`Opposing counsel cannot accept a feeling. Turn your client's position into clear settlement terms: what is offered, what is released, what happens next, and what deadline applies.`}
          </li>
          <li>
            <strong>{`Present the offer strategically:`}</strong>{" "}
            {`When you send terms to the other side, explain why the proposal is reasonable. Use the file you built: strong facts, proof risks, litigation costs, weak spots, and what could happen if talks fail.`}
          </li>
          <li>
            <strong>{`Take responses back to the client:`}</strong>{" "}
            {`A counteroffer is not just a number to accept or reject. Read it like new information: what the other side fears, what they refuse to concede, and where your client may need to compromise.`}
          </li>
          <li>
            <strong>{`Know when to walk away:`}</strong>{" "}
            {`Settlement is useful only if the deal is better than the risk-adjusted fight. If the offer does not protect your client or gives away too much leverage, return to preparation and take the dispute to court.`}
          </li>
        </ol>

        <h3 className="mt-8 text-2xl font-semibold text-white">{`What makes a strong settlement move`}</h3>
        <ul className="mt-5 space-y-3 pl-6 text-base leading-8 text-white/72">
          <li>{`It is specific enough that both sides know exactly what happens if the deal is accepted.`}</li>
          <li>{`It protects your client from the biggest downside risk in the case.`}</li>
          <li>{`It gives opposing counsel a reason to say yes beyond simple politeness.`}</li>
          <li>{`It leaves you ready to argue in court if the other side refuses reasonable terms.`}</li>
        </ul>

        <div className="arena-surface-soft mt-6 border border-white/10 p-4">
          <span className="text-sm leading-7 text-white/70">
            <strong className="font-medium text-white">Think of your role this way:</strong>{" "}
            You are the bridge between your client and the other lawyer. Good settlement play
            means listening carefully inside your own camp, then advocating clearly across the
            table.
          </span>
        </div>
      </div>
    </section>
  );
}
