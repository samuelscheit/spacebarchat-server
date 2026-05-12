# guilds-param-role-subscriptions-templates-get

## Summary

Accepted and integrated `GET /guilds/{param}/role-subscriptions/templates`
as `GET /guilds/:guild_id/role-subscriptions/templates/` on current base
`ba416054b`.

The route is bearer-authenticated, requires `MANAGE_GUILD`, and returns an
empty list because Spacebar does not currently persist Discord guild
role-subscription listing template state. It does not fabricate purchasable
products, SKUs, subscriptions, trials, billing, payouts, entitlements, Nitro, or
adjacent role-subscription data.

## Changed Files

- `src/api/routes/guilds/#guild_id/role-subscriptions/templates.ts`
- `src/api/routes/guilds/#guild_id/role-subscriptions/templates.test.ts`
- `src/schemas/responses/GuildRoleSubscriptionListingTemplatesResponse.ts`
- `src/schemas/responses/index.ts`
- `tsconfig.test.json`
- `assets/openapi.json`
- `assets/schemas.json`
- `assets/testing-manifest.json`
- `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`
- `packages/missing-routes/missing.json`
- `test/generated/http-contracts.json`
- `test/generated/suite-coverage.json`
- `worker-progress/guilds-param-role-subscriptions-templates-get.md`

## Evidence

- `packages/missing-routes/missing.json` contained `GET
  /guilds/{param}/role-subscriptions/templates` with route name
  `GUILD_ROLE_SUBSCRIPTION_LISTING_TEMPLATES`.
- The xHyroM catalog lists the same path shape and route name.
- Userdoccers has no matching role-subscriptions route.
- Existing Spacebar read endpoints with unsupported durable state use
  conservative empty collections when that is the locally truthful behavior.
- The completed worker handoff in
  `/Users/user/Developer/Developer/spacebarchat/worktrees/current-guilds-param-role-subscriptions-templates-get-agent/worker-progress/guilds-param-role-subscriptions-templates-get.md`
  reported the same behavior on worker base `2e458d3f8`.

## Behavior

- `401` for missing bearer auth through standard authentication middleware.
- `403` when the viewer lacks `MANAGE_GUILD`.
- `404` when the standard guild permission path cannot resolve the guild.
- `200 []` after auth and permission checks pass.
- Adds `GuildRoleSubscriptionListingTemplatesResponse = unknown[]` to avoid
  claiming a stable local schema for Discord private template fields.

## Missing-Route Movement

- Current base: `ba416054b`
- Missing count: `551 -> 550`
- Spacebar implemented count: `629 -> 630`
- Discord implemented count: `1128`
- Removed from missing:
  `GET /guilds/{param}/role-subscriptions/templates`
- Adjacent role-subscription routes remain missing, including
  `/guilds/{param}/role-subscriptions/trials` and trial eligibility.

## Verification

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
- `TS_NODE_TRANSPILE_ONLY=1 node -r dotenv/config -r ts-node/register/transpile-only -r module-alias/register --enable-source-maps --test 'src/api/routes/guilds/#guild_id/role-subscriptions/templates.test.ts'`
- `npm run build:test-fixtures`
- `node -r dotenv/config -r module-alias/register --enable-source-maps --test 'dist-test/src/api/routes/guilds/#guild_id/role-subscriptions/templates.test.js'`
- `node scripts/testing-manifest/verify.js`
- `node scripts/testing-manifest/generate-contract-tests.js --check`
- `node --test test/generated/http-contracts.test.js test/contracts/*.test.cjs`
- `node scripts/testing-manifest/generate-suite-coverage.js --check`
- `node --test test/generated/suite-coverage.test.js`
- `npm run test:manifest`
- `npm run test:suite-coverage`
- `npm run test --workspace @spacebar/missing-routes`
- `npm run test --workspace @spacebar/automatic-reverse-engineering`
- `npx eslint 'src/api/routes/guilds/#guild_id/role-subscriptions/templates.ts' 'src/api/routes/guilds/#guild_id/role-subscriptions/templates.test.ts' src/schemas/responses/GuildRoleSubscriptionListingTemplatesResponse.ts`
- `npx prettier --check 'src/api/routes/guilds/#guild_id/role-subscriptions/templates.ts' 'src/api/routes/guilds/#guild_id/role-subscriptions/templates.test.ts' src/schemas/responses/GuildRoleSubscriptionListingTemplatesResponse.ts`
- `git diff --check`
- Package and lockfile guard over changed files
- License-header typo scan over touched source and test files

## Verification Notes

- Focused source route test passed: `4/4`.
- Focused built route test passed: `4/4`.
- Testing manifest verification passed: `735` entries.
- Generated HTTP contract static checks passed: `710` contracts and `10/10`
  matrix tests.
- Generated suite coverage checks passed: `4/4` tests.
- Missing-routes workspace tests passed: `2/2`.
- Automatic reverse-engineering workspace tests passed: `85/85`.
- OpenAPI regeneration produced `519` paths and `1173` schemas.
- Package and lockfile guard passed; no package or lockfile changed.
- `npm run test:contracts` failed only on the known unrelated runtime contract:
  `api:http:GET:/discovery/search` returned `500` instead of `200`. Existing
  analytics `query.ts` route-registration noise remains unrelated.

## Risks And Boundaries

- Spacebar does not have durable guild role-subscription listing template
  storage, so the current response is an empty compatibility collection.
- A future implementation with real local role-subscription template/listing
  storage should replace this provider and tighten the response schema.
- No role-subscription group listing, subscription listing, trial, settings,
  guild product, billing, payout, entitlement, Nitro, or unrelated guild/store
  route was implemented.
