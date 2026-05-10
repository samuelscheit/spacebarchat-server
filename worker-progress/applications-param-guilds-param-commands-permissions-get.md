# GET /applications/{application_id}/guilds/{guild_id}/commands/permissions

## Summary

Integrated the assigned `GET /applications/{param}/guilds/{param}/commands/permissions` route onto current master.

The route rejects bot-token callers, verifies the caller can manage the target application, verifies the guild exists, verifies the application bot is installed in the guild, enforces `MANAGE_GUILD` and `MANAGE_ROLES`, and returns persisted command permission overwrites in the documented guild application command permissions response shape.

Current-master integration note: accepted onto base `d9eb3cdfb` after regenerating schemas, source catalog, missing-route report, testing manifest, generated HTTP contracts, suite coverage, and OpenAPI from the integrated tree. The assigned route moves the current master report from `missing: 823`, `spacebar: 357` to `missing: 822`, `spacebar: 358`.

## Assigned Path

- Assigned missing path: `/applications/{param}/guilds/{param}/commands/permissions`
- Source route: `/applications/{application_id}/guilds/{guild_id}/commands/permissions`
- Missing methods found: `GET`
- Methods implemented: `GET`
- Adjacent routes intentionally not implemented: command detail permissions, permission update, application command CRUD, guild command CRUD, bulk overwrite, and interaction routes.

## Changed Files

- `src/api/routes/applications/#application_id/guilds/#guild_id/commands/permissions.ts`
- `src/schemas/api/bots/ApplicationCommandPermissions.ts`
- `src/schemas/api/bots/index.ts`
- `src/api/util/utility/ApplicationCommands.ts`
- `src/api/util/utility/ApplicationCommands.test.ts`
- `test/scenarios/applications-commands.test.ts`
- `assets/schemas.json`
- `assets/testing-manifest.json`
- `assets/openapi.json`
- `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`
- `packages/missing-routes/missing.json`
- `test/generated/http-contracts.json`
- `test/generated/suite-coverage.json`
- `worker-progress/applications-param-guilds-param-commands-permissions-get.md`

## Evidence

- Current missing-route report contained exactly one assigned entry for this path before integration.
- Current source catalog and route tree had no assigned route before integration.
- Userdoccers source `interactions/application-commands.mdx` documents the endpoint, response list, permission object fields, overwrite types `1/2/3`, and command permission management requirements.
- The route reads existing durable `ApplicationCommand.permissions` role, user, and channel overwrite maps and does not synthesize missing permission records.
- Current source catalog now contains `GET_APPLICATIONS_APPLICATION_ID_GUILDS_GUILD_ID_COMMANDS_PERMISSIONS`.
- The assigned missing entry is absent from `packages/missing-routes/missing.json`.

## Verification

- `npm run build:src:tsgo` passed.
- `npm run build:test-fixtures` passed.
- `node -r dotenv/config -r module-alias/register --enable-source-maps --test dist-test/src/api/util/utility/ApplicationCommands.test.js` passed: 21 tests.
- `node -r dotenv/config -r module-alias/register --enable-source-maps --test --test-concurrency=1 dist-test/test/scenarios/applications-commands.test.js` exited 0 with 1 skipped test because this local environment lacks a Postgres admin URL.
- `npm run generate:schema` wrote 720 schemas.
- `npm run build --workspace @spacebar/automatic-reverse-engineering` passed.
- Source route import passed.
- `npm run build --workspace @spacebar/missing-routes` passed.
- `npm run start --workspace @spacebar/missing-routes` reported `missing: 822`, `spacebar: 358`, `discord: 1128`.
- `npm run generate:testing-manifest` wrote 463 entries.
- `node scripts/testing-manifest/verify.js` passed.
- Generated HTTP contract checks verified 438 contracts after regeneration.
- Generated suite coverage verified.
- Generated contract and suite static tests passed: 13 tests.
- `npm run generate:openapi` wrote 283 paths and 720 schemas; only pre-existing webhook route metadata warnings remain.

## Goal Evidence

- Worker `get_goal` evidence reported status `active` and objective for the assigned route path.
- Worker final report says the goal was marked complete with final elapsed time of 1386 seconds.

## Risks

- The scenario test for end-to-end route behavior needs an environment with a Postgres admin URL to execute instead of skipping.
- There is not yet a first-class durable model for application-wide per-guild permission entries where the response object `id` is the application ID, so the route only returns persisted command-level overwrites.
