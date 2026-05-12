# POST /applications/{param}/store-layout

Worker: `applications_param_store_layout_post`
Branch: `codex/current-missing-route-applications-param-store-layout-post-agent`
Worktree: `/Users/user/Developer/Developer/spacebarchat/worktrees/current-applications-param-store-layout-post-agent`

## Summary

Implemented only the assigned `POST /applications/{param}/store-layout` method. The route is bearer-authenticated, validates the application ID shape, requires application store access through the existing application authorization helper, and then fails closed with a typed `501` API error because Spacebar does not currently persist Discord application store layout state.

The sibling `GET /applications/{param}/store-layout` route was intentionally not implemented.

## Changed Files

- `src/api/routes/applications/#application_id/store-layout.ts`
  - New POST-only route module.
  - Exports focused helpers for route snowflake validation, access-checked mutation behavior, and the typed unsupported error.
  - Catches unknown application and application authorization errors into stable JSON responses before unsupported handling.
- `test/routes/applications-param-store-layout-post.test.ts`
  - Focused route tests for auth, access boundaries, fail-closed behavior, mounted error semantics, sibling-method non-implementation, and generated artifact movement.
- `assets/openapi.json`
- `assets/testing-manifest.json`
- `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`
- `packages/missing-routes/missing.json`
- `test/generated/http-contracts.json`
- `test/generated/suite-coverage.json`

## Evidence Gathered

- `packages/missing-routes/missing.json` initially contained:
  - `GET /applications/{param}/store-layout`, route name `GET_APPLICATIONS_APPLICATION_ID_STORE_LAYOUT`.
  - `POST /applications/{param}/store-layout`, route name `STORE_LAYOUT`.
- `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json` had no local source route for `/applications/{application_id}/store-layout` before implementation.
- `packages/automatic-reverse-engineering/data/catalogs/routes.xhyrom.catalog.json` lists `POST /applications/{application_id}/store-layout` as route name `STORE_LAYOUT`.
- `packages/automatic-reverse-engineering/data/catalogs/routes.userdoccers.catalog.json` lists only `GET /applications/{application_id}/store-layout` from `userdoccers:resources/store.mdx`.
- Userdoccers store docs (`https://docs.discord.food/resources/store`) document the GET response body fields `subscriptions`, `otps`, and `subscription_plans`, but do not document the assigned POST request/response shape.
- Existing nearby patterns used:
  - `src/api/routes/partner-sdk/applications/#application_id/storefront.ts` for application store access and unknown/authorization error conversion.
  - `src/api/routes/applications/shelf.ts` for explicit unsupported/fail-closed API behavior.
  - `src/api/util/utility/ApplicationAuthorization.ts` for `requireApplicationStoreAccess`.

## Missing-Route Movement

After regenerating `packages/missing-routes/missing.json`:

- `missing`: `530 -> 529`
- `spacebar`: `650 -> 651`
- `discord`: `1128`
- Removed assigned entry:
  - `POST /applications/{param}/store-layout`, route name `STORE_LAYOUT`
- Preserved sibling entry:
  - `GET /applications/{param}/store-layout`, route name `GET_APPLICATIONS_APPLICATION_ID_STORE_LAYOUT`

Source catalog now includes:

```json
{
  "method": "POST",
  "route": "/applications/{application_id}/store-layout",
  "route_name": "POST_APPLICATIONS_APPLICATION_ID_STORE_LAYOUT",
  "source": "src/api/routes/applications/#application_id/store-layout.ts",
  "response_schema_refs": ["APIErrorResponse"]
}
```

## Commands Run

- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run build:src:tsgo`
  - Initially failed because this worktree had no `node_modules` and `tsgo` was absent.
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm ci`
  - Passed; installed lockfile dependencies in the assigned worktree.
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run build:src:tsgo`
  - Passed.
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run generate:schema`
  - Passed.
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run generate:openapi`
  - Passed.
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run generate:testing-manifest`
  - Passed.
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run generate:contract-tests`
  - Passed.
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run generate:suite-coverage`
  - Passed.
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run build --workspace @spacebar/automatic-reverse-engineering`
  - Passed.
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" node packages/automatic-reverse-engineering/dist/cli.js import-source-routes --root src/api/routes --out packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`
  - Passed.
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run build --workspace @spacebar/missing-routes`
  - Passed.
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run start --workspace @spacebar/missing-routes`
  - Passed; wrote `missing: 529`, `spacebar: 651`, `discord: 1128`.
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run test -- test/routes/applications-param-store-layout-post.test.ts`
  - First run exposed unknown application API errors crossing the test ErrorHandler as 500; fixed by route-level unknown application conversion.
  - Final run passed: 4/4 tests.
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run build:test-fixtures`
  - Passed.
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" node -r dotenv/config -r module-alias/register --enable-source-maps --test dist-test/test/routes/applications-param-store-layout-post.test.js`
  - Passed: 4/4 tests.
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run test:manifest`
  - Passed; testing manifest verified with 756 entries.
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run test:suite-coverage`
  - Passed.
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run test:contracts`
  - Static contract generation/checks passed.
  - Runtime phase failed only on known unrelated `api:http:GET:/discovery/search` response-schema contract: `500 !== 200`.
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npx eslint 'src/api/routes/applications/#application_id/store-layout.ts' test/routes/applications-param-store-layout-post.test.ts`
  - Passed.
- `git diff --check`
  - Passed.
- `git diff -- package.json package-lock.json`
  - No output; package and lockfile unchanged.
- Malformed warranty-token scan against `src/api/routes/applications/#application_id/store-layout.ts` and `test/routes/applications-param-store-layout-post.test.ts`
  - No malformed warranty tokens found.

## Risks And Blockers

- Discord POST request and response semantics are not documented in Userdoccers; only xhyrom exposes the route name/path.
- Spacebar currently has no durable application store layout persistence/provider. Returning success or mutating unrelated application/SKU/listing records would fabricate state, so the route intentionally returns `501` after validating auth and application store access.
- `npm run test:contracts` is not green because of the known unrelated `api:http:GET:/discovery/search` runtime `500 !== 200` failure.

## Sibling Routes Intentionally Untouched

- `GET /applications/{param}/store-layout`
- `HEAD /applications/{param}/store-layout`
- `OPTIONS /applications/{param}/store-layout`
- `POST /applications/{param}/storefront/publish`

## Reconciliation Notes

- Current `packages/missing-routes/missing.json` contains only the sibling `GET /applications/{param}/store-layout` entry for this path.
- Current `routes.source.catalog.json`, OpenAPI, testing manifest, generated HTTP contracts, and suite coverage include the POST route from `src/api/routes/applications/#application_id/store-layout.ts`.
- Current route source declares only `router.post(`, and the focused artifact test also asserts no OpenAPI `GET`, `PUT`, `PATCH`, or `DELETE` operation was introduced for this path.
- `package.json` and `package-lock.json` are unchanged.
- Worktree changes are limited to the new route/test/progress report plus regenerated route-derived artifacts.

## Current-Base Replay

- Replayed source, focused test, and progress report onto main commit `3ed26e0b5`.
- Regenerated source catalog, missing-route report, OpenAPI, testing manifest, generated HTTP contracts, and suite coverage on current main.
- Current-base movement: `missing 527 -> 526`, `spacebar 653 -> 654`, `discord 1128`.
- Current-base generated artifacts: OpenAPI `538` paths / `1191` schemas, testing manifest `759` entries, generated HTTP contracts `734`.
- Current-base verification passed `build:src:tsgo`, `build:test-fixtures`, focused compiled route tests `4/4`, manifest verification, generated contract check, suite coverage check, generated contract matrix `10/10`, `test:manifest` `30/30`, `test:suite-coverage` `4/4`, targeted ESLint, malformed warranty-token scan, `git diff --check`, and package/lockfile guard.
- `npm run test:contracts` passed generated/static checks and failed only on the known unrelated runtime contract `api:http:GET:/discovery/search` returning `500 !== 200`.

## Recommended Next Tasks

- Implement `GET /applications/{param}/store-layout` separately once assigned, using the Userdoccers response shape and a real local layout/listing/subscription-plan source.
- Design durable store layout storage before changing this POST route from fail-closed behavior to a successful mutation.
