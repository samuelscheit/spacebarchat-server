# users-me-guilds-premium-subscriptions-get

## Summary

- Implemented the assigned `GET /users/@me/guilds/premium/subscriptions` route
  only.
- Behavior is an authenticated compatibility endpoint returning `[]`.
- This is intentionally conservative: Spacebar has guild/user premium counters
  and `premium_since` timestamps, but no durable current-user applied guild
  boost subscription records, subscription IDs, pause state, billing state, or
  renewal state to expose.

## Assigned Path

- Assigned route: `GET /users/@me/guilds/premium/subscriptions`
- Worker branch:
  `codex/current-missing-route-users-me-guilds-premium-subscriptions-get-agent`
- Worker base: `91c70c571`
- Missing methods found on worker base: one `GET` entry in
  `packages/missing-routes/missing.json`
- Methods implemented: `GET`
- Worker missing-route movement: assigned
  `GET /users/@me/guilds/premium/subscriptions` moved from missing to
  implemented. Regenerated missing-route total was `565` on the worker base.
- Current-base movement after reconciliation on `95c61511d`: `missing = 565`
  to `564`, `spacebar = 615` to `616`, `discord = 1128`.

## Changed Files

- `src/api/routes/users/@me/guilds/premium/subscriptions.ts`
- `src/api/routes/users/@me/guilds/premium/subscriptions.test.ts`
- `src/schemas/responses/UserGuildPremiumSubscriptionsResponse.ts`
- `src/schemas/responses/index.ts`
- `tsconfig.test.json`
- `test/scenarios/users-supplemental.test.ts`
- `testing/suite-coverage-policy.json`
- `assets/schemas.json`
- `assets/openapi.json`
- `assets/testing-manifest.json`
- `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`
- `packages/missing-routes/missing.json`
- `test/generated/http-contracts.json`
- `test/generated/suite-coverage.json`
- `worker-progress/users-me-guilds-premium-subscriptions-get.md`

## Evidence Gathered

- `packages/missing-routes/missing.json` had the assigned `GET` entry before
  implementation and no assigned `GET` entry after regeneration.
- `packages/automatic-reverse-engineering/data/catalogs/routes.userdoccers.catalog.json`
  lists `GET /users/@me/guilds/premium/subscriptions` from
  `userdoccers:resources/subscription.mdx` with summary
  `Get Applied Premium Guild Subscriptions`.
- `packages/automatic-reverse-engineering/data/catalogs/routes.xhyrom.catalog.json`
  lists the same route as `USER_APPLIED_GUILD_BOOSTS`; HEAD/OPTIONS are xHyroM
  evidence only and were not separately implemented.
- Userdoccers `resources/subscription.mdx`:
  `https://raw.githubusercontent.com/discord-userdoccers/discord-userdoccers/master/pages/resources/subscription.mdx`
  documents the endpoint as returning premium guild subscription objects
  applied by the current user, with optional `paused` filtering. Spacebar does
  not currently persist that object set.
- Local state search found `premium_since` and aggregate
  `premium_subscription_count` fields, but no durable premium guild
  subscription entity/store for user-applied boosts.
- Existing `GET /guilds/:guild_id/premium/subscriptions` behavior already
  returns an empty list because Spacebar does not persist Discord premium guild
  subscription records.

## Behavior And Risks

- The route returns `200 []` for authenticated users.
- It declares `UserGuildPremiumSubscriptionsResponse` as `unknown[]` so
  schema/OpenAPI/contracts capture the array response without fabricating
  Discord boost object fields.
- It does not honor `paused` because there is no local applied boost
  subscription state to filter.
- Risk: Discord clients expecting concrete applied boost objects will see an
  empty list until Spacebar adds durable current-user guild boost subscription
  storage.

## Adjacent Routes Intentionally Untouched

- Did not implement `/users/@me/guilds/premium/subscriptions/cooldown`; that
  route was integrated separately on current main before this reconciliation.
- Did not implement subscription slot cancel/uncancel mutations.
- Did not implement guild premium subscription mutations, billing routes, Nitro
  routes, entitlement routes, referral routes, or unrelated current-user routes.

## Commands Run

Worker commands were run with
`PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH"`:

- `npm run build:src:tsgo` - initially failed because this worktree had no
  `node_modules` and `tsgo` was unavailable.
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
- `npm run build:test-fixtures`
- `node -r dotenv/config -r module-alias/register --enable-source-maps --test dist-test/src/api/routes/users/@me/guilds/premium/subscriptions.test.js`
- `node scripts/testing-manifest/verify.js`
- `node scripts/testing-manifest/generate-contract-tests.js --check`
- `node --test test/generated/http-contracts.test.js`
- `node scripts/testing-manifest/generate-suite-coverage.js --check`
- `node --test test/generated/suite-coverage.test.js`
- `node -r dotenv/config -r module-alias/register --enable-source-maps --test --test-concurrency=1 dist-test/test/scenarios/users-supplemental.test.js` -
  skipped because no Postgres admin URL was available.
- `git diff --check`
- `git diff -- package.json package-lock.json`

Current-base orchestrator verification is recorded below after regeneration on
`95c61511d`.

Current-base orchestrator commands were run with
`PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH"`:

- `npm run build:src:tsgo` - passed.
- `npm run generate:schema` - passed; wrote `1153` schemas.
- `npm run generate:openapi` - passed; wrote `506` paths and `1153` schemas,
  with the existing unrelated webhook route metadata warnings.
- `npm run build --workspace @spacebar/automatic-reverse-engineering` - passed.
- `node packages/automatic-reverse-engineering/dist/cli.js import-source-routes --root src/api/routes --out packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json` - passed.
- `npm run build --workspace @spacebar/missing-routes` - passed.
- `npm run start --workspace @spacebar/missing-routes` - passed; wrote
  `missing = 564`, `spacebar = 616`, `discord = 1128`.
- `npm run generate:testing-manifest` - passed; wrote `721` entries.
- `npm run generate:contract-tests` - passed; wrote `696` contracts.
- `npm run generate:suite-coverage` - passed; wrote `15` suites.
- `npm run build:test-fixtures` - passed.
- `npm test -- src/api/routes/users/@me/guilds/premium/subscriptions.test.ts` -
  passed, `4/4`.
- `node -r dotenv/config -r module-alias/register --enable-source-maps --test dist-test/src/api/routes/users/@me/guilds/premium/subscriptions.test.js` - passed,
  `4/4`.
- `node -r dotenv/config -r module-alias/register --enable-source-maps --test --test-concurrency=1 dist-test/test/scenarios/users-supplemental.test.js` - skipped because no Postgres admin URL was available.
- `node scripts/testing-manifest/verify.js` - passed, `721` entries.
- `node scripts/testing-manifest/generate-contract-tests.js --check` - passed,
  `696` contracts.
- `node scripts/testing-manifest/generate-suite-coverage.js --check` - passed.
- `node --test test/generated/http-contracts.test.js test/generated/suite-coverage.test.js` - passed, `13/13`.
- `npx eslint src/api/routes/users/@me/guilds/premium/subscriptions.ts src/api/routes/users/@me/guilds/premium/subscriptions.test.ts src/schemas/responses/UserGuildPremiumSubscriptionsResponse.ts` - passed.
- `npx prettier --check src/api/routes/users/@me/guilds/premium/subscriptions.ts src/api/routes/users/@me/guilds/premium/subscriptions.test.ts src/schemas/responses/UserGuildPremiumSubscriptionsResponse.ts worker-progress/users-me-guilds-premium-subscriptions-get.md` - passed after formatting the two route files.
- `git diff --check` - passed.
- `git diff --exit-code -- package.json package-lock.json bun.lock packages/automatic-reverse-engineering/package.json packages/missing-routes/package.json apps/admin-dashboard/package.json` - passed.
- Changed-file malformed warranty-string scan - passed.
- `npm run test:contracts` - failed only on the known unrelated
  `api:http:GET:/discovery/search` runtime assertion (`500 !== 200`). Static
  contract checks passed before the runtime phase.

## Verification Results

- Worker focused route test: passed, 4 tests.
- Worker testing manifest verify: passed, 720 entries.
- Worker generated HTTP contract matrix check/test: passed, 695 contracts.
- Worker generated suite coverage check/test: passed, 15 suites.
- Worker `build:src:tsgo`: passed after `npm ci`.
- Worker `build:test-fixtures`: passed.
- Worker `git diff --check`: passed.
- Worker package/lockfile guard: no `package.json` or `package-lock.json` diff.

## Completion Audit

- Assigned worktree/branch: confirmed current directory is the assigned
  worktree and branch is
  `codex/current-missing-route-users-me-guilds-premium-subscriptions-get-agent`
  at `91c70c571`.
- Missing-route confirmation/removal: `packages/missing-routes/missing.json`
  now has no `GET /users/@me/guilds/premium/subscriptions` entry; regenerated
  total is `565` on the worker base.
- Source implementation:
  `src/api/routes/users/@me/guilds/premium/subscriptions.ts` defines only
  `router.get("/")`, returns `200 []`, and declares
  `UserGuildPremiumSubscriptionsResponse` plus `APIErrorResponse`.
- Auth boundary: route is absent from `NO_AUTHORIZATION_ROUTES`; focused test
  asserts both raw and `/api/v9` paths require auth.
- Local truthful behavior: route returns an empty list because local searches
  found no durable current-user applied guild boost subscription store.
  Aggregate guild counters and `premium_since` fields were not used as
  fabricated subscription objects.
- Adjacent scope: source/test checks and missing-route evidence show this
  worker did not implement cooldown, subscription slot mutations, guild premium
  mutations, billing, Nitro, entitlement, referral, or unrelated current-user
  routes.
- Generated artifacts: `assets/schemas.json`, `assets/openapi.json`,
  `assets/testing-manifest.json`, source route catalog, missing-route report,
  HTTP contracts, and suite coverage all include the assigned GET route with
  the new response schema.

## Recommended Next Tasks

- Add a real persistence-backed response later if Spacebar introduces durable
  current-user applied guild boost subscription records.
