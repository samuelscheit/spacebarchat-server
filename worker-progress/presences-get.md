# GET /presences

## Summary

Implemented the assigned `GET /presences` API route. The route is authenticated, returns the documented `guilds`, `presences`, and `applications` response envelope, and serializes only locally backed friend session presences that are non-offline and have at least one activity. It does not fabricate Discord-only implicit relationship, voice guild, or application discovery payloads; those fields are returned as empty arrays until Spacebar has a persisted local model for them.

`POST /presences`, console/Xbox presence routes, gateway presence opcodes, relationship routes, and adjacent mutation flows were intentionally untouched.

## Changed Files

- `src/api/routes/presences.ts`
- `src/schemas/responses/PresencesResponse.ts`
- `src/schemas/responses/index.ts`
- `test/routes/presencesRoute.test.ts`
- `assets/schemas.json`
- `assets/openapi.json`
- `assets/testing-manifest.json`
- `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`
- `packages/missing-routes/missing.json`
- `test/generated/http-contracts.json`

## Missing Route Movement

- Worker base: `894b854d8 Implement family center teen activity route`
- Before regeneration: `missing = 608`, `spacebar = 572`; both `GET /presences` and `POST /presences` were listed as missing.
- After regeneration: `missing = 607`, `spacebar = 573`; `GET /presences` is removed and `POST /presences` remains missing.
- Source catalog now contains `GET_PRESENCES` from `src/api/routes/presences.ts` with response schemas `APIErrorResponse` and `PresencesResponse`.

## Evidence Gathered

- Local missing report assigned `GET /presences` from `userdoccers:resources/presence.mdx`; `POST /presences` remains a separate missing entry and was out of scope.
- Local `routes.source.catalog.json` had no existing `/presences` route before implementation.
- Local xHyroM route catalog had no exact `/presences` entry.
- Userdoccers upstream `pages/resources/presence.mdx` documents `GET /presences` as overall presences for non-offline friends and implicit relationships, including only users with an activity or returned guild voice presence, with `guilds`, `presences`, and `applications` response fields.
- Existing local patterns checked: `src/util/interfaces/Presence.ts`, `src/util/util/Presence.ts`, `src/util/util/SessionRelevance.ts`, `src/api/routes/consoles/xbox/presences.ts`, and `test/routes/consolesXboxPresencesRoute.test.ts`.

## Behavior

- Requires bearer auth through the normal API stack.
- Reads `RelationshipType.friends` rows for the authenticated user.
- Reads non-admin `Session` rows for those friend IDs and uses `getMostRelevantSession`.
- Maps `invisible` to `offline`, maps `unknown` to `online`, skips offline or activity-less presences, and skips rows without a local public user projection.
- Returns empty `guilds` and `applications` arrays because this route has no defensible persisted local model for Discord's implicit relationship, voice guild discovery, or application discovery payloads.

## Commands Run

- `npm ci`
- `npm run build:src:tsgo`
- `npm run generate:schema`
- `npm run build --workspace @spacebar/automatic-reverse-engineering`
- `npm run build --workspace @spacebar/missing-routes`
- `npm run generate:openapi`
- `node packages/automatic-reverse-engineering/dist/cli.js import-source-routes --root src/api/routes --out packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`
- `npm run start --workspace @spacebar/missing-routes`
- `npm run generate:testing-manifest`
- `npm run generate:contract-tests`
- `npm run generate:suite-coverage`
- `npm test -- test/routes/presencesRoute.test.ts`
- `npm run build:test-fixtures`
- `node scripts/testing-manifest/verify.js`
- `node scripts/testing-manifest/generate-contract-tests.js --check`
- `node scripts/testing-manifest/generate-suite-coverage.js --check`
- `node --test test/generated/http-contracts.test.js test/generated/suite-coverage.test.js`
- `npm run test:suite-coverage`
- `npm run test:contracts`
- `node -r dotenv/config -r module-alias/register --enable-source-maps --test dist-test/test/routes/presencesRoute.test.js`
- `git diff --check`
- `git diff --name-only -- package.json package-lock.json`

## Verification Results

- Initial `npm run build:src:tsgo` failed before `npm ci` because this worktree had no local `node_modules` and `tsgo` was unavailable.
- Focused source route test passed: 6 tests.
- Built fixture route test passed: 6 tests.
- `npm run build:src:tsgo` passed.
- Initial `npm run build:test-fixtures` caught a test-only mock activity type mismatch; it passed after tightening the test mock activity type.
- Testing manifest verify passed: 678 entries.
- Generated HTTP contract tests verified: 653 contracts.
- Generated suite coverage verified; `npm run test:suite-coverage` passed.
- `git diff --check` passed.
- Package/lockfile guard passed: no `package.json` or `package-lock.json` diff after `npm ci`.
- `npm run test:contracts` failed only on the known unrelated runtime contract: `api:http:GET:/discovery/search` returned `500 !== 200`. Static contract checks passed before that runtime failure.

## Completion Audit

- Assigned worktree and branch confirmed with `pwd` and `git status --short --branch`: `/Users/user/Developer/Developer/spacebarchat/worktrees/current-presences-get-agent` on `codex/current-missing-route-presences-get-agent`.
- Prompt-to-artifact checklist:
    - Exact route implemented: `src/api/routes/presences.ts` defines only `router.get("/")` for `GET /presences`.
    - Adjacent routes untouched: final `git status` has no `src/api/routes/consoles/xbox/presences.ts` changes, and `POST /presences` remains listed in `packages/missing-routes/missing.json`.
    - Source evidence preserved: `packages/automatic-reverse-engineering/data/catalogs/routes.userdoccers.catalog.json` lists `GET_PRESENCES` and `POST_PRESENCES`; `routes.xhyrom.catalog.json` has no exact `/presences` entry.
    - Missing report regenerated: `missing = 607`, `spacebar = 573`, `discord = 1128`; only `POST /presences` remains under `/presences`.
    - Source catalog regenerated: `routes.source.catalog.json` has `GET /presences`, route name `GET_PRESENCES`, source `src/api/routes/presences.ts`, responses `APIErrorResponse` and `PresencesResponse`.
    - Schema/OpenAPI regenerated: `assets/schemas.json` contains `PresencesResponse`; `assets/openapi.json` has `/presences/` `get` with bearer security and `PresencesResponse`/`APIErrorResponse`.
    - Testing manifest/contracts regenerated: `assets/testing-manifest.json` contains `api:http:GET:/presences/`; `test/generated/http-contracts.json` contains the matching contract.
    - Focused behavior and auth tests: `npm test -- test/routes/presencesRoute.test.ts` passed 6 tests on the final audit rerun.
    - Built fixture test: `node -r dotenv/config -r module-alias/register --enable-source-maps --test dist-test/test/routes/presencesRoute.test.js` passed 6 tests on the final audit rerun.
    - Required build/check gates: `npm run build:src:tsgo`, `npm run build:test-fixtures`, `node scripts/testing-manifest/verify.js`, `node scripts/testing-manifest/generate-contract-tests.js --check`, `node scripts/testing-manifest/generate-suite-coverage.js --check`, `node --test test/generated/http-contracts.test.js test/generated/suite-coverage.test.js`, and `npm run test:suite-coverage` all passed on final audit rerun.
    - Whitespace/package guard: `git diff --check` passed; `git diff --name-only -- package.json package-lock.json` produced no package or lockfile changes.
- One audit rerun of `npm test -- test/routes/presencesRoute.test.ts` failed transiently because it was started concurrently with `npm run build:src:tsgo`, which deletes `dist` before rebuilding. The same test passed after the build completed.

## Risks Or Blockers

- The endpoint currently omits implicit relationships, voice guilds, and application discovery. This is intentional fail-closed behavior because Spacebar does not have a route-local persisted model that can produce those payloads safely.
- If main has advanced beyond assigned base `894b854d8`, orchestrator should reconcile normally before merge. No extra reconciliation was needed within this assigned worktree/base.

## Recommended Next Tasks

- Implement `POST /presences` separately if assigned.
- Add a shared presence discovery model later if Spacebar persists implicit relationships, voice session discovery, or application discovery payloads that can be safely exposed by both `/presences` and `/consoles/xbox/presences`.
