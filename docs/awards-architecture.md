# Awards architecture

The catalogue contains the original 87 award families plus one repeatable, tiered
country distinction for every supported case country. Country awards are objective:
winning a completed matter increments that jurisdiction's distinction, using the
same Bronze, Silver, Gold, and Diamond thresholds as other repeatable distinctions.

Legal Arena stores permanent catalogue data separately from player progress and occurrence history. `AwardEvaluation.evaluationKey` and `AwardOccurrence.occurrenceKey` are the retry boundaries: a completed source can be evaluated repeatedly without incrementing progression or an award twice.

Objective evaluation runs after a terminal solo or PVP outcome is saved. AI-eligible work remains durable and is processed by `/api/internal/award-evaluations/run`; case completion never depends on that worker. Objective, AI, and catalogue versions are independent so rules can evolve without silently rewriting history.

`awardMetrics` and evaluation context contain only structured gameplay measurements needed for awards. Missing historical monetary, disposition, timing, or evidence-submission values stay null and cannot qualify. Raw prompts, AI payloads, errors, and transcript context are private; public profiles receive sanitized explanations and aggregate progress only.

Production MongoDB should support transactions. Unique indexes remain the final concurrency guard. Run `npm run awards:migrate -- --apply` during deployment, then use the dry-run-first backfill command for existing accounts.
