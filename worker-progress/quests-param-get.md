# GET /quests/{param} Worker Report

## Summary

Implemented the assigned public `GET /quests/{quest_id}` route.

The endpoint returns an active provider-backed `QuestConfigResponse` when one is
available locally. Spacebar has no durable quest config store, quest catalog,
campaign state, reward state, or entitlement model yet, so the default provider
fails closed with `404 UNKNOWN_QUEST` instead of fabricating Discord data.

## Changed Files

- `src/api/routes/quests/#quest_id/index.ts`
- `src/api/middlewares/NoAuthorizationRoutes.ts`
- `test/routes/questsParamRoute.test.ts`
- `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`
- `packages/missing-routes/missing.json`
- `assets/openapi.json`
- `assets/testing-manifest.json`
- `test/generated/http-contracts.json`
- `worker-progress/quests-param-get.md`

## Assigned Path And Method

- Assigned path: `/quests/{param}`
- Missing method found: `GET`
- Missing route name: `GET_QUESTS_QUEST_ID`
- Source route implemented: `/quests/{quest_id}`
- Testing manifest coverage id: `api:http:GET:/quests/:quest_id/`

## Behavior Implemented

- Added route metadata with summary `Get Quest Config`.
- Kept the route public, matching Userdoccers source evidence.
- Validates quest IDs as Discord snowflakes.
- Returns only provider-backed active quest configs.
- Strips provider-only extras from returned quest configs.
- Leaves adjacent protected quest routes protected, including `/quests/@me`,
  `/quests/decision`, and deeper quest subroutes.

## Current-Base Evidence

- Current base before merge: `1b5b7ecf3`.
- Missing-route movement after regeneration: `625 -> 624`.
- Implemented count movement after regeneration: `555 -> 556`.
- Discord route count remains `1128`.
- The assigned `GET /quests/{param}` entry is no longer present in
  `packages/missing-routes/missing.json`.
- Adjacent `/quests/{param}/reward-code` remains missing and out of scope.
- Source catalog, OpenAPI, testing manifest, and generated HTTP contracts all
  include `GET /quests/{quest_id}` / `api:http:GET:/quests/:quest_id/`.

## Verification

Passed on the current base:

- `npm run build:src:tsgo`
- `npm run build --workspace @spacebar/automatic-reverse-engineering`
- Source route import
- `npm run build --workspace @spacebar/missing-routes`
- `npm run start --workspace @spacebar/missing-routes`
- `npm run generate:testing-manifest`
- `node scripts/testing-manifest/verify.js`
- `npm run generate:contract-tests`
- `node scripts/testing-manifest/generate-contract-tests.js --check`
- `npm run generate:suite-coverage`
- `node scripts/testing-manifest/generate-suite-coverage.js --check`
- `npm run generate:openapi`
- `npm run build:test-fixtures`
- Focused quest tests: 20/20 passing
- `npm run test:manifest`
- `npm run test:suite-coverage`
- Generated contract/suite tests: 13/13 passing
- Generated public auth runtime contract check
- `npm run lint`
- `git diff --check`
- Package/lockfile guard
- Changed-file malformed warranty-token scan

Known unrelated failure:

- `npm run test:contracts` passes static/generated contract checks, then fails
  in runtime on existing `api:http:GET:/discovery/search` returning `500`
  instead of `200`. The run also logs existing analytics `query` route
  registration warnings.

## Risks And Follow-Ups

- Real quest config responses require a durable quest config/catalog model.
- Adjacent quest reward, enrollment, heartbeat, preview, and entitlement routes
  remain separate missing-route assignments.
