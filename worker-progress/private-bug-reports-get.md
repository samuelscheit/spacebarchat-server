# GET /private/bug-reports

## Summary

Implemented only `GET /private/bug-reports`.

The endpoint is authenticated and returns the current user's locally supported
private bug-report listing. Spacebar has no durable private bug-report
submission/listing table or checked-in response captures for this endpoint, so
the implemented representation is an empty `PrivateBugReportsResponse` array
instead of fabricated bug-report, attachment, staff, tracker, or moderation
state.

`POST /private/bug-reports` and adjacent reporting/trust/safety routes were not
implemented.

## Changed Files

- `src/api/routes/private/bug-reports.ts`
- `src/schemas/responses/PrivateBugReportsResponse.ts`
- `src/schemas/responses/index.ts`
- `test/routes/private-bug-reports-get.test.ts`
- `assets/schemas.json`
- `assets/openapi.json`
- `assets/testing-manifest.json`
- `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`
- `packages/missing-routes/missing.json`
- `test/generated/http-contracts.json`

## Evidence Gathered

- `packages/missing-routes/missing.json` initially listed both `GET` and `POST`
  for `/private/bug-reports`; assignment covered only `GET`.
- `packages/automatic-reverse-engineering/data/catalogs/routes.xhyrom.catalog.json`
  lists `GET`, `HEAD`, `OPTIONS`, and `POST` for `/private/bug-reports` with
  route name `BUG_REPORTS`.
- `packages/automatic-reverse-engineering/data/catalogs/routes.userdoccers.catalog.json`
  has no bug-report route entries.
- `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`
  had no `/private/bug-reports` implementation before this change.
- Local compatibility patterns used:
    - `src/api/routes/users/@me/harvest.ts` for unsupported private current-user
      state without fabricating records.
    - `src/api/routes/users/@me/scheduled-messages.ts` and
      `src/api/routes/search/favorites.ts` for empty locally backed current-user
      collections when persistence is absent.
    - `src/api/routes/reporting/index.ts` for nearby reporting scope, which was
      intentionally left untouched.

## Behavior

- `GET /private/bug-reports`
    - Auth: bearer required.
    - Response: `200 []`.
    - Metadata responses: `200 PrivateBugReportsResponse`, `401 APIErrorResponse`.
- `POST /private/bug-reports`
    - Still missing and unimplemented.
- Reporting mutations, `/reporting/*` routes, trust/safety routes, private admin
  routes, bug-report attachments, billing/Nitro, and unrelated current-user
  routes were not changed.

## Missing-Route Movement

- Before regeneration on this worker base: `missing = 561`, `spacebar = 619`.
- After regeneration: `missing = 560`, `spacebar = 620`.
- Removed missing entry: `GET /private/bug-reports`.
- Remaining assigned-path entry: `POST /private/bug-reports`.

## Commands Run

- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run build:src:tsgo`
    - First attempt failed because dependencies were not installed and `tsgo` was
      missing.
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm ci`
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run build:src:tsgo`
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run generate:schema`
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run generate:openapi`
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run build --workspace @spacebar/automatic-reverse-engineering`
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" node packages/automatic-reverse-engineering/dist/cli.js import-source-routes --root src/api/routes --out packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run build --workspace @spacebar/missing-routes`
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run start --workspace @spacebar/missing-routes`
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run generate:testing-manifest`
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run generate:contract-tests`
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run generate:suite-coverage`
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run build:test-fixtures`
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" node -r dotenv/config -r module-alias/register --enable-source-maps --test dist-test/test/routes/private-bug-reports-get.test.js`
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" node scripts/testing-manifest/verify.js`
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run test:suite-coverage`
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run test:contracts`
    - Generated contract matrix checks passed.
    - Runtime phase failed only on known unrelated
      `api:http:GET:/discovery/search` public response-schema assertion:
      `500 !== 200`.
- `git diff -- package.json package-lock.json`
    - No package or lockfile changes.
- License typo guard on the route, schema, and focused test files had no
  matches.
- `git diff --check`

## Risks And Notes

- xHyroM provides only the route path/name for this endpoint; no checked-in
  source gives Discord's private response shape. The empty array is intentionally
  conservative and source-truthful for Spacebar's current persistence model.
- If Spacebar later adds durable bug-report submission/listing state, this route
  should expose only records visible to `req.user_id` and avoid staff/private
  moderation fields unless explicitly modeled.
- `npm ci` was required because the worktree had no installed `tsgo`; it did not
  modify `package.json` or `package-lock.json`.

## Reconciliation

Worker implementation started on assigned base `771e08950`.

## Integration Notes

- Reconciled onto current integration base `f14236472`.
- Regenerated current-base schema/OpenAPI, source route catalog, missing-route
  report, testing manifest, generated HTTP contracts, and suite coverage.
- Current-base missing-route movement: `missing = 559 -> 558`,
  `spacebar = 621 -> 622`, `discord = 1128`.
- Focused route tests, manifest verification, generated contract check,
  generated suite coverage check, manifest tests, suite coverage tests,
  targeted ESLint, Prettier check, `git diff --check`, package/lockfile guard,
  and license typo guard passed.
- `npm run test:contracts` failed only on the known unrelated runtime contract:
  `api:http:GET:/discovery/search` returned `500 !== 200`.
