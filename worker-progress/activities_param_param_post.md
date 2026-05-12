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

# Worker Progress: activities_param_param_post

## Summary

Implemented the assigned `POST /activities/{param}/{param}` missing route as `POST /activities/{channel_id}/{application_id}`.

The new route is bearer-authenticated, validates an `ActivityLaunchSchema` body, checks embedded-activity eligibility and channel support, verifies the caller is joined to the requested voice-capable channel with a non-admin session, persists a local embedded activity into the session presence, and emits a `PRESENCE_UPDATE`.

## Scope

- Assigned missing path: `/activities/{param}/{param}`.
- Implemented source path: `/activities/{channel_id}/{application_id}`.
- Route name: `POST_ACTIVITIES_CHANNEL_ID_APPLICATION_ID`.
- Summary: `Launch Embedded Activity`.
- Sources:
    - `userdoccers:resources/application.mdx`
    - `xhyrom:data/client/routes.json`
- Userdoccers URL used: `https://raw.githubusercontent.com/discord-userdoccers/discord-userdoccers/master/pages/resources/application.mdx`.
- Adjacent routes intentionally untouched: `/activities`, `/activities/{application_id}/instances/{channel_id}`, `/activities/{application_id}/test-mode`, activity metadata/secret routes, and application activity-instance routes.

## Behavior

- Requires bearer auth through the existing API route middleware.
- Request body is `ActivityLaunchSchema` with required non-empty `session_id`.
- Requires the target application to exist and have the `EMBEDDED` application flag.
- Requires the channel to exist and be `GUILD_VOICE`, `DM`, or `GROUP_DM`.
- Requires `VIEW_CHANNEL` and `CONNECT`.
- For guild channels, also requires `USE_EMBEDDED_ACTIVITIES`.
- For guild channels where local authorization cannot be proven through `application.guild_id === guildId` or app bot guild membership, also requires `USE_EXTERNAL_APPS`.
- Requires the caller's non-admin `Session` for the supplied `session_id`.
- Requires a matching `VoiceState` for the caller, session, and requested channel.
- Joins an existing local same-channel party id for the application when another voice session already has one; otherwise generates a UUID party id.
- Upserts the embedded activity into `Session.activities`, preserving unrelated activities and existing activity metadata where possible.
- Emits `PRESENCE_UPDATE` for the updated session activity state.
- Returns `204` with an empty response body on success.

## Changed Files

- `src/api/routes/activities/#channel_id/#application_id.ts`
- `src/schemas/uncategorised/ActivityLaunchSchema.ts`
- `src/schemas/uncategorised/index.ts`
- `test/routes/activity-launch-route.test.ts`
- `assets/schemas.json`
- `assets/openapi.json`
- `assets/testing-manifest.json`
- `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`
- `packages/missing-routes/missing.json`
- `test/generated/http-contracts.json`
- `worker-progress/activities_param_param_post.md`

## Generated Artifact Evidence

- Source catalog now includes `POST /activities/{channel_id}/{application_id}` from `src/api/routes/activities/#channel_id/#application_id.ts`.
- OpenAPI now exposes `/activities/{channel_id}/{application_id}/` with bearer security, `ActivityLaunchSchema` request body, `204`, and `APIErrorResponse` for `400`, `401`, `403`, and `404`.
- Testing manifest includes `api:http:POST:/activities/:channel_id/:application_id/` with `authMode: "bearer"`.
- Generated HTTP contracts include the new manifest id and request-body schema coverage.
- `assets/schemas.json` includes `ActivityLaunchSchema`.

## Missing-Route Movement

- Before regeneration: `missing = 519`, `spacebar = 661`, `discord = 1128`.
- After regeneration: `missing = 518`, `spacebar = 662`, `discord = 1128`.
- The assigned `POST /activities/{param}/{param}` missing entry is absent after regeneration.

## Commands Run And Verification

Passed:

- `npm ci`
- `npm run build:src:tsgo`
- `npx prettier --write src/api/routes/activities/#channel_id/#application_id.ts src/schemas/uncategorised/ActivityLaunchSchema.ts src/schemas/uncategorised/index.ts test/routes/activity-launch-route.test.ts`
- `npm run build:test-fixtures`
- `npm run generate:schema` - wrote 1197 schemas.
- `npm run generate:openapi` - wrote 546 paths and 1197 schemas; existing webhook route-metadata warnings were unchanged and unrelated.
- `npm run build --workspace @spacebar/automatic-reverse-engineering`
- `node packages/automatic-reverse-engineering/dist/cli.js import-source-routes --root src/api/routes --out packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`
- `npm run build --workspace @spacebar/missing-routes`
- `npm run start --workspace @spacebar/missing-routes` - wrote the missing-route movement above.
- `npm run generate:testing-manifest` - wrote 767 entries.
- `node scripts/testing-manifest/verify.js` - verified 767 entries.
- `npm run generate:contract-tests` - wrote 742 contracts.
- `node scripts/testing-manifest/generate-contract-tests.js --check` - verified 742 contracts.
- `npm run generate:suite-coverage` - wrote 15 suites.
- `node scripts/testing-manifest/generate-suite-coverage.js --check`
- `node --test test/generated/http-contracts.test.js test/generated/suite-coverage.test.js` - passed, 13 tests.
- `npm run test -- test/routes/activity-launch-route.test.ts` - passed, 10 tests.
- `node -r dotenv/config -r module-alias/register --enable-source-maps --test dist-test/test/routes/activity-launch-route.test.js` - passed, 10 tests.
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npx eslint src/api/routes/activities/#channel_id/#application_id.ts src/schemas/uncategorised/ActivityLaunchSchema.ts src/schemas/uncategorised/index.ts test/routes/activity-launch-route.test.ts`
- `git diff --check`
- `git diff --exit-code -- package.json package-lock.json bun.lock`

Known unrelated failure:

- `npm run test:contracts` regenerated/checked contracts and rebuilt source/test fixtures, then failed in the existing public response-schema runtime contract for `api:http:GET:/discovery/search` because that route returned `500` instead of the expected `200`.
- This failure is unrelated to the new activity launch route. Other generated and focused activity-launch tests passed.

## Risks And Blockers

- Spacebar does not currently have durable Discord interaction launch state for embedded activities. This route therefore persists the local session activity presence and emits presence only; it does not fabricate the optional accompanying application-command invocation.
- Party joining is inferred from local voice states and session activities. Without a first-class embedded activity instance store, the route cannot prove or mirror all Discord live launch state.
- No package manifest or lockfile changes were made.

## Reconciliation Notes

- Completion audit ran on `/Users/user/Developer/Developer/spacebarchat/worktrees/current-activities-param-param-post-agent` at base `b764b04ca` on branch `codex/current-missing-route-activities-param-param-post-agent`.
- `packages/missing-routes/missing.json` has zero remaining `POST /activities/{param}/{param}` entries with route name `POST_ACTIVITIES_CHANNEL_ID_APPLICATION_ID`.
- `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`, `assets/openapi.json`, `assets/testing-manifest.json`, `test/generated/http-contracts.json`, and `assets/schemas.json` all reference the implemented route and `ActivityLaunchSchema`.
- The only file under `src/api/routes/activities/#channel_id` is `#application_id.ts`, and it defines only `router.post`, so no sibling method or adjacent route was added under this assignment.

## Orchestrator Merge Reconciliation

- Replayed the scoped worker changes onto integration commit `0613b4bfb`.
- Regenerated schemas, OpenAPI, source catalog, missing-route report, testing
  manifest, generated HTTP contracts, and suite coverage from the current
  integration checkout.
- Current integration missing-route movement: `515 -> 514`; implemented routes:
  `665 -> 666`; Discord routes: `1128`.
- Current generated artifact sizes after reconciliation: testing manifest
  `771` entries and generated HTTP contracts `746` contracts.
- Focused source and built route tests passed, generated HTTP/suite tests
  passed, targeted ESLint passed, `git diff --check` passed, and the
  package/lockfile guard remained clean.
- Full `npm run test:contracts` still fails only on the known unrelated runtime
  contract: `api:http:GET:/discovery/search` returns `500 !== 200`.

## Recommended Next Tasks

- Add durable embedded activity instance and interaction launch state if Spacebar later needs to mirror Discord's optional application-command launch side effect.
- Revisit embedded activity party and participant modeling once related launch/leave/activity-instance routes are implemented.
