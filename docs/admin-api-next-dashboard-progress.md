# Admin Dashboard Next Features Progress

This file has been reset for the follow-up admin dashboard feature plan.

Update it before and after each meaningful work block. Keep entries factual and include changed files, verification, blockers, and next steps.

The previous first-slice implementation history remains available in git history before this reset.

## 2026-05-07 22:05 CEST - Deployment Wiring

Status: complete

Changed files:

- `apps/admin-dashboard/app/health/route.ts`
- `apps/admin-dashboard/app/lib/admin-api.ts`
- `apps/admin-dashboard/next.config.mjs`
- `apps/admin-dashboard/package.json`
- `docs/admin-dashboard-deployment.md`
- `package.json`
- `scripts/smoke-admin-dashboard.mjs`

What changed:

- Started the first follow-up slice from the next-feature plan: dashboard deployment wiring, scripts, health/smoke checks, and production topology documentation.
- Added root scripts for dashboard dev/build/start/smoke commands.
- Added a dashboard health route at `/_spacebar/admin/health`.
- Added a smoke script that checks the dashboard health endpoint and can optionally check authenticated SSR with `SPACEBAR_ADMIN_TOKEN`.
- Made dashboard base path and token cookie names configurable through documented environment variables.
- Added deployment documentation with topology, start commands, reverse-proxy routing, smoke checks, misconfiguration behavior, and release note.

Verification:

- Command: `npm run build:admin-dashboard`
- Result: pass
- Notes: Next.js production build passed and included the dynamic `/health` route.
- Command: `PORT=3310 SPACEBAR_ADMIN_API_URL=http://127.0.0.1:3001/_spacebar/admin/api npm run start:admin-dashboard`
- Result: pass
- Notes: Started the built dashboard on a temporary local port for smoke verification.
- Command: `SPACEBAR_ADMIN_DASHBOARD_URL=http://127.0.0.1:3310/_spacebar/admin npm run smoke:admin-dashboard`
- Result: pass
- Notes: Health check passed; authenticated SSR check was skipped because `SPACEBAR_ADMIN_TOKEN` was not set.
- Command: `lsof -ti tcp:3310`
- Result: pass
- Notes: Returned no process after stopping the temporary dashboard server.

Risks or blockers:

- Authenticated SSR reachability still needs an OPERATOR token to verify with `SPACEBAR_ADMIN_TOKEN`.

Next step:

- Start the next follow-up slice: admin login/session UX or durable jobs/audit storage.
