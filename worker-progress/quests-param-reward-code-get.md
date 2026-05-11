# GET /quests/{param}/reward-code Worker Report

## Summary

Implemented the assigned authenticated `GET /quests/{quest_id}/reward-code`
route.

The endpoint returns a `QuestRewardCodeResponse` only from a local injected
provider. Spacebar has no durable quest reward-code, quest redemption, quest
claim, platform-selection, or entitlement storage for this Discord feature yet,
so the default provider fails closed with the existing `Unknown Quest` 404 rather
than fabricating redeem codes.

## Assigned Path And Method

- Worker id: `quests_param_reward_code_get`
- Assigned path: `/quests/{param}/reward-code`
- Missing method found: `GET`
- Missing route name: `GET_QUESTS_QUEST_ID_REWARD_CODE`
- Source route implemented: `/quests/{quest_id}/reward-code`
- Testing manifest coverage id:
  `api:http:GET:/quests/:quest_id/reward-code/`

## Evidence Gathered

- `packages/missing-routes/missing.json` contained exactly one assigned missing
  entry: `GET /quests/{param}/reward-code`, route name
  `GET_QUESTS_QUEST_ID_REWARD_CODE`, sources
  `userdoccers:resources/quests.mdx` and `xhyrom:data/client/routes.json`,
  summary `Get Quest Reward Code`.
- Pre-implementation source catalog contained quest config, preview
  dismissibility/status, and decision routes, but no
  `/quests/{quest_id}/reward-code` entry.
- Pre-implementation `src/api/routes/quests` had only `#quest_id/index.ts`,
  preview reset routes, and `decision.ts`; no reward-code route existed.
- Userdoccers quests docs define the quest reward-code object fields:
  `quest_id`, `code`, `platform`, `user_id`, `claimed_at`, and nullable `tier`,
  and describe `GET /quests/{quest.id}/reward-code` as returning that object.
  The docs do not list request body or query params for this endpoint.
- xHyroM route catalog lists `GET`, `HEAD`, and `OPTIONS`
  `/quests/{param}/reward-code` under `QUESTS_REWARD_CODE`; only the `GET`
  method was in the assigned missing entry.

## Behavior Implemented

- Added bearer-authenticated `GET /quests/:quest_id/reward-code/` route metadata
  with summary `Get Quest Reward Code`.
- Added `QuestRewardCodeResponse` schema export.
- Added a shared quest route helper for snowflake validation and the existing
  `Unknown Quest` 404 so route files do not import each other during OpenAPI
  route discovery.
- Validates quest IDs before provider lookup.
- Validates provider-backed reward-code ownership and shape before serializing:
  quest id, user id, non-empty code, non-negative integer platform, valid
  `claimed_at`, and nullable/non-negative integer tier.
- Serializes `Date` reward claim timestamps to ISO strings.
- Does not emit gateway events, mutate quest status, claim rewards, enroll the
  user, or touch entitlement/gift-code/billing/promotion state.

## Changed Files

- `src/api/routes/quests/#quest_id/reward-code.ts`
- `src/api/routes/quests/#quest_id/index.ts`
- `src/api/util/utility/QuestRoutes.ts`
- `src/schemas/responses/QuestRewardCodeResponse.ts`
- `src/schemas/responses/index.ts`
- `test/routes/questsRewardCodeRoute.test.ts`
- `test/routes/questsParamRoute.test.ts`
- `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`
- `packages/missing-routes/missing.json`
- `assets/schemas.json`
- `assets/openapi.json`
- `assets/testing-manifest.json`
- `test/generated/http-contracts.json`
- `worker-progress/quests-param-reward-code-get.md`

## Artifact Status

- Source catalog now contains `GET /quests/{quest_id}/reward-code` from
  `src/api/routes/quests/#quest_id/reward-code.ts` with response schemas
  `APIErrorResponse` and `QuestRewardCodeResponse`.
- Missing-route report moved from `619` missing / `561` Spacebar implemented
  to `618` missing / `562` Spacebar implemented on the acceptance base.
  Discord count remains `1128`.
- The exact assigned missing entry is no longer present.
- Testing manifest has `667` entries and includes the new bearer route with
  statuses `200`, `400`, `401`, and `404`.
- Generated HTTP contracts have `642` contracts and include the new route.
- OpenAPI has `456` paths and `1059` schemas and includes both
  `/quests/{quest_id}/` and `/quests/{quest_id}/reward-code/`.

## Verification

- Initial `npm run build:src:tsgo`: failed before code validation because the
  worktree had no `node_modules`; exact TypeScript error was
  `TS2688: Cannot find type definition file for 'node'`.
- `npm install`: passed from the existing lockfile; package manifest/lockfile
  guard later confirmed no tracked package changes.
- `npm run build:src:tsgo`: passed.
- `npm run generate:schema`: passed; wrote `1059` schemas on the acceptance
  base.
- `npm run build --workspace @spacebar/automatic-reverse-engineering`: passed.
- Source route import command: passed.
- `npm run build --workspace @spacebar/missing-routes`: passed.
- `npm run start --workspace @spacebar/missing-routes`: passed on the
  acceptance base; wrote `missing: 618`, `spacebar: 562`, `discord: 1128`.
- `npm run generate:testing-manifest`: passed; wrote `667` entries.
- `node scripts/testing-manifest/verify.js`: passed.
- `npm run generate:contract-tests`: passed; wrote `642` contracts.
- `node scripts/testing-manifest/generate-contract-tests.js --check`: passed.
- `npm run generate:suite-coverage`: passed; wrote `15` suites.
- `node scripts/testing-manifest/generate-suite-coverage.js --check`: passed.
- `npm run generate:openapi`: passed; retained the existing three webhook
  metadata warnings.
- `npm run build:test-fixtures`: passed.
- Focused route tests: passed, `25` tests across quest config, decision,
  preview reset, and reward-code suites.
- `npm run test:manifest`: passed, including manifest verify.
- `npm run test:suite-coverage`: passed.
- `node --test test/generated/http-contracts.test.js test/generated/suite-coverage.test.js`:
  passed, `13` tests.
- Targeted `npx eslint`: passed.
- Targeted `npx prettier --check`: passed after formatting the new reward-code
  test.
- `git diff --check`: passed.
- Package/lockfile guard: passed.
- Changed-file malformed warranty-token scan: passed.
- Optional `npm run test:contracts`: static generated contract checks passed,
  then the runtime public response-schema suite failed on the known unrelated
  `api:http:GET:/discovery/search` returning `500` instead of `200`; existing
  analytics `query` route-registration warnings were also logged.

## Risks And Follow-Ups

- Real Discord-compatible reward-code retrieval still needs durable quest
  completion/claim/reward-code storage and a platform-aware redemption model.
- The provider hook is intentionally narrow so a future durable store can
  be wired without changing the route contract.
- Adjacent routes remain separate assignments: claim reward, enrollment,
  heartbeat, video progress, console start/stop, dismiss content, current-user
  quests, claimed quests, entitlements, billing, storefront, and promotions.
