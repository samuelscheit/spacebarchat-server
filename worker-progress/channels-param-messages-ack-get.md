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

# channels-param-messages-ack-get

## Summary

Implemented `GET` and `PATCH /channels/{channel_id}/messages/ack` on current
base. The route exposes the authenticated user's local channel read-state
fields and updates only durable Spacebar-owned read-state values because source
catalogs identify the path/methods but do not document Discord's exact
channel-level ack-token contract.

## Scope

- Assigned route path: `/channels/{param}/messages/ack`
- Missing methods found and implemented: `GET`, `PATCH`
- Route names: `GET_CHANNELS_CHANNEL_ID_MESSAGES_ACK`,
  `PATCH_CHANNELS_CHANNEL_ID_MESSAGES_ACK`
- Source evidence: `xhyrom:data/client/routes.json`; Userdoccers only documents
  adjacent read-state behavior.
- Adjacent paths were not changed.

## Behavior

- `GET` requires bearer auth and `VIEW_CHANNEL`, then returns the current user's
  channel `ReadState` or an empty local channel read-state representation.
- `PATCH` requires bearer auth and `VIEW_CHANNEL`, accepts `message_id` or
  `last_message_id`, local `mention_count`, `last_viewed`, and `flags`, ignores
  non-persisted source-ambiguous `manual` and `token`, emits `MESSAGE_ACK` with
  version `3763` when a cursor is supplied, and returns the resulting local ack
  state.
- `PATCH` rejects conflicting cursor ids, non-snowflake cursors, zero-like or
  short cursor ids, and negative or unsafe integer local counters before
  mutating state. The accepted cursor pattern is `^[1-9]\d{16,19}$`.

## Changed Files

- `src/api/routes/channels/#channel_id/messages/index.ts`
- `src/schemas/uncategorised/MessageAcknowledgeSchema.ts`
- `src/schemas/responses/ChannelMessagesAckStateResponse.ts`
- `src/schemas/responses/index.ts`
- `test/routes/channels-param-messages-ack-get-patch.test.ts`
- `assets/schemas.json`
- `assets/openapi.json`
- `assets/testing-manifest.json`
- `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`
- `packages/missing-routes/missing.json`
- `test/generated/http-contracts.json`
- `test/generated/suite-coverage.json`
- `worker-progress/channels-param-messages-ack-get.md`

## Current-Base Verification

- `npm run build:src:tsgo`: passed.
- `npm run generate:schema`: passed, `1062` schemas.
- `npm run build --workspace @spacebar/automatic-reverse-engineering`: passed.
- Source route import: passed.
- `npm run build --workspace @spacebar/missing-routes`: passed.
- `npm run start --workspace @spacebar/missing-routes`: passed,
  `missing = 616`, `spacebar = 564`, `discord = 1128`.
- `npm run generate:openapi`: passed, `456` paths and `1062` schemas.
- `npm run generate:testing-manifest`: passed, `669` entries.
- `node scripts/testing-manifest/verify.js`: passed.
- `npm run generate:contract-tests`: passed, `644` contracts.
- `npm run generate:suite-coverage`: passed, `15` suites.
- `npm run build:test-fixtures`: passed.
- Focused compiled route/schema test: passed, `4/4`.
- `node --test test/generated/http-contracts.test.js`: passed, `9/9`.
- `node --test test/generated/suite-coverage.test.js`: passed, `4/4`.
- `node scripts/testing-manifest/generate-contract-tests.js --check`: passed.
- `npm run test:suite-coverage`: passed.
- `npm run test:manifest`: passed, `30/30`, manifest verified.
- `npm run lint`: passed.
- `git diff --check`: passed.
- Package/lockfile guard: `package.json` and `package-lock.json` unchanged.
- Malformed warranty-token scan over changed text files: passed.
- `npm run test:contracts`: static generated checks passed; runtime sweep failed
  only on known unrelated `api:http:GET:/discovery/search` returning `500`
  instead of `200`, with existing analytics `query` route-registration warnings.

## Missing-Route Count Movement

- Current base before accepting this worker: `618` missing / `562` implemented /
  `1128` Discord.
- After current-base regeneration: `616` missing / `564` implemented /
  `1128` Discord.
- No `missing_entries[]` item remains for `GET` or `PATCH
/channels/{param}/messages/ack`.

## Risks

- Source evidence for this route only provides method/path metadata, not exact
  Discord response body or ack-token semantics. The implementation is
  intentionally conservative and local-state-backed.
- Full runtime contract sweep remains blocked by unrelated `/discovery/search`
  behavior.
