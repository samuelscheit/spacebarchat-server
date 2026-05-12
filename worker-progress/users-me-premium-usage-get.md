# GET /users/@me/premium-usage

## Summary

Accepted from worker `users_me_premium_usage_get` and reconciled onto current
main commit `d5a784793`.

Implemented only `GET /users/@me/premium-usage`. The route is
bearer-authenticated and returns Spacebar's durable local current-user premium
usage state, backed by `users.premium_usage_flags`. Detailed Discord Nitro
usage counters are not persisted locally, so the response exposes the
source-documented flag bitfield and decoded flag names instead of fabricating
unsupported counters.

## Changed Files

- `src/api/routes/users/@me/premium-usage.ts`
- `src/schemas/responses/UserPremiumUsageResponse.ts`
- `src/schemas/responses/index.ts`
- `test/routes/users-me-premium-usage-get.test.ts`
- `assets/schemas.json`
- `assets/openapi.json`
- `assets/testing-manifest.json`
- `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`
- `packages/missing-routes/missing.json`
- `test/generated/http-contracts.json`
- `test/generated/suite-coverage.json`

## Evidence

- Userdoccers `resources/user.mdx` documents `Get User Premium Usage` and the
  `premium_usage_flags` user bitfield.
- The xHyroM catalog includes `/users/@me/premium-usage`; only `GET` is in
  missing-route scope.
- Local storage persists `premium_usage_flags` on `User`; the private user API
  projection and admin DTO already expose/use that field.
- Adjacent billing subscription, Nitro affinity/trial, premium mutation,
  virtual currency, payment, store purchase, and current-user settings routes
  remain untouched.

## Current-Base Movement

- Before: `missing = 594`, `spacebar = 586`, `discord = 1128`.
- After regeneration: `missing = 593`, `spacebar = 587`, `discord = 1128`.
- The assigned route is absent from `missing_entries[]`.

## Verification

Commands run with `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH"`:

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
- `node -r dotenv/config -r module-alias/register --enable-source-maps --test dist-test/test/routes/users-me-premium-usage-get.test.js`
- `node scripts/testing-manifest/verify.js`
- `node scripts/testing-manifest/generate-contract-tests.js --check`
- `node scripts/testing-manifest/generate-suite-coverage.js --check`
- `node --test test/generated/http-contracts.test.js test/generated/suite-coverage.test.js`
- `npm run test:suite-coverage`
- `npm run lint`
- `git diff --check`
- `git diff --exit-code -- package.json package-lock.json bun.lock`
- `npm run test:contracts`

Passing evidence:

- Focused premium usage route tests passed: 6/6.
- OpenAPI regenerated with 478 paths and 1112 schemas.
- Testing manifest regenerated and verified with 692 entries.
- Generated HTTP contract tests regenerated and verified with 667 contracts.
- Generated contract/suite tests passed: 13/13.
- Suite coverage tests passed: 4/4.
- Lint, whitespace diff check, and package/lockfile guard passed.

Known unrelated failure:

- `npm run test:contracts` failed only on
  `api:http:GET:/discovery/search`, which returned runtime `500 !== 200`.
  The analytics `query.ts` route-registration warnings are existing baseline
  noise and unrelated to this route.
