# POST /billing/popup-bridge/{param}/callback

## Summary

Implemented only the assigned authenticated `POST /billing/popup-bridge/{payment_source_type}/callback` route with route name `POST_BILLING_POPUP_BRIDGE_PAYMENT_SOURCE_TYPE_CALLBACK`.

The route validates the documented callback body (`state`, `path`, optional string-map `query`, optional `insecure`) and stays behind bearer authentication. Because Spacebar does not currently persist local popup bridge state or provider callback verification data, the default handler fails closed with `501` instead of accepting unverifiable billing callbacks. A typed injectable handler path is present for future local provider support and focused testing.

## Changed Files

- `src/api/routes/billing/popup-bridge/#payment_source_type/callback.ts`
- `src/api/routes/billing/popup-bridge/#payment_source_type/callback.test.ts`
- `src/schemas/uncategorised/BillingPopupBridgeCallbackSchema.ts`
- `src/schemas/uncategorised/index.ts`
- `tsconfig.test.json`
- `assets/schemas.json`
- `assets/openapi.json`
- `assets/testing-manifest.json`
- `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`
- `packages/missing-routes/missing.json`
- `test/generated/http-contracts.json`

## Commands Run

- `npm ci`
- `npm run build:src:tsgo`
- `npm run generate:schema`
- `npm run build --workspace @spacebar/automatic-reverse-engineering`
- `npm run generate:openapi`
- `node packages/automatic-reverse-engineering/dist/cli.js import-source-routes --root src/api/routes --out packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`
- `npm run build --workspace @spacebar/missing-routes`
- `npm run generate:testing-manifest`
- `npm run start --workspace @spacebar/missing-routes`
- `npm run generate:contract-tests`
- `npm run generate:suite-coverage`
- `npm run build:test-fixtures`
- `node -r dotenv/config -r module-alias/register --enable-source-maps --test 'dist-test/src/api/routes/billing/popup-bridge/#payment_source_type/callback.test.js'`
- `npm run test:manifest`
- `npm run test:suite-coverage`
- `npm run test:contracts`
- `npx eslint 'src/api/routes/billing/popup-bridge/#payment_source_type/callback.ts' 'src/api/routes/billing/popup-bridge/#payment_source_type/callback.test.ts' src/schemas/uncategorised/BillingPopupBridgeCallbackSchema.ts src/schemas/uncategorised/index.ts`
- `git diff --check`
- `git diff -- package.json package-lock.json`

## Verification Results

- Focused route test passed: 6 tests, 0 failures.
- `npm run build:src:tsgo` passed.
- `npm run build:test-fixtures` passed.
- `npm run test:manifest` passed and verified 759 entries.
- `npm run test:suite-coverage` passed.
- Targeted ESLint passed for touched TypeScript route/schema files.
- `git diff --check` passed.
- Package/lockfile guard showed no package manifest or lockfile diff.
- `npm run test:contracts` passed generated contract matrix checks but failed in the runtime phase only on the known unrelated `api:http:GET:/discovery/search` public response-schema case: `500 !== 200`.

## Missing-Route Movement

- Before regeneration: `Spacebar is missing 527`, `Spacebar implements 653`.
- After regeneration: `Spacebar is missing 526`, `Spacebar implements 654`, `Discord implements 1128`.
- Assigned path: `/billing/popup-bridge/{param}/callback`.
- Missing methods found for assigned path: `POST`.
- Methods implemented for assigned path: `POST`.
- Assigned `POST /billing/popup-bridge/{param}/callback` is no longer present in `packages/missing-routes/missing.json`.
- Adjacent missing routes remain untouched:
  - `POST /billing/popup-bridge/{param}`
  - `GET /billing/popup-bridge/{param}/callback/{param}/{param}`

## Evidence Sources

- Worker brief: `/Users/user/Developer/Developer/spacebarchat/WORKER_BRIEF.md`.
- Userdoccers catalog source: `packages/automatic-reverse-engineering/data/catalogs/routes.userdoccers.catalog.json` lists `POST /billing/popup-bridge/{payment_source_type}/callback` with route name `POST_BILLING_POPUP_BRIDGE_PAYMENT_SOURCE_TYPE_CALLBACK`.
- Userdoccers upstream reference: `https://github.com/discord-userdoccers/discord-userdoccers/tree/master/pages/resources/billing.mdx`.
- xHyroM catalog source: `packages/automatic-reverse-engineering/data/catalogs/routes.xhyrom.catalog.json` lists `/billing/popup-bridge/{param}/callback` as `BILLING_POPUP_BRIDGE_CALLBACK`.
- Source catalog now includes `POST_BILLING_POPUP_BRIDGE_PAYMENT_SOURCE_TYPE_CALLBACK` at `src/api/routes/billing/popup-bridge/#payment_source_type/callback.ts`.
- OpenAPI exposes `/billing/popup-bridge/{payment_source_type}/callback/` with bearer security, `BillingPopupBridgeCallbackSchema`, and `204/400/401/501` responses.
- Testing manifest entry `api:http:POST:/billing/popup-bridge/:payment_source_type/callback/` is bearer-authenticated and has schema/auth/response-shape contract coverage.
- Generated contract cases for this route are auth boundary, malformed auth, invalid body, response shape, status/error shape, and policy auth boundary.
- No event metadata is declared for this route because the fail-closed default does not emit a gateway event.

## Completion Audit

- Exact assigned route: `src/api/routes/billing/popup-bridge/#payment_source_type/callback.ts` declares only `router.post("/")`.
- Exact assigned route name: source catalog entry is `POST_BILLING_POPUP_BRIDGE_PAYMENT_SOURCE_TYPE_CALLBACK`.
- Method-scoped assignment: route source has no `router.get`, `router.put`, `router.patch`, or `router.delete`; sibling missing-route entries remain present.
- Request schema: `BillingPopupBridgeCallbackSchema` requires `state` and `path`, rejects extra fields, and allows optional string-map `query` plus optional boolean `insecure`.
- Auth boundary: testing manifest reports `authMode: "bearer"` and focused tests assert the route is not in the no-auth list.
- Locally truthful behavior: default handler returns `501` with an API error because durable popup bridge state and provider callback verification are absent.
- Future provider hook: injected handler path normalizes `paymentSourceType`, `userId`, body fields, `insecure`, and a plain-object `query`, then returns `204`.
- Generated artifacts: schemas, OpenAPI, source catalog, missing-route report, testing manifest, generated HTTP contracts, and suite coverage were regenerated and inspected.
- Verification gates: source build, test fixture build, focused test, manifest test, suite coverage test, targeted ESLint, diff check, and package/lockfile guard passed.
- Known unrelated blocker: generated contract runtime still fails only at `api:http:GET:/discovery/search` with `500 !== 200`.

## Risks And Blockers

- Real billing popup callback completion still needs durable popup bridge state, provider callback verification, and payment-source reconciliation before returning `204` in production.
- The broader contract suite remains blocked by the unrelated `GET /discovery/search` runtime `500`.

## Recommended Next Tasks

- Design durable popup bridge state storage and provider callback verification before enabling production `204` behavior.
- Separately investigate the existing `GET /discovery/search` runtime contract failure.

## Reconciliation Notes

- Added the focused route test to `tsconfig.test.json` so it compiles into `dist-test`.
- Normalized the validated callback `query` map into a plain object before calling injected handlers.
- Regenerated schema, OpenAPI, source catalog, missing-route, testing manifest, contract, and suite coverage artifacts.
- `npm ci` restored local `node_modules`; package manifests and lockfiles are unchanged.
- During main-branch acceptance, the generated-artifact focused test was narrowed
  to assert only that the assigned POST callback route is implemented. It no
  longer asserts adjacent popup-bridge routes remain missing, so future sibling
  implementations will not break this route's focused test.
