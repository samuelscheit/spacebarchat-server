# guilds-param-new-member-welcome-get

## Summary

Accepted and ported `GET /guilds/{guild_id}/new-member-welcome` onto current
integration base `69e7219f7`. The route is bearer-authenticated, requires
`MANAGE_GUILD` for the only locally supported absent/disabled state, verifies
guild existence, declares the documented `200` schema plus `204`, and returns
`204` because Spacebar does not persist Discord new-member welcome/home settings.

`PUT /guilds/{guild_id}/new-member-welcome` and adjacent onboarding/new-member
action/resource routes remain out of scope.

## Assignment

- Route id: `guilds-param-new-member-welcome-get`
- Assigned path: `/guilds/{param}/new-member-welcome`
- Implemented method: `GET`
- Route name: `GET_GUILDS_GUILD_ID_NEW_MEMBER_WELCOME`
- Sources: `userdoccers:resources/guild.mdx`,
  `xhyrom:data/client/routes.json`

## Evidence

- Current `packages/missing-routes/missing.json` contained
  `GET /guilds/{param}/new-member-welcome` before this port.
- Current source catalog and `src/api/routes/guilds/**` had no matching route.
- Userdoccers `resources/guild.mdx` documents the new-member welcome response
  shape and the empty `204` state.
- xHyroM catalogs identify the same Discord route family as
  `GUILD_HOME_SETTINGS`.
- Local captured traffic from the existing ARE run observed
  `GET /guilds/{guild_id}/new-member-welcome` returning `204`.
- Spacebar has older `welcome_screen` storage but no durable store for Discord
  new-member actions, resource channels, welcome-message authors, or home
  settings. The accepted behavior is therefore fail-closed/empty rather than
  fabricated content.

## Changed Files

- `src/api/routes/guilds/#guild_id/new-member-welcome.ts`
- `src/schemas/responses/GuildNewMemberWelcomeResponse.ts`
- `src/schemas/responses/index.ts`
- `test/routes/guilds-param-new-member-welcome-get.test.ts`
- `assets/schemas.json`
- `assets/openapi.json`
- `assets/testing-manifest.json`
- `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`
- `packages/missing-routes/missing.json`
- `test/generated/http-contracts.json`
- `test/generated/suite-coverage.json`
- `worker-progress/guilds-param-new-member-welcome-get.md`

## Current-Base Artifact Status

- Missing-route report moved `634 -> 633`; Spacebar implemented moved
  `546 -> 547`; Discord stayed `1128`.
- Source catalog now includes
  `GET /guilds/{guild_id}/new-member-welcome`.
- OpenAPI contains 442 paths and 1035 schemas, including
  `/guilds/{guild_id}/new-member-welcome/`.
- Testing manifest contains 652 entries, including the new route.
- Generated HTTP contracts contain 627 contracts.
- Generated suite coverage contains 15 suites.

## Verification

- `npm run build:src:tsgo`: passed.
- `npm run generate:schema`: passed; wrote 1035 schemas.
- `npm run generate:openapi`: passed; 442 paths, 1035 schemas. Existing webhook
  route-metadata warnings remain unrelated.
- `npm run generate:testing-manifest`: passed; wrote 652 entries.
- `node scripts/testing-manifest/verify.js`: passed.
- `node scripts/testing-manifest/generate-contract-tests.js --check`: initially
  stale, then passed after `npm run generate:contract-tests`; 627 contracts.
- `node scripts/testing-manifest/generate-suite-coverage.js --check`: initially
  stale, then passed after `npm run generate:suite-coverage`.
- `npm run build:test-fixtures`: passed.
- Focused route test
  `node -r dotenv/config -r module-alias/register --enable-source-maps --test dist-test/test/routes/guilds-param-new-member-welcome-get.test.js`:
  passed 6/6.
- `npm run test:manifest`: passed 30/30 and verified 652 manifest entries.
- `npm run test:suite-coverage`: passed 4/4.
- Static generated contract tests
  `node --test test/generated/http-contracts.test.js test/contracts/*.test.cjs`:
  passed 10/10.
- `npm run lint`: initially found a scoped no-loss-of-precision literal in the
  focused test; fixed by using a small invalid number, then passed.
- `npm run test:contracts`: static/generated checks passed; runtime failed only
  on known unrelated `api:http:GET:/discovery/search` returning `500 !== 200`.
  Runtime startup also logged the pre-existing analytics `query.ts` route
  registration noise. No discovery or analytics files are changed in this port.
- `git diff --check`: passed.
- Package/lockfile guard: no package or lockfile diff.
- Changed-file malformed warranty-token scan: passed.

## Risks And Limits

- No non-empty `200` path exists yet because Spacebar lacks durable new-member
  welcome/home settings.
- `PUT /guilds/{guild_id}/new-member-welcome` remains missing and should be
  implemented only after the backing data model is designed.
- Onboarding, new-member action/resource mutations, join requests, and member
  safety routes remain separate assignments.
