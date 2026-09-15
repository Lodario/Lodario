# Lodario

Lodario is a mobile-first football training and team-management application for Players and Coaches. The current public-beta scope includes authentication, onboarding, profiles, teams, wellness and training logs, readiness and load guidance, injuries, calendars, analytics, RSVP/attendance, and feedback.

Players use the existing country-specific age and Guardian rules. Younger Players require verified Guardian approval and current document acceptance; Coaches remain 18+. AI, subscription/payment, advertising, and health-integration features remain disabled.

## Local development

Copy the required local environment variables into `.env.local`, then run:

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Useful validation commands:

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

Do not apply Supabase migrations to a linked environment without reviewing `npx supabase db push --dry-run`, confirming a recoverable backup, and obtaining deployment approval.

See [`docs/launch/country-beta-status.md`](docs/launch/country-beta-status.md) for the current scope, verification, recovery procedures and deployment status. Older 18+ launch documents are historical and superseded by that status document.
