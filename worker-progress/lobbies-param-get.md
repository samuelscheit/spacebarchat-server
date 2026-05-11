# lobbies-param-get

## Summary

Accepted and ported `GET /lobbies/{param}` (`GET_LOBBIES_LOBBY_ID`) onto
current integration base `554fd4282`.

The route is authenticated and bot-only. Spacebar currently has no durable
lobby persistence, lobby-member table, lobby metadata store, application
ownership link, or existing lobby route support, so the handler validates
Discord-style lobby snowflakes, rejects user accounts with `BOT_ONLY_ENDPOINT`,
and fails closed with `404 Unknown lobby` for bot requests rather than
fabricating Discord lobby state.

## Changed Files

- `src/api/routes/lobbies/#lobby_id/index.ts`
- `src/api/routes/lobbies/#lobby_id/index.test.ts`
- `src/schemas/responses/LobbyResponse.ts`
- `src/schemas/responses/LobbyResponse.test.ts`
- `src/schemas/responses/index.ts`
- `tsconfig.test.json`
- `assets/schemas.json`
- `assets/openapi.json`
- `assets/testing-manifest.json`
- `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`
- `packages/missing-routes/missing.json`
- `test/generated/http-contracts.json`
- `worker-progress/lobbies-param-get.md`

## Evidence

- Missing entry before current-base acceptance: `GET /lobbies/{param}` in
  `packages/missing-routes/missing.json`, route name `GET_LOBBIES_LOBBY_ID`,
  source `userdoccers:resources/lobby.mdx`.
- Source absence before port: no `lobbies` route in `src/api/routes`; source
  catalog had no lobby routes.
- Userdoccers source:
  `https://raw.githubusercontent.com/discord-userdoccers/discord-userdoccers/master/pages/resources/lobby.mdx`
- Local support limits: only incidental lobby symbols existed
  (`ChannelType.LOBBY`, message `lobby_id`, `UNKNOWN_LOBBY`); no durable lobby
  entity or route implementation exists.

## Missing-Route Movement

- Current-base before regeneration: `641` missing / `539` implemented /
  `1128` Discord.
- After regeneration: `640` missing / `540` implemented / `1128` Discord.
- `GET /lobbies/{param}` was removed from missing entries.
- Remaining same-path methods, intentionally out of scope:
  `DELETE /lobbies/{param}` and `PATCH /lobbies/{param}`.

## Verification

- `npm run build:src:tsgo` - passed.
- `npm run generate:schema` - passed; wrote `1028` schemas.
- `npm run build --workspace @spacebar/automatic-reverse-engineering` - passed.
- `node packages/automatic-reverse-engineering/dist/cli.js import-source-routes --root src/api/routes --out packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json` - passed.
- `npm run build --workspace @spacebar/missing-routes && npm run start --workspace @spacebar/missing-routes` - passed; wrote `640` missing / `540` implemented.
- `npm run generate:testing-manifest && node scripts/testing-manifest/verify.js` - passed with `645` entries.
- `node scripts/testing-manifest/generate-contract-tests.js --check` - initially stale.
- `npm run generate:contract-tests && node scripts/testing-manifest/generate-contract-tests.js --check` - passed with `620` contracts.
- `node scripts/testing-manifest/generate-suite-coverage.js --check` - passed.
- `npm run generate:openapi` - passed with `435` paths and `1028` schemas.
- `npm run build:test-fixtures` - passed.
- Focused compiled tests:
  `node -r dotenv/config -r module-alias/register --enable-source-maps --test 'dist-test/src/api/routes/lobbies/#lobby_id/index.test.js' dist-test/src/schemas/responses/LobbyResponse.test.js`
  passed 10/10.
- `node --test test/generated/http-contracts.test.js test/generated/suite-coverage.test.js` - passed 13/13.
- `npm run test:manifest` - passed.
- `npm run test:suite-coverage` - passed.
- `npm run lint` - passed.
- `npm run test:contracts` - static/generated checks passed; runtime contracts
  failed on known unrelated `api:http:GET:/discovery/search` returning `500`
  instead of `200`.
- `git diff --check` - passed.
- `git diff -- package.json package-lock.json` - no diff.
- Malformed warranty-token scan across `src test packages scripts assets
  worker-progress` - no matches.

## Risks / Blockers

- The route cannot return real lobby objects until Spacebar has durable lobby
  persistence and membership state. Current behavior deliberately fails closed.
- `DELETE` and `PATCH /lobbies/{param}` remain missing by assignment scope.
- Full `npm run test:contracts` has a pre-existing/unrelated runtime failure on
  `GET /discovery/search`.

## Completion Audit

- Assigned route id `lobbies-param-get`: complete.
- Implemented method: `GET` only.
- Adjacent lobby methods/routes: not implemented.
- Userdoccers comparison: complete for auth mode, response fields, and endpoint
  support limits.
- Production behavior: authenticated, bot-only, validates lobby ID, fails
  closed against absent local persistence.
- Focused tests: route/helper behavior and generated schema/OpenAPI shape pass.
- Generated artifacts: source catalog, missing report, schemas, OpenAPI,
  testing manifest, and HTTP contract matrix refreshed on current base.

## Next Tasks

- Implement durable lobby storage before enabling `200` responses for real
  lobbies.
- Assign separate workers for `DELETE /lobbies/{param}`,
  `PATCH /lobbies/{param}`, and adjacent lobby member/message routes.
