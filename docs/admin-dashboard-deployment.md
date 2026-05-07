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

| Variable | Default | Purpose |
| --- | --- | --- |
| `SPACEBAR_ADMIN_API_URL` | `http://localhost:3001/_spacebar/admin/api` | Internal URL the dashboard uses for admin API SSR and server actions. |
| `SPACEBAR_ADMIN_API_TIMEOUT_MS` | `2500` | Fetch timeout for dashboard SSR and server actions. |
| `SPACEBAR_ADMIN_DASHBOARD_BASE_PATH` | `/_spacebar/admin` | Public dashboard base path. This is a Next.js build-time setting; rebuild the dashboard after changing it. |
| `SPACEBAR_ADMIN_TOKEN_COOKIE` | `spacebar_admin_token` | Cookie name checked first for dashboard admin token forwarding. |
| `SPACEBAR_TOKEN_COOKIE` | `spacebar_token` | Fallback cookie name for compatibility with existing Spacebar token cookies. |
| `PORT` | Next.js default | Dashboard listen port. |
| `HOSTNAME` | Next.js default | Dashboard listen host. |
| `SPACEBAR_ADMIN_DASHBOARD_URL` | `http://127.0.0.1:3300/_spacebar/admin` | URL used by `npm run smoke:admin-dashboard`. |
| `SPACEBAR_ADMIN_TOKEN` | unset | Optional token used by the smoke script to verify authenticated SSR. |

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

## Misconfiguration Behavior

If `SPACEBAR_ADMIN_API_URL` is wrong or unreachable, dashboard pages render their existing error banner from the failed server-side admin API fetch. The health endpoint also reports whether the API URL was explicitly configured and whether its URL shape is valid, without exposing the internal origin.

## Release Note

The TypeScript Spacebar server serves the admin API at `/_spacebar/admin/api`. The Next.js dashboard is a separate app under `apps/admin-dashboard` and must be deployed as its own process behind `/_spacebar/admin`. The old C# `Spacebar.AdminApi` remains deprecated and should only be kept for rollback while the TypeScript dashboard deployment is validated.
