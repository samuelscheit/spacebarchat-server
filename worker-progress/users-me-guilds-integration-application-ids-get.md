# GET /users/@me/guilds/integration-application-ids

## Summary

Implemented `GET /users/@me/guilds/integration-application-ids` using Spacebar's locally supported application-backed integration model. The route returns an authenticated mapping of the current user's guild IDs to installed bot application IDs, including empty arrays for current-user guilds without locally backed application integrations. It does not fabricate private Discord integration discovery state.

## Changed Files

- `src/api/routes/users/@me/guilds/integration-application-ids.ts`
- `src/api/routes/users/@me/guilds/integration-application-ids.test.ts`
- `src/api/util/utility/GuildIntegrations.ts`
- `src/api/util/utility/GuildIntegrations.test.ts`
- `src/schemas/responses/GuildIntegrationApplicationIdsResponse.ts`
- `src/schemas/responses/index.ts`
- `assets/schemas.json`
- `assets/openapi.json`
- `assets/testing-manifest.json`
- `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`
- `packages/missing-routes/missing.json`
- `test/generated/http-contracts.json`
- `test/generated/suite-coverage.json`
- `testing/suite-coverage-policy.json`
- `tsconfig.test.json`

## Evidence Gathered

- Userdoccers integration resource documents `GET /users/@me/guilds/integration-application-ids` as a mapping of guild IDs to lists of application IDs attached to integrations in the current user's guilds.
- xHyroM route catalog lists `INTEGRATION_APPLICATION_IDS_FOR_MY_GUILDS` for GET/DELETE/HEAD/OPTIONS on the same path.
- Existing Spacebar integration support is `src/api/util/utility/GuildIntegrations.ts`, which derives guild integrations from bot guild members and `Application.bot`.
- `src/api/routes/guilds/#guild_id/integrations.ts` already exposes only application-backed guild integrations with `MANAGE_GUILD`.
- `src/api/routes/users/@me/guilds.ts` confirms current-user guild membership is derived from `Member` rows with `id = req.user_id`.

## Behavior

- Authenticated users receive an object keyed by guild ID.
- Each current-user guild is included even when no locally backed application integrations exist.
- Application IDs are included only when the guild has a bot member with a matching local `Application.bot`.
- Duplicate bot members/application IDs are de-duplicated per guild.
- No guild IDs, applications, integrations, OAuth state, command metadata, or private discovery state are fabricated.

## Missing-Route Movement

- Worker base: `7ec1bd2a4`.
- Worker-base regeneration: `missing = 570`, `spacebar = 610`, `discord = 1128`.
- Removed missing entry: `GET /users/@me/guilds/integration-application-ids`.
- The path still appears in `packages/missing-routes/missing.json` because xHyroM-only `DELETE /users/@me/guilds/integration-application-ids` remains intentionally unimplemented.

## Adjacent Routes Untouched

- Did not implement `DELETE`, `HEAD`, or `OPTIONS` for `/users/@me/guilds/integration-application-ids`.
- Did not implement guild premium subscription routes.
- Did not change integration mutation routes, OAuth routes, application command index routes, guild settings routes, or other current-user guild routes.

## Commands Run

- `npm ci`
- `npm run build:src:tsgo`
- `npm run generate:schema`
- `npm run generate:openapi`
- `npm run build --workspace @spacebar/automatic-reverse-engineering`
- `node packages/automatic-reverse-engineering/dist/cli.js import-source-routes --root src/api/routes --out packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`
- `npm run build --workspace @spacebar/missing-routes`
- `npm run start --workspace @spacebar/missing-routes`
- `node scripts/testing-manifest/generate.js`
- `node scripts/testing-manifest/generate-contract-tests.js`
- `node scripts/testing-manifest/generate-suite-coverage.js`
- `npm run build:test-fixtures`
- `node -r dotenv/config -r module-alias/register --enable-source-maps --test dist-test/src/api/util/utility/GuildIntegrations.test.js dist-test/src/api/routes/users/@me/guilds/integration-application-ids.test.js`
- `node scripts/testing-manifest/verify.js`
- `node scripts/testing-manifest/generate-contract-tests.js --check`
- `node scripts/testing-manifest/generate-suite-coverage.js --check`
- `node --test test/generated/http-contracts.test.js test/contracts/*.test.cjs`
- `node --test test/generated/suite-coverage.test.js`
- `npm run test:contracts`
- Completion audit reran focused built tests and generated checks.
- `git diff --check`
- `git diff -- package.json package-lock.json`

## Verification Notes

- Focused compiled route/utility tests passed: 10 tests.
- Manifest verification passed: 715 entries.
- Generated contract matrix checks passed: 690 contracts.
- Generated suite coverage checks passed.
- `git diff --check` passed.
- Package/lockfile guard was clean.
- `npm run test:contracts` failed only in the runtime public response-schema phase on the known unrelated `api:http:GET:/discovery/search` issue: expected `200`, got `500`.
- Runtime contract setup also logged existing route registration warnings for analytics `query` helper files that do not export routers; they did not cause the failure.

## Risks

- This route returns only Spacebar-local application-backed integrations. Discord may include private client integration discovery state that Spacebar does not persist; unsupported data is deliberately omitted instead of fabricated.
- Reconciliation to current main is needed before merge if nearby workers also regenerate `assets/testing-manifest.json`, `test/generated/http-contracts.json`, `test/generated/suite-coverage.json`, `packages/missing-routes/missing.json`, or `routes.source.catalog.json`.

## Recommended Next Tasks

- Handle the remaining xHyroM-only `DELETE /users/@me/guilds/integration-application-ids` separately only if there is defensible source evidence for its behavior.
- Fix the unrelated `/discovery/search` runtime contract failure in its own route scope.

## Integration Acceptance

- Integrated onto main checkout base `2e23cbb08 Implement guild members supplemental route`.
- Current-main missing-route movement: `569 -> 568`.
- Current-main Spacebar/implemented route movement: `611 -> 612`.
- Discord route count remained `1128`.
- Regenerated current-main artifacts: `1150` schemas, `502` OpenAPI paths, `717` testing-manifest entries, `692` HTTP contracts, and `15` suite groups.
- Focused route/utility tests passed through the repository runner: 10 tests.
- Focused built route/utility tests passed: 10 tests.
- Generated checks passed:
  - `node scripts/testing-manifest/verify.js`
  - `node scripts/testing-manifest/generate-contract-tests.js --check`
  - `node --test test/generated/http-contracts.test.js test/contracts/*.test.cjs`
  - `node scripts/testing-manifest/generate-suite-coverage.js --check`
  - `node --test test/generated/suite-coverage.test.js`
- `npm run lint` passed.
- `git diff --check` passed.
- Package guard passed for `package.json`, `package-lock.json`, `packages/automatic-reverse-engineering/package.json`, and `packages/missing-routes/package.json`.
- License-header typo scan for the new files passed.
- `npm run test:contracts` completed static generated checks and failed only on the known unrelated runtime contract `api:http:GET:/discovery/search` returning `500 !== 200`; pre-existing analytics query route-registration warnings were also present.
