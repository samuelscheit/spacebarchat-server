# PUT /users/@me/applications/{param}/role-connection

## Summary

Implemented only `PUT /users/@me/applications/{application_id}/role-connection`.

The route is authenticated, requires an OAuth2 token with `role_connections.write`, verifies that the token's application claim matches the path `application_id`, validates the documented nullable payload, and dispatches to an injectable updater. The default updater fails closed with `501` because Spacebar does not currently have durable per-user application role connection storage; it does not pretend that request data was persisted.

## Changed Files

- `src/api/routes/users/@me/applications/#application_id/role-connection.ts`
- `src/schemas/uncategorised/ApplicationRoleConnectionModifySchema.ts`
- `src/schemas/uncategorised/index.ts`
- `test/routes/users-me-applications-param-role-connection-put.test.ts`
- `test/routes/users-me-applications-param-role-connection-get.test.ts`
- `test/routes/users-me-applications-role-connections.test.ts`
- `assets/schemas.json`
- `assets/openapi.json`
- `assets/testing-manifest.json`
- `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`
- `packages/missing-routes/missing.json`
- `test/generated/http-contracts.json`
- `test/generated/suite-coverage.json`

## Assigned Path Movement

- Assigned method: `PUT`
- Assigned missing path: `/users/@me/applications/{param}/role-connection`
- Source route: `/users/@me/applications/{application_id}/role-connection`
- Route name: `PUT_USERS__ME_APPLICATIONS_APPLICATION_ID_ROLE_CONNECTION`
- Before regeneration: `routes=397`, `missing_entries=487`
- After regeneration: `routes=396`, `missing_entries=486`
- Current-base acceptance regeneration: `routes=391`, `missing_entries=481`,
  `spacebar=699`, `discord=1128`
- Assigned missing entries after regeneration: `[]`

## Evidence

- `packages/missing-routes/missing.json` initially included the assigned `PUT /users/@me/applications/{param}/role-connection`; after regeneration it is absent.
- `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json` now contains both singular `GET` and `PUT` role-connection entries; the `PUT` entry uses `ApplicationRoleConnectionModifySchema`.
- `packages/automatic-reverse-engineering/data/catalogs/routes.userdoccers.catalog.json` documents the singular `GET` and `PUT` route from `userdoccers:resources/application.mdx`.
- `packages/automatic-reverse-engineering/data/catalogs/routes.xhyrom.catalog.json` only documents the plural `/users/@me/applications/role-connections` route, so it was not used as the source of truth for this singular `PUT`.

## Behavior Notes

- Missing bearer auth remains `401 Missing Authorization Header`.
- Missing `role_connections.write` returns existing `DiscordApiErrors.MISSING_REQUIRED_OAUTH2_SCOPE`.
- Missing or mismatched application claim returns existing `DiscordApiErrors.INVALID_OAUTH_TOKEN`.
- Accepted application id claims follow the existing singular GET behavior: `application_id`, `client_id`, nested `application.id`, `azp`, or `aud`.
- Omitted or nullable body fields normalize to `{ platform_name: null, platform_username: null, metadata: {} }`.
- `platform_name` is limited to 50 characters and `platform_username` to 100 characters through the generated schema.
- Metadata values are additionally checked at runtime for a 100-character maximum because the schema generator does not preserve the JSDoc max length on map `additionalProperties`.
- The default updater returns `501` with `APPLICATION_ROLE_CONNECTION_UPDATE_UNSUPPORTED_MESSAGE` instead of echoing the payload as persisted state.

## Adjacent Routes Intentionally Untouched

- `POST/PATCH/DELETE /users/@me/applications/{application_id}/role-connection`
- Existing singular `GET /users/@me/applications/{application_id}/role-connection` behavior, except test expectations that now assert `PUT` is implemented
- Existing plural `GET /users/@me/applications/role-connections` behavior, except stale missing-route expectations
- OAuth role connection callbacks and verification flows
- Application role-connection metadata management
- Guild role connection eligibility/configuration routes
- Billing, entitlements, application ownership, and unrelated current-user application routes

## Commands Run

- `npm run build:src:tsgo`
    - Initial attempt failed because the assigned worktree had no installed `node_modules` and `tsgo` was missing.
- `npm ci`
- `npm run build:src:tsgo`
- `npm run generate:schema`
- `npm run generate:openapi`
    - Passed with existing unrelated webhook route metadata warnings.
- `npm run build --workspace @spacebar/automatic-reverse-engineering`
- `node packages/automatic-reverse-engineering/dist/cli.js import-source-routes --root src/api/routes --out packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`
- `npm run build --workspace @spacebar/missing-routes`
- `npm run start --workspace @spacebar/missing-routes`
    - Reported `Spacebar is missing 486`, `Spacebar implements 694`, `Discord implements 1128`.
- `npm run generate:testing-manifest`
- `npm run generate:contract-tests`
- `npm run generate:suite-coverage`
- `npm run build:test-fixtures`
- `node -r dotenv/config -r module-alias/register --enable-source-maps --test dist-test/test/routes/users-me-applications-param-role-connection-put.test.js dist-test/test/routes/users-me-applications-param-role-connection-get.test.js dist-test/test/routes/users-me-applications-role-connections.test.js`
- `npm run test:manifest`
- `npm run test:suite-coverage`
- `npm run test:contracts`
    - Failed only on the known unrelated runtime contract `api:http:GET:/discovery/search`, which returned `500 !== 200`.
- `npx eslint --max-warnings=0 'src/api/routes/users/@me/applications/#application_id/role-connection.ts' src/schemas/uncategorised/ApplicationRoleConnectionModifySchema.ts src/schemas/uncategorised/index.ts test/routes/users-me-applications-param-role-connection-put.test.ts test/routes/users-me-applications-param-role-connection-get.test.ts test/routes/users-me-applications-role-connections.test.ts`
- `git diff --check`
- Package and lockfile guard: no `package.json`, `package-lock.json`, `npm-shrinkwrap.json`, `yarn.lock`, or `pnpm-lock.yaml` diff.
- Malformed AGPL warranty-token scan on touched files: passed.

## Verification Result

Passing:

- Source build via `npm run build:src:tsgo`
- Schema and OpenAPI generation
- Source route catalog import
- Missing-route regeneration
- Testing manifest, contract, and suite coverage generation
- Test fixture build
- Focused route tests: 15 passed
- `npm run test:manifest`
- `npm run test:suite-coverage`
- Targeted ESLint
- `git diff --check`
- Package and lockfile guard
- Malformed AGPL warranty-token scan on touched files

Known unrelated failure:

- `npm run test:contracts` failed only on `api:http:GET:/discovery/search` returning `500 !== 200`. Generated contract checks had already passed before that runtime failure.

## Risks Or Blockers

- The default `PUT` implementation is intentionally non-persistent and returns `501` because durable current-user per-application role connection storage is not present.
- A real persisted implementation should replace the injectable updater with backing storage that makes subsequent `GET` responses truthful.
- `npm ci` was required in this worktree because dependencies were missing; it produced no package or lockfile diff.

## Reconciliation

No merge or rebase was performed in this worker. Reconcile against the current integration branch before orchestrator merge if the base advanced while this worker was running.

Current-base acceptance replayed the route/schema/test/report changes onto
`b2a95673f`, patched the current schema export manually, and regenerated
schemas, OpenAPI, source routes, missing routes, testing manifest, generated
contracts, and suite coverage from the formatted current source.

Current-base verification passed source build, schema/OpenAPI generation, ARE
build/import, missing-route generation, manifest generation/verification with
`804` entries, generated contracts with `779` contracts, suite coverage checks,
test-fixture build, focused compiled role-connection tests `15/15`, targeted
ESLint, `git diff --check`, and package/lockfile guard. Full
`npm run test:contracts` passed generated/static checks and failed only on the
known unrelated runtime assertion: `api:http:GET:/discovery/search` returned
`500 !== 200`.
