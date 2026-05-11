# guilds-param-analytics-growth-activation-joins-by-referrer-get

Goal status: complete in worker; scoped implementation audited and ported by the orchestrator onto current `upstream/master` base.

Goal objective: Implement production-ready GET support for `/guilds/{guild_id}/analytics/growth-activation/joins-by-referrer` with focused tests, regenerated route catalogs and generated route artifacts, verification evidence, and a complete handoff report.

## Summary

Implemented `GET /guilds/{guild_id}/analytics/growth-activation/joins-by-referrer` as a guild insights route with `VIEW_GUILD_INSIGHTS`, bearer-auth metadata, shared growth-activation analytics query parsing, guild existence lookup, and a conservative empty response until Spacebar persists Discord external referral join analytics buckets.

Added the documented `GuildGrowthActivationJoinsByReferrerResponse` schema and focused route/schema tests covering route metadata, query validation, guild lookup ordering, schema validation, regenerated catalog/manifest/contract/OpenAPI metadata, and missing-route removal.

## Assigned Scope

- Route id: `guilds-param-analytics-growth-activation-joins-by-referrer-get`
- Assigned path: `/guilds/{param}/analytics/growth-activation/joins-by-referrer`
- Owned method: `GET`
- Missing entry: `GET_GUILDS_GUILD_ID_ANALYTICS_GROWTH_ACTIVATION_JOINS_BY_REFERRER`
- Source route reference: `/guilds/{guild_id}/analytics/growth-activation/joins-by-referrer`

## Missing-Route Movement

- Before current-base port: `691` missing / `489` implemented / `1128` Discord
- After current-base regeneration: `690` missing / `490` implemented / `1128` Discord
- Assigned missing entry present after regeneration: `false`

## References Used

- Userdoccers guild analytics docs: `https://docs.discord.food/resources/guild-analytics`
- Local catalog source: `packages/automatic-reverse-engineering/data/catalogs/routes.userdoccers.catalog.json`
- Existing growth-activation helper: `src/api/routes/guilds/#guild_id/analytics/growth-activation/query.ts`
- Existing analytics response and route test patterns under `src/schemas/responses/` and `test/routes/`

## Changed Files

- `src/api/routes/guilds/#guild_id/analytics/growth-activation/joins-by-referrer.ts`
- `src/schemas/responses/GuildGrowthActivationJoinsByReferrerResponse.ts`
- `src/schemas/responses/index.ts`
- `test/routes/guilds-param-analytics-growth-activation-joins-by-referrer-get.test.ts`
- `assets/schemas.json`
- `assets/openapi.json`
- `assets/testing-manifest.json`
- `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`
- `packages/missing-routes/missing.json`
- `test/generated/http-contracts.json`
- `test/generated/suite-coverage.json`
- `worker-progress/guilds-param-analytics-growth-activation-joins-by-referrer-get.md`

## Verification

- `npx prettier --write src/api/routes/guilds/#guild_id/analytics/growth-activation/joins-by-referrer.ts src/schemas/responses/GuildGrowthActivationJoinsByReferrerResponse.ts src/schemas/responses/index.ts test/routes/guilds-param-analytics-growth-activation-joins-by-referrer-get.test.ts`: passed.
- `npm run build:src:tsgo`: passed.
- `npm run generate:schema`: passed; wrote `965` schemas.
- `npm run build --workspace @spacebar/automatic-reverse-engineering`: passed.
- `node packages/automatic-reverse-engineering/dist/cli.js import-source-routes --root src/api/routes --out packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`: passed.
- `npm run build --workspace @spacebar/missing-routes`: passed.
- `npm run start --workspace @spacebar/missing-routes`: passed; `Spacebar is missing 690`, `Spacebar implements 490`, `Discord implements 1128`.
- `npm run generate:testing-manifest`: passed; wrote `595` entries.
- `node scripts/testing-manifest/verify.js`: passed.
- `node scripts/testing-manifest/generate-contract-tests.js --check`: correctly detected stale generated contracts before regeneration.
- `npm run generate:contract-tests`: passed; wrote `570` contracts.
- `node scripts/testing-manifest/generate-contract-tests.js --check`: passed.
- `node scripts/testing-manifest/generate-suite-coverage.js --check`: correctly detected stale generated suite coverage before regeneration.
- `npm run generate:suite-coverage`: passed.
- `node scripts/testing-manifest/generate-suite-coverage.js --check`: passed.
- `npm run generate:openapi`: passed; specification contains `396` paths and `965` schemas.
- `npm run build:test-fixtures`: passed.
- `node -r dotenv/config -r module-alias/register --enable-source-maps --test dist-test/test/routes/guilds-param-analytics-growth-activation-joins-by-referrer-get.test.js`: passed; `6/6` tests.
- `node --test test/generated/http-contracts.test.js test/generated/suite-coverage.test.js`: passed; `13/13` tests.
- `npx eslint src/api/routes/guilds/#guild_id/analytics/growth-activation/joins-by-referrer.ts src/schemas/responses/GuildGrowthActivationJoinsByReferrerResponse.ts src/schemas/responses/index.ts test/routes/guilds-param-analytics-growth-activation-joins-by-referrer-get.test.ts`: passed.
- `npx prettier --check src/api/routes/guilds/#guild_id/analytics/growth-activation/joins-by-referrer.ts src/schemas/responses/GuildGrowthActivationJoinsByReferrerResponse.ts src/schemas/responses/index.ts test/routes/guilds-param-analytics-growth-activation-joins-by-referrer-get.test.ts`: passed.
- `git diff --check`: passed.
- Package manifest and lockfile guard: no package manifest or lockfile changes.
- Exact AGPL warranty line and malformed warranty-string scan over changed source/test files: passed.

## Completion Audit

- Derived and handled the only missing method for the assigned path: done.
- Confirmed the source catalog now includes `GET /guilds/{guild_id}/analytics/growth-activation/joins-by-referrer`: done.
- Confirmed `packages/missing-routes/missing.json` no longer lists the assigned missing entry: done.
- Added focused route/schema tests: done.
- Regenerated schema catalog, source catalog, missing-route report, testing manifest, generated HTTP contracts, generated suite coverage, and OpenAPI: done.
- Verified route metadata declares bearer-authenticated `401`, `403`, `404`, and `422` API error responses: done.
- Avoided adjacent growth-activation, welcome-screen, channel-following, engagement, and audience routes: done.
