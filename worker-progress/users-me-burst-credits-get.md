# GET /users/@me/burst-credits

## Summary

Implemented the assigned `GET /users/@me/burst-credits` route only.

The route is authenticated and returns Spacebar's locally truthful burst-credit balance:

```json
{ "balance": 0 }
```

Spacebar has no durable local burst-credit ledger and the available route evidence does not include a captured Discord response body, so the handler intentionally exposes only a conservative zero balance and does not fabricate Nitro, billing, upload, entitlement, account-credit, or private client metadata.

## Changed Files

- `src/api/routes/users/@me/burst-credits.ts`
- `src/schemas/responses/BurstCreditBalanceResponse.ts`
- `src/schemas/responses/index.ts`
- `test/routes/users-me-burst-credits-get.test.ts`
- `assets/schemas.json`
- `assets/openapi.json`
- `assets/testing-manifest.json`
- `test/generated/http-contracts.json`
- `test/generated/suite-coverage.json`
- `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`
- `packages/missing-routes/missing.json`

## Evidence Gathered

- `packages/missing-routes/missing.json` initially had one assigned missing entry:
  - `GET /users/@me/burst-credits`
  - route name `BURST_CREDIT_BALANCE`
  - source `xhyrom:data/client/routes.json`
- `packages/automatic-reverse-engineering/data/catalogs/routes.xhyrom.catalog.json` has source evidence for:
  - `GET /users/@me/burst-credits`
  - `HEAD /users/@me/burst-credits`
  - `OPTIONS /users/@me/burst-credits`
  - route name `BURST_CREDIT_BALANCE`
- `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json` had no source implementation for the assigned route before this work.
- No Userdoccers source was present for this route in the local missing-route evidence.
- Nearby local patterns used:
  - `src/api/routes/users/@me/virtual-currency/balance.ts` returns a locally backed zero balance when no durable ledger exists.
  - `src/api/routes/users/@me/consumable/confetti.ts` and `src/api/routes/users/@me/consumable/hd-streaming.ts` avoid pretending to mutate or expose unsupported private consumable inventory.
  - `src/api/routes/users/@me/premium-usage.ts` documents narrow locally persisted state instead of fabricating Discord Nitro details.

## Assigned Path And Missing-Route Movement

- Assigned path: `/users/@me/burst-credits`
- Missing methods found: `GET`
- Methods implemented: `GET`
- Generated source route:
  - `GET /users/@me/burst-credits`
  - route name `GET_USERS__ME_BURST_CREDITS`
  - response schemas `APIErrorResponse`, `BurstCreditBalanceResponse`
- Missing-route count moved from `581` to `580`.
- Spacebar implemented-route count moved from `599` to `600`.
- The assigned `GET /users/@me/burst-credits` entry is no longer present in `packages/missing-routes/missing.json`.

## Tests And Verification

Commands run with `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH"`:

- `npm install` - passed; installed missing local dependencies, no `package.json` or `package-lock.json` changes.
- `npm run build:src:tsgo` - passed.
- `npm run generate:schema` - passed.
- `npm run generate:openapi` - passed.
- `npm run build --workspace @spacebar/automatic-reverse-engineering` - passed.
- `npm run build --workspace @spacebar/missing-routes` - passed.
- `node packages/automatic-reverse-engineering/dist/cli.js import-source-routes --root src/api/routes --out packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json` - passed.
- `npm run start --workspace @spacebar/missing-routes` - passed; wrote `missing 580`, `spacebar 600`, `discord 1128`.
- `npm run generate:testing-manifest` - passed.
- `npm run generate:contract-tests` - passed.
- `npm run generate:suite-coverage` - passed.
- `npm run test -- test/routes/users-me-burst-credits-get.test.ts` - passed.
- `npm run build:test-fixtures` - passed.
- `node -r dotenv/config -r module-alias/register --enable-source-maps --test dist-test/test/routes/users-me-burst-credits-get.test.js` - passed.
- `node scripts/testing-manifest/verify.js` - passed.
- `node scripts/testing-manifest/generate-contract-tests.js --check` - passed.
- `node scripts/testing-manifest/generate-suite-coverage.js --check` - passed.
- `node --test test/generated/http-contracts.test.js test/generated/suite-coverage.test.js` - passed.
- `git diff --check` - passed.
- `git diff --exit-code -- package.json package-lock.json` - passed.

## Adjacent Routes Intentionally Untouched

- Did not implement other current-user billing, premium, entitlement, consumable, upload, quota, virtual-currency, or account-credit routes.
- Did not add persistence, migrations, Nitro semantics, billing metadata, or upload quota behavior.
- Did not implement `HEAD` or `OPTIONS`; those are xHyroM-discovered method variants and were outside the assigned `GET` scope.

## Risks And Blockers

- Response-shape risk: local evidence identifies the Discord route and name but does not include a captured Discord response body. The implemented `{ balance: 0 }` shape follows the nearby local balance-route pattern and is intentionally narrow.
- Product behavior risk: clients expecting Discord-private burst-credit metadata beyond a numeric zero balance will not receive it until Spacebar has durable state or stronger source evidence.
- No blockers remain for the assigned route.

## Reconciliation

- This worktree started from integration base `995f3e0ed`.
- Reconciliation to current main may be needed if other workers changed generated route catalogs, schemas, OpenAPI, testing manifest, generated contracts, suite coverage, or `packages/missing-routes/missing.json` after this worker base.

## Recommended Next Tasks

- Merge/reconcile generated artifacts with other route workers.
- If future captured Discord responses or durable Spacebar burst-credit state become available, revisit `BurstCreditBalanceResponse` and the handler to expose that supported shape.

## Integration Acceptance

- Integrated on main server branch at base `5b0c4bdcd`.
- Route movement after main-checkout regeneration: missing `573 -> 572`, implemented `607 -> 608`, Discord `1128`.
- Generated counts after regeneration: `1144` schemas, `498` OpenAPI paths, `713` manifest entries, `688` contracts, `15` suites.
- Focused burst-credit route tests passed in source and built fixtures: `3/3` and `3/3`.
- Generated checks passed: testing manifest verify, generated contract check, generated HTTP contracts, generated suite coverage check, generated suite coverage tests, `git diff --check`, and package/lockfile guard.
- `npm run lint` passed.
- Full `npm run test:contracts` failed only on the known unrelated runtime baseline: `api:http:GET:/discovery/search` returned `500 !== 200`.
