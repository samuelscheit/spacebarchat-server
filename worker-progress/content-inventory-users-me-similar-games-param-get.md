# content-inventory-users-me-similar-games-param-get

## Summary

Accepted and integrated `GET /content-inventory/users/@me/similar-games/{param}`
as `GET /content-inventory/users/@me/similar-games/:application_id/` on
current base `b98f08b17`.

Spacebar has no durable source-backed content inventory recommendation state or
checked-in response capture for this route, so the handler returns a
conservative empty `ContentInventorySimilarGamesResponse` (`unknown[]`) and
does not fabricate similar games, applications, purchases, subscriptions,
billing state, store state, or inventory entries.

## Changed Files

- `src/api/routes/content-inventory/users/@me/similar-games/#application_id.ts`
- `src/schemas/responses/ContentInventorySimilarGamesResponse.ts`
- `src/schemas/responses/index.ts`
- `test/routes/contentInventorySimilarGamesRoute.test.ts`
- `assets/schemas.json`
- `assets/openapi.json`
- `assets/testing-manifest.json`
- `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`
- `packages/missing-routes/missing.json`
- `test/generated/http-contracts.json`
- `worker-progress/content-inventory-users-me-similar-games-param-get.md`

## Evidence

- `packages/missing-routes/missing.json` contained one assigned missing entry:
  `GET /content-inventory/users/@me/similar-games/{param}` with route name
  `SIMILAR_GAMES`.
- `packages/automatic-reverse-engineering/data/catalogs/routes.xhyrom.catalog.json`
  contains xHyroM evidence for this route.
- No matching Userdoccers route entry was present in the local Userdoccers
  catalog.
- Checked-in capture evidence only showed
  `GET /content-inventory/users/@me` inventory responses; no local capture for
  this exact `similar-games` route was present.
- Nearby local patterns used:
  `src/api/routes/users/@me/widgets/suggested-games.ts`,
  `src/api/routes/users/@me/game-relationships.ts`,
  `src/api/routes/content-inventory/users/#user_id/outbox.ts`, and
  `src/api/routes/application-directory-static.ts`.

## Behavior

- Requires bearer authentication through the normal current-user route boundary.
- Uses the path parameter name `application_id` for the xHyroM `{param}` slot.
- Returns HTTP 200 with `[]` for supported local truth.
- Does not validate or look up the application because there is no local
  recommendation or inventory backing store for this endpoint, and no response
  evidence proving an application lookup/error contract.

## Missing-Route Movement

- Current base: `b98f08b17`
- Missing count: `557 -> 556`
- Spacebar implemented count: `623 -> 624`
- Discord implemented count: `1128`
- Removed from missing:
  `GET /content-inventory/users/@me/similar-games/{param}`
- Still intentionally missing:
  `GET /content-inventory/users/@me?refresh_token={param}`,
  `PATCH /content-inventory/users/@me/applications/{param}`, and
  `POST /content-inventory/users/@me/spotify`.

## Verification

- `npm run build:tsgo`
- `npm run build --workspace @spacebar/automatic-reverse-engineering`
- `node packages/automatic-reverse-engineering/dist/cli.js import-source-routes --root src/api/routes --out packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`
- `npm run build --workspace @spacebar/missing-routes`
- `npm run start --workspace @spacebar/missing-routes`
- `npm run generate:testing-manifest`
- `npm run generate:contract-tests`
- `npm run generate:suite-coverage`
- `npm run test -- test/routes/contentInventorySimilarGamesRoute.test.ts`
- `npm run build:src:tsgo`
- `npm run build:test-fixtures`
- `node -r dotenv/config -r module-alias/register --enable-source-maps --test dist-test/test/routes/contentInventorySimilarGamesRoute.test.js`
- `node scripts/testing-manifest/verify.js`
- `node scripts/testing-manifest/generate-contract-tests.js --check`
- `node --test test/generated/http-contracts.test.js test/contracts/*.test.cjs`
- `node scripts/testing-manifest/generate-suite-coverage.js --check`
- `node --test test/generated/suite-coverage.test.js`
- `npm run test:manifest`
- `npm run test:suite-coverage`
- `npx eslint src/api/routes/content-inventory/users/@me/similar-games/#application_id.ts src/schemas/responses/ContentInventorySimilarGamesResponse.ts test/routes/contentInventorySimilarGamesRoute.test.ts`
- `npx prettier --check src/api/routes/content-inventory/users/@me/similar-games/#application_id.ts src/schemas/responses/ContentInventorySimilarGamesResponse.ts src/schemas/responses/index.ts test/routes/contentInventorySimilarGamesRoute.test.ts`
- `git diff --check`
- `git diff -- package.json package-lock.json`
- `git status --short package.json package-lock.json`

## Verification Notes

- Focused source route test passed: `5/5`.
- Built focused route test passed: `5/5`.
- OpenAPI regeneration produced `514` paths and `1165` schemas.
- Testing manifest verification passed: `729` entries.
- Generated HTTP contract static checks passed: `704` contracts and `10/10`
  matrix tests.
- Generated suite coverage checks passed: `4/4` tests.
- Package and lockfile guard passed; `package.json` and `package-lock.json`
  are unchanged.
- `npm run test:contracts` failed only on the known unrelated runtime contract:
  `api:http:GET:/discovery/search` returned `500` instead of `200`. Existing
  analytics `query.ts` route-registration noise remains unrelated.

## Risks And Boundaries

- The response shape is conservative because no local source documents this
  exact endpoint response. If later captures show concrete fields, replace
  `ContentInventorySimilarGamesResponse = unknown[]` with a source-backed
  schema and persistence behavior.
- No adjacent content-inventory refresh, application mutation, outbox history,
  Spotify, purchase, store, billing, or Nitro route was implemented.
