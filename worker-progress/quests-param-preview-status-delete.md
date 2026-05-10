# DELETE /quests/{param}/preview/status Worker Report

## Summary

Implemented the assigned `DELETE /quests/{param}/preview/status` route as `DELETE /quests/:quest_id/preview/status/`.

The route is bearer-authenticated and constrained to the `OPERATOR` right as the Spacebar analogue for the Userdoccers employee-only preview endpoint. Spacebar has no durable quest preview status model or `QUESTS_USER_STATUS_UPDATE` gateway event support, so the handler returns a typed empty `QuestUserStatusResponse` without fabricating quest progress, rewards, entitlements, or dismissal state.

## Changed Files

- `src/api/routes/quests/#quest_id/preview/status.ts`
- `src/schemas/responses/QuestUserStatusResponse.ts`
- `src/schemas/responses/index.ts`
- `test/routes/questsPreviewStatusRoute.test.ts`
- `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`
- `packages/missing-routes/missing.json`
- `assets/schemas.json`
- `assets/testing-manifest.json`
- `assets/openapi.json`
- `test/generated/http-contracts.json`

## Assigned Path And Methods

- Assigned path: `/quests/{param}/preview/status`
- Missing methods found: `DELETE`
- Missing route name: `DELETE_QUESTS_QUEST_ID_PREVIEW_STATUS`
- Methods implemented: `DELETE`
- Source route implemented: `/quests/{quest_id}/preview/status`

## What Changed

- Added a new Express router under `src/api/routes/quests/#quest_id/preview/status.ts`.
- Added snowflake-style quest ID validation with `DiscordApiErrors.INVALID_FORM_BODY` on malformed IDs.
- Added route metadata:
    - summary `Reset Quest`
    - `right: "OPERATOR"`
    - `200` body `QuestUserStatusResponse`
    - `400`, `401`, and `403` body `APIErrorResponse`
- Added `QuestUserStatusResponse`, `QuestTaskProgressResponse`, `QuestTaskHeartbeatResponse`, and named `QuestTaskProgressMap` schema types.
- Added focused route tests for success, parameter validation, non-operator denial, and route metadata.
- Regenerated source route catalog, missing route report, schemas, testing manifest, HTTP contracts, and OpenAPI.

## Missing Route Count Movement

- Original worker base result: `missing: 815`, `spacebar: 365`
- Current master base before merge: `missing: 812`, `spacebar: 368`
- Current master base after merge: `missing: 811`, `spacebar: 369`
- The assigned `DELETE /quests/{param}/preview/status` entry was removed from `packages/missing-routes/missing.json`.

## Evidence Gathered

- Confirmed the assigned entry existed in `packages/missing-routes/missing.json`.
- Confirmed the route was absent from `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json` before implementation.
- Confirmed `src/api/routes/**` had no quest route tree before implementation.
- Confirmed regenerated source catalog now contains:
    - `DELETE /quests/{quest_id}/preview/status`
    - source `src/api/routes/quests/#quest_id/preview/status.ts`
    - response schemas `APIErrorResponse` and `QuestUserStatusResponse`
- Confirmed regenerated OpenAPI includes bearer security, `x-right-required: OPERATOR`, path parameter `quest_id`, and `200/400/401/403` responses.
- Confirmed regenerated testing manifest contains `api:http:DELETE:/quests/:quest_id/preview/status/`.

## Userdoccers And xHyroM References

- Userdoccers route catalog: `packages/automatic-reverse-engineering/data/catalogs/routes.userdoccers.catalog.json`
    - `DELETE /quests/{quest_id}/preview/status`
    - route name `DELETE_QUESTS_QUEST_ID_PREVIEW_STATUS`
    - summary `Reset Quest`
    - source `userdoccers:resources/quests.mdx`
- Userdoccers source page: `resources/quests.mdx`
    - endpoint `DELETE /quests/{quest.id}/preview/status`
    - returns a Quest User Status object
    - available only to Discord employees for preview quests
    - documented as firing `QUESTS_USER_STATUS_UPDATE`
- xHyroM route catalog: `packages/automatic-reverse-engineering/data/catalogs/routes.xhyrom.catalog.json`
    - `DELETE /quests/{param}/preview/status`
    - route name `QUESTS_PREVIEW_STATUS`
    - source `xhyrom:data/client/routes.json`

## Commands Run

- `if [ -L node_modules ]; then unlink node_modules; fi; if [ ! -d node_modules ]; then npm ci; fi`
- `npx prettier --write ...`
- `npm run build:src:tsgo`
- `npm run build:test-fixtures`
    - First run exposed a test-only `req.t` type assignment issue; fixed and reran successfully.
- `node -r dotenv/config -r module-alias/register --enable-source-maps --test dist-test/test/routes/questsPreviewStatusRoute.test.js`
- `npm run build --workspace @spacebar/automatic-reverse-engineering`
- `node packages/automatic-reverse-engineering/dist/cli.js import-source-routes --root src/api/routes --out packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`
- `npm run build --workspace @spacebar/missing-routes`
- `npm run start --workspace @spacebar/missing-routes`
- `npm run generate:schema`
    - First run exposed a generic `Record<string, QuestTaskProgressResponse>` schema ref issue; replaced it with a named map interface and reran successfully.
- `npm run generate:testing-manifest`
- `node scripts/testing-manifest/verify.js`
- `node scripts/testing-manifest/generate-contract-tests.js --check`
    - Initially stale as expected after adding the route.
- `npm run generate:contract-tests`
- `node scripts/testing-manifest/generate-contract-tests.js --check`
- `node scripts/testing-manifest/generate-suite-coverage.js --check`
- `npm run generate:openapi`
    - Completed with the repository's pre-existing warnings about 3 webhook routes missing `route()` metadata.
- Current-base port verification after rebasing the worker result onto `dc1c87d78`:
    - `npm run build:src:tsgo`
        - passed
    - `npm run generate:schema`
        - passed, wrote `734` schemas
    - `npm run build:test-fixtures`
        - passed
    - `node -r dotenv/config -r module-alias/register --enable-source-maps --test dist-test/test/routes/questsPreviewStatusRoute.test.js`
        - passed, `4` tests
    - `npm run build --workspace @spacebar/automatic-reverse-engineering`
        - passed
    - `node packages/automatic-reverse-engineering/dist/cli.js import-source-routes --root src/api/routes --out packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`
        - passed
    - `npm run build --workspace @spacebar/missing-routes`
        - passed
    - `npm run start --workspace @spacebar/missing-routes`
        - passed with `Spacebar is missing 811`, `Spacebar implements 369`, `Discord implements 1128`
    - `npm run generate:testing-manifest`
        - passed, wrote `474` manifest entries
    - `node scripts/testing-manifest/verify.js`
        - passed
    - `npm run generate:contract-tests`
        - passed, wrote `449` contracts
    - `node scripts/testing-manifest/generate-contract-tests.js --check`
        - passed
    - `npm run generate:suite-coverage`
        - passed, wrote `15` suites
    - `node scripts/testing-manifest/generate-suite-coverage.js --check`
        - passed
    - `node --test test/generated/http-contracts.test.js test/generated/suite-coverage.test.js`
        - passed, `13` tests
    - `npm run generate:openapi`
        - passed with `291` paths and `734` schemas; only the repository's pre-existing webhook route metadata warnings
    - `git diff --check`
        - passed
    - `git diff -- package.json package-lock.json npm-shrinkwrap.json pnpm-lock.yaml yarn.lock --exit-code`
        - passed
    - malformed warranty grep over changed/untracked scoped files
        - passed
    - `jq '.missing_entries[] | select(.route=="/quests/{param}/preview/status")' packages/missing-routes/missing.json`
        - returned no entry

## Risks And Blockers

- Spacebar does not currently persist quest configs, quest user status, quest preview status, quest rewards, or quest entitlement state.
- Spacebar does not currently model the `QUESTS_USER_STATUS_UPDATE` gateway event.
- The compatibility response intentionally returns no fabricated task progress and emits no gateway event.
- The source endpoint is Discord employee-only for preview quests; this implementation maps that to the existing Spacebar `OPERATOR` right.

## Recommended Next Tasks

- Implement a durable quest domain model before adding quest enroll, progress, reward, or gateway side effects.
- Add a real quest status event path only after quest status persistence exists.
- Implement `/quests/{param}/preview/dismissibility` separately; it was intentionally not touched.

## Goal Status Evidence

- `create_goal` objective: `implement the missing route path DELETE /quests/{param}/preview/status for the Spacebar server API.`
- `get_goal` status after setup and before handoff report: `active`
- `get_goal` objective: `implement the missing route path DELETE /quests/{param}/preview/status for the Spacebar server API.`
