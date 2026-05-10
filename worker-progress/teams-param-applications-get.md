# GET /teams/{team_id}/applications

## Summary

Implemented the assigned authenticated `GET /teams/{team_id}/applications` API route. The route verifies the team exists, authorizes the caller as the team owner or an accepted team member, and returns team-owned applications with the existing `APIApplicationArray` response schema.

## Assigned Path

- Assigned path: `/teams/{team_id}/applications`
- Missing methods found: `GET /teams/{param}/applications` (`GET_TEAMS_TEAM_ID_APPLICATIONS`)
- Methods implemented: `GET /teams/{team_id}/applications`

## Changed Files

- `src/api/routes/teams/#team_id/applications.ts`
- `test/routes/teams-applications.test.ts`
- `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`
- `packages/missing-routes/missing.json`
- `assets/testing-manifest.json`
- `test/generated/http-contracts.json`
- `assets/openapi.json`
- `worker-progress/teams-param-applications-get.md`

## What Changed

- Added a nested team applications router with bearer-auth route metadata.
- Added authorization helper behavior for team owners and accepted team members.
- Added conservative API errors for unknown teams (`10039`, 404) and inaccessible teams (`50001`, 403).
- Added focused tests covering owner access, accepted member access, invited/non-member rejection, unknown team short-circuiting, and mounted route responses.
- Regenerated source route catalog, missing-route report, testing manifest, HTTP contract catalog, and OpenAPI.

## Evidence Gathered

- `packages/missing-routes/missing.json` initially had one assigned missing entry for `GET /teams/{param}/applications`.
- `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json` initially had only `GET /teams` and `POST /teams`; after regeneration it includes `GET /teams/{team_id}/applications`.
- `src/api/routes/**` had no team applications route before this change.
- Existing local patterns used:
  - `src/api/routes/teams.ts` for team entity and list route behavior.
  - `src/api/routes/applications/index.ts` for `APIApplicationArray` application list response metadata.
  - `src/api/util/utility/ApplicationAuthorization.ts` and branch/gift-code-batch route tests for accepted team-member authorization style.
- Userdoccers local catalog reference: `packages/automatic-reverse-engineering/data/catalogs/routes.userdoccers.catalog.json`, `GET_TEAMS_TEAM_ID_APPLICATIONS`, source `userdoccers:resources/team.mdx`.
- Upstream Userdoccers source reference: `https://raw.githubusercontent.com/discord-userdoccers/discord-userdoccers/master/pages/resources/team.mdx`, `Get Team Applications`, response is an array of application objects.
- xHyroM local catalog reference: `packages/automatic-reverse-engineering/data/catalogs/routes.xhyrom.catalog.json`; it has `/teams` root methods only and no `/teams/{team_id}/applications` entry.

## Missing-Route Count Movement

- Before: `missing_entries = 843`, assigned route count `1`.
- After regeneration: `missing_entries = 842`, assigned route count `0`.
- `Spacebar implements` moved from `337` to `338`.

## Commands Run

- `create_goal` and `get_goal`
- `npm ci`
- `npm run build:src:tsgo`
- `npm run build:test-fixtures`
- `node -r dotenv/config -r module-alias/register --enable-source-maps --test dist-test/test/routes/teams-applications.test.js`
- `npm run build --workspace @spacebar/automatic-reverse-engineering`
- `node packages/automatic-reverse-engineering/dist/cli.js import-source-routes --root src/api/routes --out packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`
- `npm run build --workspace @spacebar/missing-routes`
- `npm run start --workspace @spacebar/missing-routes`
- `npm run generate:schema`
- `npm run generate:testing-manifest`
- `node scripts/testing-manifest/verify.js`
- `npm run generate:contract-tests`
- `node scripts/testing-manifest/generate-contract-tests.js --check`
- `node scripts/testing-manifest/generate-suite-coverage.js --check`
- `npm run generate:openapi`
- `git diff --check`
- Malformed warranty-line scan from the worker brief

## Verification Results

- Source build passed.
- Test fixture build passed.
- Focused compiled route test passed: 6 tests, 6 passing.
- Missing-route regeneration reports `Spacebar is missing 842`.
- Testing manifest verified: 443 entries.
- Generated HTTP contracts verified: 418 contracts.
- Generated suite coverage verified.
- OpenAPI regenerated with 263 paths and 675 schemas. The generator still reports 3 pre-existing webhook route metadata warnings unrelated to this change.
- `git diff --check` passed.
- Malformed warranty-line scan returned no matches.

## Risks And Blockers

- Userdoccers documents the route and response shape but does not specify detailed error semantics. I used conservative Discord-style API errors for missing team and missing access.
- Spacebar has exact backing state for team-owned applications through the `Application.team` relation, so no empty compatibility fallback was needed.
- I did not implement adjacent team detail, member, company, payout, identity verification, delete, invite, or Stripe routes.

## Recommended Next Tasks

- Implement remaining team routes as separate assigned work, especially `GET /teams/{team_id}` and team member routes, so team authorization behavior can be centralized if repeated.
- Consider adding a shared `UNKNOWN_TEAM` Discord API error constant if more team routes need the same error semantics.

## Goal Status Evidence

- Initial `get_goal`: status `active`, objective `implement the missing route path GET /teams/{team_id}/applications for the Spacebar server API`.
- Final pre-completion `get_goal`: status `active`, objective unchanged, thread `019e1192-38f0-78b1-8e02-dbc72f885e9e`.
- `update_goal`: status `complete`, time used 695 seconds.
