# PUT /guilds/{param}/members/@me

## Summary

Accepted the worker implementation for the method-scoped `PUT /guilds/{guild_id}/members/@me` route on the current integration base. The route reuses the existing `joinGuildMember` handler so the explicit current-user join path preserves the established guild-join permission, persistence, gateway, and response behavior. The route remains bearer-authenticated, supports the `lurker` query, returns `204` for existing-member lurker probes, and returns `MemberJoinGuildResponse` for successful joins.

Sibling `PATCH /guilds/{param}/members/@me` and `DELETE /guilds/{param}/members/@me` routes remain intentionally unimplemented.

## Changed Files

- `src/api/routes/guilds/#guild_id/members/@me.ts`
    - Added `PUT /` with `MemberJoinGuildResponse`, `204`, and API error metadata.
    - Delegates to `joinGuildMember` with `member_id: "@me"`, authenticated `user_id`, `user_bot`, and query passthrough.
- `src/api/routes/guilds/#guild_id/members/@me.test.ts`
    - Added focused coverage for bearer auth, join delegation, lurker `204`, generated artifacts, and assigned missing-route removal.
- Regenerated `assets/openapi.json`, `assets/testing-manifest.json`, `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`, `packages/missing-routes/missing.json`, `test/generated/http-contracts.json`, and `test/generated/suite-coverage.json`.

## Evidence

- Current `packages/missing-routes/missing.json` listed the assigned `PUT_GUILDS_GUILD_ID_MEMBERS__ME` entry before replay.
- Userdoccers lists `PUT /guilds/{guild_id}/members/@me` from `resources/guild.mdx` with summary `Join Guild`.
- xHyroM lists `PUT /guilds/{guild_id}/members/@me` with route name `GUILD_JOIN`.
- Existing local `src/api/util/handlers/GuildMemberJoin.ts` and generic `PUT /guilds/{guild_id}/members/{member_id}` already provide the durable join behavior used here.

## Missing Route Movement

- Current integration base: `dd4a15492`
- `packages/missing-routes/missing.json`
    - `missing`: `476 -> 475`
    - `spacebar`: `704 -> 705`
    - `discord`: `1128`
- Removed only:
    - `PUT /guilds/{param}/members/@me` (`PUT_GUILDS_GUILD_ID_MEMBERS__ME`)
- Still missing by design:
    - `PATCH /guilds/{param}/members/@me`
    - `DELETE /guilds/{param}/members/@me`

## Verification

- `npm run build:src:tsgo` passed.
- `npm run generate:openapi` passed.
- `npm run build --workspace @spacebar/automatic-reverse-engineering` passed.
- `node packages/automatic-reverse-engineering/dist/cli.js import-source-routes --root src/api/routes --out packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json` passed.
- `npm run build --workspace @spacebar/missing-routes` passed.
- `npm run start --workspace @spacebar/missing-routes` passed and reported `Spacebar is missing 475`, `Spacebar implements 705`, `Discord implements 1128`.
- `npm run generate:testing-manifest` passed with `810` entries.
- `npm run generate:contract-tests` passed with `785` contracts.
- `npm run generate:suite-coverage` passed.
- `npm run build:test-fixtures` passed.
- Focused built route/handler tests passed: `dist-test/src/api/routes/guilds/#guild_id/members/@me.test.js` and `dist-test/src/api/util/handlers/GuildMemberJoin.test.js` (`13/13`).
- `npm run test:manifest` passed.
- `npm run test:suite-coverage` passed.
- Targeted ESLint passed.
- `git diff --check` passed.
- Package/lockfile guard passed.
- `npm run test:contracts` passed generated/static checks and failed only on the known unrelated `api:http:GET:/discovery/search` runtime case returning `500 !== 200`.
