# Legal Arena

A legal training app where users interview clients, build case files, argue simulated matters, and climb specialty leaderboards.

## Get Started

1. Install dependencies with `npm install`.
2. Add your environment variables in `.env.local`.
3. Run the app with `npm run dev`.
4. Visit `/dashboard` after signing in.

## Environment

- `MONGODB_URI`
- `NEXTAUTH_SECRET`
- `GOOGLE_ID`
- `GOOGLE_SECRET`
- `OPENAI_API_KEY`
- `ADMINS`
- `CASE_GENERATOR_API_KEY`
- `RESEND_API_KEY`

## Notes

- The dashboard contains the playable case workflow.
- `/dashboard/admin` is the admin lab for creating and generating case templates.
- Generated and manually authored case templates are stored in MongoDB.
