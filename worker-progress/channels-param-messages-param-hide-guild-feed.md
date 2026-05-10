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

# Worker Progress: channels-param-messages-param-hide-guild-feed

## Goal Status

- Status: complete
- Objective: Implement production-ready support for the missing route path `/channels/{param}/messages/{param}/hide-guild-feed` on the current integration branch, with focused tests, regenerated route catalogs and generated route artifacts, verification evidence, and a complete handoff report.
- Goal completion budget report: time used `810` seconds.

## Progress

- Read `WORKER_BRIEF.md`; `ORCHESTRATOR.md` was not read.
- Confirmed owned missing entries: `DELETE /channels/{param}/messages/{param}/hide-guild-feed` and `POST /channels/{param}/messages/{param}/hide-guild-feed`.
- Confirmed the assigned path is absent from `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json` and absent from `src/api/routes/**`.
- Evidence: Userdoccers `resources/message.mdx` describes both hide and unhide as guild-feed message visibility actions returning `204` and firing `MESSAGE_UPDATE`; local `MessageFlags` already contains `GUILD_FEED_HIDDEN`.
- Implemented `DELETE` and `POST` route handlers that validate guild channel and message existence, require authenticated `VIEW_CHANNEL`, require `MANAGE_MESSAGES` for other users' messages, toggle `MessageFlags.GUILD_FEED_HIDDEN`, emit `MESSAGE_UPDATE`, and return `204`.
- Added focused route tests for metadata, success flag mutation, missing message behavior, non-guild channel rejection, and permission rejection.

## Verification Log

- `npm ci`: passed; installed missing workspace dependencies from `package-lock.json`.
- Initial `npm run build:src:tsgo`: blocked because `node_modules` was not installed and `@types/node` was unavailable.
- `npm run build:src:tsgo`: passed after dependency install; rerun after implementation also passed.
- `npm run build:test-fixtures`: passed.
- `node -r dotenv/config -r module-alias/register --enable-source-maps --test dist-test/src/api/routes/channels/#channel_id/messages/#message_id/hide-guild-feed.test.js`: passed.
- `npm run generate:schema`: not run; no schema files changed.
- `npm run build --workspace @spacebar/automatic-reverse-engineering`: passed.
- `node packages/automatic-reverse-engineering/dist/cli.js import-source-routes --root src/api/routes --out packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`: passed.
- `npm run build --workspace @spacebar/missing-routes`: passed.
- `npm run start --workspace @spacebar/missing-routes`: passed; missing count is now `767`.
- `npm run generate:testing-manifest`: passed; manifest now has `518` entries.
- `node scripts/testing-manifest/verify.js`: passed.
- `node scripts/testing-manifest/generate-contract-tests.js --check`: initially reported stale generated contracts.
- `npm run generate:contract-tests`: passed; generated `493` contracts.
- `node scripts/testing-manifest/generate-contract-tests.js --check`: passed.
- `node scripts/testing-manifest/generate-suite-coverage.js --check`: initially reported stale suite coverage.
- `npm run generate:suite-coverage`: passed.
- `node scripts/testing-manifest/generate-suite-coverage.js --check`: passed.
- `node --test test/generated/http-contracts.test.js test/generated/suite-coverage.test.js`: passed.
- `npm run generate:openapi`: passed; generated OpenAPI with `329` paths and `817` schemas. Existing webhook route-metadata warnings remained.
- `git diff --check`: passed.
- Malformed AGPL warranty-token scan for changed files: passed.

## Handoff Report

### Summary

Implemented production support for `/channels/{channel_id}/messages/{message_id}/hide-guild-feed`:

- `POST` hides a guild message from the guild feed by setting `MessageFlags.GUILD_FEED_HIDDEN`.
- `DELETE` unhides it by clearing `MessageFlags.GUILD_FEED_HIDDEN`.
- Both methods validate channel and message existence, reject non-guild channels, require authenticated `VIEW_CHANNEL`, require `MANAGE_MESSAGES` for messages authored by another user, emit `MESSAGE_UPDATE`, and return `204`.

### Changed Files

- `src/api/routes/channels/#channel_id/messages/#message_id/hide-guild-feed.ts`
- `src/api/routes/channels/#channel_id/messages/#message_id/hide-guild-feed.test.ts`
- `tsconfig.test.json`
- `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`
- `packages/missing-routes/missing.json`
- `assets/testing-manifest.json`
- `test/generated/http-contracts.json`
- `test/generated/suite-coverage.json`
- `assets/openapi.json`
- `worker-progress/channels-param-messages-param-hide-guild-feed.md`

### Assigned Path And Methods

- Assigned path: `/channels/{param}/messages/{param}/hide-guild-feed`
- Missing methods found: `DELETE`, `POST`
- Methods implemented: `DELETE`, `POST`
- Missing-route movement after regeneration: `missing 769 -> 767`, `spacebar 411 -> 413`
- The assigned path no longer appears in `packages/missing-routes/missing.json`.

### Evidence Used

- Userdoccers raw source: `https://raw.githubusercontent.com/discord-userdoccers/discord-userdoccers/master/pages/resources/message.mdx`
  - `Hide Message from Guild Feed`: hides a message from the guild feed, returns `204`, fires `MESSAGE_UPDATE`.
  - `Unhide Message from Guild Feed`: unhides a message from the guild feed, returns `204`, fires `MESSAGE_UPDATE`.
- Local source catalog before implementation: no `hide-guild-feed` source route entry.
- Local route tree before implementation: no `src/api/routes/**/hide-guild-feed.ts`.
- Local durable state evidence: `src/util/util/MessageFlags.ts` already defines `GUILD_FEED_HIDDEN`.
- Nearby route behavior reviewed:
  - `src/api/routes/channels/#channel_id/messages/#message_id/index.ts`
  - `src/api/routes/channels/#channel_id/messages/#message_id/crosspost.ts`
  - `src/api/routes/channels/#channel_id/messages/#message_id/interaction-data.ts`

### Risks Or Blockers

- No blocker remains.
- Permission behavior is source-informed but necessarily conservative: Userdoccers documents no explicit extra permission for this route, so this implementation allows authors to toggle their own message and requires `MANAGE_MESSAGES` for other users' messages, matching nearby message mutation patterns.
- `npm ci` surfaced existing audit findings (`3 moderate`, `2 high`, `1 critical`); no dependency versions were changed.

### Recommended Next Tasks

- Consider broader scenario coverage for guild feed listing once `/guilds/{guild_id}/guild-feed` is implemented.
- Consider documenting the author-versus-moderator permission choice if future Discord evidence proves this route is moderator-only.

## Orchestrator Current-Base Acceptance

- Ported only source, focused test, config, and report changes onto `6d90e76b1`.
- Regenerated generated artifacts on the current main checkout rather than copying stale worker artifacts.
- Resolved the `tsconfig.test.json` current-base conflict by preserving existing test entries and adding the hide-guild-feed focused test.
- Added the AGPL header to this new worker report before acceptance.
- Current-base missing-route movement: `752 -> 750` missing and `428 -> 430` implemented.
- Current-base generated artifacts: testing manifest `535` entries, generated HTTP contracts `510` contracts, OpenAPI `340` paths and `828` schemas.
- Current-base verification passed:
  - `npm run build:src:tsgo`
  - `npm run build:test-fixtures`
  - `node -r dotenv/config -r module-alias/register --enable-source-maps --test dist-test/src/api/routes/channels/#channel_id/messages/#message_id/hide-guild-feed.test.js`
  - `npm run build --workspace @spacebar/automatic-reverse-engineering`
  - `node packages/automatic-reverse-engineering/dist/cli.js import-source-routes --root src/api/routes --out packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`
  - `npm run build --workspace @spacebar/missing-routes`
  - `npm run start --workspace @spacebar/missing-routes`
  - `npm run generate:testing-manifest`
  - `node scripts/testing-manifest/verify.js`
  - `npm run generate:contract-tests`
  - `node scripts/testing-manifest/generate-contract-tests.js --check`
  - `npm run generate:suite-coverage`
  - `node scripts/testing-manifest/generate-suite-coverage.js --check`
  - `npm run generate:openapi`
  - `node --test test/generated/http-contracts.test.js test/generated/suite-coverage.test.js`
- `npm run generate:schema` was not run during current-base acceptance because no schema files changed and OpenAPI reused the existing generated schema set.
