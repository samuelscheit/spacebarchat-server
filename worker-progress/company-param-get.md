# Company Param GET Worker Report

## Summary

Implemented `GET /company/{param}` as `GET /company/{company_id}`. The route is authenticated, documents the Company object shape `{ id, name }`, records `200`, `401`, and `404` response metadata, and fails closed with `404` by default because Spacebar has no dedicated Company persistence model.

## Assigned Path

- Assigned path: `/company/{param}`
- Missing methods found at start: `GET /company/{param}` (`GET_COMPANY_COMPANY_ID`)
- Methods implemented: `GET /company/{company_id}`
- Scope intentionally not implemented: `/companies`, `/teams/{param}/companies`, team CRUD/member/payout routes, applications, application directory, store, and organization routes.

## Changed Files

- `src/api/routes/company/#company_id.ts`
- `src/schemas/responses/CompanyResponse.ts`
- `src/schemas/responses/index.ts`
- `test/routes/company-get.test.ts`
- `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`
- `packages/missing-routes/missing.json`
- `assets/schemas.json`
- `assets/testing-manifest.json`
- `assets/openapi.json`
- `test/generated/http-contracts.json`

## What Changed

- Added a route factory and default router for `GET /company/:company_id/`.
- Added `CompanyResponse` schema with required `id` and `name`.
- Implemented an injectable minimal company lookup with no production backing by default, so the route does not expose unrelated local team rows as companies.
- Added explicit `UNKNOWN_COMPANY_ERROR` returning HTTP 404 with API error body.
- Added focused compiled route tests for serialization, injected repository lookup, not-found behavior, mounted success response with injected backing, mounted 404 response, and default fail-closed behavior with no production backing configured.
- Regenerated route source catalog, missing-route report, schema assets, testing manifest, HTTP contract matrix, and OpenAPI.

## Evidence Gathered

- `packages/missing-routes/missing.json` initially contained exactly one assigned entry: `GET /company/{param}` / `GET_COMPANY_COMPANY_ID`.
- `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json` and `src/api/routes/**` initially had no company route implementation.
- Local Userdoccers catalog contains `GET /company/{company_id}` from `userdoccers:resources/team.mdx` with summary `Get Company`.
- Upstream Userdoccers source used: `https://raw.githubusercontent.com/discord-userdoccers/discord-userdoccers/master/pages/resources/team.mdx`
- Userdoccers source describes Company as a game development/publishing company and documents the Company object with only `id` and `name`.
- Userdoccers source documents Search Companies and Get Company without a route-specific permission statement, so the implementation keeps bearer auth and returns only minimal public-compatible fields.
- `packages/automatic-reverse-engineering/data/catalogs/routes.xhyrom.catalog.json` has no `GET_COMPANY_COMPANY_ID` entry.
- `packages/automatic-reverse-engineering/data/catalogs/source-refs.json`: `userdoccers_commit` `259d8f8cf97ff357c4d1255afdf30e2e05672742`, `xhyrom_routes_commit` `0d792408fc6f5f67140fe1b4cad48b386ae1fd44`.
- Current Spacebar persistence has `Team` and `TeamMember` entities but no dedicated Company entity; the accepted implementation therefore does not map arbitrary teams to companies.

## Missing-Route Movement

- Before regeneration: `missing = 833`
- After regeneration: `missing = 832`
- Assigned entry after regeneration: absent from `missing_entries[]`
- New source catalog entry: `GET /company/{company_id}`, route name `GET_COMPANY_COMPANY_ID`, response refs `APIErrorResponse` and `CompanyResponse`.

## Commands Run

- `if [ -L node_modules ]; then unlink node_modules; fi; if [ ! -d node_modules ]; then npm ci; fi`
- Research: `rg`, `jq`, and `sed` against `packages/missing-routes/missing.json`, source/Userdoccers/xHyroM route catalogs, `source-refs.json`, `src/api/routes/**`, team/application entities, team route patterns, route metadata helpers, schema exports, and OpenAPI/testing-manifest generators.
- `npm run build:src:tsgo`
- `npm run build:test-fixtures`
- `node -r dotenv/config -r module-alias/register --enable-source-maps --test dist-test/test/routes/company-get.test.js`
- `npm run build --workspace @spacebar/automatic-reverse-engineering`
- `node packages/automatic-reverse-engineering/dist/cli.js import-source-routes --root src/api/routes --out packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`
- `npm run build --workspace @spacebar/missing-routes`
- `npm run start --workspace @spacebar/missing-routes`
- `npm run generate:schema`
- `npm run generate:testing-manifest`
- `node scripts/testing-manifest/verify.js`
- `node scripts/testing-manifest/generate-contract-tests.js --check` (first run found stale contracts after manifest regeneration)
- `npm run generate:contract-tests`
- `node scripts/testing-manifest/generate-contract-tests.js --check`
- `node scripts/testing-manifest/generate-suite-coverage.js --check`
- `npm run generate:openapi`
- `npx prettier --write src/api/routes/company/#company_id.ts src/schemas/responses/CompanyResponse.ts src/schemas/responses/index.ts test/routes/company-get.test.ts`
- Re-ran `npm run build:src:tsgo`
- Re-ran `npm run build:test-fixtures`
- Re-ran `node -r dotenv/config -r module-alias/register --enable-source-maps --test dist-test/test/routes/company-get.test.js`
- Re-ran `node scripts/testing-manifest/verify.js`
- Re-ran `node scripts/testing-manifest/generate-contract-tests.js --check`
- Re-ran `node scripts/testing-manifest/generate-suite-coverage.js --check`
- `git diff --check`
- Malformed warranty-token scan over changed files using the required pattern from the worker brief.

## Verification Results

- `npm run build:src:tsgo`: passed.
- `npm run build:test-fixtures`: passed.
- Focused compiled test `dist-test/test/routes/company-get.test.js`: passed, 6 tests after orchestrator audit added the default fail-closed regression case.
- Automatic reverse engineering workspace build: passed.
- Missing-routes workspace build and report generation: passed.
- `npm run generate:schema`: passed; `CompanyResponse` generated.
- `npm run generate:testing-manifest`: passed; manifest now has 453 entries.
- `node scripts/testing-manifest/verify.js`: passed.
- HTTP contract generation/check: regenerated to 428 contracts; check passed.
- Suite coverage check: passed.
- `npm run generate:openapi`: passed; OpenAPI now has `/company/{company_id}/` with bearer security and `CompanyResponse`.
- `git diff --check`: passed.
- Warranty-token scan over changed files: no malformed tokens found.

## Risks Or Blockers

- No blocker remains for this assigned route.
- Compatibility risk: Spacebar lacks a dedicated Company table/model, so production requests currently return `404` until a real Company backing model exists. The route has an injectable lookup boundary for future backing.
- The not-found error uses local `Unknown Company` with code `404` because the local Discord error catalog does not define an Unknown Company code.

## Recommended Next Tasks

- Implement `/companies` search only as a separate assigned route if needed.
- Implement `/teams/{param}/companies` creation only as a separate assigned route if needed.
- Consider a dedicated Company entity/migration if broader company creation/search semantics are assigned later.

## Goal Status Evidence

- `create_goal` objective: `implement the missing route path \`GET /company/{param}\` for the Spacebar server API.`
- Initial `get_goal` status: `active`
- Final pre-report `get_goal` status: `active`
- Final pre-report `get_goal` objective: `implement the missing route path \`GET /company/{param}\` for the Spacebar server API.`
