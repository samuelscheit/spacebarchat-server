# Worker Progress: PUT /users/@me/connections/{param}/{param}

## Summary

Implemented only the assigned `PUT /users/@me/connections/{param}/{param}` route for xHyroM route name `CONNECTION`.

The new method is mounted on the existing current-user connection router, reuses the local connection modification persistence path, validates `ConnectionUpdateSchema`, rejects unknown and revoked connections with the existing Discord API errors, persists normalized visibility fields, returns the updated `ConnectedAccountDTO`, and emits `USER_CONNECTIONS_UPDATE` for the assigned `PUT` mutation.

## Assigned Scope

- Assigned method/path: `PUT /users/@me/connections/{param}/{param}`
- Assigned route name: `CONNECTION`
- Missing methods found for assigned path before implementation: `PUT` only
- Method implemented: `PUT`
- Source catalog route name after implementation: `PUT_USERS__ME_CONNECTIONS_CONNECTION_NAME_CONNECTION_ID`
- Sibling methods intentionally not implemented: no new `PATCH` or `DELETE` route work; existing `PATCH` and `DELETE` remain registered on the same source file.
- Adjacent paths intentionally untouched: `/users/@me/connections/{param}/{param}/refresh`, `/users/@me/connections/contacts/*`, `/users/@me/connections/domain/{param}`, `/users/@me/connections/reddit/{param}/subreddits`, and connection OAuth callback/authorize routes.

## Missing-Route Movement

- Before regeneration on the accepted integration base: `480` missing, `700` implemented, `1128` Discord.
- After regeneration on the accepted integration base: `479` missing, `701` implemented, `1128` Discord.
- `PUT /users/@me/connections/{param}/{param}` was removed from `packages/missing-routes/missing.json`.
- The assigned path no longer appears in `missing_routes.routes[]` or `missing_entries[]`.

## Changed Files

- `src/api/routes/users/@me/connections/#connection_name/#connection_id/index.ts`
- `src/api/routes/users/@me/connections/#connection_name/#connection_id/index.test.ts`
- `assets/openapi.json`
- `assets/testing-manifest.json`
- `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`
- `packages/missing-routes/missing.json`
- `test/generated/http-contracts.json`
- `test/generated/suite-coverage.json`
- `worker-progress/put_users_me_connections_param_param.md`

## Evidence Sources

- `packages/missing-routes/missing.json` initially contained exactly one assigned entry: `{ "method": "PUT", "route": "/users/@me/connections/{param}/{param}", "route_name": "CONNECTION" }`.
- `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json` had `DELETE` and `PATCH` for `/users/@me/connections/{connection_name}/{connection_id}`, but no `PUT`.
- `packages/automatic-reverse-engineering/data/catalogs/routes.xhyrom.catalog.json` lists `PUT /users/@me/connections/{param}/{param}` with route name `CONNECTION`.
- `packages/automatic-reverse-engineering/data/catalogs/routes.userdoccers.catalog.json` documents the same connection path for `DELETE` and `PATCH`, but not `PUT`.
- Userdoccers raw source checked: `https://raw.githubusercontent.com/discord-userdoccers/discord-userdoccers/master/pages/resources/connected-accounts.mdx`
    - Modify User Connection returns a connection object.
    - Modification can fire `USER_CONNECTIONS_UPDATE`.
    - The documented body includes visibility/activity-style fields.
- Existing local implementation in `src/api/routes/users/@me/connections/#connection_name/#connection_id/index.ts` already persisted current-user connection modifications and returned `ConnectedAccountDTO`.

## Behavior Notes

- The route remains bearer-authenticated through the standard API route stack.
- `PUT` uses the existing `ConnectionUpdateSchema` and local boolean-to-`0`/`1` normalization for `visibility`, `show_activity`, and `metadata_visibility`.
- Unknown connections return `DiscordApiErrors.UNKNOWN_CONNECTION`.
- Revoked connections return `DiscordApiErrors.CONNECTION_REVOKED` and do not update storage.
- Successful `PUT` updates the matching `ConnectedAccount`, returns the DTO, and emits `USER_CONNECTIONS_UPDATE`.
- Existing `PATCH` behavior was refactored through a shared update helper and covered by existing focused tests; this implementation did not add another generated `PATCH` route or change the registered `PATCH`/`DELETE` method set.

## Commands Run

- `npm run build:src:tsgo`
- `npm run generate:openapi`
- `npm run build --workspace @spacebar/automatic-reverse-engineering`
- `node packages/automatic-reverse-engineering/dist/cli.js import-source-routes --root src/api/routes --out packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`
- `npm run build --workspace @spacebar/missing-routes`
- `npm run start --workspace @spacebar/missing-routes`
- `npm run generate:testing-manifest`
- `npm run generate:contract-tests`
- `npm run generate:suite-coverage`
- `npx prettier --write src/api/routes/users/@me/connections/#connection_name/#connection_id/index.ts src/api/routes/users/@me/connections/#connection_name/#connection_id/index.test.ts assets/openapi.json assets/testing-manifest.json packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json packages/missing-routes/missing.json test/generated/http-contracts.json test/generated/suite-coverage.json worker-progress/put_users_me_connections_param_param.md`
- `npm run build:test-fixtures`
- `node -r dotenv/config -r module-alias/register --enable-source-maps --test 'dist-test/src/api/routes/users/@me/connections/#connection_name/#connection_id/index.test.js'`
- `npm run test:manifest`
- `npm run test:suite-coverage`
- `npx eslint 'src/api/routes/users/@me/connections/#connection_name/#connection_id/index.ts' 'src/api/routes/users/@me/connections/#connection_name/#connection_id/index.test.ts'`
- `git diff --check`
- `git status --short package.json package-lock.json`
- `git diff -- package.json package-lock.json`
- `npm run test:contracts`

## Current Verification Results

- `npm run build:src:tsgo`: passed.
- `npm run generate:openapi`: passed; specification contains `566` paths and `1234` schemas, with only pre-existing webhook route-metadata warnings.
- `npm run build --workspace @spacebar/automatic-reverse-engineering`: passed.
- `import-source-routes`: passed.
- `npm run build --workspace @spacebar/missing-routes`: passed.
- `npm run start --workspace @spacebar/missing-routes`: passed; missing count is now `479`, implemented count is `701`.
- `npm run generate:testing-manifest`: passed; `806` entries.
- `npm run generate:contract-tests`: passed; `781` contracts.
- `npm run generate:suite-coverage`: passed; `15` suites.
- Prettier formatting: passed.
- `npm run build:test-fixtures`: passed.
- Focused compiled route test: passed (`6` tests across existing `PATCH` and new `PUT` suites).
- `npm run test:manifest`: passed (`806` entries).
- `npm run test:suite-coverage`: passed.
- Targeted ESLint: passed.
- `git diff --check`: passed.
- Package/lockfile guard: passed; `package.json` and `package-lock.json` unchanged.
- `npm run test:contracts`: generated/static contract checks passed, runtime failed only on the known unrelated `api:http:GET:/discovery/search` response-schema assertion (`500 !== 200`), matching the orchestrator note.

## Risks / Blockers

- `PUT` is only present in the xHyroM route catalog; Userdoccers documents modification semantics under `PATCH`, so this implementation maps `PUT` to the existing local connection update semantics rather than introducing a separate full-replace model.
- The current local `ConnectionUpdateSchema` accepts boolean visibility fields. Userdoccers describes some fields as integer visibility settings and also lists `name`/`friend_sync`; expanding that schema would affect existing `PATCH` behavior and should be handled as a separate scoped route/schema audit.
- Existing `PATCH` gateway-event parity remains a separate follow-up. This implementation added the event side effect only to the assigned `PUT` method.

## Recommended Next Tasks

- Separately audit `PATCH /users/@me/connections/{connection_type}/{connection_id}` against Userdoccers for `USER_CONNECTIONS_UPDATE` parity and schema completeness.
- Implement assigned missing sibling paths separately, especially `/users/@me/connections/{param}/{param}/refresh`, contact sync routes, and domain connection creation, only with source-backed local behavior.
