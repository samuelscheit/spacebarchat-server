# GET /users/@me/gravity-icymi

## Summary

Implemented `GET /users/@me/gravity-icymi` as an authenticated compatibility endpoint. Spacebar has no durable local Gravity ICYMI feed/recommendation state, so the route returns a locally truthful empty dehydrated-feed envelope:

```json
{ "items": [], "load_id": "spacebar/empty" }
```

The implementation does not hydrate messages, activities, recommended guilds, attachments, uploads, guild joins, or ranking state.

## Changed Files

- `src/api/routes/users/@me/gravity-icymi.ts`
- `src/schemas/responses/GravityIcyMiResponse.ts`
- `src/schemas/responses/index.ts`
- `test/routes/users-me-gravity-icymi-route.test.ts`
- `test/routes/users-me-gravity-attachments-route.test.ts`
- `assets/schemas.json`
- `assets/openapi.json`
- `assets/testing-manifest.json`
- `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`
- `packages/missing-routes/missing.json`
- `test/generated/http-contracts.json`
- `test/generated/suite-coverage.json`

## Evidence Gathered

- `packages/missing-routes/missing.json` had exactly one assigned missing entry: `GET /users/@me/gravity-icymi`, route name `GRAVITY_ITEMS_DEHYDRATED`, source `xhyrom:data/client/routes.json`.
- `packages/automatic-reverse-engineering/data/catalogs/routes.xhyrom.catalog.json` lists `GET`, `HEAD`, and `OPTIONS` for `/users/@me/gravity-icymi`, route name `GRAVITY_ITEMS_DEHYDRATED`.
- `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json` did not have `/users/@me/gravity-icymi` before implementation.
- Checked-in capture data had no concrete `gravity-icymi` HTTP response bodies.
- Userdoccers local catalogs/docs index had no `gravity-icymi` route entry.
- Current Discord web client asset lookup showed `fetchDehydrated` reads `a.body.items` and `a.body.load_id` from `GRAVITY_ITEMS_DEHYDRATED`, supporting the `{ items, load_id }` response envelope.

## Behavior

- Requires bearer auth through normal route middleware.
- Accepts the client `refresh` query flag as documented metadata, but does not fabricate a refreshed feed.
- Returns an empty `items` array and stable `spacebar/empty` `load_id`.
- Provides a schema for the dehydrated item envelope without returning fabricated item records.

## Missing-Route Movement

- Before regeneration on this worker base: `missing = 562`, `GET /users/@me/gravity-icymi` present in `missing_entries` and `routes`.
- After regeneration: `missing = 561`, `GET /users/@me/gravity-icymi` absent from `missing_entries` and `routes`.

## Adjacent Routes Intentionally Untouched

- Did not implement `POST /users/@me/gravity-attachments`.
- Did not implement `/users/@me/gravity-attachments-upload`.
- Did not implement `/gravity-content`.
- Did not implement `/gravity-topic-guilds`.
- Did not implement `/guilds/gravity-join`.
- Did not add attachment, upload, message hydration, recommendation, guild-join, billing, or Nitro behavior.

## Commands Run

- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run build:src:tsgo` initially failed before dependencies were installed: `tsgo: command not found`.
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm ci` passed.
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run build:src:tsgo` passed.
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run generate:schema` passed.
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run generate:openapi` passed with existing unrelated warnings for 3 webhook routes missing `route()` middleware.
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run build --workspace @spacebar/automatic-reverse-engineering` passed.
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" node packages/automatic-reverse-engineering/dist/cli.js import-source-routes --root src/api/routes --out packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json` passed.
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run build --workspace @spacebar/missing-routes` passed.
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run start --workspace @spacebar/missing-routes` passed and reported `Spacebar is missing 561`.
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run generate:testing-manifest` passed.
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run generate:contract-tests` passed.
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run generate:suite-coverage` passed.
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run build:test-fixtures` passed.
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" node -r dotenv/config -r module-alias/register --enable-source-maps --test dist-test/test/routes/users-me-gravity-icymi-route.test.js dist-test/test/routes/users-me-gravity-attachments-route.test.js` passed.
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" node scripts/testing-manifest/verify.js` passed.
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run test:suite-coverage` passed.
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run test:contracts` failed only on the known unrelated runtime contract: `api:http:GET:/discovery/search` returned `500 !== 200`. Generated contract checks passed before the runtime phase.
- `git diff --check` passed.
- `git diff -- package.json package-lock.json` had no output.
- License typo guard on the route, schema, and focused test files had no matches.

## Integration Notes

- Reconciled onto current integration base `eeceb12b5`.
- Regenerated current-base artifacts after formatting the accepted source files.
- Current-base missing-route movement: `missing = 560 -> 559`, `spacebar = 620 -> 621`, `discord = 1128`.
- Focused route tests, manifest verification, generated contract check, generated suite coverage check, suite coverage test, targeted ESLint, Prettier check, `git diff --check`, package/lockfile guard, and license typo guard passed.
- `npm run test:contracts` failed only on the known unrelated runtime contract: `api:http:GET:/discovery/search` returned `500 !== 200`.

## Risks Or Blockers

- The response is intentionally empty because Spacebar does not persist source-backed Gravity ICYMI feed state. Clients expecting Discord-generated private feed items will see no ICYMI content.
- `load_id` is a stable Spacebar compatibility value, not a Discord ranking/load identifier.
- Reconciliation to current main is likely needed before merge if other missing-route workers also changed schemas, OpenAPI, route catalogs, missing-route output, or generated contracts. This worker did not merge, rebase, or inspect another worktree.

## Recommended Next Tasks

- Implement `/gravity-content` only when there is a defensible local hydration source for messages/activities.
- Implement Gravity attachment upload/mutation routes separately from this endpoint.
- Keep future ICYMI item persistence behind a real local data model rather than synthesizing Discord private recommendation state.
