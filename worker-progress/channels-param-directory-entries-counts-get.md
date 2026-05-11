# channels-param-directory-entries-counts-get

## Summary

Implemented `GET /channels/{param}/directory-entries/counts` only.

The route is mounted from `src/api/routes/channels/#channel_id/directory-entries.ts` at `/counts`, requires `VIEW_CHANNEL`, verifies the target channel is `ChannelType.GUILD_DIRECTORY`, and returns an empty category-count map while Spacebar has no persisted directory-entry store. This matches the existing conservative directory-entry behavior, where the base listing returns an empty list and individual directory entries are not synthesized from guild state.

## Assigned Path

- Assigned route id: `channels-param-directory-entries-counts-get`
- Assigned route name: `GET_CHANNELS_CHANNEL_ID_DIRECTORY_ENTRIES_COUNTS`
- Assigned source route: `/channels/{channel_id}/directory-entries/counts`
- Missing methods found: `GET`
- Methods implemented: `GET`
- Adjacent paths intentionally not implemented: `/list`, `/search`, `/directory-entry/{entity_id}`, guild broadcast routes, directory mutations.

## Evidence Gathered

- `packages/missing-routes/missing.json` initially listed `GET /channels/{param}/directory-entries/counts`.
- `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json` initially did not list `/channels/{channel_id}/directory-entries/counts`.
- Userdoccers source reference: `resources/directory-entry.mdx`, mirrored at `https://docs.discord.food/resources/directory-entry`, says the endpoint returns a mapping of directory categories to entry counts and requires `VIEW_CHANNEL`.
- xHyroM source reference: `packages/automatic-reverse-engineering/data/catalogs/routes.xhyrom.catalog.json` lists `/channels/{channel_id}/directory-entries/counts` as `DIRECTORY_CHANNEL_CATEGORY_COUNTS`.
- Existing local directory-entry behavior:
    - `src/api/routes/channels/#channel_id/directory-entries.ts` returned an empty `HubDirectoryEntriesResponse`.
    - `src/api/routes/channels/#channel_id/directory-entry.ts` validates `GUILD_DIRECTORY` and does not synthesize entries because Spacebar does not persist them yet.

## Changed Files

- `src/api/routes/channels/#channel_id/directory-entries.ts`
    - Added `GET /counts`.
    - Added `VIEW_CHANNEL` route metadata.
    - Added directory-channel validation and empty count response helper.
- `src/schemas/responses/HubDirectoryEntriesResponse.ts`
    - Added `HubDirectoryEntryCountsResponse` as a string-keyed integer map.
- `test/routes/channels-param-directory-entries-counts-get.test.ts`
    - Added focused route behavior, schema, and artifact assertions.
- Regenerated artifacts:
    - `assets/schemas.json`
    - `assets/openapi.json`
    - `assets/testing-manifest.json`
    - `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`
    - `packages/missing-routes/missing.json`
    - `test/generated/http-contracts.json`
    - `test/generated/suite-coverage.json`

## Behavior

- Success: a visible `GUILD_DIRECTORY` channel returns `{}` as `HubDirectoryEntryCountsResponse`.
- Wrong channel type: returns Discord API error `CANNOT_EXECUTE_ON_THIS_CHANNEL_TYPE`.
- Auth/authorization: route metadata requires bearer auth and `VIEW_CHANNEL`.
- Side effects: none. GET-only route; no gateway or audit-log events.

## Missing-Route Movement

- Worker-base regeneration: `missing = 662 -> 661`; assigned route absent from `missing_entries`.
- Current-base regeneration after merging `codex/merge-ready-prs-20260508` at
  `1a4bea076`: `missing = 659 -> 658`, `spacebar = 521 -> 522`,
  `discord = 1128`; assigned route absent from `missing_entries`.
- Source catalog now includes:
    - `GET /channels/{channel_id}/directory-entries/counts`
    - `route_name: GET_CHANNELS_CHANNEL_ID_DIRECTORY_ENTRIES_COUNTS`
    - response schemas `APIErrorResponse`, `HubDirectoryEntryCountsResponse`

## Commands Run

- `npm run build:src:tsgo`
    - First attempt failed before `npm ci`: `TS2688: Cannot find type definition file for 'node'` because the worktree had no `node_modules`.
- `npm ci`
- `npm run build:src:tsgo`
- `npm run generate:schema`
- `npm run build:test-fixtures`
- `node -r dotenv/config -r module-alias/register --enable-source-maps --test dist-test/test/routes/channels-param-directory-entries-counts-get.test.js`
- `npm run build --workspace @spacebar/automatic-reverse-engineering`
- `node packages/automatic-reverse-engineering/dist/cli.js import-source-routes --root src/api/routes --out packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`
- `npm run build --workspace @spacebar/missing-routes`
- `npm run start --workspace @spacebar/missing-routes`
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
- `node --test test/generated/http-contracts.test.js test/generated/suite-coverage.test.js`
- Current-base port reruns after merging `1a4bea076`:
    - `npm run build:src:tsgo`
    - `npm run build --workspace @spacebar/automatic-reverse-engineering`
    - `npm run generate:schema`
    - `node packages/automatic-reverse-engineering/dist/cli.js import-source-routes --root src/api/routes --out packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`
    - `npm run build --workspace @spacebar/missing-routes`
    - `npm run start --workspace @spacebar/missing-routes`
    - `npm run generate:testing-manifest`
    - `node scripts/testing-manifest/verify.js`
    - `node scripts/testing-manifest/generate-contract-tests.js --check`
    - `npm run generate:contract-tests`
    - `node scripts/testing-manifest/generate-contract-tests.js --check`
    - `node scripts/testing-manifest/generate-suite-coverage.js --check`
    - `npm run generate:suite-coverage`
    - `node scripts/testing-manifest/generate-suite-coverage.js --check`
    - `npm run generate:openapi`
    - `npm run build:test-fixtures`
    - `node -r dotenv/config -r module-alias/register --enable-source-maps --test dist-test/test/routes/channels-param-directory-entries-counts-get.test.js`
    - `node --test test/generated/http-contracts.test.js test/generated/suite-coverage.test.js`
    - `npm run test:manifest`
    - `npm run test:suite-coverage`
- Final reruns:
    - `npm run build:test-fixtures`
    - `node -r dotenv/config -r module-alias/register --enable-source-maps --test dist-test/test/routes/channels-param-directory-entries-counts-get.test.js`
    - `npm run build:src:tsgo`
    - `node scripts/testing-manifest/verify.js`
    - `node scripts/testing-manifest/generate-contract-tests.js --check`
    - `node scripts/testing-manifest/generate-suite-coverage.js --check`
    - `node --test test/generated/http-contracts.test.js test/generated/suite-coverage.test.js`
    - `git diff --check`
    - `git diff -- package.json package-lock.json && git status --short package.json package-lock.json`
    - Changed-file malformed warranty scan over changed/untracked files.
    - Repository-wide malformed warranty scan with the same malformed-token patterns.

## Verification Results

- `npm run build:src:tsgo`: pass after installing dependencies in this worktree.
- `npm run generate:schema`: pass.
- `npm run build:test-fixtures`: pass.
- Focused route/schema/artifact test: pass, 5 tests.
- Automatic reverse-engineering build and source import: pass.
- Missing-routes build/start: pass; current-base missing count 658.
- Testing manifest generation and verify: pass, 627 entries.
- OpenAPI generation: pass with 416 paths and 999 schemas; existing warnings
  about webhook routes missing route metadata remain unrelated.
- Contract check/regenerate/check: pass, 602 contracts.
- Suite coverage check/regenerate/check: pass.
- Generated contract/suite tests: pass, 13 tests.
- `git diff --check`: pass.
- Package/lockfile guard: pass, no package/lockfile diff.
- Changed-file malformed warranty scan: pass, no hits.
- Repository-wide malformed warranty scan: found pre-existing unrelated hits outside this assignment, including `src/schemas/responses/GuildRecommendationsResponse.test.ts`, `src/schemas/responses/InviteResponse.ts`, and several invite/webhook utility files. I did not edit those unrelated files.

## Artifact Status

- Schemas regenerated and include `HubDirectoryEntryCountsResponse`.
- OpenAPI regenerated and includes `/channels/{channel_id}/directory-entries/counts`.
- Source catalog regenerated and includes the assigned route.
- Missing-routes report regenerated and no longer includes the assigned route.
- Testing manifest regenerated and includes `api:http:GET:/channels/:channel_id/directory-entries/counts`.
- HTTP contracts and suite coverage regenerated and verified.

## Risks Or Blockers

- Spacebar still has no persisted directory-entry data model. Returning `{}` avoids fabricating category counts from unrelated guild discovery state, but full Discord parity for non-empty counts requires implementing directory-entry persistence in future work.
- Repository-wide malformed warranty scan has pre-existing unrelated hits. Changed files are clean.

## Recommended Next Tasks

- Implement directory-entry persistence before adding non-empty `/directory-entries`, `/list`, `/search`, or mutation behavior.
- Address the pre-existing malformed warranty boilerplate files in a separate cleanup task.

## Completion Audit

- Confirmed assigned missing method and source absence before implementation.
- Compared Userdoccers/xHyroM evidence only for this path.
- Inspected existing channel directory-entry routes and schemas.
- Implemented only the assigned GET route.
- Added focused route/schema/artifact tests.
- Regenerated required route, schema, OpenAPI, manifest, contract, suite, and missing-route artifacts.
- Ran required verification and documented the one environment-only initial failure.
