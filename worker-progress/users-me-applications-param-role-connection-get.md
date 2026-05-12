# GET /users/@me/applications/{param}/role-connection

## Summary

Implemented `GET /users/@me/applications/{application_id}/role-connection` only.

The route is authenticated, requires an OAuth2 token with `role_connections.write`, verifies the token's application claim matches the path `application_id`, and returns Spacebar's locally truthful default role connection:

```json
{
    "platform_name": null,
    "platform_username": null,
    "metadata": {}
}
```

Spacebar does not currently have durable per-user per-application role connection storage, so the implementation does not fabricate platform account data, application metadata, OAuth callback state, guild role state, entitlement data, or application configuration.

## Changed Files

- `src/api/routes/users/@me/applications/#application_id/role-connection.ts`
- `test/routes/users-me-applications-param-role-connection-get.test.ts`
- `assets/openapi.json`
- `assets/testing-manifest.json`
- `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`
- `packages/missing-routes/missing.json`
- `test/generated/http-contracts.json`
- `test/generated/suite-coverage.json`

## Assigned Path Movement

- Assigned method: `GET`
- Assigned missing path: `/users/@me/applications/{param}/role-connection`
- Source route: `/users/@me/applications/{application_id}/role-connection`
- Route name: `GET_USERS__ME_APPLICATIONS_APPLICATION_ID_ROLE_CONNECTION`
- Before regeneration: `missing=591`, `spacebar=589`
- After regeneration: `missing=590`, `spacebar=590`
- Remaining adjacent entry: `PUT /users/@me/applications/{param}/role-connection`

## Evidence Gathered

- `packages/missing-routes/missing.json` initially had both `GET` and `PUT` entries for `/users/@me/applications/{param}/role-connection`; after regeneration only `PUT` remains.
- `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json` initially only had the plural `/users/@me/applications/role-connections` local route; after import it includes the singular `GET` route.
- `packages/automatic-reverse-engineering/data/catalogs/routes.userdoccers.catalog.json` includes `GET` and `PUT` singular entries from `userdoccers:resources/application.mdx`.
- `packages/automatic-reverse-engineering/data/catalogs/routes.xhyrom.catalog.json` includes only the plural `GET/HEAD/OPTIONS /users/@me/applications/role-connections`, not the singular route.
- Userdoccers page `https://docs.discord.food/resources/application` documents that the singular GET returns an application role connection object without optional fields and requires `role_connections.write`.
- Official Discord user resource `https://docs.discord.com/developers/resources/user` confirms the role connection object fields and the OAuth2 scope requirement.

## Behavior Notes

- Missing bearer auth remains `401 Missing Authorization Header`.
- Missing `role_connections.write` returns existing `DiscordApiErrors.MISSING_REQUIRED_OAUTH2_SCOPE`.
- Missing or mismatched application claim returns existing `DiscordApiErrors.INVALID_OAUTH_TOKEN`.
- Accepted application id claims follow existing local OAuth patterns: `application_id`, `client_id`, nested `application.id`, `azp`, or `aud`.
- The response omits optional `application` and `application_metadata` because there is no durable local backing for those values.

## Adjacent Routes Intentionally Untouched

- `PUT /users/@me/applications/{application_id}/role-connection`
- `PATCH/DELETE /users/@me/applications/{application_id}/role-connection`
- OAuth role connection callbacks and verification flows
- Application role-connection metadata management
- Guild role connection eligibility/configuration routes
- Billing, entitlements, application ownership, and unrelated current-user application routes
- Existing plural `GET /users/@me/applications/role-connections`

## Commands Run

- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run build:src:tsgo`
  - Initial attempt failed because this worktree had no installed `node_modules` and `tsgo` was missing.
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm ci`
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run build:src:tsgo`
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run generate:schema`
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run generate:openapi`
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run build --workspace @spacebar/automatic-reverse-engineering`
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" node packages/automatic-reverse-engineering/dist/cli.js import-source-routes --root src/api/routes --out packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run build --workspace @spacebar/missing-routes`
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run start --workspace @spacebar/missing-routes`
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run generate:testing-manifest`
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run generate:contract-tests`
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run generate:suite-coverage`
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npx prettier --write src/api/routes/users/@me/applications/#application_id/role-connection.ts test/routes/users-me-applications-param-role-connection-get.test.ts`
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" TS_NODE_TRANSPILE_ONLY=1 node -r dotenv/config -r ts-node/register/transpile-only -r module-alias/register --enable-source-maps --test test/routes/users-me-applications-param-role-connection-get.test.ts src/schemas/responses/ApplicationRoleConnectionsResponse.test.ts`
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" node scripts/testing-manifest/verify.js`
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run build:test-fixtures`
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" node scripts/testing-manifest/generate-contract-tests.js --check`
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" node --test test/generated/http-contracts.test.js test/contracts/*.test.cjs`
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" node scripts/testing-manifest/generate-suite-coverage.js --check`
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" node --test test/generated/suite-coverage.test.js`
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run test:contracts`
  - Failed only on known unrelated runtime contract: `api:http:GET:/discovery/search` returned `500 !== 200`.
- `git diff --check`
- `git diff -- package.json package-lock.json`
- `rg -n 'MERMER|MERCHANTIBILITY' src/api/routes/users/@me/applications/#application_id/role-connection.ts test/routes/users-me-applications-param-role-connection-get.test.ts`

## Verification Result

Passing:

- Source build via `npm run build:src:tsgo`
- Focused route/schema tests
- OpenAPI/schema generation
- Source route catalog generation
- Missing-route regeneration
- Testing manifest generation and verification
- Generated HTTP contract generation/checks
- Generated suite coverage generation/checks
- `npm run build:test-fixtures`
- `git diff --check`
- Package/lockfile guard: no `package.json` or `package-lock.json` diff
- New file warranty spelling guard

Known unrelated failure:

- `npm run test:contracts` fails in runtime public response-schema coverage for `api:http:GET:/discovery/search` with `500 !== 200`, matching the prompt's known unrelated failure condition.

## Risks Or Blockers

- This is a default, non-persistent role connection response because Spacebar has no durable current-user per-application role connection storage today.
- The route enforces OAuth scope and application claim locally, but it does not validate application existence or metadata records because doing so would broaden the assigned scope into application role-connection metadata management.
- `npm ci` was required because the assigned worktree initially had no dependencies installed; it produced no package or lockfile diff.

## Reconciliation

No merge/rebase/reconciliation was performed in this worker. Reconcile against current main before orchestrator merge if main advanced beyond the assigned integration base `0e6d61c85`.

## Recommended Next Tasks

- Implement the remaining `PUT /users/@me/applications/{application_id}/role-connection` only when durable role connection write semantics are assigned.
- Add durable storage for application-scoped user role connection state before exposing non-default platform or metadata values.

## Integration Acceptance

- Accepted into the main checkout on 2026-05-12 from current integration base `7bf94e40b`.
- Ported only the worker-owned route, focused test, and worker progress report; generated artifacts were regenerated from the main checkout.
- Current main missing-route movement after regeneration: `589 -> 588` missing, `591 -> 592` implemented, Discord `1128` unchanged.
- `npm run build:src:tsgo`: passed.
- `npm run generate:openapi`: passed; wrote 483 paths and 1118 schemas with the existing unrelated webhook route metadata warnings.
- `npm run build --workspace @spacebar/automatic-reverse-engineering`: passed.
- Source route catalog import, missing-routes build, and `npm run start --workspace @spacebar/missing-routes`: passed; wrote 588 missing / 592 implemented.
- `npm run generate:testing-manifest`: passed; wrote 697 entries.
- `npm run generate:contract-tests`: passed; wrote 672 contracts.
- `npm run generate:suite-coverage`: passed; wrote 15 suites.
- `npm run build:test-fixtures`: passed.
- `npm run test -- test/routes/users-me-applications-param-role-connection-get.test.ts src/schemas/responses/ApplicationRoleConnectionsResponse.test.ts`: passed, 6 tests.
- `node scripts/testing-manifest/verify.js`: passed, 697 entries.
- `npm run generate:contract-tests -- --check`: passed, 672 contracts.
- `npm run generate:suite-coverage -- --check`: passed.
- `npm run test:manifest`: passed, 30 tests and manifest verify.
- `node --test test/generated/http-contracts.test.js test/contracts/*.test.cjs`: passed, 10 tests.
- `npm run test:suite-coverage`: passed, 4 tests.
- `npm run lint`: passed.
- `git diff --check`: passed.
- Package and lockfile guard: passed; no package or lockfile changes.
- Changed source/test AGPL malformed warranty-token scan: passed; the only match was this report's command ledger entry.
- `npm run test:contracts`: failed only on the known unrelated baseline runtime assertion `api:http:GET:/discovery/search` returning `500 !== 200`; generated contract checks passed before that failure.
