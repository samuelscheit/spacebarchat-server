# guilds-param-onboarding-get

## Summary

Implemented `GET /guilds/{param}/onboarding` as `GET /guilds/{guild_id}/onboarding`.

Spacebar has no durable guild onboarding prompt/default-channel store, so the route returns a locally truthful disabled onboarding object:

```json
{
    "guild_id": "<guild_id>",
    "prompts": [],
    "default_channel_ids": [],
    "enabled": false,
    "below_requirements": true,
    "mode": 0
}
```

Because the local representation is always disabled, the route requires bearer auth plus `MANAGE_GUILD`, matching Userdoccers' disabled-onboarding access rule. It checks guild existence and does not mutate state, emit events, fabricate prompt IDs, role IDs, channel IDs, onboarding responses, or Discord-managed onboarding state.

## Changed Files

- `src/api/routes/guilds/#guild_id/onboarding.ts`
- `src/schemas/responses/GuildOnboardingResponse.ts`
- `src/schemas/responses/index.ts`
- `test/routes/guilds-param-onboarding-get.test.ts`
- `assets/schemas.json`
- `assets/openapi.json`
- `assets/testing-manifest.json`
- `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`
- `packages/missing-routes/missing.json`
- `test/generated/http-contracts.json`
- `test/generated/suite-coverage.json`
- `worker-progress/guilds-param-onboarding-get.md`

## Evidence Gathered

- `packages/missing-routes/missing.json` initially contained both `GET` and `PUT` for `/guilds/{param}/onboarding`; only `GET` was assigned.
- `routes.userdoccers.catalog.json` lists `GET_GUILDS_GUILD_ID_ONBOARDING` from `userdoccers:resources/guild.mdx`.
- `routes.xhyrom.catalog.json` lists `GET /guilds/{guild_id}/onboarding` as `GUILD_ONBOARDING`.
- Userdoccers guild docs: `https://docs.discord.food/resources/guild` documents `GET /guilds/{guild.id}/onboarding` as returning onboarding and requiring `MANAGE_GUILD` when disabled; `PUT` remains a separate modify route.
- Local source has `src/api/routes/guilds/#guild_id/onboarding/allowed-applications.ts` but had no `src/api/routes/guilds/#guild_id/onboarding.ts` before this change.
- Local storage search found only `latest_onboarding_question_id` TODO/ready DTO references and deprecated `welcome_screen`; no persisted onboarding prompts/default channels/responses.

## Missing-Route Movement

- Before: `missing_entries.length = 590`.
- After regeneration: `missing_entries.length = 589`.
- Removed: `GET /guilds/{param}/onboarding`.
- Still intentionally missing: `PUT /guilds/{param}/onboarding`.
- Adjacent routes intentionally untouched: onboarding prompt mutation routes, onboarding response routes, onboarding allowed-applications, new-member-action routes, creator monetization onboarding routes, and unrelated guild configuration routes.

## Commands Run

- `npm ci` (needed because this worktree had no installed dependencies; package-lock/package.json unchanged)
- `npx prettier --write src/api/routes/guilds/#guild_id/onboarding.ts src/schemas/responses/GuildOnboardingResponse.ts src/schemas/responses/index.ts test/routes/guilds-param-onboarding-get.test.ts`
- `npm run build:src:tsgo` (initial pre-install attempt failed with `tsgo: command not found`; reruns after `npm ci` passed)
- `npm run generate:schema`
- `npm run generate:openapi` (passed with existing warnings for three webhook routes missing `route()` middleware)
- `npm run build --workspace @spacebar/automatic-reverse-engineering`
- `node packages/automatic-reverse-engineering/dist/cli.js import-source-routes --root src/api/routes --out packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`
- `npm run build --workspace @spacebar/missing-routes`
- `npm run start --workspace @spacebar/missing-routes`
- `npm run generate:testing-manifest`
- `npm run generate:contract-tests`
- `node scripts/testing-manifest/generate-suite-coverage.js`
- `npm run build:test-fixtures`
- `node -r dotenv/config -r module-alias/register --enable-source-maps --test dist-test/test/routes/guilds-param-onboarding-get.test.js`
- `node scripts/testing-manifest/verify.js`
- `node scripts/testing-manifest/generate-contract-tests.js --check`
- `node scripts/testing-manifest/generate-suite-coverage.js --check`
- `node --test test/generated/http-contracts.test.js`
- `node --test test/generated/suite-coverage.test.js`
- `git diff --check`
- `git diff -- package.json package-lock.json`
- `rg -n "MERMER|MERCHANTIBILITY" src/api/routes/guilds/#guild_id/onboarding.ts src/schemas/responses/GuildOnboardingResponse.ts test/routes/guilds-param-onboarding-get.test.ts`

## Risks Or Blockers

- The route is compatibility-only until Spacebar gains durable onboarding prompts/default-channel persistence.
- Returning a disabled object is intentionally conservative; clients expecting Discord-managed onboarding prompts will receive no prompts/default channels.
- Full `npm run test:contracts` was not run; generated contract checks were run directly and passed.

## Recommended Next Tasks

- Implement real onboarding persistence before broadening this route to member-visible enabled onboarding.
- Leave `PUT /guilds/{guild_id}/onboarding` and onboarding prompt/response mutation routes to their assigned workers.
- Reconcile with current main during orchestrator integration if main has moved since base `df2d44ac1`.

## Integration Acceptance

Accepted on current integration base `0d899a3d0`.

- Ported only the worker-owned route, schema, focused test, and progress report, then regenerated all shared artifacts on current main.
- Current-base missing-route movement: `587 -> 586` missing, `593 -> 594` implemented, `1128` Discord.
- Verification passed: `npm run build:src:tsgo`, `npm run generate:schema`, `npm run generate:openapi` (`485` paths / `1126` schemas), automatic reverse-engineering build/import, missing-route regeneration, testing manifest generation/verification (`699` entries), generated contract regeneration/checks (`674` contracts), suite coverage generation/check, `npm run build:test-fixtures`, focused onboarding route test (`8/8`), generated contract tests (`10/10`), suite coverage tests (`4/4`), `npm run test:manifest` (`30/30`), ESLint on changed source/test files, `git diff --check`, and package/lockfile guard.
- Full `npm run test:contracts` was run; it failed only on the known unrelated runtime baseline `api:http:GET:/discovery/search` returning `500` instead of `200`. Existing analytics `query.ts` route-registration warnings remain unrelated baseline noise.
