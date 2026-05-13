# POST /quests/{param}/video-progress

## Summary

Implemented the assigned `POST /quests/{param}/video-progress` route as `POST_QUESTS_QUEST_ID_VIDEO_PROGRESS`.

The route now validates `QuestVideoProgressSchema` request bodies, requires bearer auth, accepts a non-negative integer `timestamp`, returns provider-backed `QuestUserStatusResponse` data on success, emits `QUESTS_USER_STATUS_UPDATE` for validated provider-backed updates, and fails closed with `Unknown Quest` when Spacebar has no durable quest progress provider.

## Changed Files

- `src/api/routes/quests/#quest_id/video-progress.ts`
- `src/schemas/uncategorised/QuestVideoProgressSchema.ts`
- `src/schemas/uncategorised/index.ts`
- `src/util/interfaces/Event.ts`
- `test/routes/questsVideoProgressRoute.test.ts`
- `assets/schemas.json`
- `assets/openapi.json`
- `assets/testing-manifest.json`
- `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`
- `packages/missing-routes/missing.json`
- `test/generated/http-contracts.json`

## Assigned Scope

- Assigned path: `/quests/{param}/video-progress`
- Missing methods found: `POST`
- Implemented methods: `POST`
- Route name: `POST_QUESTS_QUEST_ID_VIDEO_PROGRESS`
- Sibling routes intentionally untouched: `/quests/{param}/enroll`, `/quests/{param}/heartbeat`, `/quests/{param}/preview/complete`, `/quests/{param}/claim-reward`, console quest routes, reward-code route, current-user quest routes.

## Behavior

- Request body: `QuestVideoProgressSchema` with required integer `timestamp >= 0`.
- Response body: `QuestUserStatusResponse` for provider-backed video quest progress.
- Auth mode: bearer-authenticated.
- Default provider: returns no state because Spacebar does not currently persist Discord quest enrollment or video progress.
- Fail-closed semantics: absent, malformed, cross-user, wrong-quest, or non-video progress state returns `Unknown Quest`/404; invalid quest IDs or invalid request bodies return form-body validation errors.
- Gateway semantics: `QUESTS_USER_STATUS_UPDATE` is added to known event names and emitted to the user id only after a provider returns a validated video progress status.

## Evidence Gathered

- `packages/missing-routes/missing.json` originally listed:
  - method `POST`
  - route `/quests/{param}/video-progress`
  - route name `POST_QUESTS_QUEST_ID_VIDEO_PROGRESS`
  - sources `userdoccers:resources/quests.mdx`, `xhyrom:data/client/routes.json`
- `packages/automatic-reverse-engineering/data/catalogs/routes.userdoccers.catalog.json` lists `POST /quests/{quest_id}/video-progress` with summary `Send Quest Video Progress`.
- `packages/automatic-reverse-engineering/data/catalogs/routes.xhyrom.catalog.json` lists `POST /quests/{param}/video-progress` as `QUESTS_VIDEO_PROGRESS`.
- Userdoccers reference: https://docs.discord.food/resources/quests documents `POST /quests/{quest.id}/video-progress`, JSON param `timestamp` integer seconds, successful `quest user status object` response, and `Quests User Status Update` gateway event.

## Missing-Route Movement

- Before regeneration: `missing: 504`, `spacebar: 676`, `discord: 1128`.
- After regeneration: `missing: 503`, `spacebar: 677`, `discord: 1128`.
- Exact missing entry removed:
  - `POST /quests/{param}/video-progress`
  - `POST_QUESTS_QUEST_ID_VIDEO_PROGRESS`

Generated source catalog now contains:

```json
{
  "method": "POST",
  "request_schema_ref": "QuestVideoProgressSchema",
  "response_schema_refs": ["APIErrorResponse", "QuestUserStatusResponse"],
  "route": "/quests/{quest_id}/video-progress",
  "route_name": "POST_QUESTS_QUEST_ID_VIDEO_PROGRESS",
  "source": "src/api/routes/quests/#quest_id/video-progress.ts"
}
```

## Commands Run

- `npm run build:src:tsgo` failed initially because the isolated worktree had no `node_modules` and `tsgo` was unavailable.
- `npm ci`
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
- `TS_NODE_TRANSPILE_ONLY=1 node -r dotenv/config -r ts-node/register/transpile-only -r module-alias/register --enable-source-maps --test test/routes/questsVideoProgressRoute.test.ts`
- `npm run build:test-fixtures`
- `npm run test:manifest`
- `npm run test:contracts`
- `npm run test:suite-coverage`
- `npx eslint src/api/routes/quests/#quest_id/video-progress.ts src/schemas/uncategorised/QuestVideoProgressSchema.ts src/schemas/uncategorised/index.ts src/util/interfaces/Event.ts test/routes/questsVideoProgressRoute.test.ts`
- `git diff -- package.json package-lock.json`
- `git diff --check`

## Verification Results

- Focused route test: passed, 6 tests.
- `npm run build:src:tsgo`: passed.
- `npm run build:test-fixtures`: passed.
- `npm run test:manifest`: passed.
- `npm run test:suite-coverage`: passed.
- Targeted ESLint: passed after fixing the test close helper.
- `git diff --check`: passed.
- Package/lockfile guard: `git diff -- package.json package-lock.json` produced no diff.
- `npm run test:contracts`: generated contract checks passed, runtime failed only on the known unrelated `api:http:GET:/discovery/search` public response-schema check with `500 !== 200`.

## Risks Or Blockers

- Spacebar still lacks durable Discord quest enrollment/progress persistence. The production default therefore fails closed instead of fabricating quest progress.
- Generic runtime event contracts do not seed quest progress state; the focused route test verifies event emission through the injected provider/emitter path.
- The route validates and serializes provider-backed state but does not implement quest enrollment, completion, rewards, or video task target computation itself.

## Reconciliation Notes

- Objective scope reconciled to one method: only `router.post("/")` was added in `src/api/routes/quests/#quest_id/video-progress.ts`; no sibling quest route files were modified.
- Missing-route reconciliation: current `packages/missing-routes/missing.json` has `missing: 503`, `spacebar: 677`, `discord: 1128`, and zero entries matching `POST /quests/{param}/video-progress` with `POST_QUESTS_QUEST_ID_VIDEO_PROGRESS`.
- Artifact reconciliation: source catalog, OpenAPI, testing manifest, and generated HTTP contracts all point to `src/api/routes/quests/#quest_id/video-progress.ts` with bearer auth, `QuestVideoProgressSchema`, `QuestUserStatusResponse`, and `APIErrorResponse`.
- Schema reconciliation: `QuestVideoProgressSchema` is exported from `src/schemas/uncategorised/index.ts` and generated in `assets/schemas.json` with required integer `timestamp` and `minimum: 0`.
- Verification reconciliation: completion audit reran the focused test, `build:src:tsgo`, `build:test-fixtures`, `test:manifest`, `test:contracts`, `test:suite-coverage`, targeted ESLint, `git diff --check`, and the package/lockfile guard in the assigned worktree.
- Contract reconciliation: the generated contract matrix passed; the only runtime failure remained the allowed unrelated `api:http:GET:/discovery/search` `500 !== 200`.
- Worktree reconciliation: no `package.json` or `package-lock.json` changes; all changed and untracked files are scoped to the route, schema/event support, generated artifacts, tests, and this progress report.

## Recommended Next Tasks

- Implement a durable local quest enrollment/progress model and wire it into the video-progress provider.
- Implement sibling quest progression routes in their own scoped assignments, especially `/quests/{param}/enroll` and `/quests/{param}/heartbeat`.
- Add a seeded integration fixture once local quest state exists so runtime contract coverage can exercise the 200/event path without dependency injection.
