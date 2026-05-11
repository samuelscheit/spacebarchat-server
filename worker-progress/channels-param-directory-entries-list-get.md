# channels-param-directory-entries-list-get

## Summary

Implemented `GET /channels/{channel_id}/directory-entries/list` only.

The route is mounted from `src/api/routes/channels/#channel_id/directory-entries.ts` at `/list`, requires `VIEW_CHANNEL`, verifies the target channel is `ChannelType.GUILD_DIRECTORY`, validates optional `entity_ids` as repeated or comma-separated snowflake IDs with a maximum of 100 values, and returns an empty partial directory-entry array while Spacebar has no persisted directory-entry store. This follows the accepted counts route and avoids synthesizing directory entries from unrelated guild discovery state.

## Assigned Path

- Assigned route id: `channels-param-directory-entries-list-get`
- Assigned route name: `GET_CHANNELS_CHANNEL_ID_DIRECTORY_ENTRIES_LIST`
- Assigned source route: `/channels/{channel_id}/directory-entries/list`
- Missing methods found: `GET`
- Methods implemented: `GET`
- Adjacent paths intentionally not implemented: `/channels/{channel_id}/directory-entries/search`, `/channels/{channel_id}/directory-entry/{entity_id}`, guild directory-entry routes, directory broadcast routes, and directory mutations.

## Evidence Gathered

- `packages/missing-routes/missing.json` initially listed one assigned missing entry: `GET /channels/{param}/directory-entries/list`.
- `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json` initially listed `/channels/{channel_id}/directory-entries` and `/channels/{channel_id}/directory-entries/counts`, but not `/channels/{channel_id}/directory-entries/list`.
- `src/api/routes/channels/#channel_id/directory-entries.ts` already had the conservative empty full-list route and the accepted counts route, including `VIEW_CHANNEL` and `GUILD_DIRECTORY` validation for counts.
- `src/api/routes/channels/#channel_id/directory-entry.ts` validates `VIEW_CHANNEL`, requires `GUILD_DIRECTORY`, and returns 404 because Spacebar does not persist directory entries yet.
- Userdoccers source `resources/directory-entry.mdx` documents `Get Partial Directory Entries` as requiring `VIEW_CHANNEL`, accepting optional `entity_ids` array of snowflakes with max 100, and returning partial directory entry objects without expanded `guild` or `guild_scheduled_event`.
- xHyroM catalog `packages/automatic-reverse-engineering/data/catalogs/routes.xhyrom.catalog.json` lists `/channels/{channel_id}/directory-entries/list` as `DIRECTORY_CHANNEL_LIST_BY_ID`.
- Read-only prior-art branch `codex/current-missing-route-channels-param-directory-entries-list-get` had a partial-entry schema and query parsing approach; this work reconciles that idea onto current base and adds current-base directory-channel validation from the accepted counts route.

## Changed Files

- `src/api/routes/channels/#channel_id/directory-entries.ts`
  - Added `/list`.
  - Added `parseDirectoryEntryListQuery`.
  - Added `VIEW_CHANNEL`, query, and response metadata.
  - Reused `requireDirectoryChannel` to reject non-directory channels.
- `test/routes/channels-param-directory-entries-search-get.test.ts`
  - Made the accepted search route metadata assertion independent of route
    declaration order so `/list` and `/search` can coexist.
- `src/schemas/responses/HubDirectoryEntriesResponse.ts`
  - Added `HubPartialDirectoryEntry`.
  - Added `HubPartialDirectoryEntriesResponse`.
- `src/schemas/responses/HubDirectoryEntriesResponse.test.ts`
  - Added partial-entry schema assertions.
- `test/routes/channels-param-directory-entries-list-get.test.ts`
  - Added focused route behavior, query validation, schema, and generated artifact tests.
- `tsconfig.test.json`
  - Added the existing hub directory schema test to the compiled test fixture list.
- Regenerated artifacts:
  - `assets/schemas.json`
  - `assets/openapi.json`
  - `assets/testing-manifest.json`
  - `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`
  - `packages/missing-routes/missing.json`
  - `test/generated/http-contracts.json`
  - `test/generated/suite-coverage.json`

## Behavior

- Success: a visible `GUILD_DIRECTORY` channel returns `[]` as `HubPartialDirectoryEntriesResponse`.
- Query validation: `entity_ids` may be omitted, repeated, `entity_ids[]`, or comma-separated; invalid snowflakes and more than 100 raw values return `50035 Invalid Form Body`.
- Wrong channel type: returns Discord API error `CANNOT_EXECUTE_ON_THIS_CHANNEL_TYPE`.
- Auth/authorization: route metadata requires bearer auth and `VIEW_CHANNEL`.
- Side effects: none. GET-only route; no gateway or audit-log events.

## Missing-Route Movement

- Before current-base regeneration: `missing = 655`, `spacebar = 525`, `discord = 1128`; assigned route present.
- After regeneration: `missing = 654`, `spacebar = 526`, `discord = 1128`; assigned route absent from `missing_entries`.
- Source catalog now includes `GET /channels/{channel_id}/directory-entries/list` with:
  - `route_name: GET_CHANNELS_CHANNEL_ID_DIRECTORY_ENTRIES_LIST`
  - `source: src/api/routes/channels/#channel_id/directory-entries.ts`
  - response schemas `APIErrorResponse` and `HubPartialDirectoryEntriesResponse`
- Current-base port note: the worker originally verified against base
  `cb16ad240`; the orchestrator ported source/test/schema/report changes onto
  `1b247d569` and regenerated artifacts there so the accepted directory-entry
  search route and OAuth2 application tokens route stay represented.

## Commands Run

- `sed -n '1,220p' /Users/user/Developer/Developer/spacebarchat/WORKER_BRIEF.md`
- `git status --short --branch`
- `rg`/`sed`/`find` inspections for missing entries, source catalogs, Userdoccers/xHyroM catalogs, channel directory routes, schemas, and tests.
- `git show codex/current-missing-route-channels-param-directory-entries-list-get:...` read-only prior-art inspection.
- `npm run build:src:tsgo`
  - First attempt failed because this worktree had no `node_modules`: `TS2688: Cannot find type definition file for 'node'`.
- `npm ci`
- `npm run build:src:tsgo`
- `npm run generate:schema`
- `npm run build:test-fixtures`
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
- `npm run generate:openapi`
- `node -r dotenv/config -r module-alias/register --enable-source-maps --test dist-test/test/routes/channels-param-directory-entries-list-get.test.js dist-test/src/schemas/responses/HubDirectoryEntriesResponse.test.js`
- `node --test test/generated/http-contracts.test.js test/generated/suite-coverage.test.js`
- Final reruns:
  - `npm run build:src:tsgo`
  - `npm run build:test-fixtures`
  - `node -r dotenv/config -r module-alias/register --enable-source-maps --test dist-test/test/routes/channels-param-directory-entries-list-get.test.js dist-test/src/schemas/responses/HubDirectoryEntriesResponse.test.js`
  - `node --test test/generated/http-contracts.test.js test/generated/suite-coverage.test.js`
  - `node scripts/testing-manifest/verify.js`
  - `node scripts/testing-manifest/generate-contract-tests.js --check`
  - `node scripts/testing-manifest/generate-suite-coverage.js --check`
  - `npm run test:manifest`
  - `npm run test:suite-coverage`
  - `git diff --check`
  - `git diff -- package.json package-lock.json`
  - `git status --short package.json package-lock.json`
  - Changed-file malformed warranty scan.
  - Repository-wide malformed warranty scan.

## Verification Results

- `npm run build:src:tsgo`: pass after `npm ci`.
- `npm run generate:schema`: pass; generated 1005 schemas including `HubPartialDirectoryEntriesResponse`.
- `npm run build:test-fixtures`: pass.
- Focused route/schema tests: pass, 9 tests.
- Automatic reverse-engineering build and source import: pass.
- Missing-routes build/start: pass; current-base missing count is now 654.
- Testing manifest generation and verify: pass, 631 entries.
- Contract check/regenerate/check: pass, 606 contracts.
- Suite coverage check/regenerate/check: pass.
- `npm run generate:openapi`: pass; generated 420 paths and 1005 schemas. Existing webhook route-metadata warnings remain unrelated.
- Generated contract/suite tests: pass, 13 tests.
- `npm run test:manifest`: pass, 30 tests plus manifest verify.
- `npm run test:suite-coverage`: pass, 4 tests.
- `git diff --check`: pass.
- Package/lockfile guard: pass, no `package.json` or `package-lock.json` diff.
- Changed-file malformed warranty scan: pass, no hits.
- Repository-wide malformed warranty scan: found pre-existing unrelated malformed warranty tokens in invite, webhook, thread archive, payment, CDN storage, registration, and fingerprint files. I did not edit those unrelated files.

## Artifact Status

- Schemas regenerated and include `HubPartialDirectoryEntry` and `HubPartialDirectoryEntriesResponse`.
- OpenAPI regenerated and includes `/channels/{channel_id}/directory-entries/list` with `VIEW_CHANNEL`, `entity_ids`, and `HubPartialDirectoryEntriesResponse`.
- Source catalog regenerated and includes the assigned route.
- Missing-routes report regenerated and no longer includes the assigned route.
- Testing manifest regenerated and includes `api:http:GET:/channels/:channel_id/directory-entries/list`.
- HTTP contracts and suite coverage regenerated and verified.

## Risks Or Blockers

- Spacebar still has no persisted directory-entry data model. Returning `[]` avoids fabricating entries, but non-empty Discord parity requires a dedicated directory-entry persistence design.
- `HubDirectoryEntryType` still models only guild entries (`0`), matching the existing schema limitation. Scheduled-event directory entries remain out of scope for this route.
- The repository-wide malformed warranty scan has pre-existing unrelated hits. Changed files are clean.

## Recommended Next Tasks

- Design and implement directory-entry persistence before making `/directory-entries`, `/list`, `/search`, entity detail, mutations, or broadcast routes return non-empty directory data.
- Address repository-wide malformed warranty boilerplate in a separate cleanup task.

## Completion Audit

- Confirmed assigned missing method and source absence before implementation.
- Compared Userdoccers/xHyroM evidence only for this path.
- Inspected current-base channel directory-entry routes, the accepted counts route, schemas, and tests.
- Implemented only the assigned `GET /list` route.
- Added focused behavior, validation, schema, and artifact tests.
- Regenerated source catalog, missing report, schemas, testing manifest, HTTP contracts, suite coverage, and OpenAPI.
- Ran required verification and documented the one environment-only initial failure.
- Confirmed package/lockfile guard, whitespace guard, and changed-file warranty scan.
