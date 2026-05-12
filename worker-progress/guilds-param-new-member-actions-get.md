# GET /guilds/{param}/new-member-actions

## Summary

Implemented `GET /guilds/{guild_id}/new-member-actions` only.

Behavior is intentionally conservative:

- Requires bearer authentication through the normal API middleware.
- Checks the guild exists before membership/action lookups.
- Requires the authenticated user to be a guild member; non-members receive 403.
- Returns `200 []` when no locally backed new-member action source exists.
- Reuses locally backed new-member welcome actions if `getCurrentGuildNewMemberWelcome` is later backed by persisted state.
- Does not require `MANAGE_GUILD`; local source evidence did not indicate an admin route, and this endpoint is modeled as a current-member action list rather than guild configuration.
- Does not fabricate Discord-only per-member completion state.

## Source Evidence

- `packages/missing-routes/missing.json` originally listed `GET /guilds/{param}/new-member-actions`.
- Userdoccers catalog entry:
  - method: `GET`
  - route: `/guilds/{guild_id}/new-member-actions`
  - route_name: `GET_GUILDS_GUILD_ID_NEW_MEMBER_ACTIONS`
  - source: `userdoccers:resources/guild.mdx`
  - summary: `Get Guild New Member Actions`
- xHyroM catalog entry:
  - method: `GET`
  - route: `/guilds/{guild_id}/new-member-actions`
  - route_name: `GUILD_MEMBER_ACTIONS`
  - source: `xhyrom:data/client/routes.json`

## Nearby Patterns Used

- `src/api/routes/guilds/#guild_id/new-member-welcome.ts` for locally truthful new-member/home behavior when Spacebar has no durable Discord home-settings store.
- `src/api/routes/guilds/#guild_id/onboarding/allowed-applications.ts` for conservative empty compatibility responses.
- `src/api/routes/guilds/#guild_id/top-emojis.ts` and its route test for guild existence checks, guild membership authorization, dependency injection, and focused artifact assertions.
- `src/api/routes/guilds/#guild_id/members/@me.ts` and its route test for current-member authenticated route shape and generated artifact coverage.

## Missing Route Movement

- Before generation on this worker base: `missing = 587`, `spacebar = 593`.
- After implementation and regeneration: `missing = 586`, `spacebar = 594`.
- `GET /guilds/{param}/new-member-actions` was removed from `missing_entries`.
- `/guilds/{param}/new-member-actions` remains in the aggregate `routes` list because `DELETE /guilds/{param}/new-member-actions` is still missing.

## Changed Files

- `src/api/routes/guilds/#guild_id/new-member-actions.ts`
- `src/schemas/responses/GuildNewMemberActionsResponse.ts`
- `src/schemas/responses/index.ts`
- `test/routes/guilds-param-new-member-actions-get.test.ts`
- `assets/schemas.json`
- `assets/openapi.json`
- `assets/testing-manifest.json`
- `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`
- `packages/missing-routes/missing.json`
- `test/generated/http-contracts.json`
- `test/generated/suite-coverage.json`

## Adjacent Routes Intentionally Untouched

Still missing in `packages/missing-routes/missing.json`:

- `DELETE /guilds/{param}/new-member-actions`
- `PATCH /guilds/{param}/new-member-actions/{param}`
- `POST /guilds/{param}/new-member-action/{param}`

No route file was added for `new-member-actions/{param}`, `new-member-action/{param}`, `new-member-welcome`, onboarding, join-request, or member-verification routes.

## Verification

Passed:

- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm ci`
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run build:src:tsgo`
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run generate:schema`
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run build --workspace @spacebar/automatic-reverse-engineering`
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run build --workspace @spacebar/missing-routes`
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run generate:openapi`
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" node packages/automatic-reverse-engineering/dist/cli.js import-source-routes --root src/api/routes --out packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" node packages/missing-routes/dist/cli.js`
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run generate:testing-manifest`
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run generate:contract-tests`
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run generate:suite-coverage`
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run build:test-fixtures`
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" node -r dotenv/config -r module-alias/register --enable-source-maps --test dist-test/test/routes/guilds-param-new-member-actions-get.test.js`
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" node scripts/testing-manifest/verify.js`
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" node scripts/testing-manifest/generate-contract-tests.js --check`
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" node scripts/testing-manifest/generate-suite-coverage.js --check`
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" node --test test/generated/http-contracts.test.js test/generated/suite-coverage.test.js`
- `git diff --check`
- `git diff -- package.json package-lock.json` produced no diff.

Known unrelated failure:

- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run test:contracts`
- The generated/static contract checks passed, and the command completed its `build:src:tsgo` and `build:test-fixtures` stages.
- Runtime contracts then failed only on the known unrelated public schema check: `api:http:GET:/discovery/search` returned `500 !== 200`.

## Risks

- The response schema is `GuildNewMemberAction[]`, reusing the existing new-member welcome action shape. This avoids inventing per-member completion fields that Spacebar does not store.
- If Spacebar later adds durable guild home/action completion state, `getCurrentGuildNewMemberActions` is the narrow integration point to replace the current empty fallback.

## Reconciliation

- Worker branch: `codex/current-missing-route-guilds-param-new-member-actions-get-agent`
- Worker base/HEAD before local edits: `0d899a3d0c61d7db89ca4877381a5a033ad75790` (`Implement OAuth authorize webhook channels route`)
- No local `main` or `origin/main` ref is present in this assigned worktree, so reconciliation to current main was not attempted here. Normal aggregator reconciliation is needed if main has moved beyond `0d899a3d0`.

## Integration Acceptance

Accepted on current integration base `47ea815f9`.

- Ported only the worker-owned route, schema, focused test, and progress report. Shared artifacts were regenerated on current main.
- Current-base missing-route movement: `585 -> 584` missing, `595 -> 596` implemented, `1128` Discord.
- Verification passed: `npm run build:src:tsgo`, `npm run generate:schema`, `npm run generate:openapi` (`487` paths / `1129` schemas), automatic reverse-engineering build/import, missing-route regeneration, testing manifest generation/verification (`701` entries), generated contract regeneration/checks (`676` contracts), suite coverage generation/check, `npm run build:test-fixtures`, focused new-member-actions route tests (`9/9`), generated contract tests (`10/10`), suite coverage tests (`4/4`), `npm run test:manifest` (`30/30`), ESLint on changed source/test files, `git diff --check`, and package/lockfile guard.
- Full `npm run test:contracts` was run; it failed only on the known unrelated runtime baseline `api:http:GET:/discovery/search` returning `500` instead of `200`. Existing analytics `query.ts` route-registration warnings remain unrelated baseline noise.
