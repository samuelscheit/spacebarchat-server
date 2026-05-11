# guilds-param-directory-entries-broadcast-get

## Summary

Implemented `GET /guilds/{param}/directory-entries/broadcast` only.

Ported the scoped worker changes onto current integration base `51ab17f02`
after the worker completed on older base `1b247d569`. Generated artifacts were
regenerated from current main rather than copied, preserving the accepted OAuth
application assets/tokens routes and channel directory-entry list/search
routes.

The route is mounted at `src/api/routes/guilds/#guild_id/directory-entries/broadcast.ts`, requires bearer authentication through the normal API middleware, verifies that the guild exists, verifies that the current user is a guild member, validates the documented query parameters, and returns conservative broadcast information while Spacebar has no persisted directory-entry broadcast store.

The conservative response is:

- `{ "can_broadcast": false }` when only `type` is provided.
- `{ "can_broadcast": false, "has_broadcast": false }` when `entity_id` is provided.

## Assigned Path

- Assigned route id: `guilds-param-directory-entries-broadcast-get`
- Assigned route name: `GET_GUILDS_GUILD_ID_DIRECTORY_ENTRIES_BROADCAST`
- Assigned source route: `/guilds/{guild_id}/directory-entries/broadcast`
- Missing methods found: `GET`
- Methods implemented: `GET`
- Adjacent paths intentionally not implemented: channel directory-entry list/search/counts/detail/mutations, guild directory-entry mutations, hub/directory persistence, discovery routing, and unrelated guild discovery or analytics routes.

## Evidence Gathered

- `packages/missing-routes/missing.json` initially listed `GET /guilds/{param}/directory-entries/broadcast`.
- `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json` initially did not list `/guilds/{guild_id}/directory-entries/broadcast`.
- Userdoccers source reference `resources/directory-entry.mdx` documents `Get Directory Broadcast Info`, requires query field `type`, allows optional `entity_id`, says the user must be a guild member, and returns `can_broadcast` plus optional `has_broadcast`.
- xHyroM source reference `data/client/routes.json` lists `DIRECTORY_ENTRIES_BROADCAST_INFO` at `/guilds/:param/directory-entries/broadcast` with `GET`, `HEAD`, and `OPTIONS`.
- Existing local channel directory-entry behavior is conservative because Spacebar does not persist directory entries yet. This route follows that behavior and does not synthesize directory broadcast state from unrelated guild discovery data.

## Changed Files

- `src/api/routes/guilds/#guild_id/directory-entries/broadcast.ts`
    - Added the assigned GET route.
    - Added query parsing for required `type` values `0` or `1`.
    - Added optional `entity_id` snowflake validation.
    - Added guild existence and membership checks.
    - Added injectable dependencies and a conservative broadcast-info helper.
    - Added route metadata for summary, query, and `200`/`400`/`401`/`403`/`404` response schemas.
- `src/schemas/responses/GuildDirectoryBroadcastInfoResponse.ts`
    - Added `GuildDirectoryBroadcastInfoResponse`.
- `src/schemas/responses/index.ts`
    - Exported the new response schema.
- `test/routes/guilds-param-directory-entries-broadcast-get.test.ts`
    - Added focused tests for auth boundary, conservative response shape, provider hook behavior, query validation, unknown guild, non-member semantics, and generated artifacts.
- Regenerated artifacts:
    - `assets/schemas.json`
    - `assets/openapi.json`
    - `assets/testing-manifest.json`
    - `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`
    - `packages/missing-routes/missing.json`
    - `test/generated/http-contracts.json`
    - `test/generated/suite-coverage.json`

## Behavior

- Success for an authenticated guild member returns conservative broadcast information.
- Missing or invalid `type` returns field validation errors.
- Invalid `entity_id` returns a field validation error.
- Unknown guild returns Discord error `UNKNOWN_GUILD` with code `10004` and status `404`.
- Authenticated users outside the guild receive `403`.
- No directory entries, broadcasts, audit-log records, or gateway events are created.

## Missing-Route Movement

- Current-main regeneration: `missing = 653 -> 652`, `spacebar = 527 -> 528`, `discord = 1128`.
- Assigned route is absent from `missing_entries`.
- Source catalog now includes:
    - `GET /guilds/{guild_id}/directory-entries/broadcast`
    - `route_name: GET_GUILDS_GUILD_ID_DIRECTORY_ENTRIES_BROADCAST`
    - response schemas `APIErrorResponse`, `GuildDirectoryBroadcastInfoResponse`

## Commands Run

- `npm run build:src:tsgo`
    - First attempt failed before `npm ci`: `TS2688: Cannot find type definition file for 'node'` because the worktree had no `node_modules`.
- `npm ci`
- `npm run build:src:tsgo`
- `npm run generate:schema`
- `npm run generate:openapi`
    - Passed with pre-existing warnings about 3 webhook routes missing `route()` metadata.
- `npm run build --workspace @spacebar/automatic-reverse-engineering`
- `node packages/automatic-reverse-engineering/dist/cli.js import-source-routes --root src/api/routes --out packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`
- `npm run build --workspace @spacebar/missing-routes`
- `npm run start --workspace @spacebar/missing-routes`
- `npm run generate:testing-manifest`
- `node scripts/testing-manifest/verify.js`
- `node scripts/testing-manifest/generate-contract-tests.js --check`
    - Reported stale contracts before regeneration.
- `npm run generate:contract-tests`
- `node scripts/testing-manifest/generate-contract-tests.js --check`
- `node scripts/testing-manifest/generate-suite-coverage.js --check`
    - Reported stale suite coverage before regeneration.
- `npm run generate:suite-coverage`
- `node scripts/testing-manifest/generate-suite-coverage.js --check`
- `npm run build:test-fixtures`
- `node -r dotenv/config -r module-alias/register --enable-source-maps --test dist-test/test/routes/guilds-param-directory-entries-broadcast-get.test.js`
- `node --test test/generated/http-contracts.test.js test/generated/suite-coverage.test.js`
- `git diff --check`
- `git diff -- package.json package-lock.json`
- Repository-wide malformed warranty-token scan.
- Changed-file malformed warranty-token scan.

## Verification Results

- `npm run build:src:tsgo`: pass after installing dependencies in this worktree.
- `npm run generate:schema`: pass; schemas regenerated with `GuildDirectoryBroadcastInfoResponse`.
- `npm run generate:openapi`: pass; assigned route appears under `/guilds/{guild_id}/directory-entries/broadcast/`.
- Automatic reverse-engineering build and source import: pass.
- Missing-routes build/start: pass; current-main missing count is `652`.
- Testing manifest generation and verify: pass, `633` entries.
- Contract check/regenerate/check: pass, `608` contracts.
- Suite coverage check/regenerate/check: pass, `15` suites.
- OpenAPI generation: pass; `422` paths and `1007` schemas.
- `npm run build:test-fixtures`: pass.
- Focused route/schema/artifact test: pass.
- Generated contract/suite tests: pass.
- `git diff --check`: pass.
- Package/lockfile guard: pass, no package or lockfile diff.
- Changed-file malformed warranty scan: pass, no hits in the new route, schema, or focused test.
- Repository-wide malformed warranty scan: found pre-existing unrelated hits in files outside this assignment. I did not edit those files.

## Artifact Status

- Schemas regenerated and include `GuildDirectoryBroadcastInfoResponse`.
- OpenAPI regenerated and includes the assigned route with bearer security, query params, and response refs.
- Source catalog regenerated and includes the assigned route.
- Missing-routes report regenerated and no longer includes the assigned route.
- Testing manifest regenerated and includes `api:http:GET:/guilds/:guild_id/directory-entries/broadcast/`.
- HTTP contracts and suite coverage regenerated and verified.

## Risks Or Blockers

- Spacebar still has no persisted directory-entry or directory-broadcast data model. The route returns conservative false values instead of fabricating broadcast state.
- Full Discord parity for positive `can_broadcast` or `has_broadcast` values requires future directory-entry persistence and broadcast tracking.
- Repository-wide malformed warranty boilerplate hits remain pre-existing and unrelated to this route.

## Recommended Next Tasks

- Implement directory-entry persistence before adding non-empty broadcast, list, search, detail, or mutation behavior.
- Add positive broadcast eligibility and `has_broadcast` behavior once Spacebar has a real directory broadcast data source.
- Fix the pre-existing malformed warranty boilerplate files in a separate cleanup task.

## Completion Audit

- Confirmed the assigned missing method and source-catalog absence before implementation.
- Compared Userdoccers and xHyroM evidence for only this path.
- Inspected existing channel directory-entry behavior and matched its conservative persistence boundary.
- Implemented only the assigned GET route.
- Added focused route/schema/artifact coverage.
- Regenerated required schema, OpenAPI, source catalog, missing-route, testing manifest, contract, and suite coverage artifacts.
- Ran required verification and documented the environment-only initial dependency failure plus stale generated-artifact checks.
