# GET /unique-username/username-suggestions-unauthed

## Summary

Implemented the assigned unauthenticated `GET /unique-username/username-suggestions-unauthed` route. The route returns a typed `{ "username": string }` compatibility response, derives a migrated-username-safe suggestion from optional `global_name`, and checks Spacebar's local `User.username` values to avoid obvious collisions.

## Changed Files

- `src/api/routes/unique-username/username-suggestions-unauthed.ts`: new public route, query metadata, response metadata, local suggestion normalization, local availability check.
- `src/schemas/responses/UniqueUsernameSuggestionResponse.ts`: new response schema type.
- `src/schemas/responses/index.ts`: exports the new response type.
- `src/api/middlewares/NoAuthorizationRoutes.ts`: marks the route public.
- `src/api/middlewares/Authentication.test.ts`: focused no-auth route matching coverage.
- `test/routes/uniqueUsernameSuggestionsUnauthedRoute.test.ts`: focused normalization, collision, and unauthenticated route tests.
- Regenerated artifacts: `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`, `packages/missing-routes/missing.json`, `assets/schemas.json`, `assets/testing-manifest.json`, `test/generated/http-contracts.json`, `assets/openapi.json`.

## Evidence Gathered

- Assigned missing entry existed before implementation: `GET /unique-username/username-suggestions-unauthed` / `GET_UNIQUE_USERNAME_USERNAME_SUGGESTIONS_UNAUTHED`.
- The route was absent from `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json` and `src/api/routes/**` before implementation.
- Local Userdoccers catalog: `packages/automatic-reverse-engineering/data/catalogs/routes.userdoccers.catalog.json`, `GET_UNIQUE_USERNAME_USERNAME_SUGGESTIONS_UNAUTHED`, source `userdoccers:authentication.mdx`.
- Local xHyroM catalog: `packages/automatic-reverse-engineering/data/catalogs/routes.xhyrom.catalog.json`, route name `POMELO_SUGGESTIONS_UNAUTHED` for `GET`, `HEAD`, and `OPTIONS`.
- Upstream Userdoccers source used: `https://raw.githubusercontent.com/discord-userdoccers/discord-userdoccers/master/pages/authentication.mdx`, which documents optional `global_name` query and response body field `username`.
- Upstream Userdoccers username restrictions source used: `https://raw.githubusercontent.com/discord-userdoccers/discord-userdoccers/master/pages/resources/user.mdx`, which documents migrated usernames as lowercase alphanumeric plus `_` and `.`, no consecutive periods, length `2..32`, and unique.

## Assigned Path And Methods

- Assigned path: `/unique-username/username-suggestions-unauthed`
- Missing methods found: `GET`
- Methods implemented: `GET`
- Adjacent username attempt, authenticated pomelo, registration, login, password, and MFA routes were not implemented.

## What Changed

- Added the `GET` route under `src/api/routes/unique-username/`.
- Added `UniqueUsernameSuggestionResponse` schema and `200` response metadata.
- Added query metadata for optional `global_name`.
- Added no-auth route matching so unauthenticated clients can call it; no synthetic `401` response metadata was added.
- Normalizes suggestions conservatively for migrated username rules: lowercase, ASCII-compatible where possible, separators converted to `.`, repeated dots collapsed, edge separators trimmed, length capped at `2..32`.
- Checks local `User.username` values and appends numeric suffixes for local collisions.
- Regenerated source catalog and missing-route report; assigned entry disappeared. Missing count moved `844 -> 843`.

## Commands Run

- `if [ -L node_modules ]; then unlink node_modules; fi; if [ ! -d node_modules ]; then npm ci; fi`
- `npx prettier --write src/api/routes/unique-username/username-suggestions-unauthed.ts src/api/routes/unique-username/username-suggestions-unauthed.test.ts src/schemas/responses/UniqueUsernameSuggestionResponse.ts src/schemas/responses/index.ts src/api/middlewares/NoAuthorizationRoutes.ts src/api/middlewares/Authentication.test.ts`
- `npm run build:src:tsgo`
- `npm run build:test-fixtures`
- `node -r dotenv/config -r module-alias/register --enable-source-maps --test dist-test/src/api/routes/unique-username/username-suggestions-unauthed.test.js dist-test/src/api/middlewares/Authentication.test.js` failed to include the route test because `src/api/routes/unique-username/*.test.ts` was not in `tsconfig.test.json`.
- Moved the route test to `test/routes/uniqueUsernameSuggestionsUnauthedRoute.test.ts`.
- `npx prettier --write test/routes/uniqueUsernameSuggestionsUnauthedRoute.test.ts`
- `npm run build:test-fixtures`
- `node -r dotenv/config -r module-alias/register --enable-source-maps --test dist-test/test/routes/uniqueUsernameSuggestionsUnauthedRoute.test.js dist-test/src/api/middlewares/Authentication.test.js`
- `npm run build --workspace @spacebar/automatic-reverse-engineering`
- `node packages/automatic-reverse-engineering/dist/cli.js import-source-routes --root src/api/routes --out packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`
- `npm run build --workspace @spacebar/missing-routes`
- `npm run start --workspace @spacebar/missing-routes`
- `npm run generate:schema`
- `npm run generate:testing-manifest`
- `node scripts/testing-manifest/verify.js`
- `node scripts/testing-manifest/generate-contract-tests.js --check` failed before regeneration because generated contracts were stale.
- `npm run generate:contract-tests`
- `node scripts/testing-manifest/generate-contract-tests.js --check`
- `node scripts/testing-manifest/generate-suite-coverage.js --check`
- `npm run generate:openapi`
- `git diff --check`
- Generated-file boilerplate scan for malformed warranty-line variants.

## Verification Notes

- Focused compiled tests passed: `20` tests, `20` pass.
- Source catalog now includes `GET /unique-username/username-suggestions-unauthed` from `src/api/routes/unique-username/username-suggestions-unauthed.ts`.
- Missing-route report now omits the assigned route.
- Testing manifest verified with `442` entries; the new route has `authMode: "public"` and response body `UniqueUsernameSuggestionResponse`.
- Generated HTTP contracts verified with `417` contracts.
- Generated suite coverage verified.
- OpenAPI includes `/unique-username/username-suggestions-unauthed/`, optional `global_name` query, `200` schema `UniqueUsernameSuggestionResponse`, and no bearer `security`.
- `git diff --check` passed.
- Malformed warranty-line scan over changed tracked and untracked scoped files returned no matches.

## Risks Or Blockers

- Spacebar does not have Discord's exact Pomelo suggestion backend or a reservation flow for these suggestions. The implementation is a conservative compatibility response based on local username rows and does not guarantee race-free uniqueness.
- Userdoccers notes Discord defaults to a random suggestion when `global_name` is omitted. This implementation uses deterministic fallback/suffix behavior so it remains testable and does not fabricate opaque external state.

## Recommended Next Tasks

- Implement a dedicated unique-username backing model if Spacebar needs Discord-like globally unique Pomelo semantics instead of local compatibility suggestions.
- Implement adjacent username eligibility/attempt routes separately under their own assignments.

## Goal Status Evidence

- Initial `create_goal` objective: `implement the missing route path GET /unique-username/username-suggestions-unauthed for the Spacebar server API.`
- `get_goal` after setup: status `active`, same objective.
- `get_goal` before writing this report: status `active`, same objective.
- `update_goal(status: "complete")`: status `complete`, same objective, time used `624` seconds.
