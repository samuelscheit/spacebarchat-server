# Summary

Implemented `GET /applications/{param}/branches/{param}/builds/live` as an authenticated application developer resource at `GET /applications/:application_id/branches/:branch_id/builds/live/`.

The route reuses existing application branch access authorization, exposes `platform` and `locale` query metadata, declares `200/400/401/404` response metadata, and returns a source-compatible `404` `Unknown build` response when Spacebar has no live-build persistence instead of fabricating build IDs, manifests, or URLs.

# Assigned Path

- Assigned path: `/applications/{param}/branches/{param}/builds/live`
- Missing methods found: `GET` only, route name `APPLICATION_LIVE_BUILD`
- Methods implemented: `GET`
- Source route owned: `/applications/{application_id}/branches/{param}/builds/live`

# Changed Files

- `src/api/routes/applications/#application_id/branches/#branch_id/builds/live.ts`
- `src/api/routes/applications/#application_id/branches.test.ts`
- `src/schemas/responses/ApplicationLiveBuildResponse.ts`
- `src/schemas/responses/index.ts`
- `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`
- `packages/missing-routes/missing.json`
- `assets/schemas.json`
- `assets/testing-manifest.json`
- `assets/openapi.json`
- `test/generated/http-contracts.json`
- `test/generated/suite-coverage.json`
- `worker-progress/applications-param-branches-param-builds-live-get.md`

# What Changed

- Added `ApplicationLiveBuildResponse` with required `id` and `manifests[]`, matching the current Discord client access pattern.
- Added a nested route file for `/applications/:application_id/branches/:branch_id/builds/live/`.
- Added an injectable `liveBuildRepository` lookup seam for future persistence and tests; production default returns `404 Unknown build` after authorization because Spacebar has no branch/build storage entities.
- Added focused route/helper tests for owner success through injected live-build data, no-persistence 404 behavior, unauthorized lookup suppression, mounted 404 behavior, and query propagation.
- Regenerated route source catalog, missing-route report, schemas, testing manifest, generated HTTP contracts, suite coverage, and OpenAPI.

# Evidence Gathered

- Confirmed the assigned missing entry existed in `packages/missing-routes/missing.json` before implementation:
  - `GET /applications/{param}/branches/{param}/builds/live`
  - `APPLICATION_LIVE_BUILD`
  - source `xhyrom:data/client/routes.json`
- Confirmed route was absent from `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json` and from `src/api/routes/**` before implementation.
- Confirmed xHyroM route catalog includes `GET`, `HEAD`, and `OPTIONS` entries for `/applications/{application_id}/branches/{param}/builds/live`; assignment owned only `GET`.
- Confirmed current source catalog now includes:
  - `GET /applications/{application_id}/branches/{branch_id}/builds/live`
  - response schemas `APIErrorResponse` and `ApplicationLiveBuildResponse`
- Confirmed `packages/missing-routes/missing.json` no longer contains the assigned route.
- Confirmed generated OpenAPI has bearer security, `platform` and `locale` query parameters, `ApplicationLiveBuildResponse` for `200`, and `APIErrorResponse` for `400/401/404`.

# Userdoccers/xHyroM References Used

- xHyroM local catalog: `packages/automatic-reverse-engineering/data/catalogs/routes.xhyrom.catalog.json` lines 364-377 for `APPLICATION_LIVE_BUILD`.
- Userdoccers local catalog: `packages/automatic-reverse-engineering/data/catalogs/routes.userdoccers.catalog.json`; no matching live-build route found.
- Userdoccers upstream page checked: `https://raw.githubusercontent.com/discord-userdoccers/discord-userdoccers/master/pages/resources/application.mdx`; no matching branch live-build route found.
- Current Discord client bundle evidence from `/tmp/discord-app.RrlPmS/web.c0ce558aa0aa6a32.js`:
  - route builder uses `/applications/${applicationId}/branches/${branchId}/builds/live`
  - request sends `platform` and `locale`
  - client treats HTTP `404` as build not found and also treats a `200` response with empty `manifests` as build not found
  - application branch objects map `live_build_id` to `liveBuildId`
- Detritus REST endpoint reference in `/tmp/detritus-rest.vEzNGo/package/lib/endpoints.js` confirms `/applications/:applicationId/branches/:branchId/builds/live`.
- Spacebar local authorization reference: `src/api/util/utility/ApplicationAuthorization.ts` `requireApplicationBranchAccess` and existing `GET /applications/:application_id/branches` route/tests.

# Missing-Route Count Movement

- Before regeneration: `missing: 829`, `spacebar: 351`, `discord: 1128`
- After regeneration: `missing: 828`, `spacebar: 352`, `discord: 1128`
- Assigned route removed from both `routes[]` and `missing_entries[]`.
- Orchestrator current-base integration: after replaying the scoped source/test
  changes onto `7213cb1aa` and regenerating artifacts, `missing` is 825 and
  `spacebar` is 355 with no remaining
  `/applications/{param}/branches/{param}/builds/live` entries.

# Commands Run

- `if [ -L node_modules ]; then unlink node_modules; fi`
- `if [ ! -d node_modules ]; then npm ci; fi`
- `npx prettier --write src/api/routes/applications/#application_id/branches.test.ts src/api/routes/applications/#application_id/branches/#branch_id/builds/live.ts src/schemas/responses/ApplicationLiveBuildResponse.ts src/schemas/responses/index.ts`
- `npm run build:src:tsgo`
- `npm run build:test-fixtures`
- `node -r dotenv/config -r module-alias/register --enable-source-maps --test 'dist-test/src/api/routes/applications/#application_id/branches.test.js'`
- `npm run build --workspace @spacebar/automatic-reverse-engineering`
- `node packages/automatic-reverse-engineering/dist/cli.js import-source-routes --root src/api/routes --out packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`
- `npm run build --workspace @spacebar/missing-routes`
- `npm run start --workspace @spacebar/missing-routes`
- `npm run generate:schema`
- `npm run generate:testing-manifest`
- `node scripts/testing-manifest/verify.js`
- `node scripts/testing-manifest/generate-contract-tests.js --check` (reported stale before regeneration)
- `npm run generate:contract-tests`
- `node scripts/testing-manifest/generate-contract-tests.js --check`
- `node scripts/testing-manifest/generate-suite-coverage.js --check` (reported stale before regeneration)
- `npm run generate:suite-coverage`
- `node scripts/testing-manifest/generate-suite-coverage.js --check`
- `npm run generate:openapi`
- `git diff --check`
- changed-file malformed AGPL warranty token scan using the orchestrator-provided pattern

# Verification Results

- Source build passed.
- Test fixture build passed.
- Focused compiled route tests passed: 10 tests, 0 failures.
- Source route catalog regenerated.
- Missing-route report regenerated and assigned route disappeared.
- Schema generation passed.
- Testing manifest verified with 457 entries.
- Generated HTTP contracts verified with 432 contracts after regeneration.
- Suite coverage verified after regeneration.
- OpenAPI regenerated with 277 paths and 701 schemas.
- `git diff --check` passed.
- Malformed AGPL warranty token scan passed for changed files.

# Risks Or Blockers

- Spacebar does not currently have application branch/build/live-build persistence. The route therefore cannot return a real live build without future storage and upload/publish implementation.
- The conservative runtime behavior is to authenticate, authorize against the application branch access boundary, and return `404 Unknown build` when no live build can be found.
- No adjacent branch creation/list update, build upload/publish/size, store, SKU, gift, or application management routes were implemented.

# Recommended Next Tasks

- If assigned separately, implement real application branch and build persistence, then wire the `liveBuildRepository` lookup to stored live build data.
- If assigned separately, implement build upload/publish and build-size routes using the same ownership boundary and real persisted build metadata.
- Add broader runtime contract coverage once real live-build fixtures exist.

# Goal Status Evidence

- `create_goal` objective: implement the missing route path `GET /applications/{param}/branches/{param}/builds/live` for the Spacebar server API.
- Initial `get_goal` after creation: status `active`, objective matched the assigned route.
- Final pre-handoff `get_goal`: status `active`, same objective, before calling `update_goal(status: "complete")`.
