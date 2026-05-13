# POST /guilds/{param}/game-servers/{param}/wake

## Scope

- Worker id: `guilds_param_game_servers_param_wake_post`
- Assigned route: `POST /guilds/{param}/game-servers/{param}/wake`
- Assigned route name: `POST_GUILDS_GUILD_ID_GAME_SERVERS_GAME_SERVER_ID_WAKE`
- Sibling routes intentionally untouched: `GET /guilds/{param}/game-servers`, `GET /guilds/{param}/game-server-regions`, guild powerup routes.

## Evidence

- `packages/missing-routes/missing.json` contained the assigned `POST /guilds/{param}/game-servers/{param}/wake` entry before implementation.
- `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json` did not contain `POST_GUILDS_GUILD_ID_GAME_SERVERS_GAME_SERVER_ID_WAKE` before implementation.
- Userdoccers source: `resources/guild.mdx` documents "Wake Guild Game Server" as `POST /guilds/{guild.id}/game-servers/{game_server.id}/wake`, "Wakes up the game server", and returns a game server object on success.
- Userdoccers also documents the game server object as provider-backed state with provider type/url, status, SKU, entitlement, region, address, player counts, and game config fields.
- Userdoccers URL used: `https://raw.githubusercontent.com/discord-userdoccers/discord-userdoccers/master/pages/resources/guild.mdx`
- No local durable game-server entity/provider exists in the worktree; only configured game-server regions exist.

## Implementation Notes

- Added an authenticated compatibility endpoint at `src/api/routes/guilds/#guild_id/game-servers/#game_server_id/wake.ts`.
- The route checks that the guild exists and that the requester is a guild member, then fails closed with `501 APIErrorResponse`.
- No fabricated wake side effects, game-server objects, gateway events, audit logs, or provider mutations are emitted.

## Changed Files

- `src/api/routes/guilds/#guild_id/game-servers/#game_server_id/wake.ts`
- `test/routes/guilds-param-game-servers-param-wake-post.test.ts`
- `assets/openapi.json`
- `assets/testing-manifest.json`
- `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`
- `packages/missing-routes/missing.json`
- `test/generated/http-contracts.json`
- `test/generated/suite-coverage.json`
- `worker-progress/guilds_param_game_servers_param_wake_post.md`

## Commands Run

- `rg -n 'POST_GUILDS_GUILD_ID_GAME_SERVERS_GAME_SERVER_ID_WAKE|/guilds/\{param\}/game-servers/\{param\}/wake|game-servers.*wake' packages/missing-routes packages/automatic-reverse-engineering src test tests -S` (initial `tests` path absent; relevant matches still confirmed assigned missing entry)
- `rg -n 'game-server|game server|GameServer|game_server|wake|WOL|server_id' src packages test -S`
- `sed -n '2330,2385p' packages/missing-routes/missing.json`
- `rg -n 'POST_GUILDS_GUILD_ID_GAME_SERVERS_GAME_SERVER_ID_WAKE|/guilds/\{guild_id\}/game-servers/\{game_server_id\}/wake|game-servers' packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json packages/automatic-reverse-engineering/data/catalogs/routes.userdoccers.catalog.json packages/automatic-reverse-engineering/data/catalogs/routes.catalog.json -S`
- `curl -fsSL https://raw.githubusercontent.com/discord-userdoccers/discord-userdoccers/master/pages/resources/guild.mdx | sed -n '1665,1748p'`
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm ci`
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run build:src:tsgo` (initial attempt before `npm ci` failed because `tsgo` was not installed in this worktree; rerun passed)
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run generate:schema`
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run generate:openapi`
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run build --workspace @spacebar/automatic-reverse-engineering`
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" node packages/automatic-reverse-engineering/dist/cli.js import-source-routes --root src/api/routes --out packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run build --workspace @spacebar/missing-routes`
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run start --workspace @spacebar/missing-routes`
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run generate:testing-manifest`
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run generate:contract-tests`
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run generate:suite-coverage`
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run build:test-fixtures`
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" node -r dotenv/config -r module-alias/register --enable-source-maps --test dist-test/test/routes/guilds-param-game-servers-param-wake-post.test.js`
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run test:manifest`
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run test:contracts` (failed only on known unrelated `api:http:GET:/discovery/search` runtime `500 !== 200`; generated contract checks before runtime passed)
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run test:suite-coverage`
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npx eslint 'src/api/routes/guilds/#guild_id/game-servers/#game_server_id/wake.ts' test/routes/guilds-param-game-servers-param-wake-post.test.ts`
- `git diff --check`
- `git diff -- package.json package-lock.json`

## Missing-Route Movement

- `packages/missing-routes/missing.json`: `missing` 510 -> 509; `spacebar` 670 -> 671.
- Assigned `POST /guilds/{param}/game-servers/{param}/wake` is no longer in `missing_entries`.
- Sibling `GET /guilds/{param}/game-servers` remains in `missing_entries`.

## Risks And Blockers

- Durable wake behavior remains blocked on a real game-server model/provider and provider event semantics.
- The route intentionally returns `501` instead of the documented game server success object until that support exists.

## Reconciliation Notes

- Work is isolated to the assigned worktree.
- No sibling method or adjacent route implementation was taken over.
