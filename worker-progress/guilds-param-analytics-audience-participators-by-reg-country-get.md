# guilds-param-analytics-audience-participators-by-reg-country-get

Goal status: complete in worker; scoped implementation audited and ported by the orchestrator onto current `upstream/master` base.

Goal objective: Implement production-ready GET support for `/guilds/{guild_id}/analytics/audience/participators-by-reg-country` with focused tests, regenerated route catalogs and generated route artifacts, verification evidence, and a complete handoff report.

## Summary

Implemented `GET /guilds/{guild_id}/analytics/audience/participators-by-reg-country` as a guild insights route with `VIEW_GUILD_INSIGHTS`, bearer-auth metadata, documented `start`, `end`, and `interval` query parameters, and a conservative empty response until Spacebar persists Discord historical registration-country audience analytics buckets.

Added the documented `GuildAudienceParticipatorsByRegCountryResponse` schema and focused route/schema tests covering route metadata, empty response behavior, schema validation, regenerated catalog/manifest/contract/OpenAPI metadata, and missing-route removal.

## Assigned Scope

- Route id: `guilds-param-analytics-audience-participators-by-reg-country-get`
- Assigned path: `/guilds/{param}/analytics/audience/participators-by-reg-country`
- Owned method: `GET`
- Missing entry: `GET_GUILDS_GUILD_ID_ANALYTICS_AUDIENCE_PARTICIPATORS_BY_REG_COUNTRY`
- Source route reference: `/guilds/{guild_id}/analytics/audience/participators-by-reg-country`

## Missing-Route Movement

- Before current-base port: `686` missing / `494` implemented / `1128` Discord
- After current-base regeneration: `685` missing / `495` implemented / `1128` Discord
- Assigned missing entry present after regeneration: `false`

## References Used

- Userdoccers guild analytics docs: `https://docs.discord.food/resources/guild-analytics`
- Local catalog source: `packages/automatic-reverse-engineering/data/catalogs/routes.userdoccers.catalog.json`
- Existing audience analytics route patterns under `src/api/routes/guilds/#guild_id/analytics/audience/`
- Existing audience response schema and route test patterns under `src/schemas/responses/` and `src/api/routes/guilds/#guild_id/analytics/audience/`

## Changed Files

- `src/api/routes/guilds/#guild_id/analytics/audience/participators-by-reg-country.ts`
- `src/api/routes/guilds/#guild_id/analytics/audience/participators-by-reg-country.test.ts`
- `src/schemas/responses/GuildAudienceParticipatorsByRegCountryResponse.ts`
- `src/schemas/responses/GuildAudienceParticipatorsByRegCountryResponse.test.ts`
- `src/schemas/responses/index.ts`
- `tsconfig.test.json`
- `assets/schemas.json`
- `assets/openapi.json`
- `assets/testing-manifest.json`
- `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`
- `packages/missing-routes/missing.json`
- `test/generated/http-contracts.json`
- `test/generated/suite-coverage.json`
- `worker-progress/guilds-param-analytics-audience-participators-by-reg-country-get.md`

## Verification

- `npx prettier --write src/api/routes/guilds/#guild_id/analytics/audience/participators-by-reg-country.ts src/api/routes/guilds/#guild_id/analytics/audience/participators-by-reg-country.test.ts src/schemas/responses/GuildAudienceParticipatorsByRegCountryResponse.ts src/schemas/responses/GuildAudienceParticipatorsByRegCountryResponse.test.ts src/schemas/responses/index.ts tsconfig.test.json`: passed.
- `npm run build:src:tsgo`: passed.
- `npm run generate:schema`: passed; wrote `975` schemas.
- `npm run build --workspace @spacebar/automatic-reverse-engineering`: passed.
- `node packages/automatic-reverse-engineering/dist/cli.js import-source-routes --root src/api/routes --out packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`: passed.
- `npm run build --workspace @spacebar/missing-routes`: passed.
- `npm run start --workspace @spacebar/missing-routes`: passed; `Spacebar is missing 685`, `Spacebar implements 495`, `Discord implements 1128`.
- `npm run generate:testing-manifest`: passed; wrote `600` entries.
- `node scripts/testing-manifest/verify.js`: passed.
- `node scripts/testing-manifest/generate-contract-tests.js --check`: correctly detected stale generated contracts before regeneration.
- `npm run generate:contract-tests`: passed; wrote `575` contracts.
- `node scripts/testing-manifest/generate-contract-tests.js --check`: passed.
- `node scripts/testing-manifest/generate-suite-coverage.js --check`: correctly detected stale generated suite coverage before regeneration.
- `npm run generate:suite-coverage`: passed.
- `node scripts/testing-manifest/generate-suite-coverage.js --check`: passed.
- `npm run generate:openapi`: passed; specification contains `401` paths and `975` schemas.
- `npm run build:test-fixtures`: passed.
- `node -r dotenv/config -r module-alias/register --enable-source-maps --test 'dist-test/src/api/routes/guilds/#guild_id/analytics/audience/participators-by-reg-country.test.js' dist-test/src/schemas/responses/GuildAudienceParticipatorsByRegCountryResponse.test.js`: passed; `5/5` tests.
- `node --test test/generated/http-contracts.test.js test/generated/suite-coverage.test.js`: passed; `13/13` tests.
- `npx eslint src/api/routes/guilds/#guild_id/analytics/audience/participators-by-reg-country.ts src/api/routes/guilds/#guild_id/analytics/audience/participators-by-reg-country.test.ts src/schemas/responses/GuildAudienceParticipatorsByRegCountryResponse.ts src/schemas/responses/GuildAudienceParticipatorsByRegCountryResponse.test.ts src/schemas/responses/index.ts`: passed.
- `npx prettier --check src/api/routes/guilds/#guild_id/analytics/audience/participators-by-reg-country.ts src/api/routes/guilds/#guild_id/analytics/audience/participators-by-reg-country.test.ts src/schemas/responses/GuildAudienceParticipatorsByRegCountryResponse.ts src/schemas/responses/GuildAudienceParticipatorsByRegCountryResponse.test.ts src/schemas/responses/index.ts tsconfig.test.json`: passed.
- `git diff --check`: passed.
- Package manifest and lockfile guard: no package manifest or lockfile changes.
- Exact AGPL warranty line and malformed warranty-string scan over changed source/test files: passed.

## Completion Audit

- Derived and handled the only missing method for the assigned path: done.
- Confirmed the source catalog now includes `GET /guilds/{guild_id}/analytics/audience/participators-by-reg-country`: done.
- Confirmed `packages/missing-routes/missing.json` no longer lists the assigned missing entry: done.
- Added focused route/schema tests and schema validation coverage: done.
- Regenerated schema catalog, source catalog, missing-route report, testing manifest, generated HTTP contracts, generated suite coverage, and OpenAPI: done.
- Verified route metadata declares bearer-authenticated `401`, `403`, and `404` API error responses in line with existing audience analytics routes: done.
- Avoided adjacent audience, engagement, channel-following, growth-activation, welcome-screen, and guild routes: done.
