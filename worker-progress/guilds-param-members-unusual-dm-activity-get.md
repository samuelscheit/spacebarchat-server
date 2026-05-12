# GET /guilds/{param}/members/unusual-dm-activity

## Summary

Implemented `GET /guilds/{guild_id}/members/unusual-dm-activity` only. The route validates documented pagination query params, requires the token user to be a member of the guild, and returns the documented local empty activity list because Spacebar does not currently persist Discord's unusual-DM activity safety signal.

## Changed Files

- `src/api/routes/guilds/#guild_id/members/unusual-dm-activity.ts`
- `src/api/routes/guilds/#guild_id/members/unusual-dm-activity.test.ts`
- `src/schemas/responses/GuildMemberUnusualDmActivityResponse.ts`
- `src/schemas/responses/GuildMemberUnusualDmActivityResponse.test.ts`
- `src/schemas/responses/index.ts`
- `tsconfig.test.json`
- `package.json`
- `assets/schemas.json`
- `assets/openapi.json`
- `assets/testing-manifest.json`
- `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`
- `packages/missing-routes/missing.json`
- `test/generated/http-contracts.json`
- `test/generated/suite-coverage.json`

## Evidence Gathered

- `packages/missing-routes/missing.json` initially had `DELETE`, `GET`, `PATCH`, and `PUT` entries for `/guilds/{param}/members/unusual-dm-activity`; the assigned `GET` entry cited `userdoccers:resources/guild.mdx` and `xhyrom:data/client/routes.json`.
- `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json` had no source implementation for `/guilds/{guild_id}/members/unusual-dm-activity` before this change.
- Userdoccers `pages/resources/guild.mdx` documents `GET /guilds/{guild.id}/members/unusual-dm-activity`, requires the user to be a guild member, supports `limit` max 1000/default 100 plus `after`, and returns objects with `user_id`, `guild_id`, and `unusual_dm_activity_until`.
- `packages/automatic-reverse-engineering/data/catalogs/routes.xhyrom.catalog.json` lists GET/DELETE/HEAD/OPTIONS/PATCH/PUT for the same source route; only GET was in scope.
- Local `Member` persistence has `communication_disabled_until` but no `unusual_dm_activity_until` or durable unusual-DM activity store. The route does not infer from unrelated fields and does not scan message content.

## Behavior

- `GET /guilds/:guild_id/members/unusual-dm-activity/`
  - Auth mode: bearer via normal route registration.
  - Access: calls `Member.IsInGuildOrFail(req.user_id, guild_id)`.
  - Query: validates single `limit` integer from 1 to 1000 and optional snowflake `after`.
  - Response: `200 []` using `GuildMemberUnusualDmActivityResponse`.
  - Errors: `400` for invalid pagination, `401` auth metadata, `403` non-member boundary.

## Missing-Route Movement

- Worker base `5973eb019`: total missing `602`; assigned path methods missing: `DELETE`, `GET`, `PATCH`, `PUT`.
- After regeneration: total missing `601`; assigned path methods still missing: `DELETE`, `PATCH`, `PUT`.
- The `GET` missing entry was removed. Adjacent unusual-DM mutation methods were intentionally untouched.

## Commands Run

- `npm ci` to install worktree-local dependencies; `package-lock.json` stayed unchanged.
- `npm run build:src:tsgo` (initial attempt failed before `npm ci` because `tsgo` was unavailable; reruns passed).
- `npm run generate:schema`
- `npm run generate:openapi`
- `npm run build --workspace @spacebar/automatic-reverse-engineering`
- `node packages/automatic-reverse-engineering/dist/cli.js import-source-routes --root src/api/routes --out packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`
- `npm run build --workspace @spacebar/missing-routes`
- `npm run start --workspace @spacebar/missing-routes`
- `npm run generate:testing-manifest`
- `npm run generate:contract-tests`
- `npm run generate:suite-coverage`
- `npm run build:test-fixtures`
- `node -r dotenv/config -r module-alias/register --enable-source-maps --test 'dist-test/src/api/routes/guilds/#guild_id/members/unusual-dm-activity.test.js' 'dist-test/src/schemas/responses/GuildMemberUnusualDmActivityResponse.test.js'`
- `node scripts/testing-manifest/verify.js`
- `node scripts/testing-manifest/generate-contract-tests.js --check`
- `node --test test/generated/http-contracts.test.js`
- `node scripts/testing-manifest/generate-suite-coverage.js --check`
- `node --test test/generated/suite-coverage.test.js`
- `git diff --check`
- `git diff --exit-code -- package-lock.json`

## Risks And Blockers

- Spacebar has no durable unusual-DM activity data today, so the implementation deliberately returns an empty list. If a future migration adds a real `unusual_dm_activity_until` store, this route should be changed to query that store with `limit`/`after` ordering.
- I did not implement or alter unusual-DM `DELETE`, `PATCH`, or `PUT`, guild member supplemental routes, member search/list routes, member mutations, safety analytics routes, or other guild/member flows.
- No current blocker. Reconciliation may be needed if main has advanced beyond base `5973eb019`.

## Recommended Next Tasks

- Assign separate workers for the xHyroM-only `DELETE`, `PATCH`, and `PUT` unusual-DM activity methods if they are confirmed safe and locally meaningful.
- Consider a future persistence design for explicit unusual-DM safety signals before returning non-empty data from this route.

## Integration Acceptance

Accepted on current integration base `be3264abf`.

- Ported only the worker-owned route, schema, focused tests, and progress report. Shared artifacts were regenerated on current main; package metadata was intentionally left unchanged.
- Current-base missing-route movement: `586 -> 585` missing, `594 -> 595` implemented, `1128` Discord.
- Verification passed: `npm run build:src:tsgo`, `npm run generate:schema`, `npm run generate:openapi` (`486` paths / `1128` schemas), automatic reverse-engineering build/import, missing-route regeneration, testing manifest generation/verification (`700` entries), generated contract regeneration/checks (`675` contracts), suite coverage generation/check, `npm run build:test-fixtures`, `npx tsc -p tsconfig.test.json --noEmit`, focused unusual-DM route/schema tests (`7/7`), generated contract tests (`10/10`), suite coverage tests (`4/4`), `npm run test:manifest` (`30/30`), ESLint on changed source/test files, `git diff --check`, and package/lockfile guard.
- Full `npm run test:contracts` was run; it failed only on the known unrelated runtime baseline `api:http:GET:/discovery/search` returning `500` instead of `200`. Existing analytics `query.ts` route-registration warnings remain unrelated baseline noise.
