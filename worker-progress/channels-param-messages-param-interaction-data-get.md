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

# channels-param-messages-param-interaction-data-get

## Summary

Implemented `GET /channels/{channel_id}/messages/{message_id}/interaction-data` as an authenticated, channel-scoped route. It returns the documented interaction-data shape for messages created by application-command interactions and resolves the backing application command from stored command id, guild/global command lookup, or a stored command snapshot.

## Assigned path

- Assigned route path: `/channels/{param}/messages/{param}/interaction-data`
- Missing methods found: `GET`
- Source route: `/channels/{channel_id}/messages/{message_id}/interaction-data`
- Route names: `GET_CHANNELS_CHANNEL_ID_MESSAGES_MESSAGE_ID_INTERACTION_DATA`, `MESSAGE_INTERACTION_DATA`
- Sources: `userdoccers:resources/message.mdx`, `xhyrom:data/client/routes.json`
- Methods implemented: `GET`

## Changed files

- `src/api/routes/channels/#channel_id/messages/#message_id/interaction-data.ts`
- `src/api/routes/channels/#channel_id/messages/#message_id/interaction-data.test.ts`
- `src/api/routes/interactions/index.ts`
- `src/api/routes/interactions/#interaction_id/#interaction_token/callback.ts`
- `src/api/util/utility/InteractionMetadata.ts`
- `src/util/imports/Interactions.ts`
- `src/schemas/responses/MessageInteractionDataResponse.ts`
- `src/schemas/responses/index.ts`
- `tsconfig.test.json`
- `assets/schemas.json`
- `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`
- `packages/missing-routes/missing.json`
- `assets/testing-manifest.json`
- `test/generated/http-contracts.json`
- `test/generated/suite-coverage.json`
- `assets/openapi.json`
- `worker-progress/channels-param-messages-param-interaction-data-get.md`

## Behavior

- Declares `200`, `400`, `401`, `403`, and `404` route metadata; `200` uses `MessageInteractionDataResponse`.
- Requires `VIEW_CHANNEL` through route middleware and checks `READ_MESSAGE_HISTORY` when the requester is not the message author.
- Returns `UNKNOWN_INTERACTION` when the message has no interaction metadata or when no honest application-command data can be resolved.
- Persists command id, command snapshot, and submitted options for new application-command interaction responses so the route can resolve future responses without guessing.

## Current-base verification

- `npm run build:src:tsgo`: passed.
- `npm run generate:schema`: passed; wrote 817 schemas.
- `npm run build:test-fixtures`: passed.
- Focused compiled test:
  `node -r dotenv/config -r module-alias/register --enable-source-maps --test 'dist-test/src/api/routes/channels/#channel_id/messages/#message_id/interaction-data.test.js'`: passed, 3/3 tests.
- `npm run build --workspace @spacebar/automatic-reverse-engineering`: passed.
- Source route import: passed and added `/channels/{channel_id}/messages/{message_id}/interaction-data`.
- `npm run build --workspace @spacebar/missing-routes`: passed.
- `npm run start --workspace @spacebar/missing-routes`: passed, `missing = 769`, `spacebar = 411`.
- `npm run generate:testing-manifest`: passed, 516 entries.
- `node scripts/testing-manifest/verify.js`: passed, 516 entries.
- Generated HTTP contracts: regenerated, then `--check` passed with 491 contracts.
- Generated suite coverage: regenerated, then `--check` passed with 15 suites.
- `node --test test/generated/http-contracts.test.js test/generated/suite-coverage.test.js`: passed, 13/13 tests.
- `npm run generate:openapi`: passed, 328 paths and 817 schemas.

## Missing-route count movement

- Before current-base regeneration: `missing = 770`, `spacebar = 410`.
- After current-base regeneration: `missing = 769`, `spacebar = 411`.
- The assigned path is no longer present in `packages/missing-routes/missing.json`.

## Risks

- Older persisted interaction-response messages may only have name/type metadata. If the command cannot be found and no stored command snapshot exists, this route returns `UNKNOWN_INTERACTION` instead of fabricating an incomplete response.
- Broader interaction, message, and command endpoints remain separate work.

## Worker goal evidence

- The worker reported `create_goal` and `get_goal` for the assigned objective before implementation.
- The worker reported `update_goal(status: "complete")` with final goal time used: 998 seconds.
