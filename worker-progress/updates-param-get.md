# updates_param_get

## Summary

Implemented `GET /updates/{release_channel}` in `src/api/routes/updates.ts`.

The route is public, accepts `platform?` with a default of `osx`, supports the
documented desktop release channels (`stable`, `ptb`, `canary`,
`development`), and returns the latest enabled `ClientRelease` row that
explicitly matches both `platform` and `release_channel`. It returns `404: Not
Found` for unsupported channels or absent local release data.

I did not fabricate Discord updater manifest/module/delta payloads. Spacebar
currently has local durable backing only through `ClientRelease`, so this route
returns the existing `UpdatesResponse` shape from locally configured release
rows and fails closed otherwise.

## Assigned Scope

- Assigned path: `/updates/{param}`
- Missing method found: `GET_UPDATES_RELEASE_CHANNEL`
- Source route: `/updates/{release_channel}`
- Source docs: `userdoccers:topics/client-distribution.mdx`
- Implemented method: `GET /updates/:release_channel`
- Adjacent routes not implemented: distributed app manifests, downloads,
  installers, modules, updater mutations, experiments.

## Evidence Gathered

- `packages/missing-routes/missing.json` had exactly one assigned missing
  entry:
    - `GET /updates/{param}` / `GET_UPDATES_RELEASE_CHANNEL`
- `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`
  initially had only:
    - `GET /updates`
- `src/api/routes/updates.ts` initially had only:
    - `router.get("/")`
- Userdoccers client distribution docs say `GET /updates/{release_channel}`
  returns latest host update info, has `platform?` default `osx`, and response
  fields `name`, `pub_date`, optional `url`, optional `notes`.
- Local `ClientRelease` has `name`, `pub_date`, `url`, `platform`,
  `release_channel`, `arch`, `enabled`, and `notes`, so release-channel
  filtering is locally backed.

## Changed Files

- `src/api/routes/updates.ts`
    - Added release-channel route.
    - Added helpers for platform parsing, release-channel validation, latest
      release lookup, and response serialization.
    - Kept root `/updates` behavior backed by `ClientRelease`, now using the
      shared platform/serializer helpers.
- `src/api/middlewares/NoAuthorizationRoutes.ts`
    - Added public no-auth rule for `GET|HEAD /updates/:release_channel`.
- `test/routes/updates-route.test.ts`
    - Added focused route/helper/artifact tests.
- `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`
    - Regenerated; now includes `GET /updates/{release_channel}`.
- `packages/missing-routes/missing.json`
    - Regenerated; assigned missing entry removed.
- `assets/testing-manifest.json`
    - Regenerated; now includes `api:http:GET:/updates/:release_channel`.
- `test/generated/http-contracts.json`
    - Regenerated; now includes contract metadata for the route.
- `assets/openapi.json`
    - Regenerated; now includes `/updates/{release_channel}`.

## Missing Count Movement

- Worker base before: `missing=624`, `spacebar=556`, `discord=1128`; assigned
  `GET /updates/{param}` present.
- Worker after regeneration: `missing=623`, `spacebar=557`, `discord=1128`;
  assigned `GET /updates/{param}` absent.
- Orchestrator current-base regeneration after port onto `2548dd5c4`: missing
  `623 -> 622`, spacebar `557 -> 558`, discord `1128`; assigned
  `GET /updates/{param}` absent.

## Commands Run

Worker commands:

- `npm ci` - passed; installed missing worktree dependencies from lockfile.
- `npm run build:src:tsgo` - first attempt failed before dependency install
  with `TS2688: Cannot find type definition file for 'node'`; rerun after
  `npm ci` passed.
- `npm run build --workspace @spacebar/automatic-reverse-engineering` - passed.
- `node packages/automatic-reverse-engineering/dist/cli.js import-source-routes --root src/api/routes --out packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json` -
  passed.
- `npm run build --workspace @spacebar/missing-routes` - passed.
- `npm run start --workspace @spacebar/missing-routes` - passed; wrote missing
  count 623.
- `npm run generate:testing-manifest` - passed; wrote 662 entries.
- `npm run generate:contract-tests` - passed; wrote 637 contracts.
- `npm run generate:suite-coverage` - passed; wrote 15 suites.
- `npm run generate:openapi` - passed; wrote 451 paths and 1045 schemas;
  existing webhook missing-`route()` warnings remain.
- `npm run build:test-fixtures` - passed.
- `node -r dotenv/config -r module-alias/register --enable-source-maps --test dist-test/test/routes/updates-route.test.js` -
  passed, 8 tests.
- `npm run test:manifest` - passed, 30 tests; manifest verified.
- `npm run test:contracts` - static contract checks passed; runtime substep
  failed on unrelated `api:http:GET:/discovery/search` returning 500 instead
  of expected 200 in `generated HTTP public response-schema contracts match
real API responses`.
- `npm run test:suite-coverage` - passed, 4 tests.
- `node scripts/testing-manifest/generate-contract-tests.js --check` - passed
  during final audit; generated contracts are fresh.
- `node scripts/testing-manifest/generate-suite-coverage.js --check` - passed
  during final audit; suite coverage is fresh.
- Schema/package/lockfile guard:
  `git diff -- src/schemas assets/schemas.json package.json package-lock.json` -
  no diff, so `npm run generate:schema` was not required.
- `git diff --check` - passed.
- Package/lockfile guard: `git diff -- package.json package-lock.json` - no
  diff.
- Malformed warranty-token scan over source, test, package, app, doc, extra,
  and script paths - no matches.

Orchestrator current-base commands:

- `npm run build:src:tsgo` - passed.
- `npm run generate:schema` - passed.
- `npm run build --workspace @spacebar/automatic-reverse-engineering` -
  passed.
- `node packages/automatic-reverse-engineering/dist/cli.js import-source-routes --root src/api/routes --out packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json` -
  passed.
- `npm run build --workspace @spacebar/missing-routes` - passed.
- `npm run start --workspace @spacebar/missing-routes` - passed; wrote
  missing `622`, spacebar `558`, discord `1128`.
- `npm run generate:testing-manifest` - passed; wrote `663` entries.
- `node scripts/testing-manifest/verify.js` - passed.
- `node scripts/testing-manifest/generate-contract-tests.js --check` -
  initially reported stale generated contracts before current-base
  regeneration.
- `npm run generate:contract-tests` - passed; wrote `638` contracts.
- `node scripts/testing-manifest/generate-contract-tests.js --check` - passed.
- `node scripts/testing-manifest/generate-suite-coverage.js --check` -
  passed.
- `npm run generate:openapi` - passed; wrote `452` paths and `1055` schemas;
  existing missing-router warnings for analytics query files remain.
- `npm run build:test-fixtures` - passed.
- `node -r dotenv/config -r module-alias/register --enable-source-maps --test dist-test/test/routes/updates-route.test.js` -
  passed, 8 tests.
- `node --test test/generated/http-contracts.test.js` - passed, 9 tests.
- `node --test test/generated/suite-coverage.test.js` - passed, 4 tests.
- `npm run test:manifest` - passed, 30 tests; manifest verified with `663`
  entries.
- `npm run test:suite-coverage` - passed.
- `npm run test:contracts` - static contract checks passed with `638`
  contracts, then runtime failed only on the known unrelated
  `api:http:GET:/discovery/search` assertion (`500 !== 200`); existing
  analytics route-registration warnings also remain.
- `npm run lint` - passed.
- `git diff --check` - passed.
- Package/lockfile guard: `git diff -- package.json package-lock.json` - no
  diff.
- Changed-file warranty-token scan over the touched source/test files found
  only the expected AGPL header lines.

## Artifact Status

- Source catalog regenerated and contains `GET /updates/{release_channel}` from
  `src/api/routes/updates.ts`.
- Missing report regenerated and no longer contains assigned
  `GET /updates/{param}`.
- Testing manifest regenerated and contains
  `api:http:GET:/updates/:release_channel` with `authMode=public`, responses
  `UpdatesResponse` and `APIErrorResponse`, statuses `[200,404]`.
- HTTP contract matrix regenerated and contains
  `api:http:GET:/updates/:release_channel`.
- OpenAPI regenerated and contains `/updates/{release_channel}` with path
  parameter `release_channel`, query parameter `platform`, `200
UpdatesResponse`, and `404 APIErrorResponse`.
- Suite coverage regenerated; no diff after regeneration.

## Risks And Blockers

- `npm run test:contracts` has an out-of-scope runtime failure on
  `GET /discovery/search`, not on `/updates/:release_channel`. The new updates
  route is parameterized, so it is not part of the runtime public
  response-schema contract filter that failed; its public auth-boundary coverage
  passed as part of that runtime run.
- The route intentionally returns 404 unless `ClientRelease.release_channel` is
  explicitly populated. This avoids treating older channel-less release rows as
  a stable-channel update.

## Prompt-To-Artifact Audit

- Confirmed assigned missing entry and route absence before implementation.
- Compared Userdoccers only for auth/public nature, release channel, query
  default, response shape, and deprecation note.
- Implemented only `/updates/{release_channel}` and a tiny no-auth addition.
- Reused local `ClientRelease` storage and existing `UpdatesResponse`.
- Added focused helper, route, auth-boundary, fail-closed, and artifact metadata
  tests.
- Regenerated source catalog, missing report, testing manifest, HTTP contracts,
  suite coverage, and OpenAPI.
- Verified generated contracts and suite coverage are fresh with explicit
  `--check` commands.
- Verified schemas, package, and lockfile are unchanged.
- Verified malformed warranty tokens absent.

## Recommended Next Tasks

- Orchestrator can merge this route after reviewing the out-of-scope
  `GET /discovery/search` runtime contract failure.
- If future work adds durable distributed updater manifests, implement
  `/updates/distributions/app/manifests/latest` separately rather than
  expanding this legacy route.
