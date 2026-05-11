# channels-param-directory-entries-search-get

## Summary

Implemented `GET /channels/{param}/directory-entries/search` only.

The route is mounted from `src/api/routes/channels/#channel_id/directory-entries.ts` at `/search`, requires `VIEW_CHANNEL`, validates the documented `query`, `type`, and `category_id` query parameters, verifies the target channel is `ChannelType.GUILD_DIRECTORY`, and returns an empty `HubDirectoryEntriesResponse` while Spacebar has no persisted directory-entry store. This follows the existing conservative behavior for directory entries: the base listing returns an empty list, counts return an empty map, and individual entries are not synthesized from guild state.

## Assigned Path

- Assigned route id: `channels-param-directory-entries-search-get`
- Assigned route name: `GET_CHANNELS_CHANNEL_ID_DIRECTORY_ENTRIES_SEARCH`
- Assigned source route: `/channels/{channel_id}/directory-entries/search`
- Missing methods found: `GET`
- Methods implemented: `GET`
- Adjacent paths intentionally not implemented: `/channels/{channel_id}/directory-entries/list`, `/channels/{channel_id}/directory-entries/counts`, `/channels/{channel_id}/directory-entry/{entity_id}`, guild directory-entry routes, directory broadcast routes, and directory mutations.

## Evidence Gathered

- `packages/missing-routes/missing.json` initially listed `GET /channels/{param}/directory-entries/search`.
- `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json` initially did not list `/channels/{channel_id}/directory-entries/search`.
- Userdoccers source reference: `resources/directory-entry.mdx`, mirrored at `https://docs.discord.food/resources/directory-entry`, says the endpoint returns matching directory entry objects, requires `VIEW_CHANNEL`, and has query parameters `query` (1-100 characters, required), `type`, and `category_id`.
- xHyroM source reference: `packages/automatic-reverse-engineering/data/catalogs/routes.xhyrom.catalog.json` lists `/channels/{channel_id}/directory-entries/search` as `DIRECTORY_ENTRIES_SEARCH`.
- Existing local directory-entry behavior:
    - `src/api/routes/channels/#channel_id/directory-entries.ts` already implemented `/counts` with `VIEW_CHANNEL`, `GUILD_DIRECTORY` validation, and an empty response while entries are not persisted.
    - `src/api/routes/channels/#channel_id/directory-entry.ts` validates `GUILD_DIRECTORY` and does not synthesize entries because Spacebar does not persist them yet.

## Changed Files

- `src/api/routes/channels/#channel_id/directory-entries.ts`
    - Added `GET /search`.
    - Added query parsing for `query`, `type`, and `category_id`.
    - Added `VIEW_CHANNEL` route metadata, response metadata, and OpenAPI query metadata.
    - Added an empty search-result helper.
- `test/routes/channels-param-directory-entries-search-get.test.ts`
    - Added focused behavior, validation, schema, and artifact assertions.
- Regenerated artifacts:
    - `assets/openapi.json`
    - `assets/testing-manifest.json`
    - `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`
    - `packages/missing-routes/missing.json`
    - `test/generated/http-contracts.json`
    - `test/generated/suite-coverage.json`

## Behavior

- Success: a visible `GUILD_DIRECTORY` channel with a valid `query` returns `[]` as `HubDirectoryEntriesResponse`.
- Query validation:
    - `query` is required and must be a string from 1 to 100 characters.
    - `type` accepts documented directory-entry types `0` and `1`.
    - `category_id` accepts documented active categories `0`, `1`, `2`, `3`, and `5`.
- Wrong channel type: returns Discord API error `CANNOT_EXECUTE_ON_THIS_CHANNEL_TYPE`.
- Auth/authorization: route metadata requires bearer auth and `VIEW_CHANNEL`.
- Side effects: none. GET-only route; no gateway or audit-log events.

## Missing-Route Movement

- Before current-base regeneration: `missing = 656`, assigned route present.
- After source import and missing-route regeneration: `missing = 655`, `spacebar = 525`, `discord = 1128`, assigned route absent from `missing_entries`.
- Source catalog now includes:
    - `GET /channels/{channel_id}/directory-entries/search`
    - `route_name: GET_CHANNELS_CHANNEL_ID_DIRECTORY_ENTRIES_SEARCH`
    - response schemas `APIErrorResponse`, `HubDirectoryEntriesResponse`
- Current-base port note: the worker originally verified against base
  `fccc9d5a7`; the orchestrator ported only source/test/report changes onto
  `51722c294` and regenerated artifacts there so the previously accepted
  OAuth2 application tokens route stays represented.

## Commands Run

- `npm run build:src:tsgo`
    - First attempt failed before dependency install: `TS2688: Cannot find type definition file for 'node'`.
- `npm ci`
- `npm run build:src:tsgo`
- `npm run build:test-fixtures`
- `node -r dotenv/config -r module-alias/register --enable-source-maps --test --test-name-pattern 'returns empty|rejects search|validates documented|declares VIEW_CHANNEL|validates the generated directory entries response' dist-test/test/routes/channels-param-directory-entries-search-get.test.js`
- `npm run build --workspace @spacebar/automatic-reverse-engineering`
- `node packages/automatic-reverse-engineering/dist/cli.js import-source-routes --root src/api/routes --out packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`
- `npm run build --workspace @spacebar/missing-routes`
- `npm run start --workspace @spacebar/missing-routes`
- `npm run generate:schema`
- `npm run generate:testing-manifest`
- `node scripts/testing-manifest/verify.js`
- `npm run generate:openapi`
- `node scripts/testing-manifest/generate-contract-tests.js --check`
    - Reported stale contracts before regeneration.
- `npm run generate:contract-tests`
- `node scripts/testing-manifest/generate-contract-tests.js --check`
- `node scripts/testing-manifest/generate-suite-coverage.js --check`
    - Reported stale suite coverage before regeneration.
- `npm run generate:suite-coverage`
- `node scripts/testing-manifest/generate-suite-coverage.js --check`
- `npm run build:src:tsgo`
- `npm run build:test-fixtures`
- `node -r dotenv/config -r module-alias/register --enable-source-maps --test dist-test/test/routes/channels-param-directory-entries-search-get.test.js`
- `node scripts/testing-manifest/verify.js`
- `node scripts/testing-manifest/generate-contract-tests.js --check`
- `node scripts/testing-manifest/generate-suite-coverage.js --check`
- `node --test test/generated/http-contracts.test.js test/generated/suite-coverage.test.js`
- `npm run test:manifest`
- `git diff --check`
- `git diff -- package.json package-lock.json && git status --short package.json package-lock.json`
- Changed-file malformed warranty scan over changed/untracked files.
- Repository-wide malformed warranty scan with the malformed-token patterns.

## Verification Results

- `npm ci`: pass. NPM reported existing advisory counts after install; no package files changed.
- `npm run build:src:tsgo`: pass after installing dependencies in this worktree.
- `npm run generate:schema`: pass; no schema artifact diff remained because no schema types changed.
- `npm run build:test-fixtures`: pass.
- Focused route/schema/artifact test: pass, 6 tests.
- Automatic reverse-engineering build and source import: pass.
- Missing-routes build/start: pass; missing count now 655.
- Testing manifest generation and verify: pass, 630 entries.
- OpenAPI generation: pass with 419 paths and 1003 schemas; existing warnings about 3 routes missing route metadata remain unrelated.
- Contract check/regenerate/check: pass, 605 contracts.
- Suite coverage check/regenerate/check: pass, 15 suites.
- Generated contract/suite tests: pass, 13 tests.
- `npm run test:manifest`: pass, 30 tests plus manifest verify.
- `git diff --check`: pass.
- Package/lockfile guard: pass, no package/lockfile diff.
- Changed-file malformed warranty scan: pass, no hits.
- Repository-wide malformed warranty scan: found pre-existing unrelated hits outside this assignment, including `src/schemas/responses/GuildRecommendationsResponse.test.ts`, `src/schemas/responses/InviteResponse.ts`, invite/webhook utility files, channel archived-thread route files, and CDN utility/route files. I did not edit those unrelated files.

## Artifact Status

- Schemas checked; no schema file changed.
- OpenAPI regenerated and includes `/channels/{channel_id}/directory-entries/search`.
- Source catalog regenerated and includes the assigned route.
- Missing-routes report regenerated and no longer includes the assigned route.
- Testing manifest regenerated and includes `api:http:GET:/channels/:channel_id/directory-entries/search`.
- HTTP contracts and suite coverage regenerated and verified.

## Risks Or Blockers

- Spacebar still has no persisted directory-entry data model. Returning `[]` avoids fabricating search results from unrelated guild discovery state, but full Discord parity for non-empty results requires directory-entry persistence and indexing/search behavior.
- Repository-wide malformed warranty scan has pre-existing unrelated hits. Changed files are clean.

## Recommended Next Tasks

- Implement directory-entry persistence before adding non-empty `/directory-entries`, `/list`, `/search`, or mutation behavior.
- Implement `/channels/{channel_id}/directory-entries/list` separately when assigned.
- Address the pre-existing malformed warranty boilerplate files in a separate cleanup task.

## Completion Audit

- Confirmed assigned missing method and source absence before implementation.
- Compared Userdoccers/xHyroM evidence only for this path.
- Inspected existing channel directory-entry routes and schemas.
- Implemented only the assigned GET search route.
- Added focused route/query/schema/artifact tests.
- Regenerated required source catalog, missing report, testing manifest, OpenAPI, HTTP contracts, and suite coverage.
- Ran required verification and documented the dependency-install-only initial failure.
