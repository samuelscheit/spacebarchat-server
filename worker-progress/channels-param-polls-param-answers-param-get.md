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

# channels-param-polls-param-answers-param-get

## Summary

Implemented `GET /channels/{channel_id}/polls/{message_id}/answers/{poll_answer_id}` as an authenticated, channel-scoped route. The route validates the poll message and answer id, enforces `VIEW_CHANNEL` plus `READ_MESSAGE_HISTORY` for non-authors, and returns the documented response shape `{ "users": [] }`.

Spacebar stores poll definitions and aggregate counts on `Message.poll`, but does not currently persist per-answer voter IDs. Returning an empty `users` array after validating the target poll answer is the compatible behavior supported by the local data model.

## Assigned path

- Assigned route path: `/channels/{param}/polls/{param}/answers/{param}`
- Missing methods found: `GET`
- Source route: `/channels/{channel_id}/polls/{message_id}/answers/{poll_answer_id}`
- Route names: `GET_CHANNELS_CHANNEL_ID_POLLS_MESSAGE_ID_ANSWERS_POLL_ANSWER_ID`, `POLL_ANSWER_VOTERS`
- Sources: `userdoccers:resources/message.mdx`, `xhyrom:data/client/routes.json`
- Methods implemented: `GET`

## Changed files

- `src/api/routes/channels/#channel_id/polls/#message_id/answers/#poll_answer_id.ts`
- `src/schemas/responses/PollAnswerVotersResponse.ts`
- `src/schemas/responses/index.ts`
- `test/routes/pollAnswerVotersRoute.test.ts`
- `assets/schemas.json`
- `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`
- `packages/missing-routes/missing.json`
- `assets/testing-manifest.json`
- `test/generated/http-contracts.json`
- `test/generated/suite-coverage.json`
- `assets/openapi.json`
- `worker-progress/channels-param-polls-param-answers-param-get.md`

## Behavior

- Declares `200`, `400`, `401`, `403`, and `404` route metadata; `200` uses `PollAnswerVotersResponse`.
- Requires `VIEW_CHANNEL` through route middleware.
- Validates `poll_answer_id` as a positive integer.
- Validates optional `after` as a snowflake string.
- Validates optional `limit` between 1 and 100, with a default-compatible value of 25.
- Loads the message by `{ id: message_id, channel_id }`.
- Returns Discord unknown-message code `10008` when the message exists but is not a poll.
- Returns 404 when the poll does not contain the requested answer id.
- Requires `READ_MESSAGE_HISTORY` when the requester is not the poll message author.
- Returns `{ users: [] }` for valid poll answers until poll voter state exists.

## Current-base verification

- `npm run build:src:tsgo`: passed.
- `npm run generate:schema`: passed; wrote 818 schemas.
- `npm run build:test-fixtures`: passed.
- Focused compiled test:
  `node -r dotenv/config -r module-alias/register --enable-source-maps --test dist-test/test/routes/pollAnswerVotersRoute.test.js`: passed, 7/7 tests.
- `npm run build --workspace @spacebar/automatic-reverse-engineering`: passed.
- Source route import: passed and added `/channels/{channel_id}/polls/{message_id}/answers/{poll_answer_id}`.
- `npm run build --workspace @spacebar/missing-routes`: passed.
- `npm run start --workspace @spacebar/missing-routes`: passed, `missing = 765`, `spacebar = 415`.
- `npm run generate:testing-manifest`: passed, 520 entries.
- `node scripts/testing-manifest/verify.js`: passed, 520 entries.
- Generated HTTP contracts: regenerated, then `--check` passed with 495 contracts.
- Generated suite coverage: regenerated, then `--check` passed with 15 suites.
- `node --test test/generated/http-contracts.test.js test/generated/suite-coverage.test.js`: passed, 13/13 tests.
- `npm run generate:openapi`: passed, 330 paths and 818 schemas. The webhook route-metadata warnings are pre-existing.

## Missing-route count movement

- Before current-base regeneration: `missing = 766`, `spacebar = 414`.
- After current-base regeneration: `missing = 765`, `spacebar = 415`.
- The assigned path is no longer present in `packages/missing-routes/missing.json`.

## Risks

- This route cannot return real voters until poll vote state is persisted. Future work should add a poll vote storage model and then page real voter users with `after` and `limit`.
- Poll voting and expiry routes remain separate missing-route work.

## Worker goal evidence

- The worker reported `create_goal` and `get_goal` for the assigned objective before implementation.
- The worker reported `update_goal(status: "complete")` with final goal time used: 894 seconds.
