# GET /guilds/{param}/members/@me

## Summary

Implemented the literal authenticated current-member route at `GET /guilds/{guild_id}/members/@me`.

The route reuses `findCurrentGuildMember(req.user_id, guild_id)`, matching the local `/users/@me/guilds/{guild_id}/member` response shape: `CurrentGuildMemberResponse` with the public member projection plus computed `permissions`.

## Changed files

- `src/api/routes/guilds/#guild_id/members/@me.ts`
- `src/api/routes/guilds/#guild_id/members/@me.test.ts`
- `tsconfig.test.json`
- `assets/openapi.json`
- `assets/testing-manifest.json`
- `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`
- `packages/missing-routes/missing.json`
- `test/generated/http-contracts.json`
- `test/generated/suite-coverage.json`

## Evidence gathered

- Initial `packages/missing-routes/missing.json` contained `GET /guilds/{param}/members/@me` from `xhyrom:data/client/routes.json`.
- `packages/automatic-reverse-engineering/data/catalogs/routes.xhyrom.catalog.json` contains `GET /guilds/{guild_id}/members/@me` with route name `GUILD_JOIN`.
- `packages/automatic-reverse-engineering/data/catalogs/routes.userdoccers.catalog.json` only documents `PATCH` and `PUT` for `/guilds/{guild_id}/members/@me`; no Userdoccers GET evidence was present locally.
- Existing local implementation evidence:
  - `src/api/routes/users/@me/guilds/#guild_id/member.ts`
  - `src/api/util/utility/CurrentGuildMember.ts`
  - `src/schemas/responses/CurrentGuildMemberResponse.ts`
  - `src/api/routes/guilds/#guild_id/members/#member_id/index.ts`
  - `src/api/routes/guilds/#guild_id/members/index.ts`

## Missing-route movement

- Worker base movement: `missing: 601 -> 600`, `spacebar: 579 -> 580`, `discord: 1128`.
- Integration base movement: `missing: 599 -> 598`, `spacebar: 581 -> 582`, `discord: 1128`.
- `GET /guilds/{param}/members/@me` is no longer present in `missing_entries`.
- `DELETE`, `PATCH`, and `PUT` for `/guilds/{param}/members/@me` intentionally remain missing because this worker was assigned only the GET route and was instructed not to implement member mutation/join routes.

## Behavior

- Requires bearer authentication via the normal API middleware.
- Returns `200 CurrentGuildMemberResponse` for the authenticated user's membership in the requested guild.
- Returns the existing missing-member `404 APIErrorResponse` behavior when `findCurrentGuildMember` cannot find `(user_id, guild_id)`.
- Registers as a literal static `@me` route under `members`, so it is cataloged separately from `/guilds/{guild_id}/members/{member_id}`.

## Commands run

- `npm ci`
- `npm run build:src:tsgo`
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
- `node -r dotenv/config -r module-alias/register --enable-source-maps --test 'dist-test/src/api/routes/guilds/#guild_id/members/@me.test.js'`
- `node -r dotenv/config -r module-alias/register --enable-source-maps --test 'dist-test/src/api/routes/users/@me/guilds/#guild_id/member.test.js' dist-test/src/api/util/utility/CurrentGuildMember.test.js dist-test/src/schemas/responses/CurrentGuildMemberResponse.test.js`
- `node scripts/testing-manifest/verify.js`
- `node scripts/testing-manifest/generate-contract-tests.js --check`
- `node scripts/testing-manifest/generate-suite-coverage.js --check`
- `node --test test/generated/http-contracts.test.js test/contracts/*.test.cjs`
- `node --test test/generated/suite-coverage.test.js`
- `npm run test:contracts`
- `git diff --check`
- `git diff -- package.json package-lock.json`
- Current-base verification after porting to `8eb938575d015f48f694c1c8b6e88a4c3ca92bad`:
  - `npm run build:src:tsgo`
  - `npm run build:test-fixtures`
  - `node -r dotenv/config -r module-alias/register --enable-source-maps --test 'dist-test/src/api/routes/guilds/#guild_id/members/@me.test.js' 'dist-test/src/api/routes/users/@me/guilds/#guild_id/member.test.js' dist-test/src/api/util/utility/CurrentGuildMember.test.js dist-test/src/schemas/responses/CurrentGuildMemberResponse.test.js`
  - `node scripts/testing-manifest/verify.js`
  - `node scripts/testing-manifest/generate-contract-tests.js --check`
  - `node scripts/testing-manifest/generate-suite-coverage.js --check`
  - `node --test test/generated/http-contracts.test.js test/generated/suite-coverage.test.js`
  - `npm run test:suite-coverage`
  - `npm run lint`
  - `git diff --check`
  - `git diff --exit-code -- package.json package-lock.json bun.lock`
  - `npm run test:contracts`

## Verification notes

- Focused route test passed: 4 tests passing for `GET /guilds/:guild_id/members/@me`.
- Existing current-member route/schema tests passed: 6 tests passing.
- Current-base focused route/current-member tests passed: 10 tests passing.
- `node scripts/testing-manifest/verify.js` passed with 687 entries.
- Generated contract and suite coverage checks passed with 662 contracts.
- `git diff --check` passed.
- Package/lockfile guard passed: no `package.json` or `package-lock.json` diff.
- `npm run test:contracts` failed only in the known unrelated runtime contract: `api:http:GET:/discovery/search` returned `500 !== 200`. The generated contract matrix passed before that runtime stage.

## Risks and blockers

- The GET route follows local behavior from `/users/@me/guilds/{guild_id}/member`; there was no Userdoccers GET response-shape evidence in the local catalog.
- No DB migration or schema type change was required.
- No blocker remains for the assigned GET route.

## Adjacent routes intentionally untouched

- `DELETE /guilds/{param}/members/@me`
- `PATCH /guilds/{param}/members/@me`
- `PUT /guilds/{param}/members/@me`
- `/guilds/{param}/members/@me/nick`
- `/guilds/{param}/members/{param}` beyond leaving existing dynamic behavior intact
- Member listing/search/supplemental routes and unrelated user guild-member routes

## Reconciliation

- Worker branch: `codex/current-missing-route-guilds-param-members-me-get-agent`.
- Assigned integration base: `4e9bfeb88e180cb73f506a5d04e51a58b1da40e0`.
- Orchestrator integration base: `8eb938575d015f48f694c1c8b6e88a4c3ca92bad`.
- The worker worktree was not rebased or merged; the route files were ported onto the current integration branch and generated artifacts were regenerated there.

## Recommended next tasks

- Separate workers should handle the remaining `DELETE`, `PATCH`, and `PUT` `/guilds/{param}/members/@me` entries if assigned.

## Completion audit

- Assigned route: `GET /guilds/{param}/members/@me`.
  - Evidence: `src/api/routes/guilds/#guild_id/members/@me.ts` registers only `router.get("/")`.
- Confirmed missing and source evidence.
  - Evidence: initial missing report had the GET entry from `xhyrom:data/client/routes.json`; local xHyroM catalog has `GET /guilds/{guild_id}/members/@me`; local Userdoccers catalog has only `PATCH` and `PUT` for the same path.
- Studied local member patterns and reused existing current-member behavior.
  - Evidence: implementation delegates to `findCurrentGuildMember`, matching `src/api/routes/users/@me/guilds/#guild_id/member.ts` and `src/api/util/utility/CurrentGuildMember.ts`.
- Literal `@me` route registration and dynamic route separation.
  - Evidence: new static file `members/@me.ts`; route traversal loads `#` parameter routes last; source catalog now has `/guilds/{guild_id}/members/@me` separately from `/guilds/{guild_id}/members/{member_id}`.
- Focused behavior and boundary tests.
  - Evidence: `src/api/routes/guilds/#guild_id/members/@me.test.ts` covers bearer auth, successful current-member response, missing-member 404, generated metadata, and missing-route removal.
- Generated artifacts.
  - Evidence: OpenAPI, testing manifest, source catalog, missing-route report, generated HTTP contracts, and suite coverage were regenerated and checked.
- Adjacent routes untouched.
  - Evidence: missing report still lists only `DELETE`, `PATCH`, and `PUT` for `/guilds/{param}/members/@me`; no member mutation route files were changed.
- Verification gates.
  - Evidence: required build, fixture build, focused tests, manifest verify, generated checks, whitespace guard, and package/lockfile guard were run; full `npm run test:contracts` only failed on the documented unrelated discovery-search runtime failure.
