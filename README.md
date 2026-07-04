# Legal Arena

A legal training app where users interview clients, build case files, argue simulated matters, and climb specialty leaderboards.

## Get Started

1. Install dependencies with `npm install`.
2. Add your environment variables in `.env.local`.
3. Run the app with `npm run dev`.
4. Visit `/dashboard` after signing in.

## Notes

- The dashboard contains the playable case workflow.
- `/dashboard/admin` is the current admin lab for creating and generating case templates.
- Current gameplay is template-backed, with generated and manually authored case templates stored in MongoDB.
- Roadmap direction: future playable cases should move toward dynamic case generation, where a new case is generated once, stored on the session, and then used as stable gameplay state. See `roadmap.md`.
- `POST /api/internal/email-nudges/run` runs retention nudges. Pass `dryRun=true` and `limit=<n>` in the query string or JSON body when validating a run.

## Reset User Data

- Dry run auth data reset: `npm run reset:user-data`
- Apply auth data reset: `npm run reset:user-data -- --apply`
- Apply auth + gameplay data reset: `npm run reset:user-data -- --apply --include-gameplay`
