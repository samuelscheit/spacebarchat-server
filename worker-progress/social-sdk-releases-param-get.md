# Worker Progress: GET /social-sdk/releases/{param}

## Goal

- Worker goal status: complete
- Worker objective: Implement production-ready support for `GET /social-sdk/releases/{param}` with focused tests, regenerated catalogs/artifacts, verification evidence, and a handoff report.
- Orchestrator acceptance base: `codex/merge-ready-prs-20260508`

## Summary

Implemented `GET /social-sdk/releases/{sdk_release_version}` in `src/api/routes/social-sdk/releases.ts` while preserving the existing bearer-authenticated `GET /social-sdk/releases` collection route.

The detail route is provider-backed: an injected release catalog provider can return an exact `SocialSDKRelease` match. The default provider has no durable release data, so unknown versions return `404 APIErrorResponse` with `Unknown Social SDK release` instead of fabricating SDK metadata.

Collection responses expose only list fields (`version`, `release_date_time`) and keep detail-only `artifacts` out of the collection payload.

## Scope Evidence

- Assigned missing route: `GET /social-sdk/releases/{param}` / `GET_SOCIAL_SDK_RELEASES_SDK_RELEASE_VERSION`.
- Source file changed: `src/api/routes/social-sdk/releases.ts`.
- Focused test file changed: `test/routes/social-sdk-releases.test.ts`.
- Adjacent route left out of scope: `POST /applications/{param}/social-sdk/enable`.
- Existing `GET /social-sdk/releases` behavior remains bearer-authenticated and returns `{ "releases": [], "latest_version": "" }` by default.

## Generated Artifact Evidence

- Source catalog includes `GET /social-sdk/releases/{sdk_release_version}` from `src/api/routes/social-sdk/releases.ts`.
- Testing manifest includes `api:http:GET:/social-sdk/releases/:sdk_release_version` with bearer auth and statuses `[200, 401, 404]`.
- HTTP contract matrix includes the detail route contract.
- OpenAPI includes `/social-sdk/releases/{sdk_release_version}` with `SocialSDKRelease`, `APIErrorResponse`, and a required path parameter.
- Missing-route report no longer lists the assigned route.

## Missing-Route Movement

- Before acceptance on current base: `681 missing / 499 implemented / 1128 Discord`.
- After current-base regeneration: `680 missing / 500 implemented / 1128 Discord`.

## Verification

- `npm run build:src:tsgo`: passed.
- `npm run generate:schema`: passed.
- `npm run build --workspace @spacebar/automatic-reverse-engineering`: passed.
- `node packages/automatic-reverse-engineering/dist/cli.js import-source-routes --root src/api/routes --out packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`: passed.
- `npm run build --workspace @spacebar/missing-routes`: passed.
- `npm run start --workspace @spacebar/missing-routes`: passed and reported `680 missing / 500 implemented / 1128 Discord`.
- `npm run generate:testing-manifest`: passed and wrote 605 entries.
- `node scripts/testing-manifest/verify.js`: passed.
- `node scripts/testing-manifest/generate-contract-tests.js --check`: initially stale as expected.
- `npm run generate:contract-tests`: passed and wrote 580 contracts.
- `node scripts/testing-manifest/generate-contract-tests.js --check`: passed.
- `node scripts/testing-manifest/generate-suite-coverage.js --check`: passed.
- `npm run generate:openapi`: passed and wrote 405 paths / 982 schemas; existing webhook route-middleware warnings remain unrelated.
- `npm run build:test-fixtures`: passed.
- `node -r dotenv/config -r module-alias/register --enable-source-maps --test dist-test/test/routes/social-sdk-releases.test.js`: passed, 9 tests.
- `node --test test/generated/http-contracts.test.js test/generated/suite-coverage.test.js`: passed, 13 tests.
- `npx eslint src/api/routes/social-sdk/releases.ts test/routes/social-sdk-releases.test.ts`: passed.
- `npx prettier --check src/api/routes/social-sdk/releases.ts test/routes/social-sdk-releases.test.ts`: passed.
- `git diff --check`: passed.
- Package manifest/lockfile guard: clean.

## Risks

- Spacebar does not currently have a durable Social SDK release dataset. The default detail route therefore returns 404 until a real catalog provider is wired.
- Userdoccers and local catalogs normalize the path parameter to `sdk_release_version`; the implementation follows the local catalog and generated route naming.
