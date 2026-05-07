# Admin Dashboard Deployment

The TypeScript admin API and the Next.js admin dashboard are separate runtime surfaces.

- Spacebar API process: serves `/_spacebar/admin/api/*`.
- Admin dashboard process: serves `/_spacebar/admin/*`.

Route `/_spacebar/admin/api/*` to the Spacebar API before routing `/_spacebar/admin/*` to the dashboard. The API prefix is more specific and must not be swallowed by the dashboard proxy.

## Build

Build the Spacebar server and dashboard:

```sh
npm run build
npm run build:admin-dashboard
```

The dashboard-only build command is equivalent to:

```sh
npm run build --workspace apps/admin-dashboard
```

## Start

Start the API process:

```sh
npm run start:api
```

Start the dashboard process:

```sh
SPACEBAR_ADMIN_API_URL=http://127.0.0.1:3001/_spacebar/admin/api \
PORT=3300 \
npm run start:admin-dashboard
```

For local development:

```sh
SPACEBAR_ADMIN_API_URL=http://127.0.0.1:3001/_spacebar/admin/api \
PORT=3300 \
npm run dev:admin-dashboard
```

## Environment

| Variable                                 | Default                                     | Purpose                                                                                                    |
| ---------------------------------------- | ------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `SPACEBAR_ADMIN_API_URL`                 | `http://localhost:3001/_spacebar/admin/api` | Internal URL the dashboard uses for admin API SSR and server actions.                                      |
| `SPACEBAR_ADMIN_API_TIMEOUT_MS`          | `2500`                                      | Fetch timeout for dashboard SSR and server actions.                                                        |
| `SPACEBAR_ADMIN_DASHBOARD_BASE_PATH`     | `/_spacebar/admin`                          | Public dashboard base path. This is a Next.js build-time setting; rebuild the dashboard after changing it. |
| `SPACEBAR_ADMIN_TOKEN_COOKIE`            | `spacebar_admin_token`                      | Cookie name checked first for dashboard admin token forwarding.                                            |
| `SPACEBAR_ADMIN_LOGOUT_COOKIE`           | `spacebar_admin_logged_out`                 | Logout marker that suppresses fallback `spacebar_token` forwarding after dashboard logout.                 |
| `SPACEBAR_ADMIN_SESSION_MAX_AGE_SECONDS` | `43200`                                     | Dashboard admin session cookie lifetime.                                                                   |
| `SPACEBAR_ADMIN_COOKIE_SECURE`           | production-only                             | Set to `false` to allow dashboard cookies on local plain HTTP.                                             |
| `SPACEBAR_TOKEN_COOKIE`                  | `spacebar_token`                            | Fallback cookie name for compatibility with existing Spacebar token cookies.                               |
| `PORT`                                   | Next.js default                             | Dashboard listen port.                                                                                     |
| `HOSTNAME`                               | Next.js default                             | Dashboard listen host.                                                                                     |
| `SPACEBAR_ADMIN_DASHBOARD_URL`           | `http://127.0.0.1:3300/_spacebar/admin`     | URL used by `npm run smoke:admin-dashboard`.                                                               |
| `SPACEBAR_ADMIN_TOKEN`                   | unset                                       | Optional token used by the smoke script to verify authenticated SSR.                                       |
| `ADMIN_JOB_CLAIM_TIMEOUT_MS`             | `300000`                                    | API-side lease timeout before a `running` admin job is considered stale and eligible for restart recovery. |
| `ADMIN_JOB_RECOVERY_INTERVAL_MS`         | `60000`                                     | API-side interval for checking queued jobs and stale running job claims.                                   |

## Reverse Proxy Example

Nginx-style routing:

```nginx
location /_spacebar/admin/api/ {
    proxy_pass http://spacebar-api:3001/_spacebar/admin/api/;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
}

location /_spacebar/admin/ {
    proxy_pass http://spacebar-admin-dashboard:3300/_spacebar/admin/;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
}
```

If the proxy strips prefixes, keep the dashboard `SPACEBAR_ADMIN_DASHBOARD_BASE_PATH` and API mount in sync with the externally visible paths.

## Smoke Checks

The dashboard exposes:

```text
GET /_spacebar/admin/health
```

Run the smoke check against a running dashboard:

```sh
SPACEBAR_ADMIN_DASHBOARD_URL=http://127.0.0.1:3300/_spacebar/admin \
npm run smoke:admin-dashboard
```

To also verify authenticated dashboard SSR can reach the configured admin API:

```sh
SPACEBAR_ADMIN_DASHBOARD_URL=http://127.0.0.1:3300/_spacebar/admin \
SPACEBAR_ADMIN_TOKEN="$OPERATOR_TOKEN" \
npm run smoke:admin-dashboard
```

Without `SPACEBAR_ADMIN_TOKEN`, the smoke command only verifies the dashboard process and health endpoint.

Run the browser e2e smoke after `npm run build:admin-dashboard`:

```sh
npm run smoke:admin-dashboard:e2e
```

The e2e smoke starts a mock admin API, starts the built dashboard, drives headless Chrome through login, users, jobs, and media, verifies failed and successful media action banners, submits a safe dry-run attachment migration, and writes screenshots to `tmp/admin-dashboard-e2e` by default. Set `CHROME_PATH` if Chrome is not installed at the macOS default path, or `ADMIN_DASHBOARD_E2E_ARTIFACT_DIR` to change the screenshot output directory.

Run dashboard server-action request tests when mutation forms change:

```sh
npm run test:admin-dashboard-actions
```

## Durable Admin Storage

Admin jobs are stored in the Spacebar database table `admin_jobs`. Admin audit/activity records are stored in `admin_audit_records`. The schema is installed by the normal Postgres migration flow when the API process starts with migrations enabled.

Job and audit API responses remain paginated through `limit` and `offset`; the dashboard currently requests 50 rows per activity page and the configured page size for job lists. Running jobs hold a database claim lease and refresh it while writing progress or errors; restart recovery only requeues stale running jobs whose claim is older than `ADMIN_JOB_CLAIM_TIMEOUT_MS`. Records are retained indefinitely by default so operators can inspect history after process restarts. If an installation needs shorter retention, purge old rows from `admin_audit_records` and terminal `admin_jobs` rows with an operational SQL job after exporting anything required for compliance.

Run the durable storage integration gate after `npm run build:src`:

```sh
npm run test:admin-durable-storage
```

Run the destructive-operation database integration gate after `npm run build:src`:

```sh
npm run test:admin-destructive-operations
```

The durable-storage gate creates a temporary Postgres database, applies the admin job/audit migration, verifies persistence across a database reconnect, exercises idempotency, progress, failure, cancellation, and restart recovery, then drops the temporary database. Set `ADMIN_DURABLE_TEST_ADMIN_DATABASE_URL` if local Postgres is not available at `postgres://user:password@127.0.0.1:5432/postgres`.

The destructive-operation gate creates a temporary Postgres database with synchronized entities, deletes a real guild category through the admin mutation helper, asserts row deletion, child detachment, guild ordering updates, and emitted events, then drops the temporary database. Set `ADMIN_DESTRUCTIVE_TEST_ADMIN_DATABASE_URL` to change the admin database used to create the temporary database.

## Admin Session Check

The dashboard login form validates a submitted token through `GET /_spacebar/admin/api/whoami` before setting the dashboard cookie. The cookie is HttpOnly, same-site lax, scoped to the dashboard base path, and secure in production unless `SPACEBAR_ADMIN_COOKIE_SECURE=false` is set.

Manual cookie check for a local HTTP deployment:

```sh
SPACEBAR_ADMIN_COOKIE_SECURE=false \
SPACEBAR_ADMIN_API_URL=http://127.0.0.1:3001/_spacebar/admin/api \
PORT=3300 \
npm run start:admin-dashboard
```

After login, inspect the response cookies for `spacebar_admin_token` with `HttpOnly`, `SameSite=Lax`, and `Path=/_spacebar/admin`. After logout, `spacebar_admin_token` should be cleared and `spacebar_admin_logged_out=1` should prevent fallback `spacebar_token` reuse until the operator logs in again. Incoming `Authorization` headers still take priority for automation and reverse proxies.

## Misconfiguration Behavior

If `SPACEBAR_ADMIN_API_URL` is wrong or unreachable, dashboard pages render their existing error banner from the failed server-side admin API fetch. The health endpoint also reports whether the API URL was explicitly configured and whether its URL shape is valid, without exposing the internal origin.

## Release Note

The TypeScript Spacebar server serves the admin API at `/_spacebar/admin/api`. The Next.js dashboard is a separate app under `apps/admin-dashboard` and must be deployed as its own process behind `/_spacebar/admin`. The old C# `Spacebar.AdminApi` remains deprecated and should only be kept for rollback while the TypeScript dashboard deployment is validated.
