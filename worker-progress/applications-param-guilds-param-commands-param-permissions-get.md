# GET /applications/{application_id}/guilds/{guild_id}/commands/{command_id}/permissions

## Summary

Integrated the assigned `GET /applications/{param}/guilds/{param}/commands/{param}/permissions` route onto current master.

The route rejects bot-token callers, verifies application command management access, verifies the guild exists, verifies the application bot is installed in the guild, enforces `MANAGE_GUILD` and `MANAGE_ROLES`, and returns the documented single guild application command permissions object. It supports both global and guild command IDs in the requested guild and returns an empty `permissions` array for existing commands without stored overwrites.

Current-base integration note: accepted onto base `e9ee8738e` after regenerating the source catalog, missing-route report, testing manifest, generated HTTP contracts, suite coverage, and OpenAPI from the integrated tree. Schema generation was not run because no schema source changed. The assigned route moves the current report from `missing: 648`, `spacebar: 532` to `missing: 647`, `spacebar: 533`; Discord remains `1128`.

## Assigned Path

- Assigned missing path: `/applications/{param}/guilds/{param}/commands/{param}/permissions`
- Missing methods found: `GET`
- Methods implemented: `GET`
- Source routes: `/applications/{application_id}/guilds/{guild_id}/commands/{command_id}/permissions`, `/applications/{application_id}/guilds/{guild_id}/commands/{param}/permissions`
- Adjacent routes intentionally not implemented: `PUT` permission mutation, command create/update/delete, bulk command routes, global command permissions, and application command search/index routes.

## Changed Files

- `src/api/routes/applications/#application_id/guilds/#guild_id/commands/#command_id/permissions.ts`
- `src/api/routes/applications/#application_id/guilds/#guild_id/commands/#command_id/permissions.test.ts`
- `src/api/util/utility/ApplicationCommands.ts`
- `src/api/util/utility/ApplicationCommands.test.ts`
- `test/scenarios/applications-commands.test.ts`
- `tsconfig.test.json`
- `assets/testing-manifest.json`
- `assets/openapi.json`
- `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`
- `packages/missing-routes/missing.json`
- `test/generated/http-contracts.json`
- `test/generated/suite-coverage.json`
- `worker-progress/applications-param-guilds-param-commands-param-permissions-get.md`

## Evidence

- `packages/missing-routes/missing.json` had the assigned `GET` entry before implementation; after regeneration the assigned `GET` entry is gone and only the adjacent `PUT` entry remains for this path.
- `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json` now contains `GET_APPLICATIONS_APPLICATION_ID_GUILDS_GUILD_ID_COMMANDS_COMMAND_ID_PERMISSIONS` from `src/api/routes/applications/#application_id/guilds/#guild_id/commands/#command_id/permissions.ts`.
- Userdoccers `interactions/application-commands.mdx` documents this endpoint as returning a single guild application command permissions object with `id`, `application_id`, `guild_id`, and `permissions`.
- xHyroM `data/client/routes.json` catalog contributes `/applications/{application_id}/guilds/{guild_id}/commands/{param}/permissions`.
- Current-base missing movement after regeneration: `missing 648 -> 647`, `spacebar 532 -> 533`, `discord 1128`.

## Commands Run

- `npm run build:src:tsgo` passed.
- `npm run build --workspace @spacebar/automatic-reverse-engineering` passed.
- `node packages/automatic-reverse-engineering/dist/cli.js import-source-routes --root src/api/routes --out packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json` passed.
- `npm run build --workspace @spacebar/missing-routes` passed.
- `npm run start --workspace @spacebar/missing-routes` wrote `missing 647`, `spacebar 533`, `discord 1128`.
- `npm run generate:testing-manifest` wrote 638 entries.
- `node scripts/testing-manifest/verify.js` passed.
- `node scripts/testing-manifest/generate-contract-tests.js --check` initially reported stale contracts; `npm run generate:contract-tests` regenerated 613 contracts; final check passed.
- `node scripts/testing-manifest/generate-suite-coverage.js --check` initially reported stale coverage; `npm run generate:suite-coverage` regenerated 15 suites; final check passed.
- `npm run generate:openapi` wrote 427 paths and 1011 schemas; only pre-existing webhook route middleware warnings remain.
- `npm run build:test-fixtures` passed.
- `node -r dotenv/config -r module-alias/register --enable-source-maps --test dist-test/src/api/util/utility/ApplicationCommands.test.js 'dist-test/src/api/routes/applications/#application_id/guilds/#guild_id/commands/#command_id/permissions.test.js'` passed: 28 tests.
- `node -r dotenv/config -r module-alias/register --enable-source-maps --test --test-concurrency=1 dist-test/test/scenarios/applications-commands.test.js` exited 0 with 1 skipped test because no Postgres admin URL is configured.
- `node --test test/generated/http-contracts.test.js test/generated/suite-coverage.test.js` passed: 13 tests.
- `npm run test:manifest` passed: 30 tests and manifest verification.
- `npm run test:suite-coverage` passed: 4 tests.
- `npx eslint src/api/util/utility/ApplicationCommands.ts src/api/util/utility/ApplicationCommands.test.ts 'src/api/routes/applications/#application_id/guilds/#guild_id/commands/#command_id/permissions.ts' 'src/api/routes/applications/#application_id/guilds/#guild_id/commands/#command_id/permissions.test.ts' test/scenarios/applications-commands.test.ts tsconfig.test.json` passed with one warning that `tsconfig.test.json` is ignored by the lint config.
- `git diff --check` passed.
- Package/lockfile guard passed with no `package.json`, `package-lock.json`, or shrinkwrap diff.
- Malformed warranty-token scan passed.

## Artifact Status

- Source catalog regenerated.
- Missing-route report regenerated.
- Testing manifest regenerated and verified.
- Generated HTTP contracts regenerated and verified.
- Generated suite coverage regenerated and verified.
- OpenAPI regenerated.
- Schema generation was not run because no schema source changed; the route uses existing `GuildApplicationCommandPermissions`.

## Risks

- The end-to-end scenario coverage is present but skipped in this local environment without a Postgres admin URL.
- There is still no durable model for application-wide per-guild default permission records where the returned object `id` is the application ID; this route returns stored command-level permissions for existing global or guild commands.

## Recommended Next Tasks

- Implement the adjacent `PUT /applications/{application_id}/guilds/{guild_id}/commands/{command_id}/permissions` only in a separately assigned worker.
- Run the scenario suite in an environment with `POSTGRES_ADMIN_URL` to exercise the new detail route end to end.
