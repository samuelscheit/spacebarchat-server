# GET /teams/{team_id}/members

## Summary

Integrated the assigned `GET /teams/{param}/members` route onto current master.

The route follows the existing team access model: bearer-authenticated callers may list members when they own the team or are an accepted team member. It returns the same route-shaped member DTO already used by `GET /teams/{team_id}`, and it leaves the adjacent team-member invite mutation out of scope.

Current-base integration note: accepted onto base `856107f70` after regenerating schemas, the source catalog, missing-route report, testing manifest, generated HTTP contracts, and OpenAPI from the integrated tree. The assigned route moves the current report from `missing: 647`, `spacebar: 533` to `missing: 646`, `spacebar: 534`; Discord remains `1128`.

## Assigned Path

- Assigned missing path: `/teams/{param}/members`
- Missing methods found: `GET`, `POST`
- Methods implemented: `GET`
- Source route: `/teams/{team_id}/members`
- Adjacent routes intentionally not implemented: `POST /teams/{team_id}/members`, team identity verification, payout, application, ownership transfer, and member mutation routes.

## Changed Files

- `src/api/routes/teams/#team_id/members.ts`
- `src/api/util/handlers/Team.ts`
- `src/api/util/handlers/Team.test.ts`
- `src/schemas/responses/TeamListResponse.ts`
- `src/schemas/responses/TeamListResponse.test.ts`
- `test/routes/teams-members.test.ts`
- `assets/schemas.json`
- `assets/openapi.json`
- `assets/testing-manifest.json`
- `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`
- `packages/missing-routes/missing.json`
- `test/generated/http-contracts.json`
- `worker-progress/teams-param-members-get.md`

## Evidence

- `packages/missing-routes/missing.json` now has only `POST /teams/{param}/members` for this path; the assigned `GET` entry is removed.
- `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json` now contains `GET_TEAMS_TEAM_ID_MEMBERS` from `src/api/routes/teams/#team_id/members.ts`.
- Userdoccers `resources/team.mdx` documents `GET /teams/{team_id}/members` as returning team member objects for the team ID.
- Existing `GET /teams/{team_id}` and `GET /teams/{team_id}/applications` use owner-or-accepted-member access; the new route follows that authorization pattern.
- OpenAPI now includes `GET /teams/{team_id}/members/` with `TeamMembersResponse`.
- Testing manifest and generated HTTP contracts now include `api:http:GET:/teams/:team_id/members/`.

## Commands Run

- `npm run build:src:tsgo` passed.
- `npm run generate:schema` passed and wrote 1012 schemas including `TeamMembersResponse`.
- `npm run build --workspace @spacebar/automatic-reverse-engineering` passed.
- `node packages/automatic-reverse-engineering/dist/cli.js import-source-routes --root src/api/routes --out packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json` passed.
- `npm run build --workspace @spacebar/missing-routes` passed.
- `npm run start --workspace @spacebar/missing-routes` wrote `missing 646`, `spacebar 534`, `discord 1128`.
- `npm run generate:testing-manifest` wrote 639 entries.
- `node scripts/testing-manifest/verify.js` passed.
- `node scripts/testing-manifest/generate-contract-tests.js --check` initially reported stale contracts; `npm run generate:contract-tests` regenerated 614 contracts; final check passed.
- `node scripts/testing-manifest/generate-suite-coverage.js --check` passed unchanged.
- `npm run generate:openapi` wrote 428 paths and 1012 schemas; only pre-existing webhook route middleware warnings remain.
- `npm run build:test-fixtures` passed.
- `node -r dotenv/config -r module-alias/register --enable-source-maps --test dist-test/test/routes/teams-members.test.js` passed: 7 tests.
- `npm run test -- src/api/util/handlers/Team.test.ts src/schemas/responses/TeamListResponse.test.ts test/routes/teams-members.test.ts` passed: 13 tests.
- `node --test test/generated/http-contracts.test.js test/generated/suite-coverage.test.js` passed: 13 tests.
- `npm run test:manifest` passed: 30 tests and manifest verification.
- `npm run test:suite-coverage` passed: 4 tests.
- `npx eslint src/api/util/handlers/Team.ts src/api/util/handlers/Team.test.ts 'src/api/routes/teams/#team_id/members.ts' src/schemas/responses/TeamListResponse.ts src/schemas/responses/TeamListResponse.test.ts test/routes/teams-members.test.ts` passed.
- `git diff --check` passed.
- Package/lockfile guard passed with no `package.json`, `package-lock.json`, or shrinkwrap diff.
- Malformed warranty-token scan passed.

## Artifact Status

- Schemas regenerated.
- Source catalog regenerated.
- Missing-route report regenerated.
- Testing manifest regenerated and verified.
- Generated HTTP contracts regenerated and verified.
- Suite coverage checked unchanged.
- OpenAPI regenerated.

## Risks

- Response uses the existing Spacebar route-shaped `TeamListTeamMember` fields (`id`, `membership_state`, `permissions`, `role`, `team_id`, `user_id`) rather than adding nested partial users.
- The worker reported a full runtime contract failure for unrelated `GET /discovery/search`; this current-base audit reran generated static contract and manifest gates, but did not rerun that known broad runtime failure.

## Recommended Next Tasks

- Implement the separate `POST /teams/{team_id}/members` invite route in its own worker.
- Investigate the existing generated runtime contract failure for `GET /discovery/search`.
