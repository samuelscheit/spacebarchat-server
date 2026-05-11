# guilds-param-top-read-channels-get

Goal status: complete in worker; scoped implementation audited and ported by the orchestrator onto current `upstream/master` base.

Goal objective: Implement production-ready GET support for `/guilds/{guild_id}/top-read-channels` with focused tests, regenerated route catalogs and generated route artifacts, verification evidence, and a complete handoff report.

## Summary

Implemented `GET /guilds/{guild_id}/top-read-channels` as a bearer-authenticated guild route that verifies guild visibility, allows guild members, allows non-members only for discoverable non-excluded guilds, and returns Discord `UNKNOWN_GUILD` for missing or hidden guild access.

Added `GuildTopReadChannelsResponse` as an array of channel snowflake strings. The route conservatively returns an empty ranking list until Spacebar has a durable, source-backed top-read-channel ranking provider, while preserving a dependency-injected path for future source-backed channel IDs capped to Discord's documented limit of 10.

## Assigned Scope

- Route id: `guilds-param-top-read-channels-get`
- Assigned path: `/guilds/{param}/top-read-channels`
- Owned method: `GET`
- Missing entry: `GET_GUILDS_GUILD_ID_TOP_READ_CHANNELS`
- Source route reference: `/guilds/{guild_id}/top-read-channels`

## Missing-Route Movement

- Before current-base port: `685` missing / `495` implemented / `1128` Discord
- After current-base regeneration: `684` missing / `496` implemented / `1128` Discord
- Assigned missing entry present after regeneration: `false`

## References Used

- Userdoccers channel docs: `https://docs.discord.food/resources/channel`
- Local catalog sources:
    - `packages/automatic-reverse-engineering/data/catalogs/routes.userdoccers.catalog.json`
    - `packages/automatic-reverse-engineering/data/catalogs/routes.xhyrom.catalog.json`
- Existing guild visibility patterns:
    - `src/api/routes/guilds/#guild_id/basic.ts`
    - `src/api/routes/guilds/#guild_id/preview.ts`

## Changed Files

- `src/api/routes/guilds/#guild_id/top-read-channels.ts`
- `src/schemas/responses/GuildTopReadChannelsResponse.ts`
- `src/schemas/responses/index.ts`
- `test/routes/guilds-top-read-channels-route.test.ts`
- `assets/schemas.json`
- `assets/openapi.json`
- `assets/testing-manifest.json`
- `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`
- `packages/missing-routes/missing.json`
- `test/generated/http-contracts.json`
- `test/generated/suite-coverage.json`
- `worker-progress/guilds-param-top-read-channels-get.md`

## Verification

- `npx prettier --write src/api/routes/guilds/#guild_id/top-read-channels.ts src/schemas/responses/GuildTopReadChannelsResponse.ts src/schemas/responses/index.ts test/routes/guilds-top-read-channels-route.test.ts`: passed.
- `npm run build:src:tsgo`: passed.
- `npm run generate:schema`: passed; wrote `976` schemas.
- `npm run build --workspace @spacebar/automatic-reverse-engineering`: passed.
- `node packages/automatic-reverse-engineering/dist/cli.js import-source-routes --root src/api/routes --out packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`: passed.
- `npm run build --workspace @spacebar/missing-routes`: passed.
- `npm run start --workspace @spacebar/missing-routes`: passed; `Spacebar is missing 684`, `Spacebar implements 496`, `Discord implements 1128`.
- `npm run generate:testing-manifest`: passed; wrote `601` entries.
- `node scripts/testing-manifest/verify.js`: passed.
- `node scripts/testing-manifest/generate-contract-tests.js --check`: correctly detected stale generated contracts before regeneration.
- `npm run generate:contract-tests`: passed; wrote `576` contracts.
- `node scripts/testing-manifest/generate-contract-tests.js --check`: passed.
- `node scripts/testing-manifest/generate-suite-coverage.js --check`: correctly detected stale generated suite coverage before regeneration.
- `npm run generate:suite-coverage`: passed.
- `node scripts/testing-manifest/generate-suite-coverage.js --check`: passed.
- `npm run generate:openapi`: passed; specification contains `402` paths and `976` schemas.
- `npm run build:test-fixtures`: passed.
- `node -r dotenv/config -r module-alias/register --enable-source-maps --test dist-test/test/routes/guilds-top-read-channels-route.test.js`: passed; `9/9` tests.
- `node --test test/generated/http-contracts.test.js test/generated/suite-coverage.test.js`: passed; `13/13` tests.
- `npx eslint src/api/routes/guilds/#guild_id/top-read-channels.ts src/schemas/responses/GuildTopReadChannelsResponse.ts src/schemas/responses/index.ts test/routes/guilds-top-read-channels-route.test.ts`: passed.
- `npx prettier --check src/api/routes/guilds/#guild_id/top-read-channels.ts src/schemas/responses/GuildTopReadChannelsResponse.ts src/schemas/responses/index.ts test/routes/guilds-top-read-channels-route.test.ts`: passed.
- `git diff --check`: passed.
- Package manifest and lockfile guard: no package manifest or lockfile changes.
- Exact AGPL warranty line and malformed warranty-string scan over changed source/test files: passed.

## Completion Audit

- Derived and handled the only missing method for the assigned path: done.
- Confirmed the source catalog now includes `GET /guilds/{guild_id}/top-read-channels`: done.
- Confirmed `packages/missing-routes/missing.json` no longer lists the assigned missing entry: done.
- Added focused tests for authentication, member access, discoverable non-member access, hidden guild 404 behavior, response capping, schema/catalog/OpenAPI/manifest metadata, and missing-route removal: done.
- Regenerated schema catalog, source catalog, missing-route report, testing manifest, generated HTTP contracts, generated suite coverage, and OpenAPI: done.
- Verified route metadata declares bearer-authenticated `200`, `401`, and `404` response bodies with no permission bit, matching the route's access model: done.
- Avoided adjacent top-games, top-emojis, active-channels, analytics, discovery, onboarding, and other guild routes: done.
