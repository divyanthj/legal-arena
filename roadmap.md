# Legal Arena Roadmap

This file is the source of truth for deferred product direction. It captures where the app should go next without implying that the work is already implemented.

## Dynamic Case Generation and Progressive Case Discovery

### Product Diagnosis

Legal Arena currently feels less game-like than it should because playable content is too template-driven.

Static case setup can make the experience feel like browsing and completing case packets instead of entering a live legal arena where each matter is fresh, adversarial, uncertain, and shaped by the player's investigation.

The long-term direction is to move away from fixed playable case templates and toward dynamically generated legal disputes where the player uncovers, tests, and builds the case through intake, evidence requests, settlement strategy, and courtroom argument.

The goal is not merely to generate more content. The goal is to make each case feel like a live legal problem with uncertainty, contradictions, hidden weaknesses, evidentiary gaps, and tactical opportunities.

---

## Core Direction

Future playable cases should be generated dynamically rather than selected from a reusable case template library.

The player should start from a simple entry point such as:

- Quick start
- Case category
- Difficulty
- Side selection
- Legal issue type
- Procedural stage

The system should then generate the initial dispute and store it as the fixed starting state for the session.

A generated case should not initially need to contain every possible fact, artifact, and proof item in advance. Instead, the initial state should define the core dispute, party stories, legal context, and procedural rules for discovering more information during play.

---

## Initial Generated Case State

Each new generated case session should store an initial state once.

This initial state may include:

- Plaintiff story
- Defendant story
- Player side
- Opponent side
- Core dispute
- Legal issues
- Judge profile
- Party profiles
- Court type
- Case category
- Complexity level
- Display metadata such as title, court, party names, and short description
- Discovery rules
- Evidence probability rules
- Fact-generation rules
- Contradiction and weakness rules

The plaintiff and defendant stories should be treated as subjective claims, not objective truth.

Contradictions are expected. Each party may be mistaken, self-serving, incomplete, exaggerating, strategically withholding information, or telling the truth without being able to prove it.

---

## Progressive Fact and Evidence Resolution

Legal Arena should support progressive case discovery during intake.

When the player asks follow-up questions, requests documents, asks for proof, tests a claim, or explores a new factual angle, the system may dynamically resolve new fact nodes and evidence artifacts.

Once a fact, answer, or artifact is resolved, it must be stored permanently in the case session.

This allows the case to become richer through play while preserving consistency and fairness.

### Example

In a rental deposit dispute, the plaintiff may claim:

> "The landlord kept most of my deposit without justification."

During intake, the player might ask:

> "Do you have messages where the landlord abused you or threatened to keep the deposit?"

The answer should not be purely scripted. The system may resolve:

- Whether the client claims such messages exist
- Whether the underlying event actually happened
- Whether the client sincerely believes it happened
- Whether messages actually exist
- Whether the messages are strong, weak, vague, deleted, misleading, or contradicted
- Whether the opponent has a competing artifact
- Whether the issue becomes useful in court

The result should then be saved to the session and remain stable for the rest of the case.

---

## Two-Layer Fact Model

Each resolved fact should distinguish between truth and provability.

A fact may be:

- True and well-supported
- True but weakly supported
- True but unsupported
- False but sincerely believed
- False and knowingly exaggerated
- False but supported by misleading evidence
- Ambiguous
- Contested
- Outside the party's knowledge
- Known to one party but not the other
- Discoverable only through the right question or request

This distinction is central to the game.

Legal Arena should not treat "truth" and "courtroom proof" as the same thing. A player may have a factually correct theory but fail to prove it. A player may also win by showing that the opponent has not met the required burden, even without proving every underlying truth.

---

## Fact Node Structure

A resolved fact node may include:

- Claim text
- Claiming party
- Related party
- Underlying truth value
- Party belief state
- Evidence availability
- Evidence strength
- Evidence type
- Evidence owner
- Evidence accessibility
- Contradictions
- Legal relevance
- Courtroom usefulness
- Settlement usefulness
- Confidence level
- Discovery source
- Timestamp or intake turn where it was resolved

Example fields:

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

---

## Evidence Artifact Structure

Evidence artifacts should be generated or revealed when facts are explored.

Artifacts may include:

- Messages
- Emails
- Receipts
- Photos
- Invoices
- Contracts
- Inspection reports
- Payment records
- Witness statements
- Call logs
- Notices
- Screenshots
- Repair estimates
- Police complaints
- Medical records
- Delivery records
- Internal notes

An evidence artifact may be:

- Strong
- Weak
- Ambiguous
- Incomplete
- Suspicious
- Fabricated
- Misleading
- Contested
- Helpful to one side
- Harmful to the party who produced it
- Useful only when combined with another fact
- Legally irrelevant but emotionally persuasive
- Emotionally powerful but legally weak

Generated evidence should be probabilistic but stable within a session.

---

## Intake as Gameplay

Intake should become a core gameplay system, not just a data collection step.

The longer and better the player investigates, the better their case preparation should become.

Good intake questions should be able to:

- Reveal hidden strengths
- Reveal hidden weaknesses
- Generate useful evidence
- Expose contradictions
- Clarify timelines
- Test client reliability
- Identify missing proof
- Discover settlement leverage
- Identify opponent vulnerabilities
- Improve courtroom strategy

Poor or shallow intake should leave the player with a weaker, thinner, more fragile case.

This creates a direct gameplay loop:

> Ask better questions -> discover stronger facts and evidence -> build a better theory -> pressure the opponent -> persuade the judge.

---

## Opponent-Side Discovery

The opposing side should also have its own story, facts, artifacts, weaknesses, and possible contradictions.

Opponent-side materials may be generated:

- At initial case creation
- During opponent intake simulation
- During settlement negotiation
- During courtroom preparation
- When the player raises or challenges a specific issue
- When the opponent needs to respond to a claim

The opponent's artifacts may:

- Support the opponent
- Undermine the opponent
- Contradict the player's client
- Accidentally support the player
- Create new ambiguity
- Reframe an existing fact
- Force the player to adapt

This is where courtroom drama should emerge.

The game should not merely compare two clean narratives. It should generate friction between competing stories, partial proof, bad facts, and strategic argument.

---

## Stability Rule

Progressive generation is allowed only until a fact or artifact is resolved.

Once resolved, it becomes fixed session state.

The system must not freely reinvent facts after they have been established.

For example:

- If the client says they have no photos, the system should not later invent strong photos unless there is a plausible reason, such as another person producing them.
- If a message thread is generated, later references to that thread must remain consistent.
- If the defendant produces a repair invoice, the invoice details should not mutate later.
- If the judge has already heard a fact in court, the underlying record should remain stable.

This preserves fairness, consistency, and replayability while still allowing each new case to feel fresh.

---

## Judge Model

The judge should not act as an omniscient narrator who secretly knows the canonical truth and rules based on hidden facts.

Instead, the judge should evaluate the case based on:

- Claims presented
- Evidence presented
- Admissions
- Contradictions
- Timeline consistency
- Lawbook fit
- Burden of proof
- Standard of proof
- Witness credibility
- Argument quality
- Missing evidence
- Opponent responses
- Procedural posture
- Remedies requested

The judge may be influenced by the hidden truth layer only indirectly, through the evidence, testimony, admissions, and contradictions that became part of the presented case.

The player should feel that they won or lost because of what they discovered, argued, proved, failed to prove, or failed to challenge.

---

## Courtroom Argument Model

Courtroom arguments should use the stored session state.

The system should consider:

- What the player discovered during intake
- What facts are in the fact sheet
- What evidence was produced
- What evidence was not produced
- What contradictions were exposed
- What the opponent has produced
- What issues were preserved
- What arguments were made
- Whether the player addressed bad facts
- Whether the player met the legal standard

The courtroom should reward:

- Specificity
- Legal relevance
- Evidentiary grounding
- Tactical use of contradictions
- Proper framing
- Credible concessions
- Strong causal reasoning
- Remedy alignment

The courtroom should penalize:

- Unsupported claims
- Overclaiming
- Ignoring bad facts
- Misstating evidence
- Irrelevant emotional appeals
- Failing to address legal elements
- Failing to meet the burden of proof
- Contradicting the player's own record

---

## Fact Sheet Role

The fact sheet should eventually become a structured bridge between intake and courtroom.

It should not merely be a summary. It should represent the player's prepared case.

The fact sheet may include:

- Client claims
- Verified facts
- Unsupported claims
- Disputed facts
- Evidence-backed facts
- Bad facts
- Missing evidence
- Legal issues
- Timeline
- Potential arguments
- Opponent vulnerabilities
- Settlement leverage
- Courtroom risks

The fact sheet does not need to expose every hidden truth value to the player.

It should help the player distinguish between:

- What the client says
- What appears to be true
- What can be proved
- What is disputed
- What is useful in court

---

## Fun Design Constraints

Generated cases must not merely be coherent legal scenarios.

Each generated case should include at least:

- One immediately understandable dramatic question
- One client-side weakness
- One opponent-side weakness
- One discoverable contradiction
- One meaningful evidentiary gap
- One fact that changes the player's theory
- One tactical courtroom opportunity
- One possible settlement lever
- One tempting but weak argument
- One clear reason to replay or try a different strategy

A generated case is not valid unless it can produce a satisfying player move within the first five minutes.

The player should quickly experience at least one of these feelings:

- "I caught something."
- "That changes the case."
- "I can use this."
- "The other side has a problem."
- "My own client may be hiding something."
- "I need to reframe this."
- "I can win this if I argue it correctly."

---

## Target Experience

Legal Arena should feel less like:

> Read packet -> collect facts -> argue generally -> receive verdict.

And more like:

> Hear story -> spot angle -> ask sharp question -> uncover proof or weakness -> build theory -> confront opposition -> argue strategically -> receive a reasoned judgment.

The player fantasy is not just "be a lawyer."

The player fantasy is:

> Think like a lawyer, catch what others missed, turn messy facts into leverage, and win through your own reasoning.

---

## Future Architecture

The app should eventually replace the player-facing template library with a generated-case start flow.

The admin experience should shift from editing playable templates to tuning:

- Case generation recipes
- Legal issue categories
- Difficulty profiles
- Fact probability models
- Evidence probability models
- Contradiction rules
- Party reliability profiles
- Judge profiles
- Evidence artifact templates
- Sample generated outputs
- Scoring rubrics
- Verdict evaluation rules

Admin tools should help inspect generated sessions, including:

- Initial case state
- Resolved fact nodes
- Generated artifacts
- Intake questions that triggered resolution
- Opponent-side artifacts
- Courtroom arguments
- Judge reasoning
- Final verdict basis

This will make the system debuggable and tunable.

---

## Legacy Policy

Existing template-backed cases should remain readable and playable until they are intentionally migrated or retired.

Do not remove current template models, routes, admin tools, or compatibility paths as part of roadmap documentation work.

The dynamic generator should be introduced in a later implementation pass.

Template-backed cases may continue to serve as:

- Legacy playable content
- Gold-standard examples
- Test cases
- Source material for generation recipes
- Benchmarks for generated-case quality

---

## Implementation Principle

Do not build a giant generator first.

First, build one excellent handcrafted or semi-generated case that proves the intended gameplay loop:

> intake discovery -> evidence resolution -> contradiction -> theory building -> courtroom payoff.

Once one case feels fun, extract the pattern into generation recipes.

The roadmap should prioritize fun, consistency, and debuggability over raw procedural variety.
