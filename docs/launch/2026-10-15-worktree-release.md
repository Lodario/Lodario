# 15 October 2026 worktree integration

This release brings the completed logging, interface cleanup, optional signup marketing preference, and loading/routing/recommendation work into `main` for lodario.app.

- `40dc`: full-screen training and wellness forms; calendar/reminder prefilling; zero wellness and pain ratings. Effort and performance remain 1–10.
- `8948` / `codex/ui-cleanup-overlays`: overlay scrollbars, simplified player/coach screens, corrected empty readiness arcs and load-score display.
- `email-consent-preview` / `codex/signup-marketing-consent`: optional unchecked marketing preference on real signup, stored as pending metadata. Campaign delivery is not enabled. The simulated signup route remains development-only.
- `loading-screen-redirections-and-recommendations`: shared animated loader, automatic role routing, stable session refresh, daily recommendations, and Android package configuration.

The bright website in `2e34`, coach light theme in `c339`, and onboarding prototype in `a0c2` are excluded. Their source worktrees are preserved. The existing production onboarding remains in place.

## Validation and database change

All 90 Node tests, TypeScript validation, and ESLint pass. Integration resolves shared CSS, player shell, dashboard, and recommendation edits. Login regression tests cover the combined marketing-preference dependency and unchanged role restrictions.

The only pending migration is `20261013180000_logging_zero_ratings.sql`. It widens wellness/pain check constraints to accept zero; no rows, access policies, or training effort/performance constraints are removed.

A fresh private backup is recorded in `backup-2026-10-15T15-51-59-802Z.json`. All 51 public tables and 1,407 rows match an isolated restore, and the pending migration applies to that restored data. The full recovery archive also restores successfully, with all 86 public/Auth/Storage metadata table counts matching. The migration's isolated boundary checks accept 0–10 wellness/pain and reject out-of-range values and zero effort/performance.

The historical restore checker replays already-applied September migrations. For this release, an ignored local copy selects only the actual pending October migration; the tracked checker is unchanged.

Production deployment is prepared using Vercel's existing hosted configuration. Release completion requires a ready build, the pending migration, publication of `main`, promotion to lodario.app, and public route/health checks.
