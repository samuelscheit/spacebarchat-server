<!--
	Spacebar: A FOSS re-implementation and extension of the Discord.com backend.
	Copyright (C) 2026 Spacebar and Spacebar Contributors

	This program is free software: you can redistribute it and/or modify
	it under the terms of the GNU Affero General Public License as published
	by the Free Software Foundation, either version 3 of the License, or
	(at your option) any later version.

	This program is distributed in the hope that it will be useful,
	but WITHOUT ANY WARRANTY; without even the implied warranty of
	MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
	GNU Affero General Public License for more details.

	You should have received a copy of the GNU Affero General Public License
	along with this program.  If not, see <https://www.gnu.org/licenses/>.
-->

# Worker Progress: downloads-distributions-app-installers-latest-get-2

## Goal Evidence

- `create_goal`: objective set to "Implement production-ready support for the missing route path `/downloads/distributions/app/installers/latest` on the current integration branch, with focused tests, regenerated route catalogs and generated route artifacts, verification evidence, and a complete handoff report."
- `get_goal`: status `active`; objective matched the assigned route support objective.
- `update_goal(status: "complete")`: status `complete`; final goal time used was 694 seconds.

## Assignment

- Assigned path: `/downloads/distributions/app/installers/latest`
- Missing methods found: `GET`
- Methods implemented: `GET`
- Out of scope and not implemented: `/download`, `/download/{release_channel}`, `/updates/{platform}`, `/downloads/distributions/**` sibling routes, native module routes, and release-data ingestion/seeding. The only ClientRelease change is nullable query dimensions required for this exact route to avoid ignoring `channel` and `arch`.

## Evidence

- `packages/missing-routes/missing.json` initially listed exactly one owned missing entry: `GET /downloads/distributions/app/installers/latest`.
- `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json` initially had no source route for the assigned path.
- `src/api/routes/**` initially had no route file for the assigned path.
- Userdoccers source used: `https://raw.githubusercontent.com/discord-userdoccers/discord-userdoccers/master/pages/topics/client-distribution.mdx`
- Userdoccers describes "Get Latest Distributed Application Installer" as a redirect endpoint, currently Windows-only, with required `channel`, `platform`, and `arch` query parameters.

## Behavior

- Auth mode: public/no-auth. Added only exact no-auth classification for `GET`/`HEAD` matching `/downloads/distributions/app/installers/latest`.
- Success: `302` redirect to the newest matching persisted `ClientRelease.url`.
- Query validation: `channel` must be one of `stable`, `ptb`, `canary`, `development`; `platform` must be `win`; `arch` must be `x86`, `x64`, or `arm64`.
- Data source: `ClientRelease.findOne({ where: { enabled: true, release_channel, platform, arch }, order: { pub_date: "DESC" } })`.
- Error semantics: missing or unsupported query values return `400 APIErrorResponse`; no matching enabled release returns `404 APIErrorResponse`; no `401` response metadata because the route is public.
- Persistence: added nullable `ClientRelease.release_channel` and `ClientRelease.arch` columns plus a PostgreSQL migration and initial schema update. Existing rows remain valid and are not fabricated into distributed releases.

## Changed Files

- `src/api/routes/downloads/distributions/app/installers/latest.ts`
- `src/api/middlewares/NoAuthorizationRoutes.ts`
- `src/util/entities/ClientRelease.ts`
- `src/util/migration/postgres/1778439000000-ClientReleaseDistributionDimensions.ts`
- `src/util/migration/postgres-initial.ts`
- `test/routes/download-distribution-installer-route.test.ts`
- `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`
- `packages/missing-routes/missing.json`
- `assets/testing-manifest.json`
- `test/generated/http-contracts.json`
- `assets/openapi.json`
- `worker-progress/downloads-distributions-app-installers-latest-get-2.md`

## Verification

- `npm run build:src:tsgo`: first run failed because the temporary shared `node_modules` symlink exposed an existing portable declaration error outside this route; reran after using a real local dependency copy and passed.
- `npm run generate:schema`: not run because no schema sources changed.
- `npm run build --workspace @spacebar/automatic-reverse-engineering`: passed.
- `node packages/automatic-reverse-engineering/dist/cli.js import-source-routes --root src/api/routes --out packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`: passed.
- `npm run build --workspace @spacebar/missing-routes`: passed.
- `npm run start --workspace @spacebar/missing-routes`: passed; wrote missing report.
- `npm run generate:testing-manifest`: passed; wrote 523 entries.
- `node scripts/testing-manifest/verify.js`: passed.
- `node scripts/testing-manifest/generate-contract-tests.js --check`: initially stale as expected.
- `npm run generate:contract-tests`: passed; wrote 498 contracts.
- `node scripts/testing-manifest/generate-contract-tests.js --check`: passed.
- `node scripts/testing-manifest/generate-suite-coverage.js --check`: passed.
- `node --test test/generated/http-contracts.test.js test/generated/suite-coverage.test.js`: passed, 13 tests.
- `npm run generate:openapi`: passed; wrote 333 paths and 819 schemas.
- `npm run build:test-fixtures`: passed.
- `node -r dotenv/config -r module-alias/register --enable-source-maps --test dist-test/test/routes/download-distribution-installer-route.test.js`: passed, 5 tests.
- `node -r dotenv/config -r module-alias/register --enable-source-maps --test dist-test/test/routes/download.test.js`: passed, 7 tests.
- `git diff --check`: passed.
- Package manifest/lockfile cleanliness check: passed; no dependency manifest or lockfile diffs.
- Malformed warranty-string scan over changed files: passed.

The local dependency copy used for verification was removed before handoff.

## Current-Base Orchestrator Verification

- Ported scoped source, entity, migration, test, and report changes onto
  `17faa4c0e Implement guild game server regions route`; regenerated generated
  artifacts on that base instead of copying worker artifacts.
- `npm run build:src:tsgo`: passed.
- `npm run build:test-fixtures`: passed.
- Focused compiled route tests:
  `node -r dotenv/config -r module-alias/register --enable-source-maps --test dist-test/test/routes/download-distribution-installer-route.test.js dist-test/test/routes/download.test.js`:
  passed, 12/12 tests, after current-base artifact regeneration.
- `npm run build --workspace @spacebar/automatic-reverse-engineering`: passed.
- Source route import: passed and added
  `/downloads/distributions/app/installers/latest`.
- `npm run build --workspace @spacebar/missing-routes`: passed.
- `npm run start --workspace @spacebar/missing-routes`: passed,
  `missing: 760`, `spacebar: 420`.
- `npm run generate:testing-manifest`: passed, 525 entries.
- `node scripts/testing-manifest/verify.js`: passed, 525 entries.
- `node scripts/testing-manifest/generate-contract-tests.js --check`: stale
  before regeneration.
- `npm run generate:contract-tests`: passed, 500 contracts.
- `node scripts/testing-manifest/generate-contract-tests.js --check`: passed,
  500 contracts.
- `node scripts/testing-manifest/generate-suite-coverage.js --check`: passed.
- `node --test test/generated/http-contracts.test.js test/generated/suite-coverage.test.js`:
  passed, 13/13 tests.
- `npm run generate:openapi`: passed, 335 paths and 822 schemas. The webhook
  route-metadata warnings are pre-existing.

## Generated Evidence

- Source catalog now contains `GET /downloads/distributions/app/installers/latest` with route name `GET_DOWNLOADS_DISTRIBUTIONS_APP_INSTALLERS_LATEST` and `APIErrorResponse`.
- Testing manifest and HTTP contract metadata now contain `api:http:GET:/downloads/distributions/app/installers/latest/` as public, with query metadata and response statuses `[302, 400, 404]`.
- OpenAPI now contains `/downloads/distributions/app/installers/latest/` with required `channel`, `platform`, and `arch` query parameters and responses `302`, `400`, and `404`.

## Missing-Route Movement

- Before regeneration: `missing = 763`, `spacebar = 417`, `discord = 1128`.
- After regeneration: `missing = 762`, `spacebar = 418`, `discord = 1128`.
- The assigned route was removed from `missing_entries[]`.

## Risks And Next Tasks

- Operators need real `client_release` rows with `release_channel` and `arch` populated before this endpoint can redirect successfully; otherwise it fails closed with 404.
- Legacy `/download` still uses the existing platform-only lookup. That behavior was intentionally left unchanged.
- Recommended next tasks: implement `/updates/distributions/app/manifests/latest` separately, add release ingestion/population for distributed Windows installers, and consider a lookup index if the `client_release` table grows materially.
