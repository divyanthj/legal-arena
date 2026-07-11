# New-user purchase funnel audit — 2026-07-11

## Scope

Test account `Simply Solved`, Level 1, 0 XP. Tested dashboard comprehension, guided tour, first-case entry, profile entry, PVP entry, and lifetime-access offer. Hosted Lemon Squeezy checkout was not opened because doing so would transmit the signed-in email to a third party.

## Verdict

The presentation feels polished and game-like, but the funnel asks for payment before delivering the core “aha”: interviewing a client or making one courtroom argument. The biggest conversion obstacle is not the $15.99 price; it is insufficient firsthand proof that the AI legal gameplay is fun, responsive, and worth paying for.

## Steps and findings

1. **Dashboard landing — At risk.** Strong visual identity and clear game vocabulary. However, the hero leads with “Unlock,” the 0% progress treatment looks like failure, a full fictional case is presented without allowing interaction, and `Finished 2` conflicts with `0 tracked cases`.
2. **Lifetime offer modal — Mixed.** Price, one-time payment, provider, signed-in account, and permanent updates are clear. The copy repeats itself, lacks gameplay evidence, testimonials/refund reassurance, and the primary CTA sits at or below the viewport edge inside a scrollable modal.
3. **Quick tour — At risk.** Focus treatment is strong, but step 1 calls the purchase CTA “Start your first case.” It teaches payment rather than gameplay and promises the first matter before the user can try it. “Begin happy lawyering” feels less credible than the otherwise serious competitive tone.
4. **Start Case — Blocked.** Selecting an available case immediately opens the same paywall. The app offers no playable sample, limited intake exchange, simulated courtroom turn, or interactive preview before purchase.
5. **Profile entry — Blocked.** A visible “Player Brief” link suggests the user can inspect their identity and progression, but navigation replaces the entire page with the purchase gate. This feels like a broken promise and removes a low-cost personalization opportunity.
6. **PVP discovery — Blocked.** The dashboard shows docket counts and “Find Players,” yet the Bar Association route is another full-page paywall. Users cannot inspect community activity or understand whether opponents are active before buying.

## Highest-impact recommendations

1. Let every new account complete one short, curated case through verdict before presenting the hard paywall.
2. If full-case cost is prohibitive, provide a five-minute playable slice: one client exchange, one fact-sheet update, one courtroom argument, and judge feedback.
3. Change the tour’s first step to “Preview your first case” and introduce payment only after the user experiences the core loop.
4. Keep the player profile and a read-only Bar Association visible before purchase; gate actions, not evidence that the product and community exist.
5. Replace initial `0%` with “Not started,” “Awaiting assessment,” or no percentage.
6. Fix the `Finished 2` versus `0 tracked cases` contradiction before driving paid traffic.
7. Shorten the offer copy and use the space for a concrete gameplay clip, sample judge feedback, refund policy, and clearer early-access risk/reassurance.
8. Keep the modal CTA visible without internal scrolling and ensure close/interactive targets meet comfortable target sizes.

## Accessibility evidence limits

Screenshots show several low-contrast secondary labels, a very small close target, and a scroll-dependent CTA. Keyboard order, focus trapping, escape behavior, screen-reader announcements, zoom/reflow, and exact contrast ratios were not fully tested.
