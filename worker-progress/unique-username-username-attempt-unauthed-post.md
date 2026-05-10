# POST /unique-username/username-attempt-unauthed

## Summary

Implemented the unauthenticated unique username eligibility route for `POST /unique-username/username-attempt-unauthed`.

The route accepts `{ "username": string }`, applies source-backed migrated username restrictions, checks local Spacebar user records conservatively with a case-insensitive lookup, and returns `{ "taken": boolean | null }`. Invalid or locally blocked unique-username candidates return `taken: null`; valid candidates return local availability.

## Assigned Path And Methods

- Assigned path: `/unique-username/username-attempt-unauthed`
- Missing methods found at start: `POST` (`POST_UNIQUE_USERNAME_USERNAME_ATTEMPT_UNAUTHED`)
- Methods implemented: `POST`
- Adjacent routes intentionally not implemented: authenticated pomelo routes, username suggestions, registration, login, password, and MFA routes.

## Changed Files

- `src/api/routes/unique-username/username-attempt-unauthed.ts`
- `src/api/middlewares/NoAuthorizationRoutes.ts`
- `src/api/middlewares/Authentication.test.ts`
- `src/schemas/uncategorised/UniqueUsernameAttemptUnauthedSchema.ts`
- `src/schemas/uncategorised/index.ts`
- `src/schemas/responses/UniqueUsernameAttemptResponse.ts`
- `src/schemas/responses/index.ts`
- `test/routes/uniqueUsernameAttemptUnauthedRoute.test.ts`
- `assets/schemas.json`
- `assets/testing-manifest.json`
- `assets/openapi.json`
- `test/generated/http-contracts.json`
- `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`
- `packages/missing-routes/missing.json`
- `worker-progress/unique-username-username-attempt-unauthed-post.md`

## What Changed

- Added a production route at `src/api/routes/unique-username/username-attempt-unauthed.ts`.
- Added public no-auth matching for exact `POST /unique-username/username-attempt-unauthed`.
- Added request schema `UniqueUsernameAttemptUnauthedSchema`.
- Added nullable response schema `UniqueUsernameAttemptResponse`.
- Added focused route tests for migrated username syntax, instance blocked-name policy, unauthenticated access, local taken/available responses, and invalid candidate `taken: null` behavior.
- Regenerated source route catalog, missing-route report, schemas, testing manifest, generated HTTP contracts, suite coverage, and OpenAPI.

## Evidence Gathered

- `packages/missing-routes/missing.json` initially contained `POST /unique-username/username-attempt-unauthed` with sources `userdoccers:authentication.mdx` and `xhyrom:data/client/routes.json`.
- `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json` initially did not contain the assigned route; `src/api/routes/**` only had the adjacent suggestions route.
- Current source catalog now contains `POST_UNIQUE_USERNAME_USERNAME_ATTEMPT_UNAUTHED` from `src/api/routes/unique-username/username-attempt-unauthed.ts`.
- Userdoccers catalog marks the route as `POST`, unauthenticated, summary `Get Unique Username Eligibility`.
- Upstream Userdoccers `pages/authentication.mdx` at `259d8f8cf97ff357c4d1255afdf30e2e05672742` documents:
  - `POST /unique-username/username-attempt-unauthed`
  - unauthenticated access
  - JSON param `username`
  - response field `taken: ?boolean`
- Upstream Userdoccers `pages/resources/user.mdx` documents migrated username restrictions: lowercase alphanumeric, underscores, periods, no `..`, unique per user, length 2-32 via username restrictions.
- xHyroM `data/client/routes.json` at `0d792408fc6f5f67140fe1b4cad48b386ae1fd44` lists `POMELO_ATTEMPT_UNAUTHED` as `/unique-username/username-attempt-unauthed` with `OPTIONS` and `POST`.

References:

- https://github.com/discord-userdoccers/discord-userdoccers/blob/259d8f8cf97ff357c4d1255afdf30e2e05672742/pages/authentication.mdx#L616-L636
- https://github.com/discord-userdoccers/discord-userdoccers/blob/259d8f8cf97ff357c4d1255afdf30e2e05672742/pages/resources/user.mdx#L20-L44
- https://github.com/xHyroM/discord-datamining/blob/0d792408fc6f5f67140fe1b4cad48b386ae1fd44/data/client/routes.json#L1392-L1397

## Missing-Route Count Movement

- Before: `missing = 841`, `spacebar = 339`, `discord = 1128`
- After regeneration: `missing = 840`, `spacebar = 340`, `discord = 1128`
- Assigned route no longer appears in `packages/missing-routes/missing.json`.

## Commands Run

- `if [ -L node_modules ]; then unlink node_modules; fi`
- `if [ ! -d node_modules ]; then npm ci; fi`
- `npm run build:src:tsgo`
- `npm run generate:schema`
- `npm run build:test-fixtures`
- `node -r dotenv/config -r module-alias/register --enable-source-maps --test dist-test/test/routes/uniqueUsernameAttemptUnauthedRoute.test.js dist-test/src/api/middlewares/Authentication.test.js`
- `npm run build --workspace @spacebar/automatic-reverse-engineering`
- `node packages/automatic-reverse-engineering/dist/cli.js import-source-routes --root src/api/routes --out packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`
- `npm run build --workspace @spacebar/missing-routes`
- `npm run start --workspace @spacebar/missing-routes`
- `npm run generate:testing-manifest`
- `node scripts/testing-manifest/generate-contract-tests.js`
- `node scripts/testing-manifest/generate-suite-coverage.js`
- `node scripts/testing-manifest/verify.js`
- `node scripts/testing-manifest/generate-contract-tests.js --check`
- `node scripts/testing-manifest/generate-suite-coverage.js --check`
- `npm run generate:openapi`
- `git diff --check`
- malformed warranty scan command from the worker brief

## Verification Results

- Focused compiled tests: 20 passed, 0 failed.
- Testing manifest verified: 445 entries.
- Generated HTTP contract tests verified: 420 contracts.
- Generated suite coverage verified.
- Missing-route report regenerated and assigned route removed.
- `git diff --check` passed.
- Malformed AGPL warranty scan returned no matches in changed files.

## Risks Or Blockers

- Spacebar does not have Discord's global username reservation, anti-abuse, or rollout state. The implementation therefore reports only local database availability plus local instance blocked-name policy.
- Userdoccers documents `taken` as nullable but does not enumerate every null condition. This implementation uses `null` for candidates that fail source-backed migrated username syntax or local blocked-name checks.
- No route-specific rate-limit evidence was present in Userdoccers or xHyroM. The route relies on existing API middleware behavior; no synthetic route-specific limiter was added.

## Recommended Next Tasks

- Implement authenticated `/users/@me/pomelo-attempt` and `/users/@me/pomelo` only under separate assignments.
- Consider a shared unique-username policy helper if more pomelo routes are assigned.
- If Spacebar adds a global reserved-username table later, wire this route into that state before exposing public registration at scale.

## Goal Status Evidence

- `create_goal` objective: `implement the missing route path POST /unique-username/username-attempt-unauthed for the Spacebar server API.`
- `get_goal` after setup and before handoff reported status `active`.
- Latest `get_goal` before this report: status `active`, objective `implement the missing route path POST /unique-username/username-attempt-unauthed for the Spacebar server API.`, tokens used `328836`, time used `828` seconds.
- `update_goal(status: "complete")` after implementation and report writing returned status `complete`, tokens used `335797`, time used `866` seconds.
