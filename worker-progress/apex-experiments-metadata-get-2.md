# Worker Progress: apex-experiments-metadata-get-2

## Goal
- Status: active
- Objective: Implement production-ready support for the missing route path `/apex/experiments/metadata` on the current integration branch, with focused tests, regenerated route catalogs and generated route artifacts, verification evidence, and a complete handoff report.

## Research
- `packages/missing-routes/missing.json` has exactly one owned entry: `GET /apex/experiments/metadata`.
- The exact route was absent from `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json` and `src/api/routes/**`; it only appeared in Userdoccers-derived catalogs.
- Userdoccers documents `GET /apex/experiments/metadata` as employee-only, with `surface` integer query parameter and a response body shaped as `{ experiments: ApexExperimentMetadata[] }`.
- Spacebar has no upstream-backed Apex metadata persistence/catalog today; implementation will return an empty metadata list instead of fabricating Discord experiment data.

## Handoff Report

### Summary
- Implemented `GET /apex/experiments/metadata` in `src/api/routes/apex/experiments.ts`.
- Auth mode is bearer-authenticated with `right: "OPERATOR"` to model Userdoccers' employee-only behavior.
- Response is conservative and truthful: `{ "experiments": [] }` via `ApexExperimentsMetadataResponse`, because Spacebar has no live upstream Apex metadata catalog.
- Fixed the shared `route({ right })`/`permissionOrRight` handling bug that caused non-operators on OPERATOR-gated routes to get a 500 `BITFIELD_INVALID` instead of a 403 API error.
- Regenerated schemas, OpenAPI, source route catalog, missing-route report, testing manifest, and generated HTTP contract matrix.

### Assigned Path And Methods
- Assigned path: `/apex/experiments/metadata`
- Missing methods found: `GET`
- Methods implemented: `GET`
- Adjacent paths intentionally not implemented: `/apex/experiments`, experiment assignments, population lookups, and non-metadata endpoints.
- Worker implementation moved the missing-route count from `775 -> 774`; current-base integration moved it from `772 -> 771`. `GET /apex/experiments/metadata` is no longer present in `packages/missing-routes/missing.json`.

### Changed Files
- `src/api/routes/apex/experiments.ts`
- `src/api/util/utility/Experiments.ts`
- `src/api/util/utility/Experiments.test.ts`
- `src/api/util/handlers/route.ts`
- `src/api/util/handlers/route.test.ts`
- `src/schemas/responses/ExperimentsResponse.ts`
- `test/routes/apex-experiments-metadata-route.test.ts`
- `assets/schemas.json`
- `assets/openapi.json`
- `assets/testing-manifest.json`
- `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`
- `packages/missing-routes/missing.json`
- `test/generated/http-contracts.json`
- `worker-progress/apex-experiments-metadata-get-2.md`

### Evidence Gathered
- `packages/missing-routes/missing.json` initially contained exactly one owned item: `GET /apex/experiments/metadata`.
- `routes.source.catalog.json` initially had no `/apex/experiments/metadata` entry; after regeneration it has `GET_APEX_EXPERIMENTS_METADATA` from `src/api/routes/apex/experiments.ts` with `ApexExperimentsMetadataResponse` and `APIErrorResponse`.
- `src/api/routes/**` initially had no exact metadata route.
- `assets/testing-manifest.json` now has `api:http:GET:/apex/experiments/metadata`, `authMode: "bearer"`, `right: "OPERATOR"`, status metadata `200/401/403`, and response bodies `ApexExperimentsMetadataResponse` plus `APIErrorResponse`.
- `test/generated/http-contracts.json` now includes the metadata route and an `authorization-denied` case for `OPERATOR`.
- Userdoccers reference: `https://docs.discord.food/topics/experiments` and `https://raw.githubusercontent.com/discord-userdoccers/discord-userdoccers/master/pages/topics/experiments.mdx`.
- xHyroM references used: none for this exact endpoint; local xHyroM experiment catalogs describe client experiment data, not the employee-only Apex metadata endpoint.

### Commands Run
- `npm ci` (environment prep; initial build failed because `node_modules/@types/node` was absent)
- `npm run build:src:tsgo`
- `npm run generate:schema`
- `npm run build:test-fixtures`
- `npm run build --workspace @spacebar/automatic-reverse-engineering`
- `node packages/automatic-reverse-engineering/dist/cli.js import-source-routes --root src/api/routes --out packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`
- `npm run build --workspace @spacebar/missing-routes`
- `npm run start --workspace @spacebar/missing-routes`
- `npm run generate:testing-manifest`
- `node scripts/testing-manifest/verify.js`
- `node scripts/testing-manifest/generate-contract-tests.js --check`
- `npm run generate:contract-tests` (needed because the contract matrix was stale after the new route)
- `node scripts/testing-manifest/generate-contract-tests.js --check`
- `node scripts/testing-manifest/generate-suite-coverage.js --check`
- `node --test test/generated/http-contracts.test.js test/generated/suite-coverage.test.js`
- `npm run generate:openapi`
- Focused tests: `node -r dotenv/config -r module-alias/register --enable-source-maps --test dist-test/src/api/util/utility/Experiments.test.js dist-test/src/api/util/handlers/route.test.js dist-test/test/routes/apex-experiments-metadata-route.test.js dist-test/src/util/util/ExperimentRoutes.test.js`
- `git diff --check`
- Malformed warranty-token scan over changed files

### Verification Results
- `npm run build:src:tsgo`: pass after `npm ci`
- `npm run generate:schema`: pass
- `npm run build:test-fixtures`: pass
- Focused tests: pass, 28 tests
- `npm run build --workspace @spacebar/automatic-reverse-engineering`: pass
- Source route import: pass
- `npm run build --workspace @spacebar/missing-routes`: pass
- `npm run start --workspace @spacebar/missing-routes`: pass on the current base, missing count `771`, implemented count `409`
- Testing manifest generation and verification: pass, 514 entries
- Contract generation check: pass after regeneration, 489 contracts
- Suite coverage check: pass
- Generated contract/suite tests: pass, 13 tests
- `npm run generate:openapi`: pass; OpenAPI now includes `GET /apex/experiments/metadata` and contains 326 paths / 815 schemas
- `git diff --check`: pass
- Malformed warranty-token scan: pass

### Risks Or Blockers
- Compatibility risk: Discord's employee-only endpoint returns live Apex metadata; Spacebar currently has no upstream-backed source for that data. Returning an empty `experiments` array avoids fabricating experiment names, variants, or rollout metadata.
- The route requires `OPERATOR` rights rather than a Discord employee account flag because Spacebar's local authorization model represents instance-level privileged users with rights.
- `npm ci` reported existing dependency audit findings and npm config warnings; no package metadata was changed.
- `npm run generate:openapi` still reports pre-existing webhooks routes missing `route()` metadata; this was not caused by this change.

### Recommended Next Tasks
- Add a real local Apex metadata catalog/source if Spacebar later wants non-empty employee metadata responses.
- Consider adding query validation for `surface` once the project has shared query validation semantics for documented route metadata.
