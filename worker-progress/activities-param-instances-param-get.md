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

# activities-param-instances-param-get

## Summary

Implemented `GET /activities/{application_id}/instances/{channel_id}` for the assigned missing path `/activities/{param}/instances/{param}`.

The route is bearer-authenticated and bot-only, verifies the authenticated bot owns the requested application, checks channel visibility, and returns `EmbeddedActivityInstancesResponse`. Spacebar does not persist complete embedded activity instance state, so the compatibility behavior only returns instances that can be honestly inferred from voice-state sessions whose stored presence activity has the matching `application_id` and a party id. Matching activities without a party id return no fabricated instance.

## Goal Evidence

- `create_goal` was called first with the assigned worker objective.
- Initial `get_goal` after setup returned status `active` and objective `Implement production-ready support for the assigned missing route path /activities/{param}/instances/{param} on the current-base worker branch, with focused tests, regenerated route catalogs and generated route artifacts, verification evidence, and a complete handoff report.`
- Final pre-handoff `get_goal` returned status `active` for the same objective.

## Source Evidence

- Baseline missing entry: `GET /activities/{application_id}/instances/{channel_id}`, route name `GET_ACTIVITIES_APPLICATION_ID_INSTANCES_CHANNEL_ID`, summary `Get Embedded Activity Instances`.
- Userdoccers source: `userdoccers:resources/application.mdx`.
- URL used: `https://raw.githubusercontent.com/discord-userdoccers/discord-userdoccers/master/pages/resources/application.mdx`.
- Source notes: the documented endpoint is deprecated, not usable by user accounts, and returns `{ instances: [...] }` where each channel activity instance includes `application_id`, `instance_id`, `channel_id`, optional `guild_id`, and `users`.

## Changed Files

- `src/api/routes/activities/#application_id/instances/#channel_id/index.ts`
- `src/schemas/responses/EmbeddedActivityInstancesResponse.ts`
- `src/schemas/responses/index.ts`
- `test/routes/embeddedActivityInstancesRoute.test.ts`
- `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`
- `packages/missing-routes/missing.json`
- `assets/schemas.json`
- `assets/testing-manifest.json`
- `assets/openapi.json`
- `test/generated/http-contracts.json`
- `worker-progress/activities-param-instances-param-get.md`

## Behavior Details

- Requires a bearer token through the existing API auth middleware.
- Rejects non-bot callers with `BOT_ONLY_ENDPOINT`.
- Loads the requested application with its bot relation and rejects bot tokens for any other application.
- Loads the requested channel and requires `VIEW_CHANNEL`; missing permission subjects are treated as a permission denial.
- Finds voice states in the channel, loads matching sessions, and groups matching activities by party id into channel activity instances.
- Uses `i-{party_id}-{gc|pc}-{channel_id}` as the composite instance id unless the party id is already a matching composite id.
- Returns empty `instances` when Spacebar has no inferable embedded-activity party id rather than inventing unsupported live state.

## Missing-Route Movement

- Before regeneration: `missing` was 847, `spacebar` was 333, and the assigned entry existed.
- After regeneration: `missing` is 846, `spacebar` is 334, and `/activities/{param}/instances/{param}` has no remaining missing entries.
- Orchestrator current-base integration: after replaying the scoped source/test
  changes onto `bc46ea83f` and regenerating artifacts, `missing` is 826 and
  `spacebar` is 354 with no remaining `/activities/{param}/instances/{param}`
  entries.

## Commands Run

- `sed -n '1,240p' /Users/user/Developer/Developer/spacebarchat/WORKER_BRIEF.md`
- `git status --short --branch`
- Route and evidence searches with `rg`, `find`, and Userdoccers raw GitHub source lookup.
- `npm run build:src:tsgo` failed initially because dependencies were not installed in this worktree: missing `@types/node`.
- `npm ci` succeeded and did not change package manifests.
- `npm run build:src:tsgo` passed after dependency install; reran after the final route edge-case fix and passed.
- `npm run build:test-fixtures` passed; reran after generated contract artifacts and passed.
- `node -r dotenv/config -r module-alias/register --enable-source-maps --test dist-test/test/routes/embeddedActivityInstancesRoute.test.js` passed: 7 tests.
- `npm run build --workspace @spacebar/automatic-reverse-engineering` passed.
- `node packages/automatic-reverse-engineering/dist/cli.js import-source-routes --root src/api/routes --out packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json` passed.
- `npm run build --workspace @spacebar/missing-routes` passed.
- `npm run start --workspace @spacebar/missing-routes` passed and wrote `Spacebar is missing 846`.
- `npm run generate:schema` passed and wrote 673 schemas.
- `npm run generate:testing-manifest` passed and wrote 439 entries.
- `node scripts/testing-manifest/verify.js` passed.
- `node scripts/testing-manifest/generate-contract-tests.js --check || npm run generate:contract-tests` regenerated stale contracts.
- `node scripts/testing-manifest/generate-contract-tests.js --check` passed with 414 contracts.
- `node scripts/testing-manifest/generate-suite-coverage.js --check || npm run generate:suite-coverage` passed without regeneration.
- `node scripts/testing-manifest/generate-suite-coverage.js --check` passed.
- `npm run generate:openapi` passed and wrote 259 paths and 673 schemas. It reported the existing three route-metadata warnings under `webhooks/#webhook_id/index.js`.
- `node --test test/generated/http-contracts.test.js test/generated/suite-coverage.test.js` passed: 13 tests.
- `npx prettier --write src/api/routes/activities/#application_id/instances/#channel_id/index.ts src/schemas/responses/EmbeddedActivityInstancesResponse.ts src/schemas/responses/index.ts test/routes/embeddedActivityInstancesRoute.test.ts` was unchanged.
- `git diff --check` passed.
- `git diff -- package.json package-lock.json npm-shrinkwrap.json --exit-code` passed.
- Changed/untracked-file warranty spelling scan printed nothing.

## Risks And Blockers

- Spacebar still lacks a first-class embedded activity instance store, launch id, or participant state separate from voice/presence data. This route therefore cannot report Discord-live instances unless users have matching voice states, matching sessions, and a matching activity party id.
- The route intentionally does not implement adjacent embedded activity launch, leave, config, or `/applications/{application_id}/activity-instances/{...}` behavior.
- No blockers remain for this assigned route.

## Recommended Next Tasks

- Implement the newer `GET /applications/{application_id}/activity-instances/{activity_instance_composite_instance_id}` route in a separate worker scope if assigned.
- Add a real embedded activity instance persistence model if Spacebar later implements launch/leave activity lifecycle routes.
