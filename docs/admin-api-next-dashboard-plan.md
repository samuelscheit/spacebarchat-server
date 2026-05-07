# Admin Dashboard Next Features Plan

## Objective

Turn the current TypeScript admin API and Next.js dashboard into a production-ready admin surface.

The first parity slice already exists on branch:

```text
admin-api-next-dashboard-plan
```

Current PR:

```text
https://github.com/samuelscheit2/spacebarchat-server/pull/182
```

This document replaces the completed reimplementation plan. Do not redo the already implemented C# AdminApi parity work unless a follow-up feature requires changing it.

## Baseline

Already implemented:

- TypeScript admin API mounted at `/_spacebar/admin/api`.
- Next.js dashboard under `apps/admin-dashboard` with `basePath: "/_spacebar/admin"`.
- OPERATOR-only admin auth for API routes.
- Explicit admin DTOs and paginated/searchable list endpoints.
- Users, guilds, discovery, channels, media, configuration, jobs, and activity dashboard sections.
- Destructive user deletion and CDN attachment work modeled as jobs.
- Process-local job and audit/activity storage.
- C# `Spacebar.AdminApi` runtime deprecation warning.

Known gaps:

- No dedicated admin login or session UI.
- Dashboard deployment/reverse-proxy wiring is not packaged.
- Jobs and audit/activity records are process-local and disappear on restart.
- Multi-worker job coordination is not implemented.
- Dashboard list pages show totals but lack next/previous pagination controls.
- Destructive actions need stronger confirmation, reason capture, and result feedback.
- Browser visual QA and end-to-end destructive workflow tests are incomplete.
- The deprecated C# admin service is still present for rollback.

## Non-Goals

- Do not merge UApi, CDN, gateway offload, or unrelated services into this dashboard.
- Do not restore unsafe destructive `GET` behavior from the old C# admin surface.
- Do not expose raw TypeORM entities to the dashboard.
- Do not add a separate admin rights model until the OPERATOR-based flow is hardened.
- Do not remove the C# admin service until TypeScript admin deployment and rollback are proven.

## Feature Track 1: Admin Session UX

Add a first-class dashboard authentication flow.

Deliverables:

- Admin login page under `/_spacebar/admin/login`.
- Logout route/action that clears dashboard auth cookies.
- HttpOnly, secure, same-site cookie for dashboard admin sessions.
- Existing header/cookie token forwarding preserved for automation and reverse proxies.
- `GET /_spacebar/admin/api/whoami` used to validate the session on every dashboard request.
- Clear missing-token, expired-token, and non-OPERATOR error states.
- No UI-only authorization; all server actions must continue using the admin API auth boundary.

Acceptance criteria:

- Visiting dashboard pages without auth redirects or renders a login state.
- A valid OPERATOR token opens the dashboard.
- A valid non-OPERATOR token is rejected.
- Logout prevents later server actions from reusing the old session.
- Session cookie attributes are covered by tests or a documented manual check.

## Feature Track 2: Deployment Wiring

Make the dashboard deployable alongside the Spacebar server.

Deliverables:

- Documented production topology for `/_spacebar/admin` and `/_spacebar/admin/api`.
- Build/start scripts for the dashboard workspace.
- Environment variable documentation for `SPACEBAR_ADMIN_API_URL`, timeout, cookie settings, and public base path.
- Reverse-proxy examples for routing dashboard requests and API requests.
- Health/smoke endpoint or documented smoke command for the dashboard process.
- Release note explaining that the TS server serves the admin API while Next serves the dashboard UI.

Acceptance criteria:

- `npm run build --workspace apps/admin-dashboard` still passes.
- A documented start command serves the dashboard at `/_spacebar/admin`.
- Dashboard SSR can reach the configured admin API URL.
- Misconfigured API URL fails with an actionable dashboard error.

## Feature Track 3: Durable Jobs and Audit

Move admin jobs and audit/activity out of process memory.

Deliverables:

- Database-backed admin job records with status, input, progress, result, errors, idempotency key, actor, timestamps, and cancellation request state.
- Database-backed audit records with actor, action, target, severity, status, job ID, reason, metadata, and timestamps.
- Migration or schema update using the repo's established database workflow.
- Worker-safe job claiming so multiple API workers do not run the same job.
- Restart recovery for queued/running jobs.
- Retention and pagination policy for job and audit history.
- Existing process-local implementation either removed or kept only as a test helper.

Acceptance criteria:

- Jobs remain visible after process restart.
- Audit/activity remains visible after process restart.
- Idempotency prevents duplicate dangerous jobs.
- Cancellation requests survive restart.
- Tests cover job creation, progress update, failure, cancellation, idempotency, and audit persistence.

## Feature Track 4: Dashboard Operations UX

Add the interaction polish operators need for repeated use.

Deliverables:

- Shared pagination controls for every list page.
- Filter controls for jobs, activity, users, guilds, discovery, and media.
- Job detail page with input, progress, result, errors, actor, timestamps, cancellation state, and related audit records.
- Activity detail or expandable rows for metadata and related job records.
- Action result banners for successful and failed server actions.
- Configuration editor with validation, formatted JSON, and diff/preview before save.
- Media job controls that expose dry-run, force, and missing-limit inputs intentionally.

Acceptance criteria:

- List pages can navigate beyond the first page.
- Query state is represented in the URL.
- Server action success/failure is visible without inspecting logs.
- Large job/audit payloads remain readable and do not break layout.

## Feature Track 5: Destructive Action Safety

Harden high-risk admin actions.

Deliverables:

- Typed confirmation for user delete, channel delete, CDN migration force mode, and config writes.
- Required operator reason for destructive actions.
- Audit reason included in job/audit metadata.
- Idempotency keys generated for dangerous dashboard actions.
- Clear dry-run defaults for migration-style jobs.
- Rate limit or debounce where repeated submissions could create duplicate work.

Acceptance criteria:

- Destructive actions cannot be submitted accidentally from a single click.
- Audit records contain the operator reason.
- Duplicate form submissions do not create duplicate dangerous jobs.
- Tests cover reason/idempotency propagation.

## Feature Track 6: Verification and Release Gates

Add confidence beyond build-only checks.

Deliverables:

- Backend integration tests against a real test database for destructive admin operations.
- Dashboard server-action tests for auth forwarding and mutation failures.
- Browser or Playwright visual smoke checks for the dashboard shell and key pages.
- E2E smoke path covering login, users list, jobs list, and a safe dry-run media job.
- PR checklist for admin dashboard changes.

Acceptance criteria:

- Required checks run locally with documented commands.
- Visual smoke tests produce screenshots or a clear pass/fail artifact.
- Destructive integration tests assert database and event side effects, not only HTTP status codes.

## Suggested Implementation Order

1. Add deployment wiring documentation and scripts so reviewers can run the dashboard consistently.
2. Add admin login/session UX while preserving existing token forwarding.
3. Implement durable jobs and audit storage behind the existing API contracts.
4. Add dashboard pagination, filters, job detail, and action result feedback.
5. Add typed confirmations, reasons, and idempotency propagation for destructive actions.
6. Add browser/e2e verification and destructive operation integration tests.
7. Decide whether to remove the deprecated C# admin service after the TS dashboard has production deployment evidence.

## Verification Plan

Minimum checks for future implementation PRs:

- `npm run build`
- `npm run build --workspace apps/admin-dashboard`
- Focused backend tests for touched admin modules.
- Dashboard tests for touched server actions or pages.
- Database integration tests when job/audit persistence or destructive operations change.
- Browser or Playwright smoke check when dashboard UI changes.
- Manual or automated check that non-OPERATOR users cannot access the dashboard or run server actions.

## Working Prompt For Future Agents

You are working in:

```text
/Users/user/Developer/Developer/spacebarchat/server-admin-api-next-plan
```

Your task is to implement the next admin dashboard features described in `docs/admin-api-next-dashboard-plan.md`.

Follow these rules:

1. Treat the existing TypeScript admin API and dashboard as the baseline.
2. Update `docs/admin-api-next-dashboard-progress.md` before and after each meaningful work block.
3. Keep the progress file factual: current goal, changed files, verification run, blockers, and next step.
4. Do not edit the original `/Users/user/Developer/Developer/spacebarchat/server` worktree.
5. Push only to `samuelscheit2/spacebarchat-server` when pushing is explicitly needed.
6. Reuse existing TS server auth, entities, config, event, and migration patterns.
7. Do not expose raw TypeORM entities from admin endpoints.
8. Do not implement destructive admin actions as `GET`.
9. Prefer root-cause fixes over patches that only hide dashboard symptoms.
10. Before stopping, run the narrowest relevant verification and record the result in the progress file.
