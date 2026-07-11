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

## AI Player API Authentication

Admins can create and revoke named AI-player credentials in the **API credentials**
section of `/dashboard/admin`. Issuing a credential creates a separate player
identity with its own cases, challenges, progression, rating, and natural display
name. It never impersonates or shares data with an existing human user. The
identity is privately marked as AI-managed for moderation and auditing, but the
ordinary player-facing profile uses the chosen display name. The complete secret
is displayed only once and only its SHA-256 hash is stored.

Send the credential to gameplay endpoints as a bearer token:

```http
Authorization: Bearer la_live_<keyId>_<secret>
```

Bearer credentials are accepted by `/api/cases/**`, `/api/challenges/**`, player
avatar mutation, transcription, onboarding completion, and gameplay reset. They
are intentionally rejected by omission on auth, admin, billing, checkout,
portal, email, and webhook endpoints. Invalid, expired, or revoked keys return
`401`; normal arena entitlement failures return `403`; throttled keys return
`429` with `Retry-After`.

The default per-key limit is 60 requests per five minutes. Configure it with
`AI_API_RATE_LIMIT` and `AI_API_RATE_LIMIT_WINDOW_SECONDS`. Rotate a key by
creating a replacement, updating the client, then revoking the old key.
