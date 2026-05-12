# GET /guilds/{param}/scheduled-events/{param}/users/counts

## Summary

Implemented `GET /guilds/:guild_id/scheduled-events/:guild_scheduled_event_id/users/counts` in the existing guild scheduled-events router. The route is authenticated, checks guild existence and requester membership, parses `guild_scheduled_event_exception_ids` with the documented max-10 snowflake constraint, and returns Spacebar's conservative local representation:

```json
{
    "guild_scheduled_event_count": 0,
    "guild_scheduled_event_exception_counts": {}
}
```

Exception IDs requested in the query are echoed with zero counts. This is locally truthful because this worktree has scheduled-event response DTOs, but no persisted guild scheduled-event or scheduled-event subscription/RSVP entity. Existing nearby scheduled-event routes already document empty local behavior until backing state exists.

## Changed Files

- `src/api/routes/guilds/#guild_id/scheduled-events/index.ts`
- `src/api/routes/guilds/#guild_id/scheduled-events/index.test.ts`
- `src/schemas/responses/GuildScheduledEventResponse.ts`
- `src/schemas/responses/GuildScheduledEventResponse.test.ts`
- `assets/schemas.json`
- `assets/openapi.json`
- `assets/testing-manifest.json`
- `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`
- `packages/missing-routes/missing.json`
- `test/generated/http-contracts.json`
- `test/generated/suite-coverage.json`

## Evidence Gathered

- `packages/missing-routes/missing.json` initially listed `GET /guilds/{param}/scheduled-events/{param}/users/counts`; regeneration removed only this assigned route from missing entries.
- Userdoccers source: `resources/guild-scheduled-event.mdx` documents `guild_scheduled_event_exception_ids?` as `array[snowflake]` max 10, and response fields `guild_scheduled_event_count` plus `guild_scheduled_event_exception_counts`.
- xHyroM source: `packages/automatic-reverse-engineering/data/catalogs/routes.xhyrom.catalog.json` contains `GET /guilds/{guild_id}/scheduled-events/{param}/users/counts` as `GUILD_EVENT_USER_COUNTS`.
- Local source evidence: `src/util/entities/Guild.ts` still has `// TODO: guild_scheduled_events`; `src/api/routes/users/@me/scheduled-events.ts` and the existing scheduled-events list route return empty local representations because subscriptions are not persisted.

## Route Movement

- Before regeneration: `missing: 577`, `spacebar: 603`.
- After regeneration: `missing: 576`, `spacebar: 604`, `discord: 1128`.
- Assigned route present in source catalog as `GET_GUILDS_GUILD_ID_SCHEDULED_EVENTS_GUILD_SCHEDULED_EVENT_ID_USERS_COUNTS`.
- Assigned route absent from `missing_entries` after regeneration.

## Adjacent Routes Intentionally Untouched

- `GET /guilds/{param}/scheduled-events`
- `POST /guilds/{param}/scheduled-events`
- `GET /guilds/{param}/scheduled-events/{param}`
- `GET /guilds/{param}/scheduled-events/{param}/users`
- `PUT /guilds/{param}/scheduled-events/{param}/users/@me`
- `DELETE /guilds/{param}/scheduled-events/{param}/users/@me`
- Exception user, recurrence, create/update/delete, and RSVP mutation routes.

## Commands Run

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
- `TS_NODE_TRANSPILE_ONLY=1 node -r dotenv/config -r ts-node/register/transpile-only -r module-alias/register --enable-source-maps --test 'src/api/routes/guilds/#guild_id/scheduled-events/index.test.ts' src/schemas/responses/GuildScheduledEventResponse.test.ts`
- `npm run build:test-fixtures`
- `node -r dotenv/config -r module-alias/register --enable-source-maps --test 'dist-test/src/api/routes/guilds/#guild_id/scheduled-events/index.test.js' dist-test/src/schemas/responses/GuildScheduledEventResponse.test.js`
- `node scripts/testing-manifest/verify.js`
- `node scripts/testing-manifest/generate-contract-tests.js --check`
- `node --test test/generated/http-contracts.test.js test/contracts/*.test.cjs`
- `node scripts/testing-manifest/generate-suite-coverage.js --check`
- `node --test test/generated/suite-coverage.test.js`
- `npm run test:suite-coverage`
- `npm run test:contracts`
- `git diff --check`
- `git diff --exit-code -- package.json package-lock.json`

## Verification Notes

- Focused source and built scheduled-event/schema tests passed.
- `npm run build:src:tsgo` passed after installing dependencies with `npm ci`.
- `npm run build:test-fixtures` passed.
- Testing manifest verified with 709 entries.
- Generated contract matrix verified with 684 contracts.
- Generated suite coverage verified.
- `git diff --check` passed.
- Package/lockfile guard passed; `package.json` and `package-lock.json` are unchanged.
- `npm run test:contracts` failed only in the known unrelated runtime contract: `api:http:GET:/discovery/search` returned `500 !== 200`.

## Risks And Reconciliation

- Behavioral risk: without persisted scheduled-event and scheduled-event user subscription state, this route cannot distinguish an unknown event ID from a real event with zero subscribers. It therefore returns conservative zero counts after guild existence and membership checks, matching existing local scheduled-event behavior.
- No commit, push, merge, rebase, reset, or stash was performed.
- Current branch HEAD is the assigned integration base `d790f4880`; no local reconciliation was performed. Orchestrator should reconcile if main has advanced after this worker base.

## Completion Audit

- Assigned worktree only: all commands and edited files are under `/Users/user/Developer/Developer/spacebarchat/worktrees/current-guilds-param-scheduled-events-param-users-counts-get-agent`; root checkout was not edited.
- Worker brief read: verified at start and during final audit.
- Assigned route missing before work: confirmed initial `packages/missing-routes/missing.json` contained `GET /guilds/{param}/scheduled-events/{param}/users/counts`.
- Assigned route implemented: `src/api/routes/guilds/#guild_id/scheduled-events/index.ts` now registers `GET /:guild_scheduled_event_id/users/counts`.
- Auth and guild boundary: route uses bearer route metadata, checks `assertGuildExists`, then `assertRequesterGuildMember`, and focused tests assert missing guild and non-member behavior.
- Query and response shape: `guild_scheduled_event_exception_ids` supports comma and array forms, deduplicates values, enforces snowflake format and max 10, and returns `GuildScheduledEventUserCountResponse`.
- Local persistence behavior: no scheduled-event RSVP state exists locally; default dependency returns zero event and exception counts instead of fabricating attendance.
- Tests added: focused route tests cover metadata, permission boundary, query parsing, invalid query rejection, generated artifacts, missing-route removal, and adjacent routes intentionally untouched; schema tests cover the new response type.
- Artifacts regenerated: schemas, OpenAPI, source route catalog, missing-route report, testing manifest, generated HTTP contracts, and suite coverage are updated.
- Generated coverage check: manifest entry exists for `api:http:GET:/guilds/:guild_id/scheduled-events/:guild_scheduled_event_id/users/counts`; generated contracts and suite coverage include that manifest ID.
- Adjacent routes untouched: audit confirms create/update/delete, RSVP mutation, event user list, exception user, and detail routes remain missing where they were not assigned.
- Required verification rerun after final edits: `npm run build:src:tsgo`, `npm run build:test-fixtures`, focused built tests, `node scripts/testing-manifest/verify.js`, generated contract/suite checks, `git diff --check`, and package/lockfile guard passed.
- Known unrelated failure recorded: full `npm run test:contracts` only failed on `api:http:GET:/discovery/search` returning `500 !== 200`.

## Integration Acceptance

- Integrated on main server branch at base `561a1caca`.
- Route movement after main-checkout regeneration: missing `575 -> 574`, implemented `605 -> 606`, Discord `1128`.
- Generated counts after regeneration: `1141` schemas, `496` OpenAPI paths, `711` manifest entries, `686` contracts, `15` suites.
- Focused source and built tests passed: `14/14`.
- Generated checks passed: testing manifest verify, generated contract check, generated HTTP contracts, generated suite coverage check, generated suite coverage tests, `git diff --check`, and package/lockfile guard.
- `npm run lint` passed.
- Full `npm run test:contracts` failed only on the known unrelated runtime baseline: `api:http:GET:/discovery/search` returned `500 !== 200`.
