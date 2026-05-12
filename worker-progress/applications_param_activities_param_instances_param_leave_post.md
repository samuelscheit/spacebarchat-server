# POST /applications/{param}/activities/{param}/instances/{param}/leave

## Summary

Implemented the assigned method-scoped route:

- `POST /applications/{application_id}/activities/{instance_location_id}/instances/{instance_instance_id}/leave`
- Source route name: `POST_APPLICATIONS_APPLICATION_ID_ACTIVITIES_INSTANCE_LOCATION_ID_INSTANCES_INSTANCE_INSTANCE_ID_LEAVE`
- Local behavior: validates the JSON body `session_id`, parses Userdoccers embedded activity location IDs, verifies the caller owns the persisted session and is in the requested voice location, removes only the matching locally persisted activity instance from that session, emits `PRESENCE_UPDATE`, and returns `{}`.
- Fails closed with 403 when the local session, voice state, or matching activity instance cannot prove the leave action is valid; uses 404 for unknown session.

## Changed Files

- `src/api/routes/applications/#application_id/activities/#instance_location_id/instances/#instance_instance_id/leave.ts`
- `src/api/routes/applications/#application_id/activities/#instance_location_id/instances/#instance_instance_id/leave.test.ts`
- `src/schemas/uncategorised/EmbeddedActivityInstanceLeaveSchema.ts`
- `src/schemas/responses/EmbeddedActivityInstanceLeaveResponse.ts`
- `src/schemas/uncategorised/index.ts`
- `src/schemas/responses/index.ts`
- `tsconfig.test.json`
- `assets/schemas.json`
- `assets/openapi.json`
- `assets/testing-manifest.json`
- `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`
- `packages/missing-routes/missing.json`
- `test/generated/http-contracts.json`
- `test/generated/suite-coverage.json`

## Missing-Route Movement

- Base `b764b04ca`: 519 missing entries; assigned POST leave entry present.
- After regeneration: 518 missing entries; assigned POST leave entry absent.
- New source catalog entry:
    - `POST /applications/{application_id}/activities/{instance_location_id}/instances/{instance_instance_id}/leave`
    - request schema `EmbeddedActivityInstanceLeaveSchema`
    - response schemas `APIErrorResponse`, `EmbeddedActivityInstanceLeaveResponse`

## Evidence Sources

- `packages/missing-routes/missing.json`: assigned entry and source route name.
- `packages/automatic-reverse-engineering/data/catalogs/routes.userdoccers.catalog.json`: Userdoccers source route.
- `packages/automatic-reverse-engineering/data/catalogs/routes.xhyrom.catalog.json`: xHyroM `ACTIVITY_LEAVE` route.
- Userdoccers `pages/resources/application.mdx`:
    - Embedded activity instance ID and location ID formats: `i-<instance_id>-<location_kind>-<location_guild_id>-<location_channel_id>` and `<location_kind>-<location_guild_id>-<location_channel_id>`, with guild omitted for private channels.
    - Leave endpoint returns an empty object and accepts JSON `session_id`.
- Local implementation patterns:
    - `src/api/routes/activities/#application_id/instances/#channel_id/index.ts` for persisted activity/voice-state derivation.
    - `src/api/routes/users/#user_id/sessions/#session_id/activities/#application_id/#activity_action_type.ts` for current-user session checks and fail-closed activity access.
    - `src/gateway/opcodes/PresenceUpdate.ts` and `src/api/routes/users/@me/settings.ts` for `PRESENCE_UPDATE` event shape after session activity changes.

## Commands Run

- `npm ci` - passed; installed missing local dependencies.
- `npm run build:src:tsgo` - passed after `npm ci`.
- `npm run generate:schema` - passed.
- `npm run generate:openapi` - passed; OpenAPI listed the new POST leave route.
- `npm run build --workspace @spacebar/automatic-reverse-engineering` - passed.
- `node packages/automatic-reverse-engineering/dist/cli.js import-source-routes --root src/api/routes --out packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json` - passed.
- `npm run build --workspace @spacebar/missing-routes` - passed.
- `npm run start --workspace @spacebar/missing-routes` - passed; wrote 518 missing entries.
- `npm run generate:testing-manifest` - passed.
- `npm run generate:contract-tests` - passed.
- `npm run generate:suite-coverage` - passed.
- Focused source test:
    - `TS_NODE_TRANSPILE_ONLY=1 node -r dotenv/config -r ts-node/register/transpile-only -r module-alias/register --enable-source-maps --test 'src/api/routes/applications/#application_id/activities/#instance_location_id/instances/#instance_instance_id/leave.test.ts'` - passed, 6 tests.
- `npm run build:test-fixtures` - passed.
- Focused built test:
    - `node -r dotenv/config -r module-alias/register --enable-source-maps --test 'dist-test/src/api/routes/applications/#application_id/activities/#instance_location_id/instances/#instance_instance_id/leave.test.js'` - passed, 6 tests.
- `npm run test:manifest` - passed.
- `npm run test:suite-coverage` - passed.
- `npm run test:contracts` - failed only in known unrelated runtime contract:
    - `api:http:GET:/discovery/search` returned `500 !== 200`.
    - Static contract generation/checks passed before the runtime phase.
- Targeted ESLint for touched TS files - passed.
- `git diff --check` - passed.
- Package/lockfile guard:
    - `git diff --exit-code -- package.json package-lock.json` - passed.

## Risks And Blockers

- This route cannot synthesize Discord's full embedded-activity backend state. It only mutates locally persisted `Session.activities` after verifying the current user's session and voice location.
- No dedicated local embedded activity instance table or gateway embedded-activity event exists in this codebase, so the durable side effect is limited to session activity removal plus `PRESENCE_UPDATE`.
- Existing older channel-instance helper formats guild composite IDs without the guild id; this route follows the Userdoccers source format for `instance.location.id` while matching raw persisted activity party IDs.
- `npm run test:contracts` remains blocked by unrelated `api:http:GET:/discovery/search` runtime `500 !== 200`, explicitly called out by the assignment.

## Orchestrator Merge Reconciliation

- Replayed the scoped worker changes onto integration commit `64809c3a4`.
- Regenerated schemas, OpenAPI, source catalog, missing-route report, testing
  manifest, generated HTTP contracts, and suite coverage from the current
  integration checkout.
- Current integration missing-route movement: `514 -> 513`; implemented routes:
  `666 -> 667`; Discord routes: `1128`.
- Current generated artifact sizes after reconciliation: OpenAPI `551` paths /
  `1201` schemas, testing manifest `772` entries, and generated HTTP contracts
  `747` contracts.
- Focused source and built leave-route tests passed, generated HTTP/suite tests
  passed, targeted ESLint passed, `git diff --check` passed, and the
  package/lockfile guard remained clean.
- Full `npm run test:contracts` still fails only on the known unrelated runtime
  contract: `api:http:GET:/discovery/search` returns `500 !== 200`.

## Sibling Routes Intentionally Untouched

- `POST /activities/{channel_id}/{application_id}` launch route.
- `GET /applications/{application_id}/activity-instances/{activity_instance_composite_instance_id}`.
- Application embedded activity config/proxy/configuration routes.
- Any adjacent `applications/{application_id}` routes or sibling methods.

## Recommended Next Tasks

- Address the unrelated `GET /discovery/search` runtime contract failure separately.
- Consider a shared embedded activity instance model if future workers implement launch, lookup, or richer activity-instance gateway events.
