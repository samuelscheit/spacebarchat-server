# teams-param-get

## Summary

Implemented `GET /teams/{param}` (`GET_TEAMS_TEAM_ID`) as `src/api/routes/teams/#team_id/index.ts`.

The route:

- Requires bearer auth through the normal route boundary.
- Loads the requested team with members.
- Allows access for the team owner or accepted team members.
- Returns `404` `Unknown Team` (`10039`) for missing teams.
- Returns `403` `Missing Access` (`50001`) for users outside the team.
- Serializes a dedicated `TeamResponse` DTO instead of returning the raw `Team` entity.
- Declares the documented `include_payout_account_status` query parameter for compatibility, but does not fabricate payout state because this server has no persisted team payout account model in scope.

## Assigned Path

- Assigned route: `GET /teams/{param}`
- Route id: `teams-param-get`
- Route name: `GET_TEAMS_TEAM_ID`
- Source: `userdoccers:resources/team.mdx`
- Source route: `/teams/{team_id}`
- Implemented methods: `GET`
- Adjacent paths intentionally not implemented: team members, payouts, identity verification, companies, delete, stripe redirect, invite accept, and team mutation routes.

## Evidence Gathered

- Confirmed `packages/missing-routes/missing.json` had `GET /teams/{param}` under `missing_entries` before regeneration.
- Confirmed `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json` previously had `/teams` and `/teams/{team_id}/applications`, but not `/teams/{team_id}`.
- Confirmed local routes only had `src/api/routes/teams.ts` and `src/api/routes/teams/#team_id/applications.ts`.
- Reviewed `src/util/entities/Team.ts`, `src/util/entities/TeamMember.ts`, `src/util/entities/Application.ts`.
- Reviewed existing team serialization in `src/api/util/handlers/Team.ts`.
- Reviewed existing access pattern in `src/api/routes/teams/#team_id/applications.ts`.
- Reviewed Userdoccers `pages/resources/team.mdx`: `GET /teams/{team_id}` returns a team object and documents `include_payout_account_status`.

## Changed Files

- `src/api/routes/teams/#team_id/index.ts`: new route, repository injection seam, access guard, response metadata.
- `test/routes/teams-param-get.test.ts`: focused route tests.
- `src/api/util/handlers/Team.ts`: added `serializeTeamResponse`, reused by list serializer.
- `src/api/util/handlers/Team.test.ts`: serializer coverage for single-team DTO.
- `src/schemas/responses/TeamListResponse.ts`: added `TeamResponse`.
- `src/schemas/responses/TeamListResponse.test.ts`: schema/OpenAPI coverage for `TeamResponse`.
- `assets/schemas.json`: regenerated schema asset.
- `assets/openapi.json`: regenerated OpenAPI asset.
- `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`: regenerated source route catalog.
- `packages/missing-routes/missing.json`: regenerated missing-route report.
- `assets/testing-manifest.json`: regenerated testing manifest.
- `test/generated/http-contracts.json`: regenerated HTTP contract matrix.

`npm run generate:suite-coverage` was checked on current main; suite coverage output was already current.

## Missing Count Movement

Compared with current-main base `7c7e66bca5ee89fa6032b15b5904c11c95552a37`:

- Base missing count: `652`
- Current missing count: `651`
- Movement: `-1`
- Base implemented count: `528`
- Current implemented count: `529`
- Discord implemented count: `1128`
- Base had assigned entry: yes
- Current has assigned `GET /teams/{param}` entry: no

Regenerated source catalog now includes:

- `GET /teams/{team_id}`
- `route_name`: `GET_TEAMS_TEAM_ID`
- `response_schema_refs`: `APIErrorResponse`, `TeamResponse`
- `source`: `src/api/routes/teams/#team_id/index.ts`

## Commands Run

- `npm run build:src:tsgo` - passed.
- `npm run generate:schema` - passed; wrote `1008` schemas.
- `npm run build --workspace @spacebar/automatic-reverse-engineering` - passed.
- `node packages/automatic-reverse-engineering/dist/cli.js import-source-routes --root src/api/routes --out packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json` - passed.
- `npm run build --workspace @spacebar/missing-routes` - passed.
- `npm run start --workspace @spacebar/missing-routes` - passed; wrote `651` missing / `529` implemented / `1128` Discord.
- `npm run generate:testing-manifest` - passed; wrote `634` entries.
- `node scripts/testing-manifest/verify.js` - passed.
- `node scripts/testing-manifest/generate-contract-tests.js --check` - initially stale.
- `npm run generate:contract-tests` - passed; wrote `609` contracts.
- `node scripts/testing-manifest/generate-contract-tests.js --check` - passed.
- `node scripts/testing-manifest/generate-suite-coverage.js --check` - passed.
- `npm run generate:openapi` - passed; wrote `423` paths and `1008` schemas; existing warning: 3 routes missing route middleware.
- `npm run build:test-fixtures` - passed.
- `node -r dotenv/config -r module-alias/register --enable-source-maps --test dist-test/test/routes/teams-param-get.test.js dist-test/test/routes/teams-applications.test.js ...` - focused route tests passed, `13/13`.
- `TS_NODE_TRANSPILE_ONLY=1 node -r dotenv/config -r ts-node/register/transpile-only -r module-alias/register --enable-source-maps --test src/api/util/handlers/Team.test.ts src/schemas/responses/TeamListResponse.test.ts` - schema/serializer tests passed, `5/5`.
- `npm run test:manifest` - passed.
- `npm run test:suite-coverage` - passed.
- `node --test test/generated/http-contracts.test.js test/generated/suite-coverage.test.js` - passed, `13/13`.
- `npx eslint "src/api/routes/teams/#team_id/index.ts" src/api/util/handlers/Team.ts src/api/util/handlers/Team.test.ts src/schemas/responses/TeamListResponse.ts src/schemas/responses/TeamListResponse.test.ts test/routes/teams-param-get.test.ts` - passed.
- `git diff --check` - passed.
- `git diff --name-only -- package.json package-lock.json && git status --short -- package.json package-lock.json` - no output; package/lockfile unchanged.
- Malformed warranty scan over changed files - no output.

## Verification Notes

Focused tests passing:

- `GET /teams/:team_id` owner access
- accepted team-member access
- invited/non-member rejection
- unknown team error
- mounted route `200` response
- mounted route `403` response
- route metadata
- single-team serializer
- `TeamResponse` schemas/OpenAPI wiring

Generated artifacts:

- Source catalog: regenerated and includes assigned route.
- Missing report: regenerated and assigned `GET /teams/{param}` removed from `missing_entries`.
- Testing manifest: regenerated and verified, `634` entries.
- HTTP contracts: regenerated and verified, `609` contracts; new `api:http:GET:/teams/:team_id/` contract exists.
- Suite coverage: check passed; no diff.
- Schemas/OpenAPI: regenerated and include `TeamResponse` plus `/teams/{team_id}/`.

## Risks / Blockers

- `include_payout_account_status` is metadata-only because no local team payout-account persistence exists. The route does not fabricate payout fields.
- The original worker reported an unrelated generated runtime contract failure: `GET /discovery/search` returned `500` instead of `200`.

## Recommended Next Tasks

- Fix the existing `GET /discovery/search` public response runtime contract failure.
- Clean up pre-existing malformed warranty headers in a dedicated hygiene change.
- Implement remaining team routes in separate scoped workers.
