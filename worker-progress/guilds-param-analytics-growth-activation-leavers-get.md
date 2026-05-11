# guilds-param-analytics-growth-activation-leavers-get

Goal status: complete in worker; scoped implementation audited, normalized to the current focused route-test pattern, and ported by the orchestrator onto current `upstream/master` base.

Goal objective: Implement production-ready GET support for `/guilds/{guild_id}/analytics/growth-activation/leavers` with focused tests, regenerated route catalogs and generated route artifacts, verification evidence, and a complete handoff report.

## Summary

Implemented `GET /guilds/{guild_id}/analytics/growth-activation/leavers` as a guild insights route with `VIEW_GUILD_INSIGHTS`, bearer-auth metadata, shared growth-activation analytics query parsing, guild existence lookup, and a conservative empty response until Spacebar persists Discord historical guild leaver analytics buckets.

Added the documented `GuildGrowthActivationLeaversResponse` schema and focused route/schema tests covering route metadata, query validation, guild lookup ordering, schema validation, regenerated catalog/manifest/contract/OpenAPI metadata, and missing-route removal.

## Assigned Scope

- Route id: `guilds-param-analytics-growth-activation-leavers-get`
- Assigned path: `/guilds/{param}/analytics/growth-activation/leavers`
- Owned method: `GET`
- Missing entry: `GET_GUILDS_GUILD_ID_ANALYTICS_GROWTH_ACTIVATION_LEAVERS`
- Source route reference: `/guilds/{guild_id}/analytics/growth-activation/leavers`

## Missing-Route Movement

- Before current-base port: `688` missing / `492` implemented / `1128` Discord
- After current-base regeneration: `687` missing / `493` implemented / `1128` Discord
- Assigned missing entry present after regeneration: `false`

## References Used

- Userdoccers guild analytics docs: `https://docs.discord.food/resources/guild-analytics`
- Local catalog source: `packages/automatic-reverse-engineering/data/catalogs/routes.userdoccers.catalog.json`
- Existing growth-activation helper: `src/api/routes/guilds/#guild_id/analytics/growth-activation/query.ts`
- Existing analytics response and route test patterns under `src/schemas/responses/` and `test/routes/`

## Changed Files

- `src/api/routes/guilds/#guild_id/analytics/growth-activation/leavers.ts`
- `src/schemas/responses/GuildGrowthActivationLeaversResponse.ts`
- `src/schemas/responses/index.ts`
- `test/routes/guilds-param-analytics-growth-activation-leavers-get.test.ts`
- `assets/schemas.json`
- `assets/openapi.json`
- `assets/testing-manifest.json`
- `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`
- `packages/missing-routes/missing.json`
- `test/generated/http-contracts.json`
- `test/generated/suite-coverage.json`
- `worker-progress/guilds-param-analytics-growth-activation-leavers-get.md`

## Verification

- `npx prettier --write src/api/routes/guilds/#guild_id/analytics/growth-activation/leavers.ts src/schemas/responses/GuildGrowthActivationLeaversResponse.ts src/schemas/responses/index.ts test/routes/guilds-param-analytics-growth-activation-leavers-get.test.ts`: passed.
- `npm run build:src:tsgo`: passed.
- `npm run generate:schema`: passed; wrote `971` schemas.
- `npm run build --workspace @spacebar/automatic-reverse-engineering`: passed.
- `node packages/automatic-reverse-engineering/dist/cli.js import-source-routes --root src/api/routes --out packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`: passed.
- `npm run build --workspace @spacebar/missing-routes`: passed.
- `npm run start --workspace @spacebar/missing-routes`: passed; `Spacebar is missing 687`, `Spacebar implements 493`, `Discord implements 1128`.
- `npm run generate:testing-manifest`: passed; wrote `598` entries.
- `node scripts/testing-manifest/verify.js`: passed.
- `node scripts/testing-manifest/generate-contract-tests.js --check`: correctly detected stale generated contracts before regeneration.
- `npm run generate:contract-tests`: passed; wrote `573` contracts.
- `node scripts/testing-manifest/generate-contract-tests.js --check`: passed.
- `node scripts/testing-manifest/generate-suite-coverage.js --check`: correctly detected stale generated suite coverage before regeneration.
- `npm run generate:suite-coverage`: passed.
- `node scripts/testing-manifest/generate-suite-coverage.js --check`: passed.
- `npm run generate:openapi`: passed; specification contains `399` paths and `971` schemas.
- `npm run build:test-fixtures`: passed.
- `node -r dotenv/config -r module-alias/register --enable-source-maps --test dist-test/test/routes/guilds-param-analytics-growth-activation-leavers-get.test.js`: passed; `6/6` tests.
- `node --test test/generated/http-contracts.test.js test/generated/suite-coverage.test.js`: passed; `13/13` tests.
- `npx eslint src/api/routes/guilds/#guild_id/analytics/growth-activation/leavers.ts src/schemas/responses/GuildGrowthActivationLeaversResponse.ts src/schemas/responses/index.ts test/routes/guilds-param-analytics-growth-activation-leavers-get.test.ts`: passed.
- `npx prettier --check src/api/routes/guilds/#guild_id/analytics/growth-activation/leavers.ts src/schemas/responses/GuildGrowthActivationLeaversResponse.ts src/schemas/responses/index.ts test/routes/guilds-param-analytics-growth-activation-leavers-get.test.ts`: passed.
- `git diff --check`: passed.
- Package manifest and lockfile guard: no package manifest or lockfile changes.
- Exact AGPL warranty line and malformed warranty-string scan over changed source/test files: passed.

## Completion Audit

- Derived and handled the only missing method for the assigned path: done.
- Confirmed the source catalog now includes `GET /guilds/{guild_id}/analytics/growth-activation/leavers`: done.
- Confirmed `packages/missing-routes/missing.json` no longer lists the assigned missing entry: done.
- Added focused route/schema tests: done.
- Regenerated schema catalog, source catalog, missing-route report, testing manifest, generated HTTP contracts, generated suite coverage, and OpenAPI: done.
- Verified route metadata declares bearer-authenticated `401`, `403`, `404`, and `422` API error responses: done.
- Avoided adjacent growth-activation, welcome-screen, channel-following, engagement, and audience routes: done.
