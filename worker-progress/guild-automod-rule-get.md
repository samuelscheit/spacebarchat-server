# guild-automod-rule-get

## Summary

Implemented production GET support for `/guilds/{guild_id}/auto-moderation/rules/{rule_id}`. The handler uses the existing auto-moderation route permission model, performs a guild-scoped rule lookup, returns `AutomodRuleResponse`, and lets the existing API error handler convert absent or cross-guild rule lookups into 404 responses.

## Changed files

- `src/api/routes/guilds/#guild_id/auto-moderation/rules.ts`
- `src/api/routes/guilds/#guild_id/auto-moderation/rules.test.ts`
- `tsconfig.test.json`
- `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`
- `packages/missing-routes/missing.json`

## Commands run

- `npm run build:src:tsgo`
  - Initial attempt failed because this worktree had no `node_modules`: `TS2688: Cannot find type definition file for 'node'.`
- `npm ci`
  - Installed the lockfile dependencies in the worktree and applied existing package patches.
- `npm run build:src:tsgo`
  - Passed.
- `npm run build:test-fixtures`
  - Passed.
- `node -r dotenv/config -r module-alias/register --enable-source-maps --test 'dist-test/src/api/routes/guilds/#guild_id/auto-moderation/rules.test.js'`
  - Passed: 3 tests.
- `npm run build --workspace @spacebar/automatic-reverse-engineering`
  - Passed.
- `node packages/automatic-reverse-engineering/dist/cli.js import-source-routes --root src/api/routes --out packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`
  - Passed and regenerated the source catalog.
- `npm run build --workspace @spacebar/missing-routes`
  - Passed.
- `npm run start --workspace @spacebar/missing-routes`
  - Passed and regenerated `packages/missing-routes/missing.json`.

## Evidence gathered

- `packages/missing-routes/missing.json` originally listed one missing entry for the assigned path:
  - `GET /guilds/{param}/auto-moderation/rules/{param}`
  - `GET_GUILDS_GUILD_ID_AUTO_MODERATION_RULES_AUTOMOD_RULE_ID`
- `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json` originally had list `GET`, `POST`, `PATCH`, and `DELETE`, but no item `GET`.
- `src/api/routes/guilds/#guild_id/auto-moderation/rules.ts` already used `MANAGE_GUILD`, `AutomodRuleResponse`, and scoped `{ guild_id, id: rule_id }` lookup for PATCH.
- `src/api/middlewares/ErrorHandler.ts` maps TypeORM `EntityNotFoundError` to HTTP 404, which preserves absent and cross-guild lookup behavior for the new GET handler.
- Two explorer subagents independently checked the route gap and focused test strategy. Both matched the implementation plan.

## Assigned path

- Assigned route path: `/guilds/{param}/auto-moderation/rules/{param}`
- Missing methods found for exactly that path: `GET`
- Methods implemented: `GET`
- Concrete source route implemented: `GET /guilds/{guild_id}/auto-moderation/rules/{rule_id}`

## What changed

- Added `router.get("/:rule_id", ...)` to the existing auto-moderation rules router.
- The route declares:
  - permission: `MANAGE_GUILD`
  - `200` response: `AutomodRuleResponse`
  - `403` and `404` response: `APIErrorResponse`
- The handler loads exactly `AutomodRule.findOneOrFail({ where: { guild_id, id: rule_id } })` and returns the rule JSON.
- Added focused route tests that verify:
  - successful single-rule response
  - exact scoped lookup options
  - route metadata
  - 404 behavior for absent or cross-guild rule IDs
- Added the new route test to `tsconfig.test.json`.

## Missing-route count movement

- Before regeneration: `missing: 849`, `spacebar: 331`.
- After regeneration: `missing: 848`, `spacebar: 332`.
- The assigned path `/guilds/{param}/auto-moderation/rules/{param}` is no longer present in `routes[]`.
- There are now zero `missing_entries[]` for the assigned path.
- Source catalog now includes `GET /guilds/{guild_id}/auto-moderation/rules/{rule_id}` with `AutomodRuleResponse` and `APIErrorResponse`.

## Userdoccers/xHyroM references used

- `packages/automatic-reverse-engineering/data/catalogs/routes.userdoccers.catalog.json`
  - Confirms `GET /guilds/{guild_id}/auto-moderation/rules/{automod_rule_id}` with summary `Get Guild AutoMod Rule`.
- `packages/automatic-reverse-engineering/data/catalogs/routes.xhyrom.catalog.json`
  - Confirms `GET /guilds/{guild_id}/auto-moderation/rules/{param}` as `GUILD_AUTOMOD_RULE`.
- Raw `userdoccers:resources/auto-moderation.mdx` and `xhyrom:data/client/routes.json` resources were not directly exposed as local source files; the checked-in derived catalogs were sufficient for this narrow route.

## Risks or blockers

- No route-specific blockers remain.
- `npm ci` was required because the worktree initially had no dependencies installed.
- Existing adjacent missing auto-moderation endpoints remain out of scope.

## Recommended next tasks

- Implement the adjacent missing auto-moderation validation and raid-reporting routes as separate scoped tasks.
- Consider generated auth-contract refresh in a broader test-manifest task so the new route can also be covered by generated permission-denial runtime tests.

## Goal evidence

- Goal tool was available.
- Initial objective: `Implement production-ready GET /guilds/{param}/auto-moderation/rules/{param} support in Spacebarchat, with focused tests, source-catalog regeneration, missing-route report regeneration, and a complete handoff report.`
- Active goal check before completion:
  - status: `active`
  - objective matched the assigned task
  - time used at check: 412 seconds
  - tokens used at check: 199896
