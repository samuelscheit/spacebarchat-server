# DELETE /oauth2/applications/{application_id}/assets/{application_asset_id}

## Summary

Implemented the assigned `DELETE /oauth2/applications/{param}/assets/{param}` route only.

- Added `src/api/routes/oauth2/applications/#application_id/assets/#application_asset_id.ts`.
- Added purpose-named application asset authorization helpers using the documented owner/developer-team boundary.
- Deletes the backing CDN app asset path `/app-assets/{application_id}/{application_asset_id}` after authorization.
- Returns `204` on success, `403` for unauthorized application callers, `404` for unknown applications or missing/malformed application assets, and declares `401/403/404` `APIErrorResponse` metadata.
- Did not implement adjacent `GET/POST /oauth2/applications/{application_id}/assets`, store asset list/upload, storefront, SKU, proxy, or broader asset management routes.

## Changed Files

- `src/api/routes/oauth2/applications/#application_id/assets/#application_asset_id.ts`
- `src/api/util/utility/ApplicationAuthorization.ts`
- `src/api/util/utility/ApplicationAuthorization.test.ts`
- `test/routes/oauth2-application-assets-route.test.ts`
- `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`
- `packages/missing-routes/missing.json`
- `assets/testing-manifest.json`
- `assets/openapi.json`
- `test/generated/http-contracts.json`
- `test/generated/suite-coverage.json`

No `package.json` or `package-lock.json` changes.

## Evidence Gathered

- Confirmed exactly one assigned missing entry before implementation:
    - method `DELETE`
    - route `/oauth2/applications/{param}/assets/{param}`
    - route name `DELETE_OAUTH2_APPLICATIONS_APPLICATION_ID_ASSETS_APPLICATION_ASSET_ID`
    - source route `/oauth2/applications/{application_id}/assets/{application_asset_id}`
- Confirmed `routes.source.catalog.json` initially had no `DELETE /oauth2/applications/{application_id}/assets/{application_asset_id}` entry.
- Confirmed no existing source route under `src/api/routes/oauth2/applications/#application_id/assets`.
- Userdoccers reference used: `https://raw.githubusercontent.com/discord-userdoccers/discord-userdoccers/master/pages/resources/application.mdx`
    - Application Asset object: id string, deprecated type, name.
    - Delete Application Asset: permanently deletes an application asset; user must be owner or developer of owning team; success response is 204 empty.
- xHyroM catalog only lists `GET/HEAD/OPTIONS/POST /oauth2/applications/{application_id}/assets` as `APPLICATION_ASSETS`; no xHyroM DELETE detail route was present.
- Inspected adjacent implementations:
    - OAuth2 application tester delete for 204/403/404 route shape.
    - application authorization helpers for owner/team boundaries.
    - store application asset delete for CDN delete and generated artifact conventions.
    - CDN app-assets route for `/app-assets/{application_id}/{asset_id}` storage behavior.

## Missing-Route Movement

- Worker-base regeneration: `missing_entries = 661 -> 660`.
- Current-base regeneration after merging `codex/merge-ready-prs-20260508` at
  `89c071c60`: `missing = 660 -> 659`, `spacebar = 520 -> 521`,
  `discord = 1128`.
- Assigned route remaining after regeneration: `0`.
- New source catalog entry:
    - `DELETE /oauth2/applications/{application_id}/assets/{application_asset_id}`
    - source `src/api/routes/oauth2/applications/#application_id/assets/#application_asset_id.ts`
    - response schema refs `APIErrorResponse`

## Artifact Status

- Source route catalog regenerated.
- Missing routes regenerated.
- Testing manifest regenerated and verified on current base: `626 entries`.
- HTTP contract matrix regenerated and checked on current base:
  `601 contracts`.
- Suite coverage regenerated and verified.
- OpenAPI regenerated; route is present with bearer security and `204/401/403/404` responses.
- Schemas were not changed, so `npm run generate:schema` was not run.

## Commands Run

- `npm ci` - passed; installed worktree-local dependencies from lockfile.
- `npm run build:src:tsgo` - initially failed before dependency install with `TS2688: Cannot find type definition file for 'node'`; passed after `npm ci`.
- `npm run build --workspace @spacebar/automatic-reverse-engineering` - passed.
- `node packages/automatic-reverse-engineering/dist/cli.js import-source-routes --root src/api/routes --out packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json` - passed.
- `npm run build --workspace @spacebar/missing-routes` - passed.
- `npm run start --workspace @spacebar/missing-routes` - passed; worker-base
  run wrote missing count `660`, current-base run wrote missing count `659`.
- `npm run generate:testing-manifest` - passed; current-base run wrote `626`
  entries.
- `node scripts/testing-manifest/verify.js` - passed; current-base run verified
  `626` entries.
- `node scripts/testing-manifest/generate-contract-tests.js --check` -
  initially stale after the current-base merge, then passed after regeneration.
- `npm run generate:contract-tests` - passed; current-base run wrote `601`
  contracts.
- `node scripts/testing-manifest/generate-suite-coverage.js --check` -
  initially stale after the current-base merge, then passed after regeneration.
- `npm run generate:suite-coverage` - passed.
- `npm run generate:openapi` - passed; existing warnings about webhook routes without route metadata and `Found 3 routes missing a route() middleware`.
- `npm run build:test-fixtures` - passed before and after current-base
  regeneration.
- `node -r dotenv/config -r module-alias/register --enable-source-maps --test dist-test/test/routes/oauth2-application-assets-route.test.js dist-test/src/api/util/utility/ApplicationAuthorization.test.js` - passed, 38 tests.
- `node --test test/generated/http-contracts.test.js test/generated/suite-coverage.test.js` - passed, 13 tests.
- `npm run test:suite-coverage` - passed.
- `npm run test:contracts` - failed in the runtime phase only; static generated contract checks passed first. Exact unrelated failure:
    - `generated HTTP public response-schema contracts match real API responses`
    - `api:http:GET:/discovery/search should return a successful response for schema validation`
    - actual `500`, expected `200`
    - This is unrelated to the assigned OAuth2 asset DELETE route.
- `npm run test:manifest` - passed, 30 tests and manifest verify.
- `npx prettier --check src/api/routes/oauth2/applications/#application_id/assets/#application_asset_id.ts src/api/util/utility/ApplicationAuthorization.ts src/api/util/utility/ApplicationAuthorization.test.ts test/routes/oauth2-application-assets-route.test.ts worker-progress/oauth2-applications-param-assets-param-delete.md` - passed after formatting this report.
- `git diff --check` - passed.
- `git diff -- package.json package-lock.json` - no diff.
- Changed-file malformed warranty scan - passed.
- Project-wide malformed warranty scan - found pre-existing unrelated malformed warranty lines in untouched files; not changed due the no-boilerplate-churn scope rule.

## Risks And Notes

- Spacebar does not currently persist a first-class application asset catalog, so this implementation authorizes against the application and deletes the corresponding CDN app-asset object directly.
- Missing CDN storage errors are mapped to `Unknown Application Asset`; other CDN failures are allowed to propagate.
- The route accepts extension-style asset IDs for CDN compatibility by normalizing the final extension before deletion.
- No gateway events or audit log side effects were found for this Userdoccers route.

## Completion Audit

- Assigned missing entry confirmed: done.
- Absence in source catalog and routes confirmed: done.
- Userdoccers/xHyroM compared only for route semantics and adjacent evidence: done.
- Production route implemented for exact assigned DELETE path: done.
- Focused tests added and passing: done.
- Source catalog, missing report, testing manifest, generated HTTP contracts, suite coverage, and OpenAPI regenerated: done.
- Schema generation not run because schemas did not change.
- Package/lockfile guard clean: done.
- Diff whitespace guard clean: done.
- Progress report updated: done.

## Recommended Next Tasks

- Implement adjacent `GET/POST /oauth2/applications/{application_id}/assets` only in separate assigned work.
- Investigate the pre-existing runtime contract failure for `GET /discovery/search` outside this worker scope.
- Triage existing unrelated malformed warranty lines separately if the orchestrator wants a repo-wide license cleanup pass.
