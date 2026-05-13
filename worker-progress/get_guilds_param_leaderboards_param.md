# get_guilds_param_leaderboards_param

## Summary

Implemented only `GET /guilds/{guild_id}/leaderboards/{param}` for the assigned `GUILD_LEADERBOARD` missing route. The route is bearer-authenticated, verifies the guild exists, verifies the authenticated user is a guild member, and then fails closed with a typed `501 APIErrorResponse` because Spacebar has no durable provider-backed leaderboard store and no public response contract for this xHyroM-only route.

No `200` response schema was added. The sibling `leaderboards/{param}/settings` route and all other routes were left untouched.

## Assigned Scope

- Missing-report path: `/guilds/{param}/leaderboards/{param}`
- Source route path: `/guilds/{guild_id}/leaderboards/{param}`
- Assigned route name: `GUILD_LEADERBOARD`
- Implemented method: `GET`
- Out of scope: `/guilds/{param}/leaderboards/{param}/settings`, guild analytics, game stats prompts, and any non-leaderboard routes

## Evidence Gathered

- `packages/missing-routes/missing.json` originally listed one owned entry for `GET /guilds/{param}/leaderboards/{param}` with source route `/guilds/{guild_id}/leaderboards/{param}` from `xhyrom:data/client/routes.json`.
- `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json` and `src/api/routes` had no implementation for `/guilds/{guild_id}/leaderboards/{param}` before this change.
- The xHyroM client route catalog lists `GET`, `HEAD`, and `OPTIONS` for `/guilds/{guild_id}/leaderboards/{param}` and a separate settings sibling at `PUT /guilds/{guild_id}/leaderboards/{param}/settings`.
- Local Userdoccers route data did not provide a guild leaderboard response contract.
- xHyroM experiment data references `2024-09_league_of_legends_leaderboard` and `2023-09_gaming_stats_prompt_guild`, but available local/public data did not establish a stable public response body.

## Behavior

- Missing or invalid bearer authentication remains `401` through the existing authentication middleware.
- Unknown guilds return Discord `UNKNOWN_GUILD` with HTTP `404`.
- Authenticated users outside the guild receive HTTP `403`.
- Authenticated guild members receive HTTP `501` with `APIErrorResponse`:
    - `code: 0`
    - `message: "Guild leaderboards are not supported on this Spacebar instance."`
- Route metadata declares only `401`, `403`, `404`, and `501` response bodies, all as `APIErrorResponse`.

## Changed Files

- `src/api/routes/guilds/#guild_id/leaderboards/#param.ts`
- `test/routes/guilds-param-leaderboards-param-get.test.ts`
- `assets/openapi.json`
- `assets/testing-manifest.json`
- `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`
- `packages/missing-routes/missing.json`
- `test/generated/http-contracts.json`
- `test/generated/suite-coverage.json`
- `worker-progress/get_guilds_param_leaderboards_param.md`

## Generated Artifacts

- OpenAPI now includes `/guilds/{guild_id}/leaderboards/{param}/` with bearer security and `401/403/404/501` `APIErrorResponse` responses.
- Testing manifest now includes `api:http:GET:/guilds/:guild_id/leaderboards/:param/` from `src/api/routes/guilds/#guild_id/leaderboards/#param.ts`.
- Source route catalog now includes `GET /guilds/{guild_id}/leaderboards/{param}` with `APIErrorResponse`.
- Missing-route regeneration removed the assigned `GET /guilds/{param}/leaderboards/{param}` entry.
- Contract and suite coverage JSON were regenerated.
- `assets/schemas.json` was regenerated during verification, but had no diff because this route adds no new schema.

## Missing-Route Movement

- Before regeneration: `490` missing, `690` Spacebar implemented, `1128` Discord implemented.
- After regeneration: `489` missing, `691` Spacebar implemented, `1128` Discord implemented.
- Assigned missing entry present after regeneration: `false`.
- Sibling settings entry still present: `true`.

## Verification

- `npm ci`: passed; needed because `node_modules` was absent and package/lock files were unchanged.
- `npm run build:src:tsgo`: passed.
- `npm run generate:schema`: passed; no schema diff.
- `npm run generate:openapi`: passed.
- `npm run build --workspace @spacebar/automatic-reverse-engineering`: passed.
- `node packages/automatic-reverse-engineering/dist/cli.js import-source-routes --root src/api/routes --out packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`: passed.
- `npm run build --workspace @spacebar/missing-routes`: passed.
- `npm run start --workspace @spacebar/missing-routes`: passed; reported `Spacebar is missing 489`, `Spacebar implements 691`, `Discord implements 1128`.
- `npm run generate:testing-manifest`: passed; wrote `796` entries.
- `node scripts/testing-manifest/verify.js`: passed.
- `node scripts/testing-manifest/generate-contract-tests.js --check`: passed.
- `npm run generate:contract-tests`: passed; wrote `771` contracts.
- `node scripts/testing-manifest/generate-suite-coverage.js --check`: passed.
- `npm run generate:suite-coverage`: passed.
- `npm run build:test-fixtures`: passed.
- `node -r dotenv/config -r module-alias/register --enable-source-maps --test dist-test/test/routes/guilds-param-leaderboards-param-get.test.js`: passed; `7/7` tests.
- `node --test test/generated/http-contracts.test.js test/generated/suite-coverage.test.js`: passed; `13/13` tests.
- `npm run test:contracts`: generated checks passed, but the full command failed on an existing unrelated runtime failure: `api:http:GET:/discovery/search should return a successful response for schema validation`, `500 !== 200`. Existing unrelated route registration warnings/errors for analytics `query` helper files also appeared.
- `npx eslint 'src/api/routes/guilds/#guild_id/leaderboards/#param.ts' test/routes/guilds-param-leaderboards-param-get.test.ts`: passed.
- `npx prettier --check 'src/api/routes/guilds/#guild_id/leaderboards/#param.ts' test/routes/guilds-param-leaderboards-param-get.test.ts worker-progress/get_guilds_param_leaderboards_param.md`: passed.
- `git diff --check`: passed.
- Package manifest and lockfile guard: no package manifest or lockfile changes.
- Exact AGPL warranty line scan over changed source/test files: passed.

## Risks And Follow-Ups

- This route intentionally returns `501` for authorized guild members until Spacebar has a durable linked-game leaderboard ranking provider and a source-backed response contract.
- xHyroM lists `HEAD` and `OPTIONS`, but only `GET` was present in the assigned missing-route entry and only `GET` was implemented.
- The remaining `/guilds/{param}/leaderboards/{param}/settings` missing-route entry is out of scope and unchanged.

## Reconciliation Notes

- Base `HEAD:packages/missing-routes/missing.json` contained exactly the assigned `GET /guilds/{param}/leaderboards/{param}` entry with route name `GUILD_LEADERBOARD`; the regenerated working-tree report does not.
- Base `HEAD:packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json` had no `/guilds/{guild_id}/leaderboards/{param}` source entry; the regenerated working-tree catalog has the new GET entry sourced from `src/api/routes/guilds/#guild_id/leaderboards/#param.ts`.
- The working-tree route folder contains only `#param.ts` for this assignment, and `packages/missing-routes/missing.json` still lists the sibling `GUILD_LEADERBOARD_SETTINGS` missing entry.
- Completion-audit reruns used the requested Node path and reproduced the same known unrelated `npm run test:contracts` failure for `api:http:GET:/discovery/search`.

## Main-Branch Acceptance Reconciliation

- Replayed only the route source, focused test, and this report onto `c5e42577b`.
- Regenerated OpenAPI, source route catalog, missing-route report, testing manifest, generated HTTP contracts, and suite coverage on the current base. No schema file changed.
- Current-base missing-route movement: `489 -> 488`; implemented count `691 -> 692`; Discord count `1128`.
- Verification on the main checkout passed: `build:src:tsgo`, OpenAPI/catalog/missing-route/manifest/contracts/suite regeneration, `build:test-fixtures`, focused built route test `7/7`, `test:manifest`, `test:suite-coverage`, generated contract check, generated suite coverage check, targeted ESLint, Prettier check, `git diff --check`, and package/lockfile guard.
- Full `npm run test:contracts` passed generated/static checks and failed only on the known unrelated runtime baseline: `api:http:GET:/discovery/search` returned `500 !== 200`.
