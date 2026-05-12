# GET /users/@me/guilds/premium/subscriptions/cooldown

## Summary

Implemented only `GET /users/@me/guilds/premium/subscriptions/cooldown`.

Userdoccers documents this endpoint as returning a required cooldown object with
`ends_at`, `limit`, and `remaining`, all tied to premium guild subscription
slot-change cooldown state. Spacebar does not currently persist Discord boost
slots, applied premium guild subscriptions for current users, or slot-change
cooldown history. Returning `200` would require inventing cooldown limits or
timestamps, so the compatibility route is bearer-authenticated and fails closed
with the existing Discord API error `10050` (`Unknown premium server subscribe
cooldown`).

## Changed Files

- `src/api/routes/users/@me/guilds/premium/subscriptions/cooldown.ts`
- `test/routes/users-me-guilds-premium-subscriptions-cooldown-get.test.ts`
- `assets/openapi.json`
- `assets/testing-manifest.json`
- `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`
- `packages/missing-routes/missing.json`
- `test/generated/http-contracts.json`
- `test/generated/suite-coverage.json`
- `worker-progress/users-me-guilds-premium-subscriptions-cooldown-get.md`

## Evidence Gathered

- `packages/missing-routes/missing.json` had one assigned missing entry:
  `GET /users/@me/guilds/premium/subscriptions/cooldown`.
- `packages/automatic-reverse-engineering/data/catalogs/routes.xhyrom.catalog.json`
  lists the route as `APPLIED_GUILD_BOOST_COOLDOWN`.
- `packages/automatic-reverse-engineering/data/catalogs/routes.userdoccers.catalog.json`
  lists the route from `userdoccers:resources/subscription.mdx` with summary
  `Get Premium Guild Subscription Cooldown`.
- Userdoccers source:
  `https://raw.githubusercontent.com/discord-userdoccers/discord-userdoccers/master/pages/resources/subscription.mdx`
  and `https://docs.discord.food/resources/subscription#get-premium-guild-subscription-cooldown`.
  The documented response fields are `ends_at`, `limit`, and `remaining`.
- Local search found no durable entity or repository for premium guild
  subscription slots, applied current-user guild boosts, or boost cooldown
  history. Nearby local support is limited to aggregate guild premium counters,
  `Member.premium_since`, and current-user Nitro-like fields.
- `src/api/routes/users/@me/guilds/premium/subscription-slots.ts` and
  `src/api/routes/guilds/#guild_id/premium.ts` already return empty arrays
  because premium guild subscription records are not persisted.
- `src/util/util/Constants.ts` already defines
  `DiscordApiErrors.UNKNOWN_PREMIUM_SERVER_SUBSCRIBE_COOLDOWN` as code `10050`,
  which matches this unsupported unknown cooldown state.

## Behavior Implemented

- Added a nested route file for the exact assigned path.
- Route metadata declares `400` and `401` `APIErrorResponse` bodies and bearer
  auth via normal API middleware.
- Authenticated requests throw
  `DiscordApiErrors.UNKNOWN_PREMIUM_SERVER_SUBSCRIBE_COOLDOWN`.
- No `200` response schema is declared because Spacebar cannot truthfully build
  the documented cooldown object.
- No guild boosts, subscription slots, cooldown timestamps, plans, billing
  state, entitlements, Nitro state, or renewal state are fabricated.

## Missing-Route Movement

- Worker base: `43ebc35e9`.
- Before regeneration on worker base: `missing = 568`, `spacebar = 612`,
  `discord = 1128`.
- After regeneration on worker base: `missing = 567`, `spacebar = 613`,
  `discord = 1128`.
- Removed only `GET /users/@me/guilds/premium/subscriptions/cooldown`.

## Current-Base Movement

- Integration base: `91c70c571`.
- Before regeneration on current base: `missing = 566`, `spacebar = 614`,
  `discord = 1128`.
- After regeneration on current base: `missing = 565`, `spacebar = 615`,
  `discord = 1128`.
- Removed only `GET /users/@me/guilds/premium/subscriptions/cooldown`.

## Adjacent Routes Intentionally Untouched

- `GET /users/@me/guilds/premium/subscriptions`
- `POST /users/@me/guilds/premium/subscription-slots/{param}/cancel`
- `POST /users/@me/guilds/premium/subscription-slots/{param}/uncancel`
- `GET /guilds/{param}/premium/subscriptions`
- `PUT /guilds/{param}/premium/subscriptions`
- `DELETE /guilds/{param}/premium/subscriptions/{param}`
- Billing subscription, Nitro, entitlement, referral, guild boost mutation, and
  other current-user premium routes.

## Verification

Worker commands were run with `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH"`:

- `npm ci` - passed; package manifests and lockfile unchanged.
- `npm run build:src:tsgo` - passed.
- `npm run generate:schema` - passed.
- `npm run generate:openapi` - passed; wrote `503` paths and `1150` schemas.
- `npm run build --workspace @spacebar/automatic-reverse-engineering` - passed.
- `node packages/automatic-reverse-engineering/dist/cli.js import-source-routes --root src/api/routes --out packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json` - passed.
- `npm run build --workspace @spacebar/missing-routes` - passed.
- `npm run start --workspace @spacebar/missing-routes` - passed; wrote
  `missing = 567`, `spacebar = 613`, `discord = 1128`.
- `npm run generate:testing-manifest` - passed; wrote `718` entries.
- `npm run generate:contract-tests` - passed; wrote `693` contracts.
- `npm run generate:suite-coverage` - passed; wrote `15` suites.
- `npm run build:test-fixtures` - passed.
- `node -r dotenv/config -r module-alias/register --enable-source-maps --test dist-test/test/routes/users-me-guilds-premium-subscriptions-cooldown-get.test.js` - passed, `4/4`.
- `node scripts/testing-manifest/verify.js` - passed, `718` entries.
- `node scripts/testing-manifest/generate-contract-tests.js --check` - passed,
  `693` contracts.
- `node scripts/testing-manifest/generate-suite-coverage.js --check` - passed.
- `node --test test/generated/http-contracts.test.js test/generated/suite-coverage.test.js` - passed, `13/13`.
- `npx eslint src/api/routes/users/@me/guilds/premium/subscriptions/cooldown.ts test/routes/users-me-guilds-premium-subscriptions-cooldown-get.test.ts` - passed.
- `git diff --check` - passed.
- `git diff --exit-code -- package.json package-lock.json bun.lock packages/automatic-reverse-engineering/package.json packages/missing-routes/package.json apps/admin-dashboard/package.json` - passed.
- Changed-file malformed warranty-string scan - passed.

Current-base orchestrator commands were run with `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH"`:

- `npm run build:src:tsgo` - passed.
- `npm run generate:schema` - passed; wrote `1152` schemas.
- `npm run generate:openapi` - passed; wrote `505` paths and `1152` schemas,
  with the existing unrelated webhook route metadata warnings.
- `npm run build --workspace @spacebar/automatic-reverse-engineering` - passed.
- `node packages/automatic-reverse-engineering/dist/cli.js import-source-routes --root src/api/routes --out packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json` - passed.
- `npm run build --workspace @spacebar/missing-routes` - passed.
- `npm run start --workspace @spacebar/missing-routes` - passed; wrote
  `missing = 565`, `spacebar = 615`, `discord = 1128`.
- `npm run generate:testing-manifest` - passed; wrote `720` entries.
- `npm run generate:contract-tests` - passed; wrote `695` contracts.
- `npm run generate:suite-coverage` - passed; wrote `15` suites.
- `npm run build:test-fixtures` - passed.
- `npm test -- test/routes/users-me-guilds-premium-subscriptions-cooldown-get.test.ts` - passed, `4/4`.
- `node -r dotenv/config -r module-alias/register --enable-source-maps --test dist-test/test/routes/users-me-guilds-premium-subscriptions-cooldown-get.test.js` - passed, `4/4`.
- `node scripts/testing-manifest/verify.js` - passed, `720` entries.
- `node scripts/testing-manifest/generate-contract-tests.js --check` - passed,
  `695` contracts.
- `node scripts/testing-manifest/generate-suite-coverage.js --check` - passed.
- `node --test test/generated/http-contracts.test.js test/generated/suite-coverage.test.js` - passed, `13/13`.
- `npx eslint src/api/routes/users/@me/guilds/premium/subscriptions/cooldown.ts test/routes/users-me-guilds-premium-subscriptions-cooldown-get.test.ts` - passed.
- `npx prettier --check src/api/routes/users/@me/guilds/premium/subscriptions/cooldown.ts test/routes/users-me-guilds-premium-subscriptions-cooldown-get.test.ts worker-progress/users-me-guilds-premium-subscriptions-cooldown-get.md` - passed.
- `git diff --check` - passed.
- `git diff --exit-code -- package.json package-lock.json bun.lock packages/automatic-reverse-engineering/package.json packages/missing-routes/package.json apps/admin-dashboard/package.json` - passed.
- Changed-file malformed warranty-string scan - passed.
- `npm run test:contracts` - failed only on the known unrelated
  `api:http:GET:/discovery/search` runtime assertion (`500 !== 200`). Static
  contract checks passed before the runtime phase.

`npm run test:contracts` was not run in the worker; generated contract and suite
checks were run instead.

## Risks And Notes

- Discord may return a successful cooldown object for users with private boost
  cooldown state. Spacebar currently cannot represent that object without
  fabricating `ends_at`, `limit`, or `remaining`, so this route deliberately
  fails closed.
- If durable premium guild subscription slot history is later added,
  `getPremiumGuildSubscriptionCooldown()` should be replaced with a calculation
  from that persisted state and a response schema for the documented cooldown
  object.

## Reconciliation

The worker worktree `HEAD` was `43ebc35e9558a1a44b20948ad3e075da5774b7e2`.
The route was reconciled manually onto integration base `91c70c571`; generated
artifacts are rebuilt from the current base.
