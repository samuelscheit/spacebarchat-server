# GET /users/@me/consent

## Summary

Implemented only `GET /users/@me/consent` as an authenticated current-user route. The route returns Spacebar's locally truthful conservative consent state:

```json
{
    "personalization": { "consented": false },
    "usage_statistics": { "consented": false }
}
```

Spacebar still has no persisted personalization or usage-statistics consent model. READY and this endpoint now share the same default non-consented personalization state through `createDefaultReadyUserConsents`; the endpoint adds Userdoccers' endpoint-only `usage_statistics` key as not consented.

## Changed Files

- `src/api/routes/users/@me/consent.ts`
- `src/schemas/responses/UserConsentsResponse.ts`
- `src/schemas/responses/index.ts`
- `src/util/util/UserConsents.ts`
- `src/util/util/index.ts`
- `src/gateway/util/ReadyConsents.ts`
- `test/routes/users-me-consent-get.test.ts`
- `assets/schemas.json`
- `assets/openapi.json`
- `assets/testing-manifest.json`
- `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`
- `packages/missing-routes/missing.json`
- `test/generated/http-contracts.json`
- `test/generated/suite-coverage.json`

No `package.json` or `package-lock.json` changes.

## Evidence Gathered

- `packages/missing-routes/missing.json` initially contained `GET /users/@me/consent` and `POST /users/@me/consent`.
- Userdoccers source: `pages/resources/user-settings.mdx` documents `GET /users/@me/consent` as returning a consents object; it documents consent types `personalization` and endpoint-only `usage_statistics`. Source URL used: `https://raw.githubusercontent.com/discord-userdoccers/discord-userdoccers/master/pages/resources/user-settings.mdx`.
- xHyroM local catalog contains `SETTINGS_CONSENT` entries for `GET`, `HEAD`, `OPTIONS`, and `POST` on `/users/@me/consent`.
- Existing READY behavior in `src/gateway/util/ReadyConsents.ts` exposed `personalization.consented: false`; this was preserved and shared with the new endpoint default.

## Missing-Route Movement

- Worker base movement: `missing = 599 -> 598`, `spacebar = 581 -> 582`, `discord = 1128`.
- Integration base movement: `missing = 597 -> 596`, `spacebar = 583 -> 584`, `discord = 1128`.
- Removed missing entry: `GET /users/@me/consent`.
- Remaining assigned-path adjacent entry: `POST /users/@me/consent` remains missing by design.

## Commands Run

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
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run build:test-fixtures`
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" node -r dotenv/config -r module-alias/register --enable-source-maps --test dist-test/test/routes/users-me-consent-get.test.js`
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" TS_NODE_TRANSPILE_ONLY=1 node -r dotenv/config -r ts-node/register/transpile-only -r module-alias/register --enable-source-maps --test src/gateway/util/ReadyConsents.test.ts`
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" node scripts/testing-manifest/verify.js`
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" node scripts/testing-manifest/generate-contract-tests.js --check && PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" node --test test/generated/http-contracts.test.js`
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" node scripts/testing-manifest/generate-suite-coverage.js --check && PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" node --test test/generated/suite-coverage.test.js`
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run test:manifest`
- `git diff --check`
- `git diff -- package.json package-lock.json packages/*/package.json`
- Current-base verification after porting to `4ceeea8b6b2de22edb1fc65d1f2538024577723d`:
  - `npm run build:src:tsgo`
  - `npm run generate:schema`
  - `npm run generate:openapi`
  - `npm run build --workspace @spacebar/automatic-reverse-engineering`
  - `node packages/automatic-reverse-engineering/dist/cli.js import-source-routes --root src/api/routes --out packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`
  - `npm run build --workspace @spacebar/missing-routes`
  - `npm run start --workspace @spacebar/missing-routes`
  - `npm run generate:testing-manifest`
  - `npm run generate:contract-tests`
  - `npm run generate:suite-coverage`
  - `npm test -- test/routes/users-me-consent-get.test.ts`
  - `TS_NODE_TRANSPILE_ONLY=1 node -r dotenv/config -r ts-node/register/transpile-only -r module-alias/register --enable-source-maps --test src/gateway/util/ReadyConsents.test.ts`
  - `npm run build:test-fixtures`
  - `node -r dotenv/config -r module-alias/register --enable-source-maps --test dist-test/test/routes/users-me-consent-get.test.js`
  - `node scripts/testing-manifest/verify.js`
  - `node scripts/testing-manifest/generate-contract-tests.js --check`
  - `node scripts/testing-manifest/generate-suite-coverage.js --check`
  - `node --test test/generated/http-contracts.test.js test/generated/suite-coverage.test.js`
  - `npm run test:suite-coverage`
  - `npm run lint`
  - `git diff --check`
  - `git diff --exit-code -- package.json package-lock.json bun.lock`
  - `npm run test:contracts`

All worker-base verification commands passed. `npm ci` reported npm audit/deprecation warnings only. Worker-base `npm run test:contracts` was not run; generated contract checks were run directly.

Current-base verification passed source build, schema/OpenAPI regeneration with 475 paths and 1103 schemas, source catalog and missing-route regeneration, testing manifest verification with 689 entries, generated contract checks with 664 contracts, generated suite coverage checks, focused consent route tests 3/3, READY consent tests 2/2, compiled consent route tests 3/3, generated contract/suite tests 13/13, suite coverage tests, lint, diff checks, and package/lockfile guard. Current-base `npm run test:contracts` failed only in the known unrelated runtime contract: `api:http:GET:/discovery/search` returned `500 !== 200`; the generated contract matrix passed before that runtime stage.

## Intentionally Untouched

- `POST /users/@me/consent`
- user settings mutation routes
- registration consent flows
- message-request consent flows
- email settings and other current-user settings routes

## Risks And Follow-Ups

- The endpoint is intentionally conservative until Spacebar has a persisted consent model; clients will not see user-specific consent grants here.
- If `POST /users/@me/consent` is implemented later, it should add storage and update this GET route and READY from that same backing state.
- Worker base is `8eb938575`; orchestrator ported the source, tests, and report onto current base `4ceeea8b6`, then regenerated current-base artifacts.
