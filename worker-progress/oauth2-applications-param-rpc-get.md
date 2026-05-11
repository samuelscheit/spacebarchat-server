# GET /oauth2/applications/{application_id}/rpc

## Summary

Implemented only the assigned `GET /oauth2/applications/{param}/rpc` missing
route as the OAuth2-prefixed alias for the existing public application RPC
projection.

- Added `src/api/routes/oauth2/applications/#application_id/rpc.ts`.
- Moved the shared application RPC lookup/projection into
  `src/api/util/utility/ApplicationRpc.ts`.
- Kept `/applications/{application_id}/rpc` behavior unchanged by reusing the
  shared helper.
- Marked only `GET`/`HEAD /oauth2/applications/{application_id}/rpc` public in
  `NoAuthorizationRoutes`.
- Did not implement adjacent OAuth2 application routes, token management,
  assets, allowlists, verification, or bot management.

## Changed Files

- `src/api/routes/oauth2/applications/#application_id/rpc.ts`
- `src/api/util/utility/ApplicationRpc.ts`
- `src/api/routes/applications/#application_id/rpc.ts`
- `src/api/middlewares/NoAuthorizationRoutes.ts`
- `test/routes/oauth2-application-rpc.test.ts`
- `test/routes/applications-rpc.test.ts`
- `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`
- `packages/missing-routes/missing.json`
- `assets/openapi.json`
- `assets/testing-manifest.json`
- `test/generated/http-contracts.json`
- `test/generated/suite-coverage.json`

## Evidence Gathered

- Current base before this merge was `28bd25c4b`.
- `packages/missing-routes/missing.json` contained the assigned missing entry:
  `GET /oauth2/applications/{param}/rpc`, route name `APPLICATION_RPC`, source
  `xhyrom:data/client/routes.json`.
- `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`
  did not contain `GET /oauth2/applications/{application_id}/rpc` before the
  route was added.
- Existing `GET /applications/{application_id}/rpc` already implemented the
  same public, locally backed `ApplicationRpcResponse` projection.
- The OAuth2 alias now returns the same projection and fails closed with
  `UNKNOWN_APPLICATION` when no local application exists.

## Missing-Route Movement

- Current-base missing count moved from `632` to `631`.
- Current-base implemented count moved from `548` to `549`.
- Current Discord target count remained `1128`.
- The assigned `GET /oauth2/applications/{param}/rpc` entry is no longer present
  in `missing_entries[]`.
- The source catalog now contains `GET /oauth2/applications/{application_id}/rpc`.

## Artifact Status

- Source route catalog regenerated.
- Missing-route report regenerated.
- Testing manifest regenerated and verified with `654` entries.
- Generated HTTP contract matrix regenerated and verified with `629` contracts.
- Suite coverage regenerated and verified.
- OpenAPI regenerated with `444` paths and `1039` schemas.
- Schemas were not regenerated because no schema definitions changed.

## Commands Run

- `npm run build:src:tsgo` - passed.
- `npm run build --workspace @spacebar/automatic-reverse-engineering` - passed.
- `node packages/automatic-reverse-engineering/dist/cli.js import-source-routes --root src/api/routes --out packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json` - passed.
- `npm run build --workspace @spacebar/missing-routes` - passed.
- `npm run start --workspace @spacebar/missing-routes` - passed.
- `npm run generate:testing-manifest` - passed.
- `node scripts/testing-manifest/verify.js` - passed.
- `npm run generate:contract-tests` - passed.
- `node scripts/testing-manifest/generate-contract-tests.js --check` - passed.
- `npm run generate:suite-coverage` - passed.
- `node scripts/testing-manifest/generate-suite-coverage.js --check` - passed.
- `npm run generate:openapi` - passed; existing webhook route metadata warnings
  remain unrelated.
- `npm run build:test-fixtures` - passed.
- `node -r dotenv/config -r module-alias/register --enable-source-maps --test dist-test/test/routes/applications-rpc.test.js dist-test/test/routes/oauth2-application-rpc.test.js` - passed, 14 tests.
- `node --test test/generated/http-contracts.test.js` - passed, 9 tests.
- `node --test test/generated/suite-coverage.test.js` - passed, 4 tests.
- `npm run test:manifest` - passed, manifest verified with 654 entries.
- `npm run test:suite-coverage` - passed.
- `npm run lint` - passed.
- `npm run test:contracts` - static/generated contract checks passed; runtime
  failed only on the known unrelated `api:http:GET:/discovery/search` returning
  `500` instead of `200`. Existing analytics `query.ts` route-registration
  noise remained unrelated.
- `git diff --check` - passed.
- `git diff -- package.json package-lock.json && git status --short package.json package-lock.json` - passed with no package or lockfile changes.
- Changed-file malformed warranty-token scan - passed with no matches.

## Risks And Blockers

- The route only returns locally persisted application RPC data. It does not
  fabricate Discord-only RPC state that Spacebar does not store.
- The full runtime contract suite still has the pre-existing unrelated
  `GET /discovery/search` failure.

## Prompt-To-Artifact Audit

- Confirmed the missing OAuth2 RPC entry and absence from source catalog/routes.
- Compared xHyroM route evidence and existing Spacebar application RPC behavior.
- Implemented only `GET /oauth2/applications/{application_id}/rpc`.
- Shared the existing application lookup, response projection, and
  unknown-application behavior.
- Added focused route, no-auth, and generated-artifact tests.
- Regenerated source catalog, missing report, testing manifest, OpenAPI,
  contract matrix, and suite coverage on the current base.

## Recommended Next Tasks

- Investigate the unrelated generated runtime contract failure for public
  `GET /discovery/search`.
- Audit the next completed worker with a narrow, complete handoff.
