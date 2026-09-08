# Lodario

Lodario is a mobile-first football training and team-management application for Players and Coaches. The current public-beta scope includes authentication, onboarding, profiles, teams, wellness and training logs, readiness and load guidance, injuries, calendars, analytics, RSVP/attendance, and feedback.

The public beta is restricted to users aged 18 or older. Deferred Guardian/minor, AI, subscription/payment, advertising, and health-integration code remains in the repository but is disabled.

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

See [`docs/launch/18-plus-beta-scope.md`](docs/launch/18-plus-beta-scope.md) for the beta feature boundary, controls, migration status, and remaining launch work.
