# invites-param-friend-members-get

## Goal Evidence

- `create_goal`: active goal created for objective "Implement production-ready support for the missing route path `GET /invites/{param}/friend-members` on the current integration branch, with focused tests, regenerated route catalogs and generated route artifacts, verification evidence, and a complete handoff report."
- `get_goal`: status `active`; same objective confirmed.
- Final `update_goal(status: "complete")`: status `complete`; time used 569 seconds.

## Assignment

- Assigned path: `/invites/{param}/friend-members`
- Missing methods found: `GET`
- Missing route name found: `GET_INVITES_INVITE_CODE_FRIEND_MEMBERS`
- Source reference found: `userdoccers:resources/invite.mdx`
- Source route found: `/invites/{invite_code}/friend-members`
- Methods implemented: `GET /invites/{invite_code}/friend-members`
- Out of scope and not implemented: `/invites/{param}`, `/invites/{param}/target-users`, `/invites/{param}/target-users/job-status`, `/users/@me/invites`, guild invite routes, invite acceptance, and invite revocation.

## Evidence

- `packages/missing-routes/missing.json` had exactly one owned `missing_entries[]` item for `/invites/{param}/friend-members`, method `GET`.
- `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json` had no `GET /invites/{invite_code}/friend-members` entry before implementation.
- `src/api/routes/invites/index.ts` had only base invite `GET`, `POST`, and `DELETE` handlers before implementation.
- `packages/automatic-reverse-engineering/data/catalogs/routes.userdoccers.catalog.json` contains `GET /invites/{invite_code}/friend-members` with summary `Get Invite Friend Members`.
- Userdoccers `resources/invite.mdx` says the endpoint returns `friend_member_ids`, the user IDs of friends in the target guild, and always returns an empty array for group DMs and friend invites.

## Behavior

- Auth mode: bearer-authenticated. The previous broad public `GET /invites/` no-auth prefix was narrowed to base invite lookup only, so `GET /invites/{invite_code}` remains public while `/friend-members` requires auth.
- Response schema: `InviteFriendMembersResponse` with `friend_member_ids: Snowflake[]`.
- Data source: existing local `Relationship` rows for the authenticated user with `RelationshipType.friends`, intersected with local `Member` rows for the invite guild.
- Privacy/conservative behavior: returns only locally provable current-user friends who are members of the target guild; returns `{ "friend_member_ids": [] }` for non-guild invites and when Spacebar lacks local friend/member evidence.
- Invite lookup/error behavior: uses existing `Invite.findOneOrFail({ code })` behavior; unknown invite codes surface as the existing 404 API error response through `ErrorHandler`.
- No invite acceptance, revocation, guild permission, or target-user-file behavior was added.

## Changed Files

- `src/api/routes/invites/index.ts`
- `src/api/middlewares/NoAuthorizationRoutes.ts`
- `src/schemas/responses/InviteFriendMembersResponse.ts`
- `src/schemas/responses/index.ts`
- `test/routes/inviteFriendMembersRoute.test.ts`
- `assets/schemas.json`
- `assets/openapi.json`
- `assets/testing-manifest.json`
- `test/generated/http-contracts.json`
- `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`
- `packages/missing-routes/missing.json`
- `worker-progress/invites-param-friend-members-get.md`

## Verification

- `npm run build:src:tsgo`: initial attempt failed with the allowed symlinked `node_modules` because TypeScript emitted a dependency realpath portability error in an unrelated message upload helper; reran with an ignored local dependency copy and passed.
- `npm run generate:schema`: passed.
- `npm run build:test-fixtures`: passed.
- `npm run build --workspace @spacebar/automatic-reverse-engineering`: passed.
- `node packages/automatic-reverse-engineering/dist/cli.js import-source-routes --root src/api/routes --out packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`: passed.
- `npm run build --workspace @spacebar/missing-routes`: passed.
- `npm run start --workspace @spacebar/missing-routes`: passed, wrote `packages/missing-routes/missing.json`.
- `npm run generate:testing-manifest`: passed.
- `node scripts/testing-manifest/verify.js`: passed.
- `node scripts/testing-manifest/generate-contract-tests.js --check`: initially stale; `npm run generate:contract-tests` passed; rerun check passed.
- `node scripts/testing-manifest/generate-suite-coverage.js --check`: passed; no regeneration needed.
- `node --test test/generated/http-contracts.test.js test/generated/suite-coverage.test.js`: passed.
- `npm run generate:openapi`: passed.
- Focused test `node -r dotenv/config -r module-alias/register --enable-source-maps --test dist-test/test/routes/inviteFriendMembersRoute.test.js`: passed, 9 tests.
- `git diff --check`: passed.
- Package manifest/lockfile cleanliness check: passed, no package manifest or lockfile changes.
- Changed-file malformed warranty-string scan: passed.

## Generated Movement

- Missing-route count moved from 749 to 748.
- Spacebar implemented count moved from 431 to 432.
- Assigned route remaining in `missing_entries[]`: 0.
- Source catalog now includes `GET /invites/{invite_code}/friend-members` with response refs `APIErrorResponse` and `InviteFriendMembersResponse`.
- Testing manifest now includes `api:http:GET:/invites/:invite_code/friend-members` as bearer auth with `200`, `401`, and `404` metadata.
- OpenAPI now includes bearer security and `200`/`401`/`404` response schemas for `/invites/{invite_code}/friend-members`.

## Orchestrator Current-Base Audit

- Ported source, schema, focused test, and report changes onto current master
  base `020def718`.
- Regenerated schemas, source route catalog, missing-route report, testing
  manifest, generated HTTP contracts, and OpenAPI on the current base.
- Current-base missing-route count moved from 678 to 677, and Spacebar
  implemented count moved from 502 to 503.
- Current-base audit confirmed no remaining `missing_entries[]` item for
  `/invites/{param}/friend-members`.
- Current-base source catalog contains
  `GET /invites/{invite_code}/friend-members` with response refs
  `APIErrorResponse` and `InviteFriendMembersResponse`.
- Current-base testing manifest contains
  `api:http:GET:/invites/:invite_code/friend-members` as bearer auth with
  `200`, `401`, and `404` metadata.
- Current-base OpenAPI contains bearer security and `200`/`401`/`404` response
  schemas for `/invites/{invite_code}/friend-members`.
- Current-base verification passed:
  `npm run build:src:tsgo`, `npm run generate:schema`,
  `npm run build:test-fixtures`,
  `npm run build --workspace @spacebar/automatic-reverse-engineering`,
  source catalog import, `npm run build --workspace @spacebar/missing-routes`,
  `npm run start --workspace @spacebar/missing-routes`,
  `npm run generate:testing-manifest`,
  `node scripts/testing-manifest/verify.js`,
  generated contract regeneration/checks with 583 contracts,
  `node scripts/testing-manifest/generate-suite-coverage.js --check`,
  `npm run generate:openapi`, focused compiled route tests 9/9,
  generated contract/suite tests 13/13, `git diff --check`,
  focused ESLint, focused Prettier, package/lockfile guard, and malformed
  warranty-token scan.

## Risks And Notes

- Spacebar does not have a separate Discord mutual-friend-members source. The implementation intentionally uses only locally stored relationship and guild member records instead of fabricating friend IDs.
- Relationship lookup uses Spacebar's existing one-way current-user relationship rows (`from_id` to `to_id`) and `RelationshipType.friends`.
- `node_modules/` is present as an ignored local dependency copy for audit/rerun convenience. A symlink to the shared dependency tree caused the unrelated TypeScript realpath portability error noted above.

## Recommended Next Tasks

- Implement the adjacent invite target-user routes separately from this assignment.
- If Discord compatibility requires broader mutual-friend semantics later, add a shared relationship/member query abstraction with explicit tests before reusing it across invite and presence routes.
