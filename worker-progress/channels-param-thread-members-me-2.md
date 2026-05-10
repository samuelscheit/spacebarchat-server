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

Goal status: active
Goal objective: Implement production-ready `DELETE` and `PUT` support for `/channels/{param}/thread-members/@me` on the current integration branch, with focused tests, regenerated route catalogs and generated route artifacts, verification evidence, and a complete handoff report.
Goal evidence: `get_goal` after implementation reported status `active`, objective unchanged, tokensUsed `369340`, timeUsedSeconds `692`.

## Summary

Implemented exact literal `PUT /channels/:channel_id/thread-members/@me` and `DELETE /channels/:channel_id/thread-members/@me` support in `src/api/routes/channels/#channel_id/thread-members.ts`.

The existing dynamic `/:user_id` behavior already handled `@me` at runtime. The production change adds explicit literal route registrations so route catalogs and generated artifacts recognize the Userdoccers `Join Thread` and `Leave Thread` endpoints, while preserving existing dynamic add/remove behavior.

## Assigned Scope

- Route id: `channels-param-thread-members-me-2`
- Assigned path: `/channels/{param}/thread-members/@me`
- Owned methods: `DELETE`, `PUT`
- Missing entries derived before implementation:
  - `DELETE /channels/{param}/thread-members/@me`, `DELETE_CHANNELS_CHANNEL_ID_THREAD_MEMBERS__ME`, source `userdoccers:resources/channel.mdx`, summary `Leave Thread`
  - `PUT /channels/{param}/thread-members/@me`, `PUT_CHANNELS_CHANNEL_ID_THREAD_MEMBERS__ME`, source `userdoccers:resources/channel.mdx`, summary `Join Thread`
- Confirmed absent before implementation:
  - `routes.source.catalog.json` contained only `/{user_id}` entries and `PATCH /@me/settings`, not exact `DELETE`/`PUT /@me`
  - `src/api/routes/channels/#channel_id/thread-members.ts` contained `PUT /:user_id` and `DELETE /:user_id`, not exact literal `PUT`/`DELETE /@me`

## References

- Local Userdoccers catalog: `packages/automatic-reverse-engineering/data/catalogs/routes.userdoccers.catalog.json`
- Local xHyroM catalog: `packages/automatic-reverse-engineering/data/catalogs/routes.xhyrom.catalog.json`
- Userdoccers page checked: `https://docs.discord.food/resources/channel`
  - `Join Thread`: `PUT /channels/{channel.id}/thread-members/@me`, requires `VIEW_CHANNEL`, not archived, 204, fires Thread Members Update and Thread Create.
  - `Leave Thread`: `DELETE /channels/{channel.id}/thread-members/@me`, not archived, 204, fires Thread Members Update.

## Changed Files

- `src/api/routes/channels/#channel_id/thread-members.ts`
  - Added literal `router.put("/@me", joinThreadRoute, addThreadMember)`.
  - Added literal `router.delete("/@me", leaveThreadRoute, removeThreadMember)`.
  - Refactored delete handler into exported `removeThreadMember`.
  - Exported `addThreadMember` for focused handler tests.
  - Resolves absent `user_id` params as `@me`, preserving dynamic `/:user_id` behavior.
- `src/api/routes/channels/#channel_id/thread-members.test.ts`
  - Added no-database focused handler tests for self join and self leave through literal-path semantics.
- `test/scenarios/channels-threads-supplemental.test.ts`
  - Added manifest coverage IDs for literal `DELETE` and `PUT /@me`.
  - Added integration-flow assertions for member-token self leave and self join through `/thread-members/@me`.
- Regenerated artifacts:
  - `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`
  - `packages/missing-routes/missing.json`
  - `assets/testing-manifest.json`
  - `test/generated/http-contracts.json`
  - `test/generated/suite-coverage.json`
  - `assets/openapi.json`

## Evidence

- Source catalog after regeneration contains:
  - `DELETE /channels/{channel_id}/thread-members/@me`
  - `PUT /channels/{channel_id}/thread-members/@me`
- Missing-route movement:
  - Before current-base integration: `missing = 786`, target entries for `/channels/{param}/thread-members/@me` = `2`
  - After current-base regeneration: `missing = 784`, target entries for `/channels/{param}/thread-members/@me` = `0`
- OpenAPI after regeneration contains `/channels/{channel_id}/thread-members/@me` with `put` summary `Join Thread`, `delete` summary `Leave Thread`, `VIEW_CHANNEL`, and 204/401/403 responses.
- Testing manifest contains:
  - `api:http:DELETE:/channels/:channel_id/thread-members/@me`
  - `api:http:PUT:/channels/:channel_id/thread-members/@me`
- HTTP contracts and suite coverage contain both literal manifest IDs.

## Commands Run

- `sed -n '1,220p' /Users/user/Developer/Developer/spacebarchat/WORKER_BRIEF.md`
- `jq '.missing_entries[] | select(.route == "/channels/{param}/thread-members/@me")' packages/missing-routes/missing.json`
- `jq '.[] | select(.source == "src/api/routes/channels/#channel_id/thread-members.ts")' packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`
- `jq '.[] | select(.route == "/channels/{channel_id}/thread-members/@me")' packages/automatic-reverse-engineering/data/catalogs/routes.userdoccers.catalog.json`
- `jq '.[] | select(.route | contains("/channels/{channel_id}/thread-members"))' packages/automatic-reverse-engineering/data/catalogs/routes.xhyrom.catalog.json`
- `npm run build:src:tsgo`
  - Passed on the current checkout.
- `TS_NODE_TRANSPILE_ONLY=1 node -r dotenv/config -r ts-node/register/transpile-only -r module-alias/register --enable-source-maps --test 'src/api/routes/channels/#channel_id/thread-members.test.ts'`
  - Passed: 2 tests.
- `npm run build:test-fixtures`
  - Passed.
- `node -r dotenv/config -r module-alias/register --enable-source-maps --test --test-concurrency=1 dist-test/test/scenarios/channels-threads-supplemental.test.js`
  - Parsed successfully; skipped because no `TEST_DATABASE_ADMIN_URL` or `DATABASE` is configured.
- `npm run build --workspace @spacebar/automatic-reverse-engineering`
  - Passed.
- `node packages/automatic-reverse-engineering/dist/cli.js import-source-routes --root src/api/routes --out packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`
  - Passed.
- `npm run build --workspace @spacebar/missing-routes`
  - Passed.
- `npm run start --workspace @spacebar/missing-routes`
  - Passed; wrote missing report with `missing 784`, `spacebar 396`, `discord 1128`.
- `npm run generate:testing-manifest`
  - Passed; wrote 501 entries.
- `node scripts/testing-manifest/verify.js`
  - Passed; verified 501 entries.
- `node scripts/testing-manifest/generate-contract-tests.js --check`
  - Initially stale, then passed after regeneration.
- `npm run generate:contract-tests`
  - Passed; wrote 476 contracts.
- `node scripts/testing-manifest/generate-suite-coverage.js --check`
  - Initially stale, then passed after regeneration.
- `npm run generate:suite-coverage`
  - Passed; wrote 15 suites.
- `npm run generate:openapi`
  - Passed; wrote 314 paths and 788 schemas.
- `git diff --check`
  - Passed.
- `rg` scan for malformed AGPL warranty-line spellings in the touched route, route test, and progress report.
  - No malformed warranty lines found.

## Artifact Status

- Source route catalog: regenerated and includes both literal entries.
- Missing-route report: regenerated; assigned entries removed.
- Testing manifest: regenerated and verified.
- Generated HTTP contracts: regenerated and verified.
- Generated suite coverage: regenerated and verified.
- OpenAPI: regenerated successfully.
- Schemas: not regenerated because no request or response schema types changed.

## Completion Audit

Prompt-to-artifact audit passed with a local Node check covering:

- Literal route registrations for `PUT /@me` and `DELETE /@me`.
- Source catalog entries for both exact literal methods.
- Missing count `784` and zero remaining assigned-path missing entries.
- Testing manifest, generated HTTP contracts, and generated suite coverage all contain both literal manifest IDs.
- OpenAPI contains both `put` and `delete` operations for `/channels/{channel_id}/thread-members/@me`.
- Worker progress handoff exists.

## Risks And Blockers

- The scenario integration test could not execute behavior locally because the worker environment lacks `TEST_DATABASE_ADMIN_URL` or `DATABASE`; the scenario file parsed and skipped, and the added no-database handler tests passed.

## Recommended Next Tasks

- Run `test/scenarios/channels-threads-supplemental.test.ts` in an environment with disposable Postgres configured to exercise the new literal self join/leave flow end to end.
