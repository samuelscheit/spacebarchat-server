# guilds_param_onboarding_allowed_applications_get

## Summary

- Accepted implementation for `GET /guilds/{guild_id}/onboarding/allowed-applications`.
- Assigned missing entry confirmed: `GET_GUILDS_GUILD_ID_ONBOARDING_ALLOWED_APPLICATIONS` for `/guilds/{param}/onboarding/allowed-applications`.
- Source route absence was confirmed by the worker before implementation.
- Userdoccers evidence: `resources/guild.mdx` documents the endpoint response as `{ application_ids: snowflake[] }` for applications allowed as onboarding connections.
- Current-base missing-route count moved from `629` to `628`; implemented routes moved from `551` to `552`; Discord route count remained `1128`.

## Changed Files

- `src/api/routes/guilds/#guild_id/onboarding/allowed-applications.ts`
- `src/schemas/responses/GuildOnboardingAllowedApplicationsResponse.ts`
- `src/schemas/responses/index.ts`
- `assets/schemas.json`
- `assets/openapi.json`
- `assets/testing-manifest.json`
- `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`
- `packages/missing-routes/missing.json`
- `test/generated/http-contracts.json`
- `test/generated/suite-coverage.json`
- `test/routes/guilds-param-onboarding-allowed-applications-get.test.ts`
- `worker-progress/guilds-param-onboarding-allowed-applications-get.md`

## Behavior

- Requires bearer authentication.
- Requires `MANAGE_GUILD`.
- Verifies the guild exists.
- Returns `200` with `{ "application_ids": [] }`.
- The empty list is intentional: Spacebar does not persist Discord's onboarding application allowlist, so returning invented application IDs would fabricate remote state.

## Current-Base Artifacts

- `packages/missing-routes/missing.json`: `628` missing / `552` implemented / `1128` Discord.
- `assets/schemas.json`: `1042` schemas and includes `GuildOnboardingAllowedApplicationsResponse`.
- `assets/openapi.json`: `446` paths and includes `GET /guilds/{guild_id}/onboarding/allowed-applications/`.
- `assets/testing-manifest.json`: `657` entries and includes `api:http:GET:/guilds/:guild_id/onboarding/allowed-applications/`.
- `test/generated/http-contracts.json`: `632` contracts and includes the onboarding allowed-applications manifest id.
- Source catalog includes `GET /guilds/{guild_id}/onboarding/allowed-applications` with response schemas `APIErrorResponse` and `GuildOnboardingAllowedApplicationsResponse`.

## Commands

- `npm run build:src:tsgo` - passed.
- `npm run generate:schema` - passed; wrote `1042` schemas.
- `npm run build --workspace @spacebar/automatic-reverse-engineering` - passed.
- `node packages/automatic-reverse-engineering/dist/cli.js import-source-routes --root src/api/routes --out packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json` - passed.
- `npm run build --workspace @spacebar/missing-routes` - passed.
- `npm run start --workspace @spacebar/missing-routes` - passed; current report is `628` missing / `552` implemented / `1128` Discord.
- `npm run generate:testing-manifest && node scripts/testing-manifest/verify.js` - passed; verified `657` entries.
- `npm run generate:contract-tests && node scripts/testing-manifest/generate-contract-tests.js --check` - passed; verified `632` contracts.
- `npm run generate:suite-coverage && node scripts/testing-manifest/generate-suite-coverage.js --check` - passed.
- `npm run generate:openapi` - passed; wrote `446` paths and `1042` schemas.
- `npm run build:test-fixtures` - passed.
- `node -r dotenv/config -r module-alias/register --enable-source-maps --test dist-test/test/routes/guilds-param-onboarding-allowed-applications-get.test.js` - passed, `7` tests.
- `node --test test/generated/http-contracts.test.js` - passed, `9` tests.
- `node --test test/generated/suite-coverage.test.js` - passed, `4` tests.
- `npm run test:manifest` - passed; verified `657` entries.
- `npm run test:suite-coverage` - passed.
- `npm run lint` - initially found a no-loss-of-precision literal in the focused test invalid-schema probe; after replacing it with a small numeric non-string value, rerun passed.
- `npm run test:contracts` - static generated contract checks passed, then runtime contracts failed only on the known unrelated `api:http:GET:/discovery/search` response-schema check returning `500` instead of expected `200`; existing analytics `query.ts` route-registration noise was also logged.

## Risks

- Userdoccers documents the response shape but not a detailed local permission model for this endpoint. The route uses `MANAGE_GUILD` because the endpoint is onboarding-configuration-adjacent and must fail closed.
- Spacebar currently has no durable onboarding allowed-application state, so the route returns the safest locally backed empty allowlist.
- The full runtime contracts gate still has the unrelated `/discovery/search` failure noted above.

## Next Tasks

- Orchestrator commit, push, close the managed worker, prune its worktree/branch, and refill the top-level worker pool with `spawn_agent` if below the cap.
