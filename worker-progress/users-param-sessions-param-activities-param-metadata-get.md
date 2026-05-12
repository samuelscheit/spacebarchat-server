# users-param-sessions-param-activities-param-metadata-get

## Summary

Accepted and integrated `GET /users/{user_id}/sessions/{session_id}/activities/{application_id}/metadata` on current main.

The route:
- Requires bearer authentication.
- Lets users read metadata from their own non-admin sessions.
- Lets friends read metadata from visible target-user sessions.
- Rejects non-friends and hidden target sessions with Missing Access.
- Returns Unknown Session when an accessible user/session tuple is absent locally.
- Returns `204` when the activity is absent or has no object metadata.
- Uses `application_id=0` for the last unassociated `LISTENING` activity.

## Assigned Path

- Worker id: `users-param-sessions-param-activities-param-metadata-get`
- Method/path: `GET /users/{user_id}/sessions/{session_id}/activities/{application_id}/metadata`
- Source references: Userdoccers `resources/presence.mdx`; local xHyroM `USER_ACTIVITY_METADATA` route evidence.
- Methods implemented: `GET`
- Adjacent routes intentionally untouched:
  - `GET /users/{param}/sessions/{param}/activities/{param}/{param}`
  - `GET /users/{param}/sessions/{param}/activities/{param}/1`

## Changed Files

Primary implementation:
- `src/api/routes/users/#user_id/sessions/#session_id/activities/#application_id/metadata.ts`
- `src/schemas/responses/ActivityMetadataResponse.ts`
- `src/schemas/responses/index.ts`
- `test/routes/users-activity-metadata-route.test.ts`

Generated artifacts:
- `assets/schemas.json`
- `assets/openapi.json`
- `assets/testing-manifest.json`
- `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`
- `packages/missing-routes/missing.json`
- `test/generated/http-contracts.json`
- `test/generated/suite-coverage.json`

## Current-Base Movement

- Base before integration: `5973eb019 Implement channel store listing SKU route`
- Missing routes: `602 -> 601`
- Implemented Spacebar routes: `578 -> 579`
- Discord routes: `1128` unchanged
- The assigned metadata route is removed from `packages/missing-routes/missing.json`.

## Behavior Notes

- The implementation returns only locally persisted `Session.activities[].metadata`; it does not synthesize Discord-only state.
- Non-`0` application IDs match `activity.application_id`.
- `application_id=0` selects the last `LISTENING` activity with no `application_id`.
- Metadata must be an object; absent or non-object metadata returns `204`.
- Session lookup excludes admin sessions with `is_admin_session: false`.
- Self access does not require a relationship row.
- Other-user access requires a local `RelationshipType.friends` relationship and a session status other than `offline` or `invisible`.

## Verification

All npm/node commands used `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH"`.

Passed:
- `npm run build:src:tsgo`
- `npm run generate:schema`
- `npm run generate:openapi`
- `npm run build --workspace @spacebar/automatic-reverse-engineering`
- `node packages/automatic-reverse-engineering/dist/cli.js import-source-routes --root src/api/routes --out packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`
- `npm run build --workspace @spacebar/missing-routes`
- `npm run start --workspace @spacebar/missing-routes`
- `npm run generate:testing-manifest`
- `npm run generate:contract-tests`
- `npm run generate:suite-coverage`
- `npm run build:test-fixtures`
- `node -r dotenv/config -r module-alias/register --enable-source-maps --test dist-test/test/routes/users-activity-metadata-route.test.js`
- `node scripts/testing-manifest/verify.js`
- `node scripts/testing-manifest/generate-contract-tests.js --check`
- `node scripts/testing-manifest/generate-suite-coverage.js --check`
- `node --test test/generated/http-contracts.test.js test/generated/suite-coverage.test.js`
- `npm run test:suite-coverage`
- `npm run lint`
- `git diff --check`
- `git diff --exit-code -- package.json package-lock.json bun.lock`

Known unrelated baseline:
- `npm run test:contracts` failed only at `api:http:GET:/discovery/search` returning `500` instead of expected `200`.

## Risks

- The route exposes the local session activity metadata shape currently stored by Spacebar. If future persistence adds richer typed activity metadata, this endpoint should be reviewed to expose that data through typed storage rather than response synthesis.
