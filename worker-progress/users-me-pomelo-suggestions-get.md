# users-me-pomelo-suggestions-get

## Goal Evidence

- `create_goal`: succeeded before research or file reads.
- Initial `get_goal`: status `active`.
- Objective: Implement production-ready support for the missing route path `/users/@me/pomelo-suggestions` on the current integration branch, using the prior worker output for `users-me-pomelo-suggestions` only as read-only reference, with focused tests, regenerated route catalogs and generated route artifacts, verification evidence, and a complete handoff report.
- Final pre-completion `get_goal`: status `active`, objective unchanged, `tokensUsed: 267558`, `timeUsedSeconds: 542`.
- Final `update_goal(status: "complete")`: succeeded, status `complete`, `tokensUsed: 270776`, `timeUsedSeconds: 554`.

## Assignment

- Worker id: `users-me-pomelo-suggestions-get`
- Assigned path: `/users/@me/pomelo-suggestions`
- Missing methods found in `packages/missing-routes/missing.json`: `GET`
- Methods implemented: `GET`
- Out-of-scope adjacent paths: `/unique-username/**`, `/users/@me/pomelo-attempt`, `/users/@me`, `/users/@me/settings`, profile routes, username mutation routes, and registration-token routes.
- xHyroM also lists `HEAD` and `OPTIONS` for the path, but `packages/missing-routes/missing.json` owns only `GET`; no adjacent methods were implemented.

## Evidence Gathered

- `packages/missing-routes/missing.json` had one assigned entry: `GET_USERS__ME_POMELO_SUGGESTIONS`, sources `userdoccers:resources/user.mdx` and `xhyrom:data/client/routes.json`.
- Initial source absence was confirmed in `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json` and `src/api/routes/**`.
- Userdoccers source: `https://raw.githubusercontent.com/discord-userdoccers/discord-userdoccers/master/pages/resources/user.mdx`
    - Lines 1553-1575 document `GET /users/@me/pomelo-suggestions`, describe a suggested username based on the current user's username, and show response field `username: string`.
    - Lines 1-8 document migrated username rules and pomelo migration context.
- xHyroM source: `https://raw.githubusercontent.com/xhyrom/discord-datamining/master/data/client/routes.json`
    - Lines 1369-1376 map `POMELO_SUGGESTIONS` to `/users/@me/pomelo-suggestions` and include `GET`.
- Prior worktree `/Users/user/Developer/Developer/spacebarchat/worktrees/users-me-pomelo-suggestions` was read only as reference. I reused the source-backed behavior, but avoided the prior custom response schema and fixed a route-module import side effect by extracting a pure shared helper.

## Behavior

- Auth mode: bearer-authenticated current-user route.
- Request: no request body and no query fields.
- Response: `UniqueUsernameSuggestionResponse` with `{ "username": string }`.
- Error metadata: explicit `401: { body: "APIErrorResponse" }`.
- Data source: authenticated `req.user.username`, local `Config` username limits/blocked terms, and a case-insensitive `users.username` lookup excluding the current user.
- Persistence and side effects: none. The route does not reserve, mutate, emit gateway events, or fabricate durable migration state.
- Conservative behavior: when the current username normalizes to a blocked/invalid pomelo candidate, the route falls back to the existing conservative default suggestion base instead of returning a blocked candidate.

## Changed Files

- `src/api/routes/users/@me/pomelo-suggestions.ts`
- `src/api/util/UniqueUsernameSuggestion.ts`
- `src/api/routes/unique-username/username-suggestions-unauthed.ts`
- `test/routes/usersMePomeloSuggestionsRoute.test.ts`
- `assets/openapi.json`
- `assets/testing-manifest.json`
- `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`
- `packages/missing-routes/missing.json`
- `test/generated/http-contracts.json`
- `test/generated/suite-coverage.json`
- `worker-progress/users-me-pomelo-suggestions-get.md`

## Generated Evidence

- Source catalog now contains `GET /users/@me/pomelo-suggestions` with route name `GET_USERS__ME_POMELO_SUGGESTIONS`, source `src/api/routes/users/@me/pomelo-suggestions.ts`, and response refs `APIErrorResponse` plus `UniqueUsernameSuggestionResponse`.
- Current-base missing-route report movement after regeneration: `missing 727 -> 726`, `spacebar 453 -> 454`, `discord 1128`.
- Assigned missing entries remaining after regeneration: `0`.
- Testing manifest contains `api:http:GET:/users/@me/pomelo-suggestions/` with `authMode: "bearer"`, `responseStatuses: [200, 401]`, and no query metadata.
- HTTP contracts contain the same manifest id with auth-boundary, response-shape, ownership-boundary, schema-validation, and db-state checks.
- OpenAPI contains `GET /users/@me/pomelo-suggestions/` with bearer security, `200` response `UniqueUsernameSuggestionResponse`, and `401` response `APIErrorResponse`.

## Current-Base Porting Notes

- Source, tests, and report were ported onto current `upstream/master` after `8faf3f9f2`.
- Generated artifacts were regenerated on the current base rather than copied from the worker's older `d18379f7a` base.
- The route uses existing `UniqueUsernameSuggestionResponse`; no schema source file changed.

## Commands Run

- `create_goal`: pass.
- `get_goal`: pass, status `active`.
- `sed -n '1,240p' /Users/user/Developer/Developer/spacebarchat/WORKER_BRIEF.md`: pass.
- Missing/source catalog inspection with `jq`, `rg`, `find`, `sed`, and `curl`: pass.
- `npm run build:src:tsgo`: pass on the current base.
- `npm run build:test-fixtures`: pass.
- `npm run build --workspace @spacebar/automatic-reverse-engineering`: pass.
- `node packages/automatic-reverse-engineering/dist/cli.js import-source-routes --root src/api/routes --out packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`: pass.
- `npm run build --workspace @spacebar/missing-routes`: pass.
- `npm run start --workspace @spacebar/missing-routes`: pass; wrote missing count `726`.
- `npm run generate:testing-manifest`: pass; wrote 559 entries.
- `node scripts/testing-manifest/verify.js`: pass.
- `node scripts/testing-manifest/generate-contract-tests.js --check`: initially stale as expected, pass after regeneration.
- `npm run generate:contract-tests`: pass; wrote 534 contracts.
- `node scripts/testing-manifest/generate-suite-coverage.js --check`: initially stale as expected, pass after regeneration.
- `npm run generate:suite-coverage`: pass; wrote 15 suites.
- `node --test test/generated/http-contracts.test.js test/generated/suite-coverage.test.js`: pass, 13 tests.
- `npm run generate:openapi`: pass; final output has the pomelo route once, 362 paths, 880 schemas, and the existing unrelated webhook route warnings.
- `NODE_OPTIONS=--preserve-symlinks node -r dotenv/config -r module-alias/register --enable-source-maps --test dist-test/test/routes/usersMePomeloSuggestionsRoute.test.js dist-test/test/routes/uniqueUsernameSuggestionsUnauthedRoute.test.js`: pass, 7 tests.
- `npx eslint src/api/routes/users/@me/pomelo-suggestions.ts src/api/util/UniqueUsernameSuggestion.ts src/api/routes/unique-username/username-suggestions-unauthed.ts test/routes/usersMePomeloSuggestionsRoute.test.ts test/routes/uniqueUsernameSuggestionsUnauthedRoute.test.ts`: pass.
- `npx prettier --check src/api/routes/users/@me/pomelo-suggestions.ts src/api/util/UniqueUsernameSuggestion.ts src/api/routes/unique-username/username-suggestions-unauthed.ts test/routes/usersMePomeloSuggestionsRoute.test.ts test/routes/uniqueUsernameSuggestionsUnauthedRoute.test.ts worker-progress/users-me-pomelo-suggestions-get.md`: pass after formatting the report.
- `git diff --check`: pass.
- Package manifest/lockfile cleanliness check: pass; no package manifests or lockfiles changed.
- Changed-file malformed warranty-string scan: pass.
- `npm run generate:schema`: not run because no schema files changed; the route uses the existing `UniqueUsernameSuggestionResponse`.

## Risks And Blockers

- Spacebar does not model Discord's historical pomelo rollout gate. The endpoint is implemented as an authenticated compatibility route without rollout blocking.
- The local uniqueness check can only evaluate existing Spacebar `users.username` rows. It does not create a durable reservation or enforce a future global unique-username invariant.
- The existing unauthenticated suggestion route still preserves its previous availability semantics. The new authenticated route adds a current-user-aware, case-insensitive lookup without broadening unauthenticated behavior.

## Recommended Next Tasks

- Implement adjacent pomelo mutation/eligibility routes only when separately assigned.
- If Spacebar adopts durable unique usernames, add a normalized unique username column/index and update this route to use that canonical source of truth.
