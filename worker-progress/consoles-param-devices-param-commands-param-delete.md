# DELETE /consoles/{param}/devices/{param}/commands/{param}

## Summary

Implemented the assigned authenticated `DELETE /consoles/{connection_type}/devices/{device_id}/commands/{command_id}` route for cancelling a console device command.

The route validates `connection_type` with the same supported console device connection-type helper used by the existing console device routes, accepts `playstation` and `playstation-stg`, rejects unsupported connection types with `BASE_TYPE_CHOICES`, and returns Discord-compatible `204` empty success. There is no local persisted console command queue yet, so cancellation is intentionally idempotent and does not invent command state.

## Changed Files

- `src/api/routes/consoles/#connection_type/devices/#device_id/commands/#command_id.ts`
- `test/routes/consolesCommandCancelRoute.test.ts`
- `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`
- `packages/missing-routes/missing.json`
- `assets/testing-manifest.json`
- `test/generated/http-contracts.json`
- `assets/openapi.json`
- `worker-progress/consoles-param-devices-param-commands-param-delete.md`

## Evidence Gathered

- `packages/missing-routes/missing.json` had one assigned missing entry before implementation:
    - `DELETE /consoles/{param}/devices/{param}/commands/{param}`
    - `route_name`: `DELETE_CONSOLES_CONNECTION_TYPE_DEVICES_DEVICE_ID_COMMANDS_COMMAND_ID`
    - sources: `userdoccers:resources/connected-accounts.mdx`, `xhyrom:data/client/routes.json`
    - source route: `/consoles/{connection_type}/devices/{device_id}/commands/{command_id}`
- `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json` and `src/api/routes/**` had no source route for this path before implementation.
- Userdoccers describes "Cancel Console Command" as `DELETE /consoles/{connection_type}/devices/{device_id}/commands/{command_id}` with `204` empty success.
- Existing `GET /consoles/{connection_type}/devices` support is limited to `playstation` and `playstation-stg`; this route shares that connection-type surface.

## Assigned Path

- Assigned path: `/consoles/{param}/devices/{param}/commands/{param}`
- Missing methods found: `DELETE`
- Methods implemented: `DELETE`
- Implemented source route: `/consoles/{connection_type}/devices/{device_id}/commands/{command_id}`
- Adjacent routes intentionally not implemented: `POST /consoles/{connection_type}/devices/{device_id}/commands`, console device listing semantics, Xbox console routes, connect-request creation, and broader console command persistence.

## What Changed

- Added `src/api/routes/consoles/#connection_type/devices/#device_id/commands/#command_id.ts`.
- Added route metadata:
    - summary: `Cancel Console Command`
    - `204` empty success
    - `400: APIErrorResponse`
    - `401: APIErrorResponse`
- Kept the route authenticated through normal bearer auth.
- Added focused route tests for:
    - assigned manifest route id declaration
    - `204` empty success for `playstation` and `playstation-stg`
    - unsupported connection-type `400` field error
    - route metadata and absence of a `200` response contract
- Regenerated source catalog, missing-route report, testing manifest, generated HTTP contract matrix, and OpenAPI.

## Missing-Route Movement

- Worker base movement before this current-base merge: `missing: 664 -> 663`, `spacebar: 516 -> 517`, `discord: 1128`.
- Current integration base before regeneration: `missing: 663`, `spacebar: 517`, `discord: 1128`.
- Current integration base after regeneration: `missing: 662`, `spacebar: 518`, `discord: 1128`.
- The assigned `DELETE /consoles/{param}/devices/{param}/commands/{param}` entry is absent from `packages/missing-routes/missing.json`.
- `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json` now contains `DELETE /consoles/{connection_type}/devices/{device_id}/commands/{command_id}` from `src/api/routes/consoles/#connection_type/devices/#device_id/commands/#command_id.ts`.

## Commands Run

- `npm run build:src:tsgo`
- `npx eslint src/api/routes/consoles/#connection_type/devices/#device_id/commands/#command_id.ts test/routes/consolesCommandCancelRoute.test.ts`
- `npm run build:test-fixtures`
- `node -r dotenv/config -r module-alias/register --enable-source-maps --test dist-test/test/routes/consolesCommandCancelRoute.test.js dist-test/src/api/routes/consoles/#connection_type/devices.test.js dist-test/test/routes/consolesConnectRequestCancelRoute.test.js`
- `npm run build --workspace @spacebar/automatic-reverse-engineering`
- `node packages/automatic-reverse-engineering/dist/cli.js import-source-routes --root src/api/routes --out packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`
- `npm run build --workspace @spacebar/missing-routes`
- `npm run start --workspace @spacebar/missing-routes`
- `npm run generate:testing-manifest`
- `node scripts/testing-manifest/verify.js`
- `node scripts/testing-manifest/generate-contract-tests.js --check` (reported stale contracts after the new route)
- `npm run generate:contract-tests`
- `node scripts/testing-manifest/generate-contract-tests.js --check`
- `node scripts/testing-manifest/generate-suite-coverage.js --check`
- `npm run generate:openapi`
- `node --test test/generated/http-contracts.test.js test/generated/suite-coverage.test.js`
- `npm run test:manifest`
- `npm run test:suite-coverage`
- `npx prettier --check src/api/routes/consoles/#connection_type/devices/#device_id/commands/#command_id.ts test/routes/consolesCommandCancelRoute.test.ts`
- `git diff --check`
- `git diff --exit-code -- package.json package-lock.json packages/automatic-reverse-engineering/package.json packages/missing-routes/package.json tsconfig.test.json`
- Conflict-marker scans over changed files with `rg`
- Changed-file malformed warranty-token scans with `rg`

## Verification Notes

- `npm run build:src:tsgo` passed.
- Focused ESLint passed.
- `npm run build:test-fixtures` passed.
- Focused compiled console route tests passed: 10 tests, 0 failures.
- Automatic reverse engineering package build and source import passed.
- Missing-routes package build/start passed and wrote `Spacebar is missing 662`, `Spacebar implements 518`, `Discord implements 1128`.
- Testing manifest verified: 623 entries.
- Generated HTTP contracts verified after regeneration: 598 contracts.
- Generated suite coverage verified without regeneration: 15 suites.
- `npm run generate:openapi` wrote `assets/openapi.json` with 412 paths and 997 schemas and included `DELETE /consoles/{connection_type}/devices/{device_id}/commands/{command_id}/`. Existing webhook metadata warnings remain outside this assignment.
- Generated HTTP contract and suite coverage tests passed: 13 tests, 0 failures.
- `npm run test:manifest` passed 30 tests plus manifest verification.
- `npm run test:suite-coverage` passed 4 tests.
- Focused Prettier checks passed.
- `git diff --check` passed.
- Package/lockfile/tsconfig guard showed no package, lockfile, workspace package, or `tsconfig.test.json` changes.
- Conflict-marker scans over changed files returned no matches.
- Malformed AGPL warranty-token scans over changed in-scope files returned no matches.
- Optional runtime auth contracts were not rerun during this current-base port; the previous full run in this merge stream failed only on the pre-existing unrelated public response-schema case `api:http:GET:/discovery/search` returning `500` instead of `200`.
- `npm run generate:schema` was not run because no schema files changed.

## Prompt-To-Artifact Audit

- Confirmed missing entry and absence in source catalog/routes: done.
- Compared Userdoccers/xHyroM only as needed: done.
- Inspected adjacent console device route patterns: done.
- Implemented exactly `DELETE /consoles/{param}/devices/{param}/commands/{param}`: done.
- Added focused production-route tests: done.
- Regenerated source catalog and missing report: done.
- Regenerated testing manifest, HTTP contracts, and OpenAPI: done.
- Checked suite coverage freshness: done.
- Ran required builds and focused/generated tests: done.
- Ran diff, package, conflict-marker, and warranty guards: done.
- Did not implement adjacent routes or broader console persistence: confirmed.

## Risks / Blockers

- Spacebar still lacks persisted console command create/send state. This route is therefore an idempotent compatibility cancel endpoint until those separate routes and backing state exist.
- The OpenAPI generator still reports unrelated webhook routes without `route()` metadata; this was not introduced by this change.

## Recommended Next Tasks

- Implement `POST /consoles/{connection_type}/devices/{device_id}/commands` separately if assigned, including source-backed command issuance semantics.
- Revisit shared console command persistence only when create/send/cancel routes are assigned together or source evidence requires durable state.
