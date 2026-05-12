# GET /users/@me/scheduled-events

## Summary

Accepted and integrated `GET /users/@me/scheduled-events` on current main. The route is authenticated, validates the documented `guild_ids` query filter, and returns Spacebar's truthful local empty subscription list because scheduled-event subscription persistence does not exist locally.

## Changed Files

- `src/api/routes/users/@me/scheduled-events.ts`
- `src/api/routes/users/@me/scheduled-events.test.ts`
- `src/schemas/responses/GuildScheduledEventResponse.ts`
- `src/schemas/responses/GuildScheduledEventResponse.test.ts`
- `tsconfig.test.json`
- `assets/schemas.json`
- `assets/openapi.json`
- `assets/testing-manifest.json`
- `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`
- `packages/missing-routes/missing.json`
- `test/generated/http-contracts.json`
- `test/generated/suite-coverage.json`

## Evidence Gathered

- `packages/missing-routes/missing.json` initially had exactly one assigned missing entry: `GET /users/@me/scheduled-events`.
- `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json` initially had no source implementation for `/users/@me/scheduled-events`.
- `packages/automatic-reverse-engineering/data/catalogs/routes.userdoccers.catalog.json` lists `GET /users/@me/scheduled-events` from `userdoccers:resources/guild-scheduled-event.mdx` with summary `Get User Guild Scheduled Events`.
- `packages/automatic-reverse-engineering/data/catalogs/routes.xhyrom.catalog.json` lists `GET`, `HEAD`, and `OPTIONS` for `/users/@me/scheduled-events` with route name `USER_GUILD_EVENTS`; only the missing `GET` was implemented.
- Userdoccers Guild Scheduled Events docs define the guild scheduled event user object fields and document `GET /users/@me/scheduled-events` as returning current-user guild scheduled event user objects for a `guild_ids` query filter.
- Existing accepted local pattern: `src/api/routes/guilds/#guild_id/scheduled-events/index.ts` returns `[]` through a dependency seam because Spacebar does not persist guild scheduled events.
- Local source search found scheduled-event response schemas and gateway empty arrays, but no durable scheduled-event or scheduled-event-subscription persistence backing.

## Behavior

- Adds `GuildScheduledEventUserResponseType`, `GuildScheduledEventUserResponse`, and `GuildScheduledEventUsersResponse`.
- Adds `GET /users/@me/scheduled-events/` metadata:
  - summary `Get User Guild Scheduled Events`
  - required array query `guild_ids`
  - responses `200 GuildScheduledEventUsersResponse`, `400 APIErrorResponse`, `401 APIErrorResponse`
- Parses `guild_ids` and `guild_ids[]`, including comma-separated values, de-duplicates them, and rejects missing or malformed snowflake filters with `INVALID_FORM_BODY`.
- Returns `[]` for valid authenticated requests until local scheduled-event subscription state exists.

## Current-Base Movement

- Base before integration: `ea0304bf2 Implement Reddit connection subreddits route`.
- Before regeneration: `Spacebar is missing 600`; assigned route present.
- After regeneration: `Spacebar is missing 599`; assigned route removed.
- Implemented routes: `580 -> 581`.
- Discord routes: `1128` unchanged.
- Adjacent scheduled-event routes intentionally still missing and untouched, including guild scheduled-event detail, users, counts, exception users, subscription mutations, and create/modify/delete flows.

## Commands Run

Current-base acceptance commands, using `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH"`:

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
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run build:test-fixtures`
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" node -r dotenv/config -r module-alias/register --enable-source-maps --test dist-test/src/api/routes/users/@me/scheduled-events.test.js dist-test/src/schemas/responses/GuildScheduledEventResponse.test.js` passed 8/8.
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" node scripts/testing-manifest/verify.js`
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" node scripts/testing-manifest/generate-contract-tests.js --check`
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" node scripts/testing-manifest/generate-suite-coverage.js --check`
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" node --test test/generated/http-contracts.test.js test/generated/suite-coverage.test.js` passed 13/13.
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run test:suite-coverage`
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run lint`
- `git diff --check`
- `git diff --exit-code -- package.json package-lock.json bun.lock`
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run test:contracts` failed only on the known unrelated runtime contract:
  `api:http:GET:/discovery/search` returned `500` instead of `200`.

## Risks Or Blockers

- The route intentionally returns an empty list until Spacebar gains durable scheduled-event subscription storage. It does not fabricate Discord-only subscription state.
- `guild_ids` is enforced as required from the Userdoccers source. If Discord clients call this endpoint without the query, they will receive `400 INVALID_FORM_BODY` instead of an empty list.
- No blocker remains in this worker branch.

## Recommended Next Tasks

- Implement real scheduled-event persistence and user subscription state before changing this compatibility endpoint to return non-empty data.
- Keep adjacent scheduled-event detail/users/counts/subscription/create/mutation routes assigned separately.
