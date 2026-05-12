# DELETE /channels/{channel_id}/integrations/{integration_id}

Worker: `channels-param-integrations-param-delete`
Branch: `codex/current-missing-route-channels-param-integrations-param-delete-agent`
Worktree: `/Users/user/Developer/Developer/spacebarchat/worktrees/current-channels-param-integrations-param-delete-agent`
Base: `e40cd14be Merge billing invoice breakdown route`

## Scope

Assigned route: `DELETE /channels/{param}/integrations/{param}`
Assigned route name: `DELETE_CHANNELS_CHANNEL_ID_INTEGRATIONS_INTEGRATION_ID`

Implemented only this route in the existing private-channel integrations router. No guild integration, integration join/search, webhook, or adjacent channel integration methods were implemented.

## Evidence

- `packages/missing-routes/missing.json` initially contained one matching missing entry for `DELETE /channels/{param}/integrations/{param}` with route name `DELETE_CHANNELS_CHANNEL_ID_INTEGRATIONS_INTEGRATION_ID`.
- `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json` initially had only `GET /channels/{channel_id}/integrations` for `src/api/routes/channels/#channel_id/integrations.ts`.
- Userdoccers integration docs state:
    - `GET /channels/{channel.id}/integrations` returns private-channel integration objects.
    - `DELETE /channels/{channel.id}/integrations/{integration.id}` removes a channel integration, returns 204, and fires Integration Delete on success.
    - Sources: `https://docs.discord.food/resources/integration` and `https://raw.githubusercontent.com/discord-userdoccers/discord-userdoccers/master/pages/resources/integration.mdx`.
- xHyroM catalog source has `DELETE /channels/{channel_id}/integrations/{param}` as `CHANNEL_INTEGRATION`.
- Local implementation evidence: the existing GET route documents and enforces that Spacebar does not currently persist private-channel integration records.

## Behavior

- Adds `DELETE /:integration_id` under `src/api/routes/channels/#channel_id/integrations.ts`.
- Validates channel and integration IDs as snowflakes.
- Loads the channel with recipients and reuses the existing private-channel access check:
    - non-DM/group-DM channels return `50024 Cannot execute action on this channel type`;
    - inactive/non-recipient users return missing permissions;
    - unknown channels return `10003 Unknown channel`.
- Since there is no durable private-channel integration store, valid authorized delete requests fail closed with `10005 Unknown integration` as 404. The handler does not fabricate a deletion or emit `INTEGRATION_DELETE`.

## Changed Files

- `src/api/routes/channels/#channel_id/integrations.ts`
- `src/api/routes/channels/#channel_id/integrations.test.ts`
- `assets/openapi.json`
- `assets/testing-manifest.json`
- `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`
- `packages/missing-routes/missing.json`
- `test/generated/http-contracts.json`
- `test/generated/suite-coverage.json`

## Missing-Route Movement

- Worker-base missing count: `547 -> 546`
- Worker-base Spacebar implemented count: `633 -> 634`
- Current-base missing count after porting over `0917fcae9`: `545 -> 544`
- Current-base Spacebar implemented count after porting: `635 -> 636`
- Discord route count: `1128` unchanged
- The assigned missing entry was removed from `packages/missing-routes/missing.json`.
- Source catalog now includes:
    - `DELETE /channels/{channel_id}/integrations/{integration_id}`
    - route name `DELETE_CHANNELS_CHANNEL_ID_INTEGRATIONS_INTEGRATION_ID`
    - source `src/api/routes/channels/#channel_id/integrations.ts`

## Commands Run

- `npm ci` - passed; installed local dependencies because the worktree initially had no `node_modules`.
- `npm run build:src:tsgo` - passed.
- `TS_NODE_TRANSPILE_ONLY=1 node -r dotenv/config -r ts-node/register/transpile-only -r module-alias/register --enable-source-maps --test src/api/routes/channels/#channel_id/integrations.test.ts` - passed, 12 tests.
- `npm run generate:openapi` - passed; generated `assets/openapi.json`.
- `npm run build --workspace @spacebar/automatic-reverse-engineering` - passed.
- `node packages/automatic-reverse-engineering/dist/cli.js import-source-routes --root src/api/routes --out packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json` - passed.
- `npm run build --workspace @spacebar/missing-routes` - passed.
- `npm run start --workspace @spacebar/missing-routes` - passed; current-base regeneration wrote missing count 544.
- `npm run generate:testing-manifest` - passed; current-base regeneration wrote 741 entries.
- `npm run generate:contract-tests` - passed; current-base regeneration wrote 716 contracts.
- `npm run generate:suite-coverage` - passed; 15 suites.
- `npm run test:manifest` - passed.
- `npm run test:suite-coverage` - passed.
- `npm run build:test-fixtures` - passed.
- `npm run test:contracts` - failed only at known unrelated runtime assertion `api:http:GET:/discovery/search` returning `500 !== 200`; generated contract checks before runtime passed.
- `node -r dotenv/config -r module-alias/register --enable-source-maps --test dist-test/src/api/routes/channels/#channel_id/integrations.test.js` - passed, 12 tests.
- `git diff --check` - passed.
- `git diff -- package.json package-lock.json` - no output; package and lockfile unchanged.

## Risks And Blockers

- There is no local durable private-channel integration table or provider state. Returning 204 would falsely acknowledge deletion and imply an `INTEGRATION_DELETE` event that cannot be sourced locally, so the implementation intentionally fails closed with unknown integration.
- If private-channel integration persistence is added later, this route should delete only a record owned by the target private channel and then emit the documented Integration Delete event.

## Adjacent Routes Untouched

- Guild integration routes remain missing:
    - `/guilds/{param}/integrations`
    - `/guilds/{param}/integrations/{param}`
    - `/guilds/{param}/integrations/{param}/sync`
- Top-level integration routes remain missing:
    - `/integrations/{param}/join`
    - `/integrations/{param}/search`

## Reconciliation Notes

- The new route appears in OpenAPI, source catalog, testing manifest, HTTP contracts, and suite coverage.
- The assigned route no longer appears in missing routes after regeneration.
- Ported over current master `0917fcae9`, preserving the already-merged localized-pricing and application subscription group listing routes.
- `npm run test:contracts` should be re-run after the unrelated `GET /discovery/search` runtime 500 is fixed.
