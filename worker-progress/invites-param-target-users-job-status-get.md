# GET /invites/{param}/target-users/job-status

## Summary

- Implemented `GET /invites/:invite_code/target-users/job-status` only.
- The route is authenticated and uses the same invite lookup and authorization
  behavior as `GET /invites/:invite_code/target-users`: the inviter may access
  it, otherwise the caller needs `MANAGE_GUILD` or `VIEW_AUDIT_LOG`.
- Because Spacebar does not persist Discord target-users CSV files or their
  async processing jobs, the route fails closed with the existing typed `501`
  `APIErrorResponse` after invite lookup and authorization.
- Added focused tests covering auth boundary, route metadata, invite lookup,
  404 behavior, permission denial, regenerated source catalog/manifest
  presence, and OpenAPI security/schema metadata.

## Changed Files

- `src/api/routes/invites/index.ts`
    - Added a shared target-users invite lookup helper.
    - Reused the shared fail-closed target-users handler for the existing
      `GET /target-users` route.
    - Added `GET /:invite_code/target-users/job-status` with summary
      `Get Invite Target Users Job Status` and `401/403/404/501`
      `APIErrorResponse` metadata.
- `test/routes/inviteTargetUsersJobStatusRoute.test.ts`
    - Added focused tests for the assigned job-status route.
- Regenerated source catalog, missing report, testing manifest, HTTP contracts,
  suite coverage, and OpenAPI on the current integration base.

## Evidence Gathered

- The current missing report contained one assigned missing entry:
    - method `GET`
    - route `/invites/{param}/target-users/job-status`
    - route_name `GET_INVITES_INVITE_CODE_TARGET_USERS_JOB_STATUS`
    - source `userdoccers:resources/invite.mdx`
- The source catalog had `/invites/{invite_code}`,
  `/invites/{invite_code}/friend-members`, and
  `/invites/{invite_code}/target-users`, but not
  `/invites/{invite_code}/target-users/job-status`.
- Local route source already implemented `GET /invites/:invite_code/target-users`
  as an authenticated fail-closed endpoint because target-user-file storage and
  async job infrastructure are unsupported.
- Userdoccers reference used: `https://docs.discord.food/resources/invite`,
  section `Get Target Users Job Status`.
- Official Discord docs cross-check used:
  `https://docs.discord.com/developers/resources/invite`, section
  `Get Target Users Job Status`.
- xHyroM local catalog checked:
  `packages/automatic-reverse-engineering/data/catalogs/routes.xhyrom.catalog.json`
  only lists base invite routes, no target-users/job-status route.

## Missing-Route Movement

- Current base before regeneration: `missing = 671`, `spacebar = 509`.
- After regeneration: `missing = 670`, `spacebar = 510`.
- No adjacent invite routes were implemented.
  `PUT /invites/{param}/target-users` remains missing and out of scope.

## Verification

Current-base verification was rerun by the orchestrator after porting:

- `npm run build:src:tsgo`
- `npm run build --workspace @spacebar/automatic-reverse-engineering`
- `node packages/automatic-reverse-engineering/dist/cli.js import-source-routes --root src/api/routes --out packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`
- `npm run build --workspace @spacebar/missing-routes`
- `npm run start --workspace @spacebar/missing-routes`
- `npm run generate:testing-manifest`
- `node scripts/testing-manifest/verify.js`
- `npm run generate:contract-tests`
- `node scripts/testing-manifest/generate-contract-tests.js --check`
- `npm run generate:suite-coverage`
- `node scripts/testing-manifest/generate-suite-coverage.js --check`
- `npm run generate:openapi`
- `npm run build:test-fixtures`
- Focused invite target-user and job-status route tests
- Generated contract and suite coverage tests
- Focused ESLint and Prettier
- `git diff --check`
- package/lockfile guard
- conflict-marker and changed-file warranty-token scans

## Risks Or Blockers

- The route intentionally returns `501` after authorization because implementing
  true job status would require durable target-user-file/job infrastructure,
  which is out of scope.
- `PUT /invites/{param}/target-users` is still missing and should be implemented
  only when durable target-user-file upload and async job state are designed.
