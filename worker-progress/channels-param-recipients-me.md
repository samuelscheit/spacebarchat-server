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

# channels-param-recipients-me handoff

## Goal

- Status recorded from goal tool: active
- Objective: Implement production-ready support for the missing route path `/channels/{param}/recipients/@me` on the current integration branch, with focused tests, regenerated route catalogs and generated route artifacts, verification evidence, and a complete handoff report.

## Summary

- Implemented authenticated `DELETE`, `PATCH`, and `PUT` for `/channels/{channel_id}/recipients/@me`.
- Added `ChannelRecipientMeUpdateSchema` with required `consent_status`.
- Added literal `@me` routes before parameterized `/:user_id` routes to prevent route shadowing.
- Used Spacebar's existing DM recipient state as the compatibility backing:
  - `PUT`/`PATCH` accept only `consent_status: 2` (`ACCEPTED`) for normal users and reopen the current user's DM recipient row.
  - `DELETE` requires the current user's DM recipient row to be pending/closed, emits `CHANNEL_UPDATE`, `MESSAGE_ACK` when a last message exists, and `CHANNEL_DELETE`, and returns the current-user DM channel DTO.
- Kept adjacent `/channels/{param}/recipients/{param}`, batch reject, DM list/create, relationship, invite, and supplemental message-request routes untouched.

## Assigned Path

- Assigned route: `/channels/{param}/recipients/@me`
- Missing methods found before implementation: `DELETE`, `PATCH`, `PUT`
- Methods implemented: `DELETE`, `PATCH`, `PUT`
- Initial missing count: 766
- Post-regeneration missing count: 763
- Assigned path missing entries after regeneration: 0

## Evidence Used

- Userdoccers `resources/channel.mdx` via https://docs.discord.food/resources/channel:
  - `PUT /channels/{channel.id}/recipients/@me` updates a message request status, returns a DM channel object, fires `CHANNEL_UPDATE`, and documents `consent_status`.
  - `DELETE /channels/{channel.id}/recipients/@me` rejects/deletes a pending message request, returns a DM channel object, and fires `CHANNEL_UPDATE`, `MESSAGE_ACK`, and `CHANNEL_DELETE`.
- Local xHyroM-derived catalog: `packages/automatic-reverse-engineering/data/catalogs/routes.xhyrom.catalog.json`
  - Contains `DELETE`, `PATCH`, and `PUT` for `/channels/{channel_id}/recipients/@me` as `CHANNEL_RECIPIENT_ME`.
- Local Userdoccers-derived catalog: `packages/automatic-reverse-engineering/data/catalogs/routes.userdoccers.catalog.json`
  - Contains `DELETE` summary `Reject Message Request` and `PUT` summary `Update Message Request`.
- Existing Spacebar behavior:
  - `Recipient.closed` controls whether a DM is visible/open to a user.
  - `Channel.createDMChannel` reopens an existing closed creator recipient for one-to-one DMs.
  - `DELETE /channels/{channel_id}` closes a DM for the current user with `Recipient.closed = true`.

## Changed Files

- `src/api/routes/channels/#channel_id/recipients.ts`
- `src/api/routes/channels/#channel_id/recipients.test.ts`
- `src/schemas/uncategorised/ChannelRecipientMeUpdateSchema.ts`
- `src/schemas/uncategorised/index.ts`
- `test/routes/channel-recipient-me-route.test.ts`
- `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`
- `packages/missing-routes/missing.json`
- `assets/schemas.json`
- `assets/openapi.json`
- `assets/testing-manifest.json`
- `test/generated/http-contracts.json`
- `test/generated/suite-coverage.json`
- `worker-progress/channels-param-recipients-me.md`

## Verification Commands

- `npm ci` passed; this worktree initially had no `node_modules`.
- `npm run build:src:tsgo` passed.
- `npm run generate:schema` passed.
- `npm run build:test-fixtures` passed.
- `node -r dotenv/config -r module-alias/register --enable-source-maps --test dist-test/src/api/routes/channels/#channel_id/recipients.test.js dist-test/test/routes/channel-recipient-me-route.test.js` passed.
- `npm run build --workspace @spacebar/automatic-reverse-engineering` passed.
- `node packages/automatic-reverse-engineering/dist/cli.js import-source-routes --root src/api/routes --out packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json` passed.
- `npm run build --workspace @spacebar/missing-routes` passed.
- `npm run start --workspace @spacebar/missing-routes` passed and reported `Spacebar is missing 763`.
- `npm run generate:testing-manifest` passed.
- `node scripts/testing-manifest/verify.js` passed.
- `node scripts/testing-manifest/generate-contract-tests.js --check` was stale initially; `npm run generate:contract-tests` was run; rerun check passed with 497 contracts.
- `node scripts/testing-manifest/generate-suite-coverage.js --check` was stale initially; `npm run generate:suite-coverage` was run; rerun check passed.
- `node --test test/generated/http-contracts.test.js test/generated/suite-coverage.test.js` passed.
- `npm run generate:openapi` passed; existing warnings remain for webhook routes without route metadata.
- `git diff --check` passed.
- Malformed AGPL warranty-token scan over changed files returned no matches.

## Generated Artifact Evidence

- Source catalog now contains:
  - `DELETE /channels/{channel_id}/recipients/@me`
  - `PATCH /channels/{channel_id}/recipients/@me`
  - `PUT /channels/{channel_id}/recipients/@me`
- Source catalog metadata includes `DmChannelDTO` and `APIErrorResponse`; `PATCH` and `PUT` include `ChannelRecipientMeUpdateSchema`.
- Testing manifest and contract matrix contain bearer-auth contracts for all three methods at `/channels/:channel_id/recipients/@me`.
- OpenAPI contains all three methods at `/channels/{channel_id}/recipients/@me`; `PATCH`/`PUT` request bodies reference `ChannelRecipientMeUpdateSchema`, and authenticated error metadata includes `APIErrorResponse`.

## Orchestrator Current-Base Acceptance

- Ported only source, schema, focused test, generated-artifact test, and report changes onto `43956787a`.
- Regenerated generated artifacts on the current main checkout rather than copying stale worker artifacts.
- Added AGPL headers to new test/report files before acceptance.
- Current-base missing-route movement: `755 -> 752` missing and `425 -> 428` implemented.
- Current-base generated artifacts: testing manifest `533` entries, generated HTTP contracts `508` contracts, OpenAPI `339` paths and `828` schemas.
- Current-base verification passed:
  - `npm run build:src:tsgo`
  - `npm run generate:schema`
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
  - `npm run build:test-fixtures`
  - `node -r dotenv/config -r module-alias/register --enable-source-maps --test dist-test/src/api/routes/channels/#channel_id/recipients.test.js dist-test/test/routes/channel-recipient-me-route.test.js`
  - `node --test test/generated/http-contracts.test.js test/generated/suite-coverage.test.js`

## Risks And Notes

- Spacebar does not have a separate durable message-request status table. The implementation uses the existing `Recipient.closed` DM visibility state as the narrow compatibility backing.
- Normal users can only set `consent_status: 2` (`ACCEPTED`) via `PUT`/`PATCH`; other statuses are treated as employee-only and return missing permissions.
- `PATCH` is present only in the xHyroM client route catalog, so it intentionally shares the `PUT` update semantics.
- `DELETE` emits `MESSAGE_ACK` only when the channel has `last_message_id`; there is no safe message to acknowledge otherwise.

## Recommended Next Tasks

- Implement a durable message-request state model if Spacebar needs to distinguish active DMs, pending requests, rejected requests, and spam requests beyond the current `Recipient.closed` compatibility layer.
- Implement the adjacent batch reject and supplemental message-request data routes under separate assignments.
