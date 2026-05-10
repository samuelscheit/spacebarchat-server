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

# Worker Progress: DELETE and POST /attachments/report-false-positive

## Summary

Implemented the assigned `DELETE` and `POST` methods for `/attachments/report-false-positive`.

Both methods are authenticated, validate the documented request body without scalar coercion, look up the referenced local message, enforce channel/message visibility permissions, verify reported attachment IDs belong to the message, and return Discord-compatible `204` empty responses. Spacebar does not currently persist explicit-media scan feedback or false-positive reports, so the route implements the narrowest source-backed compatibility behavior: validate that the client report refers to visible local message content, then accept the signal without fabricating durable state.

## Changed Files

- `src/api/routes/attachments/report-false-positive.ts`
- `src/api/routes/attachments/report-false-positive.test.ts`
- `src/schemas/uncategorised/AttachmentFalsePositiveReportSchema.ts`
- `src/schemas/uncategorised/index.ts`
- `tsconfig.test.json`
- `assets/schemas.json`
- `assets/testing-manifest.json`
- `assets/openapi.json`
- `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`
- `packages/missing-routes/missing.json`
- `test/generated/http-contracts.json`
- `test/generated/suite-coverage.json`
- `worker-progress/attachments-report-false-positive-2.md`

## Assigned Path

- Assigned path: `/attachments/report-false-positive`
- Missing methods found: `DELETE`, `POST`
- Methods implemented: `DELETE`, `POST`
- Removed missing entries:
  - `DELETE /attachments/report-false-positive`, route name `EXPLICIT_MEDIA_REPORT_FALSE_POSITIVE`
  - `POST /attachments/report-false-positive`, route name `POST_ATTACHMENTS_REPORT_FALSE_POSITIVE`

## Evidence Gathered

- `packages/missing-routes/missing.json` initially contained exactly two assigned entries for `/attachments/report-false-positive`.
- `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json` initially had no entries for `/attachments/report-false-positive`.
- `src/api/routes/attachments` initially only had `refresh-urls.ts`; there was no `report-false-positive` route.
- Local Userdoccers catalog confirmed:
  - `POST /attachments/report-false-positive`
  - route name `POST_ATTACHMENTS_REPORT_FALSE_POSITIVE`
  - source `userdoccers:resources/message.mdx`
  - summary `Report Explicit Content False Positive`
- Upstream Userdoccers `resources/message.mdx` documents `POST` as reporting an explicit-content false positive for a message, returning `204`, with JSON fields `channel_id`, `message_id`, `attachment_ids`, and `embed_ids`.
- Local xHyroM catalog confirmed:
  - `DELETE /attachments/report-false-positive`
  - `POST /attachments/report-false-positive`
  - adjacent `OPTIONS /attachments/report-false-positive`
  - route name `EXPLICIT_MEDIA_REPORT_FALSE_POSITIVE`
- Local code search found no explicit-media false-positive feedback persistence model or scan-result state to mutate.

References used:

- `https://raw.githubusercontent.com/discord-userdoccers/discord-userdoccers/master/pages/resources/message.mdx`
- `packages/automatic-reverse-engineering/data/catalogs/routes.userdoccers.catalog.json`
- `packages/automatic-reverse-engineering/data/catalogs/routes.xhyrom.catalog.json`
- `src/api/routes/attachments/refresh-urls.ts`
- `src/api/routes/channels/#channel_id/messages/#message_id/index.ts`

## What Changed

- Added `AttachmentFalsePositiveReportSchema`:
  - required `channel_id` and `message_id` snowflake strings.
  - required `attachment_ids` array with max `100` snowflake strings.
  - required `embed_ids` array with max `100` local `embed_<number>` identifiers.
- Added `DELETE /attachments/report-false-positive/` and `POST /attachments/report-false-positive/`.
- Route metadata includes:
  - `requestBody: "AttachmentFalsePositiveReportSchema"`
  - `coerceRequestBody: false`
  - `204`, `400`, `401`, `403`, `404` responses.
- Route behavior:
  - invalid `channel_id` returns Discord unknown-channel `10003` with HTTP `404`.
  - invalid or absent `message_id` returns Discord unknown-message `10008` with HTTP `404`.
  - checks `VIEW_CHANNEL`.
  - checks `READ_MESSAGE_HISTORY` when the message author is not the requester.
  - rejects empty report target sets.
  - rejects attachment IDs that do not belong to the message.
  - accepts embed reports when the message has persisted embeds; local embed IDs cannot be mapped server-side.
  - returns `204` empty success for validated `DELETE` and `POST`.
- Added focused compiled tests for metadata, schema validation, unknown message behavior, permission checks, current-user author behavior, attachment ownership validation, and `DELETE`/`POST` success.
- Regenerated source route catalog, missing-route report, schemas, testing manifest, generated HTTP contracts, suite coverage, and OpenAPI.

## Missing-Route Count Movement

- Before regeneration: `missing = 787`, `spacebar = 393`, assigned entries for path = `2`.
- After regeneration: `missing = 785`, `spacebar = 395`, assigned entries for path = `0`.
- Orchestrator current-base regeneration after port: `missing = 783 -> 781`, `spacebar = 397 -> 399`, assigned entries for path = `0`.
- `packages/missing-routes/missing.json` no longer contains `/attachments/report-false-positive` in `missing_entries[]`.

## Commands Run

```bash
mkdir -p worker-progress
git status --short
jq '.missing_entries[] | select(.route == "/attachments/report-false-positive")' packages/missing-routes/missing.json
rg -n 'attachments/report-false-positive|EXPLICIT_MEDIA_REPORT_FALSE_POSITIVE|POST_ATTACHMENTS_REPORT_FALSE_POSITIVE' packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json src/api/routes
jq '{missing, spacebar, discord, assigned: [.missing_entries[] | select(.route == "/attachments/report-false-positive")]}' packages/missing-routes/missing.json
ln -s /Users/user/Developer/Developer/spacebarchat/server/node_modules node_modules
npm run build:src:tsgo
NODE_OPTIONS=--preserve-symlinks npm run build:src:tsgo
rm node_modules && npm ci
npm run build:src:tsgo
npm run generate:schema
npm run build:test-fixtures
node -r dotenv/config -r module-alias/register --enable-source-maps --test dist-test/src/api/routes/attachments/report-false-positive.test.js
npm run build:test-fixtures
node -r dotenv/config -r module-alias/register --enable-source-maps --test dist-test/src/api/routes/attachments/report-false-positive.test.js
npm run build --workspace @spacebar/automatic-reverse-engineering
node packages/automatic-reverse-engineering/dist/cli.js import-source-routes --root src/api/routes --out packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json
npm run build --workspace @spacebar/missing-routes
npm run start --workspace @spacebar/missing-routes
npm run generate:testing-manifest
node scripts/testing-manifest/verify.js
node scripts/testing-manifest/generate-contract-tests.js --check
npm run generate:contract-tests
node scripts/testing-manifest/generate-contract-tests.js --check
node scripts/testing-manifest/generate-suite-coverage.js --check
npm run generate:suite-coverage
node scripts/testing-manifest/generate-suite-coverage.js --check
npm run generate:openapi
node --test test/generated/http-contracts.test.js test/generated/suite-coverage.test.js
node scripts/testing-manifest/verify.js
node scripts/testing-manifest/generate-contract-tests.js --check
node scripts/testing-manifest/generate-suite-coverage.js --check
git diff -- package.json package-lock.json npm-shrinkwrap.json pnpm-lock.yaml yarn.lock --exit-code
git diff --check
```

## Verification Results

- Initial `npm run build:src:tsgo` with a shared `node_modules` symlink failed outside route scope:
  - `src/api/util/handlers/ChannelMessageCreateRoute.ts(56,14): error TS2883`
  - The error referenced `../../../../../../server/node_modules/@types/qs` and was caused by the symlink realpath.
- `NODE_OPTIONS=--preserve-symlinks npm run build:src:tsgo` failed with the same unrelated TS2883 error.
- Replaced the symlink with local `npm ci`; no lockfile/package manifest changes.
- `npm run build:src:tsgo`: passed after local install.
- `npm run generate:schema`: passed, wrote `788` schemas including `AttachmentFalsePositiveReportSchema`.
- First focused route test run failed because the test tried to mock non-configurable barrel getter `@spacebar/util.getPermission`; fixed by mocking `dist/util/util/Permissions.js` before requiring the route.
- Focused compiled route/schema test: passed, `9/9` tests.
- `npm run build --workspace @spacebar/automatic-reverse-engineering`: passed.
- Source route catalog import: passed and now includes `DELETE` and `POST /attachments/report-false-positive`.
- `npm run build --workspace @spacebar/missing-routes`: passed.
- `npm run start --workspace @spacebar/missing-routes`: passed, wrote `missing = 785`.
- `npm run generate:testing-manifest`: passed, wrote `500` entries.
- `node scripts/testing-manifest/verify.js`: passed.
- Contract check initially reported stale contracts; after regeneration:
  - `npm run generate:contract-tests`: passed, wrote `475` contracts.
  - `node scripts/testing-manifest/generate-contract-tests.js --check`: passed.
- Suite coverage check initially reported stale suite coverage; after regeneration:
  - `npm run generate:suite-coverage`: passed, wrote `15` suites.
  - `node scripts/testing-manifest/generate-suite-coverage.js --check`: passed.
- `npm run generate:openapi`: passed, wrote `313` paths and `788` schemas; only pre-existing webhook route-metadata warnings appeared.
- Generated static tests: passed, `13/13`.
- Lockfile/package manifest diff guard: passed.
- `git diff --check`: passed.
- Malformed AGPL warranty-line scan over changed/untracked scoped files: no findings.

Orchestrator current-base verification after port:

- `npm run build:src:tsgo`: passed.
- `npm run generate:schema`: passed, wrote `792` schemas including `AttachmentFalsePositiveReportSchema`.
- `npm run build:test-fixtures`: passed.
- Focused compiled route/schema test: passed, `9/9` tests.
- `npm run build --workspace @spacebar/automatic-reverse-engineering`: passed.
- Source route catalog import: passed.
- `npm run build --workspace @spacebar/missing-routes`: passed.
- `npm run start --workspace @spacebar/missing-routes`: passed, wrote `missing = 781` and `spacebar = 399`.
- `npm run generate:testing-manifest`: passed, wrote `504` entries.
- `node scripts/testing-manifest/verify.js`: passed.
- Generated HTTP contracts were stale, then regenerated and verified with `479` contracts.
- Generated suite coverage was stale, then regenerated and verified with `15` suites.
- `npm run generate:openapi`: passed, wrote `316` paths and `792` schemas; only pre-existing webhook route-metadata warnings appeared.
- Generated static tests: passed, `13/13`.
- Package manifest/lockfile guard: passed.
- `git diff --check`: passed.
- Malformed warranty-token scan over changed/untracked scoped files: no findings.

## Artifact Status

- Source route catalog: regenerated.
- Missing-route report: regenerated.
- Schemas: regenerated because a request schema changed.
- Testing manifest: regenerated and verified.
- Generated HTTP contracts: regenerated and verified.
- Generated suite coverage: regenerated and verified.
- OpenAPI: regenerated.

## Risks And Blockers

- Spacebar still has no durable explicit-media scan feedback or false-positive report persistence. The route therefore validates and accepts the signal but cannot record or delete durable false-positive state.
- `DELETE` is sourced only from xHyroM route presence, with no Userdoccers body semantics. It uses the same request schema and validation as `POST` because deleting a report still needs the same message/target identifiers.
- The local shared `node_modules` symlink was not viable for `npm run build:src:tsgo` because of an unrelated TS2883 portable-type error. A local `npm ci` was used for verification instead.

## Recommended Next Tasks

- Add a durable explicit-media scan/feedback model if Spacebar wants true false-positive report persistence, deletion, moderation review, or analytics.
- Implement adjacent routes only under separate assignments:
  - `/attachments/sender-report-false-positive`
  - `/attachments/refresh-urls`
  - channel attachment routes
  - explicit-media scan routes

## Prompt-To-Artifact Completion Audit

- Derived every current `missing_entries[]` item for `/attachments/report-false-positive`: complete, two entries found.
- Confirmed owned methods absent in `routes.source.catalog.json` and `src/api/routes/**`: complete.
- Compared local catalogs plus Userdoccers/xHyroM references as needed: complete.
- Implemented production behavior and focused tests: complete.
- Regenerated source route catalog: complete.
- Regenerated missing-route report: complete.
- Regenerated testing manifest: complete.
- Regenerated generated HTTP contracts: complete.
- Regenerated generated suite coverage: complete.
- Regenerated OpenAPI: complete.
- Regenerated schemas because request schema changed: complete.
- Ran expected verification and captured route-scope/out-of-scope failures: complete.
- Did not implement adjacent routes or push: complete.

## Goal Status Evidence

- Initial `create_goal` objective: `Implement production-ready DELETE and POST support for /attachments/report-false-positive on the current integration branch, with focused tests, regenerated route catalogs and generated route artifacts, verification evidence, and a complete handoff report.`
- Initial `get_goal` status: `active`.
- Pre-completion `get_goal` status: `active`.
- Pre-completion `get_goal` objective: `Implement production-ready DELETE and POST support for /attachments/report-false-positive on the current integration branch, with focused tests, regenerated route catalogs and generated route artifacts, verification evidence, and a complete handoff report.`
