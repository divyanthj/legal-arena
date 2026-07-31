# Legal Arena Career-Loop Re-audit

Date: 2026-07-31

## Scope

Combined UX and accessibility review of the updated solo journey: dashboard, intake, courtroom, settlement, verdict aftermath, next-case handoff, and mobile reflow.

## Overall verdict

Legal Arena now has a coherent legal-game loop and can reasonably be described as a legal simulation game. The case mechanics connect well: intake builds a record, law attaches to facts, the record supports negotiation or advocacy, the judge reacts, and the resolution feeds the next matter.

The career loop is not fully coherent yet. It is currently a narrative overlay on top of the legal mechanics rather than a system whose consequences visibly change the player's practice. The largest gap is between what the career copy says and what the game state proves.

Indicative assessment:

- Legal simulation loop: 8/10
- Moment-to-moment play: 7.5/10
- Career/story coherence: 5.5/10
- Long-term pull: 6/10

## Flow steps

### 1. Dashboard and career entry — Mixed/healthy

Evidence: `01-dashboard-career.png`

Strengths:

- The chapter and role title immediately give the profile a career identity.
- Continue Case remains the visual priority.
- Record, XP, rank, and chapter establish several forms of progress.

Risks:

- Chapter information is repeated in the top profile and Player Brief without adding a new decision.
- The active case does not explain how it follows from the player's prior result, so the career spine disappears at the most important re-entry point.
- The Player Brief is visually dense and the record wraps awkwardly.

### 2. Intake and opening story — Needs work

Evidence: `03-intake-career-thread.png`, `06-mobile-intake.png`

Strengths:

- The case is now framed as part of a career rather than an isolated worksheet.
- Developments are expandable, so history is available without showing everything.

Risks:

- An applicable-law discovery becomes the opening headline before the player asks a question. This suppresses the client hook and makes the story begin with system metadata.
- Existing cases show Chapter 1 / Rookie Advocate while the dashboard shows Chapter 6 / Leading Counsel.
- Copy is generic: “uncertain record,” “persuasive case,” and “legal judgment” could belong to almost any case.
- Grammar is visibly wrong: “1 actual-law provision now connect.”
- On mobile, the career card consumes the entire first viewport and pushes the primary interview action below the fold.

### 3. Courtroom — Mixed

Evidence: `02-courtroom-career-thread.png`

Strengths:

- “The bench has shifted focus” accurately recognizes a major case development.
- The visible development history gives the matter a sense of movement.

Risks:

- The career card repeats the Judge Signal almost word for word, creating hierarchy noise.
- Its size delays the actual courtroom interaction.
- Chapter and reputation remain inconsistent and generic.

### 4. Settlement branch — Mixed/healthy

Evidence: `07-settlement-career-thread.png`

Strengths:

- The stage transition is clear and the underlying settlement loop is unusually strong: private client instructions, opponent mood, term-level negotiation, and next-move guidance all connect.
- The career card is less obstructive here because the settlement layout is shallower.

Risks:

- The stakes still say the matter tests pressure “in court,” even though the player is negotiating.
- The career panel repeats what “Settlement Negotiation” already communicates.

### 5. Verdict aftermath — Healthy

Evidence: `04-verdict-aftermath.png`

Strengths:

- Separating client consequence from reputation consequence is the strongest new addition.
- It makes a loss feel like part of continued play instead of a dead end.
- Tone and placement fit the ruling screen.

Risks:

- The consequence is asserted but not reflected in a visible reputation score, trait, unlock, contact, or changed relationship.
- “Legal judgment practice” is generic and does not match the public-law facts of the case.

### 6. Next-case handoff — Promising/mixed

Evidence: `05-next-case-handoff.png`

Strengths:

- The next case is framed as a response to the weakness exposed by the ruling.
- Difficulty and practice-area progression remain clear.

Risks:

- The handoff is still mechanically generic: no named referrer, returning client, firm contact, or specific factual connection.
- The copy describes causality, but the player cannot see which career state changed to produce this referral.

### 7. Responsive and accessibility review — Needs verification

Evidence: `06-mobile-intake.png` plus DOM snapshots from all steps.

Likely issues:

- Small, low-contrast uppercase labels and secondary copy may be difficult to read.
- The mobile narrative card creates excessive pre-action scrolling.
- “View developments” appears as a small text target rather than a comfortably sized mobile control.
- Inactive case brief, lawbook, case-file, and settlement dialogs appeared in DOM snapshots even while visually closed. Screen-reader testing should confirm they are removed from the accessibility tree and focus order.
- Courtroom narrative and Judge Signal repeat the same information, increasing screen-reader verbosity.

Screenshots cannot confirm keyboard traversal, focus trapping, live-region announcements, screen-reader behavior, or contrast ratios. Those require targeted testing.

## Highest-impact recommendations

1. Fix narrative truth first. Resolve the Chapter 1/Chapter 6 mismatch, stage-specific stakes, singular grammar, and practice-area naming before expanding the system.
2. Make the career thread compact. Show one line above the active task; put history and broader stakes in an expandable Career Journal. On mobile, the primary legal action must remain in the first viewport.
3. Turn prose consequences into state. Track two or three understandable reputation traits such as Evidence, Negotiation, and Courtroom Advocacy. Show the exact change after resolution and use it in the next-case recommendation.
4. Make the next referral concrete. Name who sent the case, what prior result caused it, and what the new client expects. Use the existing scenario hint so the generated matter fulfills that promise.
5. Keep the legal loop dominant. Story should explain why the player is doing the legal work and what changed afterward; it should not repeat Judge Signal, settlement status, or applicable-law counts.

## Evidence limits

- The audit used an authenticated local account with existing cases, including older cases created before the narrative field existed.
- A new recommended case was not created because doing so would mutate the player's docket.
- Settlement resolution was not forced; the active settlement branch and a completed verdict were inspected.
- No automated keyboard, screen-reader, or color-contrast suite was run.
