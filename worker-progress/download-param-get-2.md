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

# Worker progress: download-param-get-2

Goal status: active
Goal objective: Implement production-ready support for the missing route path `/download/{param}` on the current integration branch, with focused tests, regenerated route catalogs and generated route artifacts, verification evidence, and a complete handoff report.
Resume goal check: active with the same objective after continuation.

## Progress

- Read worker brief.
- Confirmed owned missing entry: `GET /download/{param}` (`GET_DOWNLOAD_RELEASE_CHANNEL`) from `userdoccers:topics/client-distribution.mdx`, source route `/download/{release_channel}`.
- Confirmed absence from source catalog: only `GET /download` exists in `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`.
- Confirmed absence from source routes: only `src/api/routes/download.ts` currently declares `router.get("/")`.
- Evidence gathered:
  - Userdoccers `client-distribution.mdx` says `GET /download/{release_channel}` redirects to latest installer for the release channel and selected platform, `platform` is required, Linux `format` is optional/defaults to `deb`, and `mobile` redirects to the download page.
  - Live Discord public checks on 2026-05-10 returned `302` for `/api/download/stable?platform=linux&format=deb`, `302` for `/api/download/mobile`, and JSON `404` for invalid channel or missing platform.
  - Local `ClientRelease` storage has no release-channel column, so implementation will preserve existing Spacebar platform-based release lookup while validating the new path parameter and documenting channel compatibility in route metadata/tests.

## Handoff report

### Summary

Implemented `GET /download/:release_channel` for the assigned `/download/{param}` route. The route is public, validates known desktop release channels (`stable`, `ptb`, `canary`, `development`), supports the documented special `mobile` channel redirect, requires `platform` for desktop channels, exposes `format` query metadata, redirects via existing `ClientRelease` platform lookup, and returns JSON `APIErrorResponse` metadata for `400` and `404` cases.

### Assigned path and methods

- Assigned path: `/download/{param}`
- Missing methods found: `GET`
- Missing route name: `GET_DOWNLOAD_RELEASE_CHANNEL`
- Implemented method: `GET /download/:release_channel`
- Worker-base missing-route movement after regeneration: `missing` 774 -> 773, `spacebar` 406 -> 407.
- Current-base missing-route movement after orchestrator regeneration: `missing` 765 -> 764, `spacebar` 415 -> 416; `/download/{param}` was removed from `missing_entries`.

### Changed files

- `src/api/routes/download.ts`: added shared download helpers, route metadata, `/:release_channel` handler, mobile redirect, JSON not-found handling, and explicit `400` metadata for platform validation.
- `src/api/middlewares/NoAuthorizationRoutes.ts`: marked `GET`/`HEAD /download/<release_channel>` public.
- `test/routes/download.test.ts`: added focused tests for route metadata, no-auth handling, path/query behavior, redirects, errors, and generated artifacts.
- `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`: regenerated source route catalog with `GET /download/{release_channel}`.
- `packages/missing-routes/missing.json`: regenerated missing-route report; assigned entry removed.
- `assets/testing-manifest.json`: regenerated manifest; added `api:http:GET:/download/:release_channel`.
- `test/generated/http-contracts.json`: regenerated contract matrix; added public contract for `GET /download/:release_channel`.
- `assets/openapi.json`: regenerated OpenAPI with `/download/{release_channel}` path/query/response metadata.
- `worker-progress/download-param-get-2.md`: this report.

### Evidence gathered

- `packages/missing-routes/missing.json` owned entry before implementation: `GET /download/{param}`, source route `/download/{release_channel}`, source `userdoccers:topics/client-distribution.mdx`.
- Pre-implementation source catalog had only `GET /download`; post-regeneration includes `GET /download/{release_channel}` from `src/api/routes/download.ts`.
- Userdoccers source: `https://raw.githubusercontent.com/discord-userdoccers/discord-userdoccers/master/pages/topics/client-distribution.mdx`
- Local Userdoccers catalog reference: `packages/automatic-reverse-engineering/data/runs/2026-05-07T23-06-28Z-stable-local/static/routes.userdoccers.catalog.json`.
- Live public checks on 2026-05-10:
  - `https://discord.com/api/download/stable?platform=linux&format=deb` -> `302`
  - `https://discord.com/api/download/mobile` -> `302`
  - invalid channel and missing desktop platform -> JSON `404`
- Existing Spacebar evidence: `ClientRelease` stores `platform`, `url`, `pub_date`, `enabled`, and `notes`, but no release-channel or format column.

### Commands run

- `npm ci` (installed missing worktree dependencies)
- `npm run build:src:tsgo` (first attempt before `npm ci` failed because `@types/node` was not installed; rerun passed)
- `npm run build:test-fixtures` (first attempt caught test typing issues; reruns passed)
- `npm run build --workspace @spacebar/automatic-reverse-engineering`
- `node packages/automatic-reverse-engineering/dist/cli.js import-source-routes --root src/api/routes --out packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`
- `npm run build --workspace @spacebar/missing-routes`
- `npm run start --workspace @spacebar/missing-routes`
- `npm run generate:testing-manifest`
- `node scripts/testing-manifest/verify.js`
- `node scripts/testing-manifest/generate-contract-tests.js --check` (reported stale)
- `npm run generate:contract-tests`
- `node scripts/testing-manifest/generate-contract-tests.js --check`
- `node scripts/testing-manifest/generate-suite-coverage.js --check`
- `node --test test/generated/http-contracts.test.js test/generated/suite-coverage.test.js`
- `npm run generate:openapi`
- `node -r dotenv/config -r module-alias/register --enable-source-maps --test dist-test/test/routes/download.test.js`
- `git diff --check`
- Changed-file malformed warranty scan with `rg` over tracked modified and untracked files; no malformed warranty tokens remain.

`npm run generate:schema` was not run because no schema files or response/request schema definitions changed.

### Verification results

- Source build: passed.
- Test fixture build: passed after test type fixes.
- Focused route test: passed, 7/7 tests.
- Generated HTTP contract tests: passed, 13/13 tests for the generated contract/suite coverage files.
- Testing manifest verify: passed with 512 entries.
- Contract matrix check: passed with 487 contracts after regeneration.
- Suite coverage check: passed.
- OpenAPI regeneration: passed; existing unrelated warnings remain for webhooks routes without route metadata.
- `git diff --check`: passed.
- Warranty scan: passed for changed files; correct `MERCHANTABILITY` line present in touched source/test files.
- Resume verification on continuation: focused `dist-test/test/routes/download.test.js` passed 7/7, testing manifest verify passed with 512 entries, contract check passed with 487 contracts, suite coverage check passed, generated contract/suite tests passed 13/13, `git diff --check` passed, and the malformed warranty-token scan returned no matches.
- Current-base orchestrator verification on `4086496e2`: `npm run build:src:tsgo` passed; `npm run build:test-fixtures` passed; focused compiled download route test passed 7/7 after current-base route artifact regeneration; source catalog import passed; missing-routes regeneration reported `missing = 764`, `spacebar = 416`; testing manifest verification passed with 521 entries; generated HTTP contracts regenerated and checked with 496 contracts; suite coverage check passed; generated contract/suite tests passed 13/13; OpenAPI generation passed with 331 paths and 818 schemas. The webhook route-metadata warnings are pre-existing.

### Risks or blockers

- `ClientRelease` has no release-channel or Linux-format storage. This implementation therefore validates the release channel for compatibility but uses the existing Spacebar platform-based release lookup for desktop channels. Per-channel/per-format installer storage would require a separate schema/admin/API task.
- `mobile` redirects to the documented Discord download URL because there is no Spacebar mobile-client download configuration.

### Recommended next tasks

- If Spacebar needs distinct `stable`/`ptb`/`canary`/`development` release URLs, add release-channel and optional format fields to `ClientRelease`, migrations, admin models, and release management UI/API.
- Consider adding a configurable mobile download URL if instances should not redirect mobile clients to Discord.
