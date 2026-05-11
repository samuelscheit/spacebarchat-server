# guilds-param-members-search-get

## Summary

Implemented `GET /guilds/{guild_id}/members/search` as `Query Guild Members`.

- Added `src/api/routes/guilds/#guild_id/members/search.ts`.
- Kept the route behind bearer auth and added an explicit bot-only guard using `DiscordApiErrors.BOT_ONLY_ENDPOINT`.
- Declared `200`, `400`, `401`, and `403` response metadata for generated contracts and OpenAPI.
- Required the requesting bot to be a member of the guild via `Member.IsInGuildOrFail`.
- Parsed required `query` and optional integer `limit`, defaulting `limit` to `1` and enforcing `1..1000`.
- Searched guild members by username or nickname using escaped `ILIKE` contains matching.
- Loaded public member/user fields and role ids, then serialized responses through `toPublicMember()`.
- Added focused route/helper/artifact coverage in `test/routes/guilds-member-search-route.test.ts`.

## Changed Files

- `src/api/routes/guilds/#guild_id/members/search.ts`
- `test/routes/guilds-member-search-route.test.ts`
- `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`
- `packages/missing-routes/missing.json`
- `assets/testing-manifest.json`
- `test/generated/http-contracts.json`
- `test/generated/suite-coverage.json`
- `assets/openapi.json`
- `worker-progress/guilds-param-members-search-get.md`

## Evidence Gathered

- Confirmed the missing entry existed before implementation:
  `GET /guilds/{param}/members/search`, route name `GET_GUILDS_GUILD_ID_MEMBERS_SEARCH`, source `userdoccers:resources/guild.mdx`.
- Confirmed the route was absent from `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json` and `src/api/routes`.
- Userdoccers documents `Query Guild Members` as `GET /guilds/{guild_id}/members/search` with required `query`, optional `limit`, and guild member object responses.
- xHyroM only had adjacent `POST /guilds/{guild_id}/members-search`, so it was not used as authority for this exact route.
- Existing guild member routes and member projection helpers drove the implementation shape.

## Artifact Status

- Source catalog now includes `GET /guilds/{guild_id}/members/search` from `src/api/routes/guilds/#guild_id/members/search.ts`.
- `packages/missing-routes/missing.json` no longer lists `GET /guilds/{param}/members/search`.
- Missing-route count moved from 669 to 668 during orchestrator acceptance on current base `bed473b15`.
- Current-base source route count moved from 511 to 512 implemented routes.
- Testing manifest verified with 617 entries.
- Generated HTTP contracts verified with 592 contracts.
- Suite coverage verified with 15 suites.
- OpenAPI generation completed with 407 paths and 997 schemas.

## Commands Run

Worker verification before orchestrator acceptance:

- `npm ci`
    - Succeeded. Needed because `node_modules` was missing.
- `npm run build:src:tsgo`
    - Initially failed before install with `TS2688: Cannot find type definition file for 'node'`.
    - Succeeded after `npm ci`.
    - Succeeded again after final edits.
- `npm run build:test-fixtures`
    - Succeeded after implementation.
    - Succeeded again after final test assertion edit.
- `node -r dotenv/config -r module-alias/register --enable-source-maps --test --test-name-pattern 'parses|required|escapes|stays|rejects|requires|returns serialized' dist-test/test/routes/guilds-member-search-route.test.js`
    - Succeeded.
- `node -r dotenv/config -r module-alias/register --enable-source-maps --test dist-test/test/routes/guilds-member-search-route.test.js`
    - Succeeded after fixing an assertion for the generated HTTP contract catalog shape.
- `npm run build --workspace @spacebar/automatic-reverse-engineering`
    - Succeeded.
- `node packages/automatic-reverse-engineering/dist/cli.js import-source-routes --root src/api/routes --out packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`
    - Succeeded.
- `npm run build --workspace @spacebar/missing-routes`
    - Succeeded.
- `npm run start --workspace @spacebar/missing-routes`
    - Succeeded.
- `npm run generate:testing-manifest`
    - Succeeded.
- `node scripts/testing-manifest/verify.js`
    - Succeeded.
- `node scripts/testing-manifest/generate-contract-tests.js --check`
    - Initially reported `test/generated/http-contracts.json is stale`.
    - Succeeded after `npm run generate:contract-tests`.
- `npm run generate:contract-tests`
    - Succeeded.
- `node scripts/testing-manifest/generate-suite-coverage.js --check`
    - Initially reported `test/generated/suite-coverage.json is stale`.
    - Succeeded after `npm run generate:suite-coverage`.
- `npm run generate:suite-coverage`
    - Succeeded.
- `npm run generate:openapi`
    - Succeeded and reported existing warnings about three webhook routes missing route middleware.
- `node --test test/generated/http-contracts.test.js`
    - Succeeded.
- `node --test test/generated/suite-coverage.test.js`
    - Succeeded.
- `git diff --check`
    - Succeeded.
- `git status --short package.json package-lock.json`
    - No output; package files are unchanged.
- Malformed warranty-token scan over the changed route/artifact files.
    - No matches in the files touched for this route.

Orchestrator acceptance on current base `bed473b15`:

- `npm run build:src:tsgo`
    - Succeeded.
- `npm run build --workspace @spacebar/automatic-reverse-engineering`
    - Succeeded.
- `node packages/automatic-reverse-engineering/dist/cli.js import-source-routes --root src/api/routes --out packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`
    - Succeeded.
- `npm run build --workspace @spacebar/missing-routes`
    - Succeeded.
- `npm run start --workspace @spacebar/missing-routes`
    - Succeeded and reported `Spacebar is missing 668`, `Spacebar implements 512`, `Discord implements 1128`.
- `npm run generate:testing-manifest`
    - Succeeded and wrote 617 entries.
- `node scripts/testing-manifest/verify.js`
    - Succeeded.
- `node scripts/testing-manifest/generate-contract-tests.js --check`
    - Initially reported stale generated contracts.
- `npm run generate:contract-tests`
    - Succeeded and wrote 592 contracts.
- `node scripts/testing-manifest/generate-contract-tests.js --check`
    - Succeeded.
- `node scripts/testing-manifest/generate-suite-coverage.js --check`
    - Initially reported stale suite coverage.
- `npm run generate:suite-coverage`
    - Succeeded.
- `node scripts/testing-manifest/generate-suite-coverage.js --check`
    - Succeeded.
- `npm run generate:openapi`
    - Succeeded with existing unrelated warnings about webhook routes missing `route()` middleware and wrote 407 paths / 997 schemas.
- `npm run build:test-fixtures`
    - Succeeded.
- `node -r dotenv/config -r module-alias/register --enable-source-maps --test dist-test/test/routes/guilds-member-search-route.test.js`
    - Succeeded, 7/7 tests passed.
- `node --test test/generated/http-contracts.test.js`
    - Succeeded, 9/9 tests passed.
- `node --test test/generated/suite-coverage.test.js`
    - Succeeded, 4/4 tests passed.
- `npm run test:manifest`
    - Succeeded, 30/30 tests passed and manifest verified.
- `npm run test:suite-coverage`
    - Succeeded.
- `npx eslint src/api/routes/guilds/#guild_id/members/search.ts test/routes/guilds-member-search-route.test.ts`
    - Succeeded.
- `npx prettier --check src/api/routes/guilds/#guild_id/members/search.ts test/routes/guilds-member-search-route.test.ts worker-progress/guilds-param-members-search-get.md`
    - Succeeded.
- `git diff --check`
    - Succeeded.
- `git status --short package.json package-lock.json`
    - No output; package files are unchanged.
- Changed-file malformed warranty-token scan
    - No matches.

## Risks And Notes

- Bot-only behavior follows the Userdoccers note that this endpoint is not usable by user accounts. If upstream behavior changes, that guard may need revisiting.
- Search is intentionally scoped to this HTTP route: username/nickname contains search over guild members, not gateway member-search opcodes or broader indexing infrastructure.
- No schema regeneration was run by the worker because no schema files were changed.
- OpenAPI generation still emits unrelated pre-existing webhook route-middleware warnings.

## Recommended Next Tasks

- Run the normal integration/CI suite after merging this worktree.
- Implement adjacent missing guild member routes only as separate assignments.
