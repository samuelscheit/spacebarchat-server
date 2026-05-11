# soundboard-sounds-param-guild-param-get

## Summary

Implemented the exact assigned route `GET /soundboard-sounds/{sound_id}/guild/{guild_id}` as `GET_SOUNDBOARD_SOUNDS_SOUND_ID_GUILD_GUILD_ID`.

The route returns a `DiscoverableGuild` payload only when:

- the requested sound is backed for the requested guild,
- the guild exists,
- the guild has `DISCOVERABLE`,
- the guild is not auto-removed through `discovery_excluded`,
- guild expression discoverability is enabled.

Because this worktree has no soundboard sound entity/table or adjacent soundboard CRUD routes, the production default sound lookup fails closed and returns Discord error `10097` / `Unknown sound` until soundboard persistence is added. Tests inject a backing dependency to cover the successful public response and gate behavior without adding broader persistence outside this assignment.

## Changed Files

- `src/api/routes/soundboard-sounds/#sound_id/guild/#guild_id.ts`
    - New exact route file.
    - Adds `UNKNOWN_SOUNDBOARD_SOUND`, injectable dependencies, discoverability gating, authenticated route metadata, and `DiscoverableGuild` response mapping.
- `test/routes/soundboard-sounds-param-guild-param-get.test.ts`
    - New focused tests for auth boundary, unknown sound behavior, discoverability gates, success response shape, and generated artifact declarations.
- `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`
    - Regenerated source catalog with `GET /soundboard-sounds/{sound_id}/guild/{guild_id}`.
- `packages/missing-routes/missing.json`
    - Regenerated missing-route report; assigned entry removed.
- `assets/testing-manifest.json`
    - Regenerated manifest entry `api:http:GET:/soundboard-sounds/:sound_id/guild/:guild_id/`.
- `test/generated/http-contracts.json`
    - Regenerated generated HTTP contract metadata.
- `assets/openapi.json`
    - Regenerated OpenAPI; route returns `DiscoverableGuild` with `401` and `404` error bodies.

## Evidence Gathered

- `packages/missing-routes/missing.json` contained exactly one assigned missing entry:
    - method `GET`
    - route `/soundboard-sounds/{param}/guild/{param}`
    - route_name `GET_SOUNDBOARD_SOUNDS_SOUND_ID_GUILD_GUILD_ID`
    - sources `userdoccers:resources/soundboard.mdx`, `xhyrom:data/client/routes.json`
- `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json` had no source route for the assigned path before implementation.
- Existing route references inspected:
    - `src/api/routes/soundboard-default-sounds.ts`
    - `src/schemas/responses/SoundboardDefaultSoundsResponse.ts`
    - `src/api/routes/emojis/#emoji_id/guild.ts`
    - `src/api/routes/guilds/#guild_id/emojis.ts`
    - `src/api/routes/guilds/#guild_id/stickers.ts`
    - discovery DTO helpers in `src/schemas/responses/DiscoverableGuildsResponse.ts`
    - discovery metadata helper in `src/api/util/utility/GuildDiscoveryMetadata.ts`
- Userdoccers source used:
    - `https://raw.githubusercontent.com/discord-userdoccers/discord-userdoccers/master/pages/resources/soundboard.mdx`
    - It documents this endpoint as returning the owning discoverable guild and requiring the guild to be discoverable, not auto-removed, and expression discoverability enabled.
- xHyroM source used:
    - `packages/automatic-reverse-engineering/data/catalogs/routes.xhyrom.catalog.json`
    - Confirms `GET /soundboard-sounds/{param}/guild/{param}` as `SOUNDBOARD_SOUND_GUILD_DATA`.
- Discord official error reference used:
    - `https://docs.discord.com/developers/topics/opcodes-and-status-codes`
    - Confirms error code `10097` means `Unknown sound`.

## Missing-Route Movement

- Before regeneration from current base: `missing = 668`, `spacebar = 512`, `discord = 1128`.
- After regeneration: `missing = 667`, `spacebar = 513`, `discord = 1128`.
- Orchestrator current-base regeneration after `9c89d4c76` moved `missing = 667` to `666`, `spacebar = 513` to `514`, with `discord = 1128`; the assigned entry remains removed.
- Assigned missing entry is no longer present.
- Adjacent soundboard routes remain untouched:
    - `/guilds/{param}/soundboard-sounds`
    - `/guilds/{param}/soundboard-sounds/{param}`
    - `/channels/{param}/send-soundboard-sound`

## Artifact Status

- Source catalog: regenerated and includes:
    - `GET /soundboard-sounds/{sound_id}/guild/{guild_id}`
    - source `src/api/routes/soundboard-sounds/#sound_id/guild/#guild_id.ts`
    - response refs `APIErrorResponse`, `DiscoverableGuild`
- Missing report: regenerated; assigned entry removed.
- Testing manifest: regenerated and verified; new entry is bearer-authenticated with `200`, `401`, `404`.
- Generated HTTP contracts: check initially reported stale, then regenerated and verified. Orchestrator current-base regeneration wrote 594 contracts.
- Suite coverage: verified; no regeneration was needed.
- OpenAPI: regenerated; route summary is `Get Soundboard Sound Guild`, security is bearer, response `200` uses `#/components/schemas/DiscoverableGuild`. Orchestrator current-base generation wrote 408 paths and 997 schemas with the existing unrelated webhook route metadata warnings.
- Schemas: no schema source changed; `npm run generate:schema` was not required.

## Commands Run

- `npm ci`
    - Installed dependencies from the existing lockfile so verification could run in this clean worktree.
    - `package.json` and `package-lock.json` remained unchanged.
- `npm run build:src:tsgo`
    - First attempt failed before dependency install: `TS2688: Cannot find type definition file for 'node'`.
    - Passed after `npm ci`.
    - Re-run after final route comment; passed.
- `npm run build --workspace @spacebar/automatic-reverse-engineering`
    - Passed.
- `node packages/automatic-reverse-engineering/dist/cli.js import-source-routes --root src/api/routes --out packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`
    - Passed.
- `npm run build --workspace @spacebar/missing-routes`
    - Passed.
- `npm run start --workspace @spacebar/missing-routes`
    - Passed; reported `Spacebar is missing 667`, `Spacebar implements 513`, `Discord implements 1128`.
- `npm run generate:testing-manifest`
    - Passed; `618 entries`.
- `node scripts/testing-manifest/verify.js`
    - Passed; `Testing manifest verified (618 entries)`.
- `node scripts/testing-manifest/generate-contract-tests.js --check`
    - Initially failed because `test/generated/http-contracts.json` was stale.
    - Passed after `npm run generate:contract-tests`.
- `npm run generate:contract-tests`
    - Passed; `593 contracts`.
- `node scripts/testing-manifest/generate-suite-coverage.js --check`
    - Passed.
- `npm run generate:openapi`
    - Passed; OpenAPI generated with existing unrelated warnings about three routes missing `route()` middleware.
- `npm run build:test-fixtures`
    - Passed after generation.
- `node -r dotenv/config -r module-alias/register --enable-source-maps --test dist-test/test/routes/soundboard-sounds-param-guild-param-get.test.js dist-test/test/routes/soundboard-default-sounds.test.js`
    - Passed; 9 tests.
- `node --test test/generated/http-contracts.test.js`
    - Passed; 9 generated contract tests.
- `node --test test/generated/suite-coverage.test.js`
    - Passed; 4 generated suite coverage tests.
- `node -r dotenv/config -r module-alias/register --enable-source-maps --test dist-test/test/generated/http-auth-runtime-contracts.test.js`
    - Failed out of scope:
        - generated HTTP public response-schema contract expected `api:http:GET:/discovery/search` to return `200`, but it returned `500`.
        - The same run also logged pre-existing route registration errors for analytics `query` helper files that do not export default routers.
        - The bearer auth runtime contracts passed before the unrelated public schema failure.
- `node -r dotenv/config -r module-alias/register --enable-source-maps --test --test-name-pattern 'missing bearer' dist-test/test/generated/http-auth-runtime-contracts.test.js`
    - Passed; proves generated bearer-auth runtime coverage including the new authenticated route path. It still logs the same pre-existing route registration errors.
- `git diff --check`
    - Passed.
- `git diff --exit-code -- package.json package-lock.json`
    - Passed.
- Changed-file malformed warranty-token scan:
    - Ran the malformed warranty-token regex scan against changed files.
    - Passed with no matches in changed files.
- Full malformed warranty-token scan:
    - Found 27 pre-existing matches in unrelated files. Left untouched to avoid unrelated license churn outside this route assignment.

Orchestrator current-base acceptance after porting to `9c89d4c76`:

- Ported only source, focused test, and this progress report, then regenerated artifacts on the current base.
- Fixed duplicated `@spacebar/schemas` imports and corrected copied license text before acceptance.
- `npx prettier --write src/api/routes/soundboard-sounds/#sound_id/guild/#guild_id.ts test/routes/soundboard-sounds-param-guild-param-get.test.ts worker-progress/soundboard-sounds-param-guild-param-get.md` - passed.
- `npm run build:src:tsgo` - passed.
- `npm run build --workspace @spacebar/automatic-reverse-engineering` - passed.
- `node packages/automatic-reverse-engineering/dist/cli.js import-source-routes --root src/api/routes --out packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json` - passed.
- `npm run build --workspace @spacebar/missing-routes` - passed.
- `npm run start --workspace @spacebar/missing-routes` - passed; wrote `Spacebar is missing 666`, `Spacebar implements 514`, `Discord implements 1128`.
- `npm run generate:testing-manifest` - passed; wrote 619 entries.
- `node scripts/testing-manifest/verify.js` - passed.
- `node scripts/testing-manifest/generate-contract-tests.js --check` - failed because `test/generated/http-contracts.json` was stale.
- `npm run generate:contract-tests` - passed; wrote 594 contracts.
- `node scripts/testing-manifest/generate-contract-tests.js --check` - passed.
- `node scripts/testing-manifest/generate-suite-coverage.js --check` - passed.
- `npm run generate:openapi` - passed; existing unrelated webhook route metadata warnings remained.
- `npm run build:test-fixtures` - passed.
- `node -r dotenv/config -r module-alias/register --enable-source-maps --test dist-test/test/routes/soundboard-sounds-param-guild-param-get.test.js dist-test/test/routes/soundboard-default-sounds.test.js` - passed, 9 tests.
- `node --test test/generated/http-contracts.test.js test/generated/suite-coverage.test.js` - passed, 13 tests.
- `npm run test:manifest` - passed, 30 tests plus manifest verification.
- `npm run test:suite-coverage` - passed, 4 tests.
- `npx eslint src/api/routes/soundboard-sounds/#sound_id/guild/#guild_id.ts test/routes/soundboard-sounds-param-guild-param-get.test.ts` - initially failed on a duplicated import, then passed after the import fix.
- `npx prettier --check src/api/routes/soundboard-sounds/#sound_id/guild/#guild_id.ts test/routes/soundboard-sounds-param-guild-param-get.test.ts worker-progress/soundboard-sounds-param-guild-param-get.md` - passed.
- `git diff --check` - passed.
- `git diff --exit-code -- package.json package-lock.json packages/automatic-reverse-engineering/package.json packages/missing-routes/package.json` - passed, no package/lockfile changes.
- Changed-file conflict-marker scan - passed with no matches.
- Changed-file malformed warranty-token scan - passed with no matches.

## Risks / Blockers

- The current production default cannot return a positive match for custom soundboard sounds because no local soundboard sound persistence exists in this worktree. The route fails closed with `Unknown sound` instead of exposing discoverable guild data for unverified sound IDs.
- Full generated HTTP auth runtime suite has a pre-existing out-of-scope failure on `/discovery/search` returning `500` instead of `200`.
- Full malformed warranty-token scan finds existing unrelated malformed headers; changed files are clean.

## Recommended Next Tasks

- Implement soundboard sound persistence and the adjacent guild soundboard CRUD/read routes in their own assigned route work.
- Wire this route's default `soundExistsInGuild` dependency to the eventual soundboard sound model once that model exists.
- Fix the unrelated generated runtime contract failure for `/discovery/search`.
- Clean up the pre-existing malformed warranty headers in a dedicated license hygiene task.

## Prompt-To-Artifact Audit

- Assigned path only: complete.
- Missing entry confirmed: complete.
- Source catalog absence confirmed: complete.
- Userdoccers/xHyroM compared: complete.
- Existing default soundboard and guild/discoverability patterns inspected: complete.
- Production route behavior implemented with fail-closed persistence seam: complete.
- Focused tests added: complete.
- Source catalog regenerated: complete.
- Missing report regenerated: complete.
- Testing manifest regenerated and verified: complete.
- Generated HTTP contracts regenerated and verified: complete.
- Suite coverage check verified: complete.
- OpenAPI regenerated: complete.
- Schema generation: not required; no schema source changes.
- Package/lockfile guard: complete.
- Diff whitespace check: complete.
- Malformed warranty-token scan: changed files clean; full repo has pre-existing unrelated matches.
