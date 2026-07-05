# Legal Arena Roadmap

This file is the source of truth for deferred product direction. It captures where the app should go next without implying that the work is already implemented.

## Current Baseline

Dynamic case generation v1 now exists.

The app can start generated matters from the dashboard, create a session-level generated case state, fall back when generation fails, store party stories and evidence pools, assign judge profiles, respect category and difficulty inputs, and preserve compatibility with legacy template-backed cases.

The roadmap is no longer about proving that dynamic cases can exist. The next product challenge is making generated cases deeper, more reactive, more explainable, and harder to exploit.

## Dynamic Case Depth

Generated cases should feel less like one-shot scenario creation and more like live legal problems that become richer through play.

Future work should focus on:

- Progressive discovery during intake.
- Stable fact and evidence resolution.
- Better contradiction and weakness handling.
- Stronger links between intake, settlement, courtroom argument, and outcome.
- Debuggable generated-session state for tuning and QA.

The goal is not raw procedural variety. The goal is replayable legal strategy where the player feels they uncovered, tested, and used the case record.

## Progressive Fact and Evidence Resolution

Legal Arena should support deeper case discovery during intake.

When the player asks follow-up questions, requests documents, asks for proof, tests a claim, or explores a new factual angle, the system may resolve new fact nodes and evidence artifacts.

Once a fact, answer, or artifact is resolved, it must be stored permanently in the case session. The system must not freely reinvent established facts later.

Good intake questions should be able to:

- Reveal hidden strengths.
- Reveal hidden weaknesses.
- Generate or surface useful evidence.
- Expose contradictions.
- Clarify timelines.
- Test client reliability.
- Identify missing proof.
- Discover settlement leverage.
- Identify opponent vulnerabilities.
- Improve courtroom strategy.

Poor or shallow intake should leave the player with a weaker, thinner, more fragile case.

## Two-Layer Fact Model

Legal Arena should distinguish between truth and provability.

A fact may be:

- True and well-supported.
- True but weakly supported.
- True but unsupported.
- False but sincerely believed.
- False and knowingly exaggerated.
- False but supported by misleading evidence.
- Ambiguous.
- Contested.
- Outside the party's knowledge.
- Known to one party but not the other.
- Discoverable only through the right question or request.

This distinction is central to the game.

The player may have a factually correct theory but fail to prove it. The player may also win by showing that the opponent has not met the required burden, even without proving every underlying truth.

## Resolved Fact Nodes

A resolved fact node should eventually capture enough structure to keep gameplay stable and explainable.

Useful fields may include:

- Claim text.
- Claiming party.
- Related party.
- Underlying truth value.
- Party belief state.
- Evidence availability.
- Evidence strength.
- Evidence type.
- Evidence owner.
- Evidence accessibility.
- Contradictions.
- Legal relevance.
- Courtroom usefulness.
- Settlement usefulness.
- Confidence level.
- Discovery source.
- Intake turn where it was resolved.

Example:

```json
{
  "factId": "landlord_abusive_messages",
  "claim": "The landlord sent abusive messages threatening to keep the deposit.",
  "claimingParty": "plaintiff",
  "underlyingTruth": "partly_true",
  "partyBelief": "sincere_but_exaggerated",
  "evidenceExists": true,
  "evidenceStrength": "moderate",
  "evidenceType": "whatsapp_messages",
  "evidenceQuality": "emotionally strong but legally indirect",
  "contradictedBy": ["defendant_repair_invoice_thread"],
  "legalRelevance": "supports bad faith argument but does not prove deposit amount",
  "discoveredDuring": "plaintiff_intake"
}
```

## Evidence Artifacts

Evidence artifacts should be generated, revealed, or confirmed when facts are explored.

Artifacts may include:

- Messages.
- Emails.
- Receipts.
- Photos.
- Invoices.
- Contracts.
- Inspection reports.
- Payment records.
- Witness statements.
- Call logs.
- Notices.
- Screenshots.
- Repair estimates.
- Police complaints.
- Medical records.
- Delivery records.
- Internal notes.

An evidence artifact may be strong, weak, ambiguous, incomplete, suspicious, fabricated, misleading, contested, helpful to one side, harmful to the party who produced it, useful only when combined with another fact, or emotionally persuasive but legally weak.

Generated evidence should be probabilistic but stable within a session.

## Stability Rule

Progressive generation is allowed only until a fact or artifact is resolved.

Once resolved, it becomes fixed session state.

Examples:

- If the client says they have no photos, the system should not later invent strong photos unless there is a plausible reason, such as another person producing them.
- If a message thread is generated, later references to that thread must remain consistent.
- If the defendant produces a repair invoice, the invoice details should not mutate later.
- If the judge has already heard a fact in court, the underlying record should remain stable.

This preserves fairness, consistency, and replayability while still allowing each new case to feel fresh.

## Judge and Courtroom Model

The judge should not act as an omniscient narrator who secretly knows canonical truth and rules based on hidden facts.

The judge should evaluate the case based on the visible record:

- Claims presented.
- Evidence presented.
- Admissions.
- Contradictions.
- Timeline consistency.
- Lawbook fit.
- Burden of proof.
- Standard of proof.
- Witness credibility.
- Argument quality.
- Missing evidence.
- Opponent responses.
- Procedural posture.
- Remedies requested.

The judge may be influenced by the hidden truth layer only indirectly, through evidence, testimony, admissions, and contradictions that became part of the presented case.

The courtroom should reward specificity, legal relevance, evidentiary grounding, tactical use of contradictions, proper framing, credible concessions, strong causal reasoning, remedy alignment, and meaningful rebuttal.

The courtroom should penalize unsupported claims, overclaiming, ignoring bad facts, misstating evidence, irrelevant emotional appeals, failing to address legal elements, failing to meet the burden of proof, and contradicting the player's own record.

## Fact Sheet Role

The fact sheet should become a structured bridge between intake and courtroom.

It should represent the player's prepared case, not merely a summary.

The fact sheet may include:

- Client claims.
- Verified facts.
- Unsupported claims.
- Disputed facts.
- Evidence-backed facts.
- Bad facts.
- Missing evidence.
- Legal issues.
- Timeline.
- Potential arguments.
- Opponent vulnerabilities.
- Settlement leverage.
- Courtroom risks.

The fact sheet should help the player distinguish between what the client says, what appears to be true, what can be proved, what is disputed, and what is useful in court.

It should not expose every hidden truth value to the player.

## Settlement Feedback and Quality

Settlement should not be a black-and-white outcome.

The system should continue developing settlement as a quality-based resolution where both party satisfaction matters. A good settlement should be shown to the player as a negotiated result, not merely a shortcut around verdict.

Future settlement improvements should:

- Explain why both sides accepted or resisted terms.
- Show settlement quality clearly.
- Reward balanced outcomes more than lopsided pressure.
- Use party moods and final terms as structured signals.
- Preserve settlement as a distinct strategic path, not a disguised win/loss state.

## Lawyer Skill Progression

Legal Arena should add behavioral lawyer skills that progress based on how the player actually plays.

Skills should assist but never override weak facts, weak law, or weak arguments.

Initial skill categories:

- **Fact Development**: Asking focused intake questions and surfacing useful facts.
- **Evidence Handling**: Using records, dates, contradictions, and proof effectively.
- **Legal Framing**: Connecting facts to lawbook rules and legal standards.
- **Rebuttal**: Answering the opponent's strongest point instead of ignoring it.
- **Client Control**: Keeping the client cooperative, focused, and settlement-ready.
- **Settlement Framing**: Creating practical, balanced, acceptable settlement terms.
- **Courtroom Presence**: Clear organization, tone, concessions, and persuasive structure.

Skill XP should come from normalized judge, client, settlement, and case-record signals. It should not come from raw text length, repeated phrases, irrelevant citations, or generic legal-sounding language.

Skill effects should be bounded and explainable. A skill may improve feedback, unlock tactical prompts, slightly improve a result when the player demonstrates the relevant behavior, or make client/judge reactions more legible. A skill should not magically make bad work persuasive.

Example:

> Evidence Handling helped because you anchored this argument in two corroborated facts.

## Anti-Exploit Principles

Skill progression and generated-case scoring must be resistant to obvious player gaming.

Rules:

- Per-case and per-round skill XP caps.
- No reward for spam, repeated arguments, irrelevant legal citations, or unsupported claims.
- No invisible stat magic that makes judges or clients accept bad work.
- No unlimited grinding of one easy behavior in a single matter.
- Every meaningful skill gain or skill effect should be explainable in UI.
- Skills should amplify demonstrated behavior, not replace it.

## Fun Design Constraints

Generated cases must not merely be coherent legal scenarios.

Each generated case should include at least:

- One immediately understandable dramatic question.
- One client-side weakness.
- One opponent-side weakness.
- One discoverable contradiction.
- One meaningful evidentiary gap.
- One fact that changes the player's theory.
- One tactical courtroom opportunity.
- One possible settlement lever.
- One tempting but weak argument.
- One clear reason to replay or try a different strategy.

A generated case is not valid unless it can produce a satisfying player move within the first five minutes.

The player should quickly experience at least one of these feelings:

- "I caught something."
- "That changes the case."
- "I can use this."
- "The other side has a problem."
- "My own client may be hiding something."
- "I need to reframe this."
- "I can win this if I argue it correctly."

## Target Experience

Legal Arena should feel less like:

> Read packet -> collect facts -> argue generally -> receive verdict.

And more like:

> Hear story -> spot angle -> ask sharp question -> uncover proof or weakness -> build theory -> confront opposition -> argue strategically -> receive a reasoned judgment.

The player fantasy is not just "be a lawyer."

The player fantasy is:

> Think like a lawyer, catch what others missed, turn messy facts into leverage, and win through your own reasoning.

## Admin and Debugging Direction

Admin tooling should shift from only editing playable templates to also inspecting and tuning generated sessions.

Admin tools should eventually help inspect:

- Initial generated case state.
- Resolved fact nodes.
- Generated artifacts.
- Intake questions that triggered resolution.
- Opponent-side artifacts.
- Settlement terms and quality signals.
- Courtroom arguments.
- Judge reasoning.
- Skill XP events.
- Final verdict or settlement basis.

Future tuning controls may include:

- Case generation recipes.
- Legal issue categories.
- Difficulty profiles.
- Fact probability models.
- Evidence probability models.
- Contradiction rules.
- Party reliability profiles.
- Judge profiles.
- Evidence artifact templates.
- Sample generated outputs.
- Scoring rubrics.
- Verdict evaluation rules.

This will make the system debuggable and tunable.

## Legacy Template Policy

Dynamic starts are now a core path, but existing template-backed cases should remain readable and playable until they are intentionally migrated or retired.

Do not remove current template models, routes, admin tools, or compatibility paths as part of roadmap work.

Template-backed cases may continue to serve as:

- Legacy playable content.
- Gold-standard examples.
- Test cases.
- Source material for generation recipes.
- Benchmarks for generated-case quality.

## Implementation Principle

Improve generated-case depth incrementally.

Do not try to solve the entire legal simulation at once. Each pass should make one part of the loop more stable, fun, or explainable:

> intake discovery -> evidence resolution -> contradiction -> theory building -> settlement or courtroom payoff -> skill progression.

The roadmap should prioritize fun, consistency, debuggability, and anti-exploit design over raw procedural variety.
