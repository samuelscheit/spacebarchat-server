# lobbies-param-messages-get

## Summary

Implemented `GET /lobbies/{param}/messages`
(`GET_LOBBIES_LOBBY_ID_MESSAGES`) on current integration base
`ae394adcc8015055e5ab5e0b280e6e5a4e797b54`.

The route is authenticated by the normal API auth middleware, enforces the
documented OAuth2 `lobbies.write` scope from `req.token`, validates
Discord-style lobby snowflakes, parses the documented `limit` query parameter
range of `1` to `200` with default `50`, and fails closed with `404 Unknown
Lobby` because Spacebar has no durable Social SDK lobby store or lobby message
history to read from.

## Changed Files

- `src/api/routes/lobbies/#lobby_id/messages.ts`
- `src/api/routes/lobbies/#lobby_id/messages.test.ts`
- `src/api/routes/lobbies/#lobby_id/index.ts`
- `src/api/util/utility/Lobbies.ts`
- `src/schemas/responses/LobbyResponse.ts`
- `src/schemas/responses/LobbyResponse.test.ts`
- `tsconfig.test.json`
- `assets/schemas.json`
- `assets/openapi.json`
- `assets/testing-manifest.json`
- `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`
- `packages/missing-routes/missing.json`
- `test/generated/http-contracts.json`

## Evidence

- Missing entry before implementation: `GET /lobbies/{param}/messages` from
  `userdoccers:resources/lobby.mdx`.
- Userdoccers requirements applied: OAuth2 `lobbies.write`, optional `limit`
  query parameter, and `PartialMessage[]` response shape.
- Local support limit: there is no persisted lobby entity, lobby membership
  access model, or lobby message history. The implementation does not fabricate
  messages.
- Shared lobby ID and `Unknown Lobby` helpers live in
  `src/api/util/utility/Lobbies.ts` so runtime route discovery does not try to
  register a helper file as an API route.

## Missing-Route Movement

- Current-base before regeneration: `636` missing / `544` implemented /
  `1128` Discord.
- After regeneration: `635` missing / `545` implemented / `1128` Discord.
- `GET /lobbies/{param}/messages` was removed from missing entries.
- `POST /lobbies/{param}/messages` remains missing by assignment scope.

## Verification

- `npm run build:src:tsgo` - passed.
- `npm run generate:schema` - passed; wrote `1030` schemas.
- `npm run generate:openapi` - passed; wrote `440` paths and `1030` schemas.
- `npm run build:test-fixtures` - passed.
- Focused compiled tests for lobbies route/schema - passed `21/21`.
- Automatic reverse engineering build/import - passed.
- Missing-routes build/start - passed; wrote `635` missing / `545`
  implemented.
- `npm run generate:testing-manifest` - passed; wrote `650` entries.
- `node scripts/testing-manifest/verify.js` - passed.
- `npm run generate:contract-tests` and contract check - passed; wrote `625`
  contracts.
- Suite coverage check - passed.
- Generated contract and suite tests - passed `13/13`.
- `npm run test:manifest` - passed `30/30`.
- `npm run test:suite-coverage` - passed `4/4`.
- `npm run lint` - passed.
- `git diff --check` - passed.
- Package/lockfile guard - no diff.
- Malformed warranty-token scan - no matches.
- `npm run test:contracts` static checks passed; runtime still fails on the
  known unrelated `api:http:GET:/discovery/search` expectation returning `500`
  instead of `200`. No lobbies runtime registration error remains.

## Risks / Follow-Up

- Returning real lobby messages needs durable Social SDK lobby/message storage
  and membership authorization.
- `POST /lobbies/{param}/messages` and adjacent lobby mutation/member routes
  remain separate missing-route assignments.
