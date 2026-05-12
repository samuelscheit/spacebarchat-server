# GET /guilds/{param}/scheduled-events

## Summary

Implemented `GET /guilds/{guild_id}/scheduled-events` in the assigned worktree. The route checks that the guild exists, requires the requester to be a guild member, accepts the documented `with_user_count` query flag, and returns Spacebar's currently truthful local representation: an empty `GuildScheduledEventsResponse` list because this codebase has no durable guild scheduled-event persistence entity/table yet.

Follow-up update: moved the route from the leaf file shape to `scheduled-events/index.ts` so future nested scheduled-event routes can live under the same directory. Behavior is unchanged and adjacent scheduled-event routes remain intentionally unimplemented.

## Changed Files

- `src/api/routes/guilds/#guild_id/scheduled-events/index.ts`
- `src/api/routes/guilds/#guild_id/scheduled-events/index.test.ts`
- `src/schemas/responses/GuildScheduledEventResponse.ts`
- `assets/schemas.json`
- `assets/openapi.json`
- `assets/testing-manifest.json`
- `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`
- `packages/missing-routes/missing.json`
- `test/generated/http-contracts.json`
- `test/generated/suite-coverage.json`
- `tsconfig.test.json`
- `package.json`

## Evidence Gathered

- `packages/missing-routes/missing.json` initially had both `GET` and `POST` entries for `/guilds/{param}/scheduled-events`; only the assigned `GET` was implemented.
- `packages/automatic-reverse-engineering/data/catalogs/routes.userdoccers.catalog.json` maps `GET /guilds/{guild_id}/scheduled-events` to `GET_GUILDS_GUILD_ID_SCHEDULED_EVENTS` from `userdoccers:resources/guild-scheduled-event.mdx`.
- Userdoccers source: `https://raw.githubusercontent.com/discord-userdoccers/discord-userdoccers/master/pages/resources/guild-scheduled-event.mdx` says this endpoint returns scheduled/active guild scheduled event objects and supports optional `with_user_count`.
- `packages/automatic-reverse-engineering/data/catalogs/routes.xhyrom.catalog.json` maps the same route to `GUILD_EVENTS_FOR_GUILD` from `xhyrom:data/client/routes.json`.
- Local source search found existing scheduled-event response schemas but no durable scheduled-event persistence model; `src/util/entities/Guild.ts` still has `TODO: guild_scheduled_events`.

## Behavior

- `GET /guilds/:guild_id/scheduled-events/`
  - 404 if the guild lookup fails through the existing `Guild.findOneOrFail` path.
  - 403 if `assertGuildMember` rejects the requester.
  - 200 with `[]` for an existing guild member until durable scheduled-event storage exists.
  - `with_user_count=true` is parsed and passed through the route dependency boundary, but has no effect for an empty list.

## Missing-Route Movement

- Before regeneration on this worker base: `missing: 607`, `spacebar: 573`, `discord: 1128`.
- After regeneration: `missing: 606`, `spacebar: 574`, `discord: 1128`.
- The assigned `GET /guilds/{param}/scheduled-events` entry is removed from `missing_entries`.
- `POST /guilds/{param}/scheduled-events` remains missing by design.

## Adjacent Routes Intentionally Untouched

- `GET /guilds/{param}/scheduled-events/{param}`
- `POST /guilds/{param}/scheduled-events`
- `PATCH /guilds/{param}/scheduled-events/{param}`
- `DELETE /guilds/{param}/scheduled-events/{param}`
- scheduled-event exception routes
- scheduled-event users and users/counts routes
- scheduled-event subscription routes
- `GET /users/@me/scheduled-events`

## Commands Run

- `npm ci` after the initial `npm run build:src:tsgo` failed because the assigned worktree had no `node_modules` and `tsgo` was unavailable.
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run build:src:tsgo`
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run generate:schema`
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run generate:openapi`
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run build --workspace @spacebar/automatic-reverse-engineering`
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" node packages/automatic-reverse-engineering/dist/cli.js import-source-routes --root src/api/routes --out packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run build --workspace @spacebar/missing-routes`
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run start --workspace @spacebar/missing-routes`
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run generate:testing-manifest`
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run generate:contract-tests`
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run generate:suite-coverage`
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run build:src:tsgo` after the directory/index route move
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run generate:schema` after the directory/index route move
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run generate:openapi` after the directory/index route move
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run build --workspace @spacebar/automatic-reverse-engineering` after the directory/index route move
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" node packages/automatic-reverse-engineering/dist/cli.js import-source-routes --root src/api/routes --out packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json` after the directory/index route move
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run build --workspace @spacebar/missing-routes` after the directory/index route move
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run start --workspace @spacebar/missing-routes` after the directory/index route move: `missing: 606`, `spacebar: 574`, `discord: 1128`
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run generate:testing-manifest` after the directory/index route move
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run generate:contract-tests` after the directory/index route move
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run generate:suite-coverage` after the directory/index route move
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run build:test-fixtures`
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" node -r dotenv/config -r module-alias/register --enable-source-maps --test 'dist-test/src/api/routes/guilds/#guild_id/scheduled-events/index.test.js' dist-test/src/schemas/responses/GuildScheduledEventResponse.test.js dist-test/src/schemas/responses/TypedResponsesRemoval.test.js`
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" node scripts/testing-manifest/verify.js`
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" node scripts/testing-manifest/generate-contract-tests.js --check`
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" node --test test/generated/http-contracts.test.js test/contracts/*.test.cjs`
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" node scripts/testing-manifest/generate-suite-coverage.js --check`
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" node --test test/generated/suite-coverage.test.js`
- `git diff --check`
- `git diff --exit-code -- package-lock.json`

## Risks And Blockers

- This is intentionally not a fabricated Discord scheduled-event implementation. It does not create, persist, count, subscribe to, or hydrate scheduled events because no backing model exists.
- If scheduled-event persistence is added later, `listGuildScheduledEvents` is the intended seam to replace the empty local list while preserving the guild/member boundary.
- Generated contract policy assigns the route to `api-guild-state`, which includes broad policy checks such as `events`; this follows existing generated policy behavior but the route itself emits no events.

## Reconciliation

- Worker branch: `codex/current-missing-route-guilds-param-scheduled-events-get-agent`.
- Worker base: `34651a100 Implement channel store listing route`.
- No merge, rebase, commit, push, reset, stash, or remote operation was performed. If main has advanced beyond the assigned integration base, orchestrator reconciliation is still needed.

## Completion Audit

- Exact route implemented: `src/api/routes/guilds/#guild_id/scheduled-events/index.ts` exports only `GET /` for `/guilds/:guild_id/scheduled-events/`.
- Guild/auth boundary: focused tests cover guild lookup before membership, non-member 403, and member 200 empty list.
- Source evidence: source catalog now has `GET_GUILDS_GUILD_ID_SCHEDULED_EVENTS`; Userdoccers and xHyroM catalogs both still reference the Discord route.
- Locally truthful data: local source search shows no durable scheduled-event persistence, only existing response schemas and `src/util/entities/Guild.ts` `TODO: guild_scheduled_events`.
- Schema/OpenAPI: `GuildScheduledEventsResponse` is generated as an array of `GuildScheduledEventResponse`; OpenAPI references it for 200 and includes bearer security plus `with_user_count`.
- Missing report: `GET /guilds/{param}/scheduled-events` is absent; `POST /guilds/{param}/scheduled-events` and adjacent scheduled-event routes remain present.
- Generated metadata: source catalog, testing manifest, HTTP contracts, and suite coverage contain `api:http:GET:/guilds/:guild_id/scheduled-events/` and point to `src/api/routes/guilds/#guild_id/scheduled-events/index.ts`.
- Final fresh verification: `build:src:tsgo`, `build:test-fixtures`, focused route/schema tests, manifest verifier, generated contract checks/tests, generated suite coverage checks/tests, `git diff --check`, and `git diff --exit-code -- package-lock.json` all passed.
