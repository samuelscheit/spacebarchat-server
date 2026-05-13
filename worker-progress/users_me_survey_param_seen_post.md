# users_me_survey_param_seen_post

## Summary

Implemented the assigned `POST /users/@me/survey/{param}/seen` route as `POST /users/@me/survey/:survey_id/seen` in the existing current-user survey router. The route validates the survey id, remains bearer-authenticated, and returns a local `204` acknowledgement without fabricating Discord-private survey prompt state.

## Assignment

- Assigned route: `POST /users/@me/survey/{param}/seen`
- Assigned route name: `POST_USERS__ME_SURVEY_SURVEY_ID_SEEN`
- Method scope: only `POST`
- Implemented source route: `/users/@me/survey/{survey_id}/seen`

## Changed Files

- `src/api/routes/users/@me/survey.ts`
- `test/routes/users-me-survey-get.test.ts`
- Regenerated artifacts:
  - `assets/openapi.json`
  - `assets/testing-manifest.json`
  - `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`
  - `packages/missing-routes/missing.json`
  - `test/generated/http-contracts.json`
  - `test/generated/suite-coverage.json`

## Behavior

- Added `parseUserSurveyId()` to reject non-numeric survey ids with `DiscordApiErrors.INVALID_FORM_BODY`.
- Added `acknowledgeUserSurveySeen()` as a no-op local acknowledgement because Spacebar has no durable Discord survey prompt state.
- Added `POST /:survey_id/seen` route metadata with `204`, `400`, and `401` responses.
- Preserved the existing `GET /users/@me/survey` behavior returning `{ survey: null }`.

## Missing-Route Movement

- `packages/missing-routes/missing.json`: `missing` changed `498 -> 497` on the current merge branch.
- `packages/missing-routes/missing.json`: `spacebar` changed `682 -> 683`.
- `packages/missing-routes/missing.json`: `discord` remains `1128`.
- Removed only missing entry `POST /users/@me/survey/{param}/seen`.

## Evidence Sources

- `packages/missing-routes/missing.json` listed the assigned missing entry with sources `userdoccers:resources/user.mdx` and `xhyrom:data/client/routes.json`.
- `packages/automatic-reverse-engineering/data/catalogs/routes.userdoccers.catalog.json` lists `POST /users/@me/survey/{survey_id}/seen` as `POST_USERS__ME_SURVEY_SURVEY_ID_SEEN`.
- `packages/automatic-reverse-engineering/data/catalogs/routes.xhyrom.catalog.json` lists `POST /users/@me/survey/{param}/seen`.
- Existing Spacebar pattern used: `GET /users/@me/survey` already documents that Spacebar does not persist private Discord survey eligibility or prompt state.

## Verification

All commands below passed unless noted under Known Failure.
All npm/node commands were run with `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH"`.

- `npm run build:src:tsgo`
- `npm run generate:openapi`
- `npm run build --workspace @spacebar/automatic-reverse-engineering`
- `node packages/automatic-reverse-engineering/dist/cli.js import-source-routes --root src/api/routes --out packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`
- `npm run build --workspace @spacebar/missing-routes`
- `npm run start --workspace @spacebar/missing-routes`
- `npm run generate:testing-manifest`
- `npm run generate:contract-tests`
- `npm run generate:suite-coverage`
- `npm run build:test-fixtures`
- `node -r dotenv/config -r module-alias/register --enable-source-maps --test dist-test/test/routes/users-me-survey-get.test.js`
- `npm run test:manifest`
- `npm run test:suite-coverage`
- `node scripts/testing-manifest/generate-contract-tests.js --check`
- `npm run test:public-assets`
- `npx eslint src/api/routes/users/@me/survey.ts test/routes/users-me-survey-get.test.ts`
- `git diff --check`
- `git diff --exit-code -- package.json package-lock.json packages/*/package.json apps/*/package.json`

## Known Failure

- Full `npm run test:contracts` failed only on the known unrelated runtime contract `api:http:GET:/discovery/search`, which returned `500 !== 200`.

## Sibling Routes Intentionally Untouched

- `GET /users/@me/survey` was preserved aside from expanded focused test coverage.
- XHyroM `OPTIONS /users/@me/survey/{param}/seen` remains ignored by the missing-route report's default ignored methods.
- No adjacent `/users/@me/*` routes were implemented or modified.

## Risks And Blockers

- Spacebar still has no durable survey eligibility or prompt-seen persistence. The route is intentionally a validated `204` compatibility acknowledgement rather than a fabricated state mutation.
- No gateway event or audit-log side effect was added; none is evidenced for this private current-user acknowledgement and no local state changes occur.
- Full `npm run test:contracts` is expected to remain blocked only by the pre-existing unrelated `api:http:GET:/discovery/search` runtime `500 !== 200` failure.
