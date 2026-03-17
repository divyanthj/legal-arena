export default function Section2({ id }) {
  return (
    <div id={id} className="scroll-mt-28">
      <h2>{`Building Your File`}</h2>
      <p>
        {`The intake stage is not filler. It is where you turn a messy client story into a structured file you can actually argue from. During this phase, your questions update the transcript and help shape the fact sheet that sits beside the conversation.`}
      </p>
      <ul>
        <li>
          <strong>{`Interview for dates, records, and pressure points:`}</strong>{" "}
          {`Ask about timeline details, witnesses, notice, documents, missing records, and anything else that could move a judge. The most useful questions narrow uncertainty rather than repeating the opening story in different words.`}
        </li>
        <li>
          <strong>{`Use the fact sheet as a working file:`}</strong>{" "}
          {`As the interview develops, keep updating the summary, theory, requested relief, timeline, supporting facts, risks, disputed facts, corroborated facts, and missing evidence fields. The side panel is meant to be edited while you think.`}
        </li>
        <li>
          <strong>{`Pay attention to suggested open questions:`}</strong>{" "}
          {`Legal Arena surfaces follow-up prompts and proof gaps underneath the intake textarea. These hints are especially useful when you have enough narrative to argue, but not enough support to survive pushback.`}
        </li>
        <li>
          <strong>{`Separate what helps you from what is merely said:`}</strong>{" "}
          {`A strong file distinguishes corroborated facts from disputed ones. If something matters but still lacks proof, move it into the missing-evidence area so you remember to handle that weakness in court instead of pretending it is settled.`}
        </li>
        <li>
          <strong>{`Finalize only when the file is coherent:`}</strong>{" "}
          {`When your theory, facts, risks, and requested relief all line up, use Finalize Fact Sheet to leave intake and move into the courtroom stage.`}
        </li>
      </ul>
      <h3>{`What a strong draft usually includes`}</h3>
      <ol>
        <li>{`A short summary that explains the dispute in plain language.`}</li>
        <li>{`A theory that says why your side should prevail.`}</li>
        <li>{`A timeline that anchors events in a usable sequence.`}</li>
        <li>{`Specific supporting facts instead of broad conclusions.`}</li>
        <li>{`A realistic note of risks, proof gaps, and disputed facts.`}</li>
        <li>{`A clear statement of the remedy or relief you want.`}</li>
      </ol>
      <div className="alert mt-6 border border-warning/30 bg-warning/10">
        <span className="text-sm leading-relaxed">
          <strong className="font-medium text-base-content">Important:</strong>{" "}
          If you exit a case during intake, the same matter cannot be started again for
          24 hours. Leave only if you are sure you want to abandon the run.
        </span>
      </div>
      <p>
        {`A disciplined intake produces better courtroom turns, cleaner verdict summaries, and more reliable progression over time.`}
      </p>
    </div>
  );
}
