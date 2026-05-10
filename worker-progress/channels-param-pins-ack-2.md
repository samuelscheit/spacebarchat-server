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

# channels-param-pins-ack-2

## Summary

Implemented `DELETE`, `POST`, and `PUT /channels/{channel_id}/pins/ack` before the legacy `/:message_id` pin routes so `ack` is no longer interpreted as a message id. The route acknowledges the current user's pinned-message read state for a channel, persists `ReadState.last_pin_timestamp`, emits a user-scoped `CHANNEL_PINS_ACK`, and returns `204`.

## Assigned path

- Assigned route path: `/channels/{param}/pins/ack`
- Missing methods found: `DELETE`, `POST`, `PUT`
- Source route: `/channels/{channel_id}/pins/ack`
- Route names: `PINS_ACK`, `POST_CHANNELS_CHANNEL_ID_PINS_ACK`
- Sources: `userdoccers:topics/read-state.mdx`, `xhyrom:data/client/routes.json`
- Methods implemented: `DELETE`, `POST`, `PUT`

## Changed files

- `src/api/routes/channels/#channel_id/pins.ts`
- `src/api/routes/channels/#channel_id/pins.test.ts`
- `src/util/util/ReadStatePersistence.ts`
- `src/util/util/ReadState.test.ts`
- `src/util/interfaces/Event.ts`
- `src/util/interfaces/Event.test.ts`
- `tsconfig.test.json`
- `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`
- `packages/missing-routes/missing.json`
- `assets/testing-manifest.json`
- `assets/openapi.json`
- `test/generated/http-contracts.json`
- `test/generated/suite-coverage.json`
- `worker-progress/channels-param-pins-ack-2.md`

## Behavior

- Declares authenticated route metadata with `VIEW_CHANNEL`, `204`, `400`, `401`, `403`, and `404`.
- Computes the latest current pin timestamp from `Message.pinned_at`; when no pins exist, it uses `1970-01-01T00:00:00.000Z`, matching existing read-state default behavior.
- Upserts only `ReadState.last_pin_timestamp`, leaving message read markers and notification cursors untouched.
- Emits `CHANNEL_PINS_ACK` with `{ channel_id, timestamp, version: 232 }` scoped to the current user.

## Current-base verification

- `npm run build:src:tsgo`: passed.
- `npm run build:test-fixtures`: passed.
- Focused compiled tests:
  `node -r dotenv/config -r module-alias/register --enable-source-maps --test 'dist-test/src/api/routes/channels/#channel_id/pins.test.js' 'dist-test/src/util/util/ReadState.test.js' 'dist-test/src/util/interfaces/Event.test.js'`: passed, 27/27 tests.
- `npm run build --workspace @spacebar/automatic-reverse-engineering`: passed.
- Source route import: passed and added `DELETE`, `POST`, and `PUT /channels/{channel_id}/pins/ack`.
- `npm run build --workspace @spacebar/missing-routes`: passed.
- `npm run start --workspace @spacebar/missing-routes`: passed, `missing = 766`, `spacebar = 414`.
- `npm run generate:testing-manifest`: passed, 519 entries.
- `node scripts/testing-manifest/verify.js`: passed, 519 entries.
- Generated HTTP contracts: regenerated, then `--check` passed with 494 contracts.
- Generated suite coverage: regenerated, then `--check` passed with 15 suites.
- `node --test test/generated/http-contracts.test.js test/generated/suite-coverage.test.js`: passed, 13/13 tests.
- `npm run generate:openapi`: passed, 329 paths and 817 schemas.
- Schema generation was not needed; no request/response schema type changed.

## Missing-route count movement

- Before current-base regeneration: `missing = 769`, `spacebar = 411`.
- After current-base regeneration: `missing = 766`, `spacebar = 414`.
- No `missing_entries[]` item remains whose `route` is `/channels/{param}/pins/ack`.

## Risks

- Existing pin/unpin routes still emit `CHANNEL_PINS_UPDATE` with `last_pin_timestamp: undefined` and do not maintain `Channel.last_pin_timestamp`; changing that behavior is separate work.
- For channels with no current pins, there is no source-backed last-pin value, so the route uses the existing read-state default timestamp.

## Worker goal evidence

- The worker reported `create_goal` and `get_goal` for the assigned objective before implementation.
- The worker pane reported the goal complete with time used: 1031 seconds.
