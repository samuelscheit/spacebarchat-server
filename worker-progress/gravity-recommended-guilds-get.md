# GET /gravity-recommended-guilds

## Summary

Implemented the authenticated `GET /gravity-recommended-guilds` compatibility route. The route returns a conservative source-compatible response wrapper, `{ "guilds": [] }`, because this Spacebar tree has no durable Gravity recommendation source or model for producing personalized guild recommendations.

## Assigned Path

- Assigned path: `/gravity-recommended-guilds`
- Missing methods found: `GET` only, `route_name: GRAVITY_RECOMMENDED_GUILDS`
- Methods implemented: `GET`
- Adjacent routes not implemented: `/gravity-custom-channel-scores`, `/gravity-content`, `/gravity-topic-guilds`, `/gravity-custom-guild-score`, guild discovery, and `/guild-recommendations`

## Changed Files

- `src/api/routes/gravity-recommended-guilds.ts`
- `src/schemas/responses/GravityRecommendedGuildsResponse.ts`
- `src/schemas/responses/index.ts`
- `test/routes/gravity-recommended-guilds.test.ts`
- `test/routes/gravity-recommended-guilds-schema.test.ts`
- `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`
- `packages/missing-routes/missing.json`
- `assets/schemas.json`
- `assets/testing-manifest.json`
- `test/generated/http-contracts.json`
- `assets/openapi.json`
- `worker-progress/gravity-recommended-guilds-get.md`

## Evidence Gathered

- `packages/missing-routes/missing.json` initially contained one assigned entry: `GET /gravity-recommended-guilds`, `GRAVITY_RECOMMENDED_GUILDS`, source `xhyrom:data/client/routes.json`.
- `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json` and `src/api/routes/**` had no `/gravity-recommended-guilds` implementation before this change.
- Local xHyroM route catalog contains `GET`, `HEAD`, and `OPTIONS` entries for `/gravity-recommended-guilds`; only `GET` was assigned.
- Local Userdoccers route/docs catalogs had no source-backed `/gravity-recommended-guilds` evidence. The only local Userdoccers "recommendations" match was unrelated partner SDK SKU recommendations.
- Local direct Discord client route references were absent beyond the xHyroM-derived route catalog.
- Supplemental current Discord web client evidence from `https://discord.com/assets/web.c0ce558aa0aa6a32.js` showed the client calling `GRAVITY_RECOMMENDED_GUILDS` and reading `response.body.guilds`. The same call site did not show query parameters.
- `GET /gravity-recommended-guilds` is not listed in `NO_AUTHORIZATION_ROUTES`; with no source-backed evidence proving public access, the implementation keeps bearer auth and declares `401: APIErrorResponse`.

## What Changed

- Added `src/api/routes/gravity-recommended-guilds.ts` with `GET /`, authenticated route metadata, `200` response metadata, and explicit `401` response metadata.
- Added `GravityRecommendedGuildsResponse` and `GravityRecommendedGuild` schemas. The response models the observed Gravity wrapper shape as `guilds: [{ guild: RecommendedGuild }]`.
- Returned `{ guilds: [] }` instead of querying guild discovery/recommendation data, avoiding fabricated or cross-feature recommendation results.
- Added focused route tests for auth boundary, empty response compatibility, and route metadata.
- Added focused schema tests verifying the Gravity-specific `guilds` wrapper does not reuse `/guild-recommendations` fields such as `recommended_guilds` or `load_id`.
- Regenerated source route catalog, missing-route report, schemas, testing manifest, HTTP contracts, and OpenAPI.

## Count Movement

- Worker-base regeneration: `missing = 817`, `spacebar = 363`, `discord = 1128`.
- Current-base before integration: `missing = 806`, `spacebar = 374`.
- Current-base after regeneration: `missing = 805`, `spacebar = 375`, `discord = 1128`.
- Movement: the assigned `GET /gravity-recommended-guilds` entry disappeared from `missing_entries`.

## Commands Run

- `create_goal` with objective `implement the missing route path GET /gravity-recommended-guilds for the Spacebar server API.`
- `get_goal`
- `sed -n '1,220p' /Users/user/Developer/Developer/spacebarchat/WORKER_BRIEF.md`
- `git status --short`
- `if [ -L node_modules ]; then printf 'symlink\n'; elif [ -d node_modules ]; then printf 'directory\n'; else printf 'missing\n'; fi`
- `rg -n 'gravity-recommended-guilds|GRAVITY_RECOMMENDED_GUILDS' ...`
- `rg -n 'gravity|recommend' ...`
- `npm ci`
- `curl -L -s https://discord.com/app | rg -o 'assets/[A-Za-z0-9._/-]+\.js' | head -n 30`
- `curl` scan of current Discord web client assets for `gravity-recommended-guilds`, `GRAVITY_RECOMMENDED_GUILDS`, and related names
- `npm run build:src:tsgo` - passed.
- `npm run generate:schema` - passed, wrote `727` schemas.
- `npm run build:test-fixtures` - passed.
- `node -r dotenv/config -r module-alias/register --enable-source-maps --test dist-test/test/routes/gravity-recommended-guilds.test.js dist-test/test/routes/gravity-recommended-guilds-schema.test.js` - passed, `4` tests.
- `npm run build --workspace @spacebar/automatic-reverse-engineering` - passed.
- `node packages/automatic-reverse-engineering/dist/cli.js import-source-routes --root src/api/routes --out packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json` - passed.
- `npm run build --workspace @spacebar/missing-routes` - passed.
- `npm run start --workspace @spacebar/missing-routes` - passed, reported `Spacebar is missing 817`, `Spacebar implements 363`, `Discord implements 1128`.
- `npm run generate:schema` - passed again after catalog regeneration, wrote `727` schemas.
- `npm run generate:testing-manifest` - passed, wrote `468` entries.
- `node scripts/testing-manifest/verify.js` - passed.
- `node scripts/testing-manifest/generate-contract-tests.js --check` - initially reported stale contracts after manifest regeneration.
- `npm run generate:contract-tests` - passed, wrote `443` contracts.
- `node scripts/testing-manifest/generate-contract-tests.js --check` - passed.
- `node scripts/testing-manifest/generate-suite-coverage.js --check` - passed.
- `npm run generate:openapi` - passed, generated `287` paths and `727` schemas with only existing webhook route-metadata warnings.
- `node --test test/generated/http-contracts.test.js test/generated/suite-coverage.test.js` - passed, `13` tests.
- `git diff --check` - passed.
- Warranty-token scan for changed scoped files - passed.
- Orchestrator current-base verification:
  - `npm run build:src:tsgo` - passed.
  - `npm run generate:schema` - passed, wrote `739` schemas.
  - `npm run build:test-fixtures` - passed.
  - `node -r dotenv/config -r module-alias/register --enable-source-maps --test dist-test/test/routes/gravity-recommended-guilds.test.js dist-test/test/routes/gravity-recommended-guilds-schema.test.js` - passed, `4` tests.
  - `npm run build --workspace @spacebar/automatic-reverse-engineering` - passed.
  - `node packages/automatic-reverse-engineering/dist/cli.js import-source-routes --root src/api/routes --out packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json` - passed.
  - `npm run build --workspace @spacebar/missing-routes` - passed.
  - `npm run start --workspace @spacebar/missing-routes` - passed, reported `Spacebar is missing 805`, `Spacebar implements 375`, `Discord implements 1128`.
  - `npm run generate:testing-manifest` - passed, wrote `480` entries.
  - `node scripts/testing-manifest/verify.js` - passed.
  - `npm run generate:contract-tests` - passed, wrote `455` contracts.
  - `node scripts/testing-manifest/generate-contract-tests.js --check` - passed.
  - `npm run generate:suite-coverage` - passed, wrote `15` suites.
  - `node scripts/testing-manifest/generate-suite-coverage.js --check` - passed.
  - `node --test test/generated/http-contracts.test.js test/generated/suite-coverage.test.js` - passed, `13` tests.
  - `npm run generate:openapi` - passed, generated `295` paths and `739` schemas with only existing webhook route-metadata warnings.
  - `git diff --check` - passed.
  - Lockfile diff guard - passed.
  - Warranty-token scan for changed scoped files - passed.
  - `jq` check confirmed `/gravity-recommended-guilds` has no remaining exact `missing_entries`.

## Risks And Blockers

- Spacebar currently lacks source-backed Gravity recommendation inputs. Returning an empty `guilds` array is intentionally conservative until durable Gravity data exists.
- The current Discord client evidence confirms the top-level `guilds` wrapper, but not a full non-empty item contract. The schema models each item as containing a `guild` using the existing recommended guild DTO; this is safe for the current empty response but should be revisited before returning non-empty entries.
- No Userdoccers route evidence exists for this private Gravity route.

## Recommended Next Tasks

- Capture authenticated Discord behavior for `/gravity-recommended-guilds` if the project wants to support non-empty personalized results.
- Design durable Gravity recommendation storage/scoring before returning actual guild entries.
- Keep related Gravity endpoints as separate assignments because they have different methods and likely different request/response contracts.

## Goal Status Evidence

- Initial `get_goal` status: `active`.
- Initial `get_goal` objective: `implement the missing route path GET /gravity-recommended-guilds for the Spacebar server API.`
- Pre-handoff `get_goal` status: `active`.
- Pre-handoff `get_goal` objective: `implement the missing route path GET /gravity-recommended-guilds for the Spacebar server API.`
