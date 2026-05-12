# teams-param-payouts-onboarding-get

## Summary

Implemented `GET /teams/{param}/payouts/onboarding`
(`GET_TEAMS_TEAM_ID_PAYOUTS_ONBOARDING`) on worker base
`d6b39281ffec5e4addb1370f489c0ab0262529dd`.

The route is bearer-authenticated and owner-only, matching the Userdoccers
requirement for the Tipalti payout onboarding dashboard. Spacebar has no durable
team payout onboarding state or payout provider integration, so the handler
verifies the team exists, verifies the caller owns the team, and then fails
closed with `501 APIErrorResponse` instead of fabricating a dashboard URL.

## Changed Files

- `src/api/routes/teams/#team_id/payouts/onboarding.ts`
- `test/routes/teams-param-payouts-onboarding-get.test.ts`
- `assets/openapi.json`
- `assets/testing-manifest.json`
- `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`
- `packages/missing-routes/missing.json`
- `test/generated/http-contracts.json`

## Evidence Gathered

- `packages/missing-routes/missing.json` listed
  `GET /teams/{param}/payouts/onboarding` before implementation.
- `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`
  had no matching source route before implementation; it now maps
  `/teams/{team_id}/payouts/onboarding` to
  `src/api/routes/teams/#team_id/payouts/onboarding.ts`.
- Userdoccers `resources/team.mdx` documents `Get Team Payout Onboarding` as
  returning a Tipalti payee dashboard `url` and requiring the team owner.
- Local source inspection found only team/team-member persistence and no
  provider-backed payout onboarding, Tipalti dashboard, bank account, tax, or
  payout-provider state.
- Nearby fail-closed patterns inspected:
  `src/api/routes/teams/#team_id/payouts.ts` and
  `src/api/routes/teams/#team_id/identity/verification.ts`.

## Missing-Route Movement

- Before regeneration on this worker base: `592` missing / `588` Spacebar /
  `1128` Discord.
- After regeneration: `591` missing / `589` Spacebar / `1128` Discord.
- Removed missing entry:
  `GET /teams/{param}/payouts/onboarding`.
- Still missing and intentionally untouched:
  `GET /teams/{param}/payouts/{param}/report`.

## Commands Run

- `npm ci` - passed; no `package.json` or `package-lock.json` diff.
- `npm run build:src:tsgo` - passed.
- `npm run build:test-fixtures` - passed.
- `npm run build --workspace @spacebar/automatic-reverse-engineering` - passed.
- `node packages/automatic-reverse-engineering/dist/cli.js import-source-routes --root src/api/routes --out packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json` - passed.
- `npm run build --workspace @spacebar/missing-routes` - passed.
- `npm run start --workspace @spacebar/missing-routes` - passed; wrote `591`
  missing / `589` Spacebar / `1128` Discord.
- `npm run generate:testing-manifest` - passed; wrote `694` entries.
- `npm run generate:contract-tests` - passed; wrote `669` contracts.
- `node scripts/testing-manifest/generate-suite-coverage.js` - passed; suite
  coverage unchanged because this route is contract-tier.
- `npm run generate:openapi` - passed; wrote `480` paths and `1112` schemas.
- `node -r dotenv/config -r module-alias/register --enable-source-maps --test dist-test/test/routes/teams-param-payouts-onboarding-get.test.js` - passed `7/7`.
- `node scripts/testing-manifest/verify.js` - passed.
- `node scripts/testing-manifest/generate-contract-tests.js --check` - passed.
- `node scripts/testing-manifest/generate-suite-coverage.js --check` - passed.
- `node --test test/generated/http-contracts.test.js test/generated/suite-coverage.test.js` - passed `13/13`.
- `npm run test:manifest` - passed `30/30`.
- `npm run test:suite-coverage` - passed `4/4`.
- `npm run lint` - passed.
- `npm run test:contracts` - static/generated contract checks passed, then
  failed only on the known unrelated runtime contract
  `api:http:GET:/discovery/search` returning `500 !== 200`. Existing analytics
  `query.ts` route-registration noise appeared during server startup and is
  unrelated to this route.
- `git diff --check` - passed.
- Package/lockfile guard - no `package.json` or `package-lock.json` diff.
- Changed-file malformed warranty-token scan - no malformed matches.

## Risks / Blockers

- Real payout onboarding support requires durable provider state and a Tipalti
  or equivalent payout-provider integration. Returning a local `url` before that
  exists would misrepresent payout state, so the route intentionally returns
  `501` for authorized owners.
- No schema generation was needed because the route exposes only
  `APIErrorResponse` outcomes.

## Adjacent Routes Intentionally Untouched

- `GET /teams/{team_id}/payouts/{payout_id}/report`
- `POST /teams/{team_id}/stripe/connect/redirect-url`
- Team applications, members, identity verification, billing, payment,
  payout-creation, payout-mutation, guild role subscription, and unrelated
  commerce routes.

## Reconciliation

No reconciliation to current main is needed for this worker: the assigned base
matches `d6b39281ffec5e4addb1370f489c0ab0262529dd`, the integration base named
in the assignment.

## Integration Acceptance

- Accepted into the main checkout on 2026-05-12 from current integration base `df2d44ac1`.
- Ported only the worker-owned route, focused test, and worker progress report; generated artifacts were regenerated from the main checkout.
- Current main missing-route movement after regeneration: `590 -> 589` missing, `590 -> 591` implemented, Discord `1128` unchanged.
- `npm run build:src:tsgo`: passed.
- `npm run generate:openapi`: passed; wrote 482 paths and 1118 schemas with the existing unrelated webhook route metadata warnings.
- `npm run build --workspace @spacebar/automatic-reverse-engineering`: passed.
- Source route catalog import, missing-routes build, and `npm run start --workspace @spacebar/missing-routes`: passed; wrote 589 missing / 591 implemented.
- `npm run generate:testing-manifest`: passed; wrote 696 entries.
- `npm run generate:contract-tests`: passed; wrote 671 contracts.
- `npm run generate:suite-coverage`: passed; wrote 15 suites.
- `npm run build:test-fixtures`: passed.
- `npm run test -- test/routes/teams-param-payouts-onboarding-get.test.ts`: passed, 7 tests.
- `node scripts/testing-manifest/verify.js`: passed, 696 entries.
- `npm run generate:contract-tests -- --check`: passed, 671 contracts.
- `npm run generate:suite-coverage -- --check`: passed.
- `npm run test:manifest`: passed, 30 tests and manifest verify.
- `node --test test/generated/http-contracts.test.js test/contracts/*.test.cjs`: passed, 10 tests.
- `npm run test:suite-coverage`: passed, 4 tests.
- `npm run lint`: passed.
- `git diff --check`: passed.
- Package and lockfile guard: passed; no package or lockfile changes.
- Changed-file AGPL warranty text scan: passed.
- `npm run test:contracts`: failed only on the known unrelated baseline runtime assertion `api:http:GET:/discovery/search` returning `500 !== 200`; generated contract checks passed before that failure.
