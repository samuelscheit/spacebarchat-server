# guilds-param-roles-param-connections-configuration-get

## Summary

Accepted and integrated
`GET /guilds/{param}/roles/{param}/connections/configuration` as
`GET /guilds/:guild_id/roles/:role_id/connections/configuration/` on current
base `d5fb7dcf4`.

The route is bearer-authenticated, requires `MANAGE_ROLES`, verifies the role
belongs to the requested guild, and returns Spacebar's locally truthful role
connection configuration. Spacebar does not persist Discord linked-role
configuration state today, so the default response is `[]` rather than
fabricated requirements.

## Changed Files

- `src/api/routes/guilds/#guild_id/roles/#role_id/connections/configuration.ts`
- `test/routes/guilds-param-roles-param-connections-configuration-get.test.ts`
- `test/routes/guilds-param-roles-connections-configurations-get.test.ts`
- `assets/openapi.json`
- `assets/testing-manifest.json`
- `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`
- `packages/missing-routes/missing.json`
- `test/generated/http-contracts.json`
- `test/generated/suite-coverage.json`
- `worker-progress/guilds-param-roles-param-connections-configuration-get.md`

## Evidence

- `packages/missing-routes/missing.json` contained `GET` and `PUT` for
  `/guilds/{param}/roles/{param}/connections/configuration`.
- The Userdoccers catalog lists
  `GET_GUILDS_GUILD_ID_ROLES_ROLE_ID_CONNECTIONS_CONFIGURATION`.
- The xHyroM catalog lists `GET`, `HEAD`, `OPTIONS`, and `PUT` for this path.
- Checked-in route evidence from the worker shows Discord-compatible empty
  configuration responses; local sibling
  `roles/connections-configurations.ts` already documents that Spacebar lacks
  durable linked-role configuration state.

## Behavior

- `401` for missing bearer auth through the standard auth middleware.
- `403` when the caller lacks `MANAGE_ROLES`.
- `404` when the requested role is not found under the requested guild.
- `200 []` for existing guild roles until durable linked-role configuration
  storage exists.
- No linked-role requirements, applications, assignments, eligibility state, or
  write behavior is fabricated.

## Missing-Route Movement

- Current base: `d5fb7dcf4`
- Missing count: `555 -> 554`
- Spacebar implemented count: `625 -> 626`
- Discord implemented count: `1128`
- Removed from missing:
  `GET /guilds/{param}/roles/{param}/connections/configuration`
- Still intentionally missing for this path: `PUT`

## Verification

- `npm run build:src:tsgo`
- `npm run generate:openapi`
- `npm run build --workspace @spacebar/automatic-reverse-engineering`
- `node packages/automatic-reverse-engineering/dist/cli.js import-source-routes --root src/api/routes --out packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`
- `npm run build --workspace @spacebar/missing-routes`
- `npm run start --workspace @spacebar/missing-routes`
- `npm run generate:testing-manifest`
- `npm run generate:contract-tests`
- `npm run generate:suite-coverage`
- `npm run build:test-fixtures`
- `node -r dotenv/config -r module-alias/register --enable-source-maps --test dist-test/test/routes/guilds-param-roles-param-connections-configuration-get.test.js dist-test/test/routes/guilds-param-roles-connections-configurations-get.test.js`
- `node scripts/testing-manifest/verify.js`
- `node scripts/testing-manifest/generate-contract-tests.js --check`
- `node scripts/testing-manifest/generate-suite-coverage.js --check`
- `node --test test/generated/http-contracts.test.js test/contracts/*.test.cjs`
- `node --test test/generated/suite-coverage.test.js`
- `npm run test:manifest`
- `npm run test:suite-coverage`
- `npx eslint 'src/api/routes/guilds/#guild_id/roles/#role_id/connections/configuration.ts' test/routes/guilds-param-roles-param-connections-configuration-get.test.ts test/routes/guilds-param-roles-connections-configurations-get.test.ts`
- `npx prettier --check 'src/api/routes/guilds/#guild_id/roles/#role_id/connections/configuration.ts' test/routes/guilds-param-roles-param-connections-configuration-get.test.ts test/routes/guilds-param-roles-connections-configurations-get.test.ts`
- `git diff --check`
- `git diff --exit-code -- package.json package-lock.json`
- `rg -n 'MERMER|MERCHANTIBILITY' 'src/api/routes/guilds/#guild_id/roles/#role_id/connections/configuration.ts' test/routes/guilds-param-roles-param-connections-configuration-get.test.ts test/routes/guilds-param-roles-connections-configurations-get.test.ts`

## Verification Notes

- Focused built route tests passed: `13/13`.
- Testing manifest verification passed: `731` entries.
- Generated HTTP contract static checks passed: `706` contracts and `10/10`
  matrix tests.
- Generated suite coverage checks passed: `4/4` tests.
- OpenAPI regeneration produced `515` paths and `1165` schemas.
- Package and lockfile guard passed; `package.json` and `package-lock.json`
  are unchanged.
- `npm run test:contracts` failed only on the known unrelated runtime contract:
  `api:http:GET:/discovery/search` returned `500` instead of `200`. Existing
  analytics `query.ts` route-registration noise remains unrelated.

## Risks And Boundaries

- The response is empty because Spacebar has no durable role-specific
  linked-role configuration storage today.
- Future linked-role storage should update this GET and the remaining `PUT`
  together so read/write semantics stay consistent.
- No `PUT /guilds/:guild_id/roles/:role_id/connections/configuration`,
  eligibility, assign, unassign, or bulk role configuration mutation route was
  implemented.
