# invites-param-target-users-get

## Summary

Ported the assigned route id `invites-param-target-users-get` onto current integration base `80914e9d3` as `GET /invites/:invite_code/target-users`.

Userdoccers documents the endpoint as returning a CSV target-users file for invites that were created with `target_users_file`, with access allowed to the inviter or to guild users with `MANAGE_GUILD` or `VIEW_AUDIT_LOG`. Spacebar currently has no target-users CSV persistence, no `target_users_file` invite-create handling, and no async target-users job model. The route therefore performs invite lookup and the documented authorization check, then fails closed with a typed `501 APIErrorResponse` instead of fabricating CSV state.

## Scope

- Assigned path: `/invites/{param}/target-users`
- Assigned method/route id: `GET`, `GET_INVITES_INVITE_CODE_TARGET_USERS`
- Missing methods found for the same canonical path before implementation: `GET`, `PUT`
- Implemented: `GET /invites/:invite_code/target-users`
- Left out of scope by the explicit assignment: `PUT /invites/{param}/target-users`, `/invites/{param}/target-users/job-status`, base invite routes, friend-member routes, invite accept/delete, and durable target-users-file infrastructure.

## Changed Files

- `src/api/routes/invites/index.ts`
- `test/routes/inviteTargetUsersRoute.test.ts`
- `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`
- `packages/missing-routes/missing.json`
- `assets/testing-manifest.json`
- `assets/openapi.json`
- `test/generated/http-contracts.json`
- `worker-progress/invites-param-target-users-get.md`

No package manifests or lockfiles were changed.

## Evidence

- Current base `packages/missing-routes/missing.json` had two missing entries for `/invites/{param}/target-users`: assigned `GET` and out-of-scope `PUT`.
- `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json` initially had no `GET /invites/{invite_code}/target-users` entry.
- `src/api/routes/invites/index.ts` initially had base invite `GET`, `POST`, `DELETE`, and `GET /friend-members`, but no target-users route.
- Userdoccers source: `https://raw.githubusercontent.com/discord-userdoccers/discord-userdoccers/master/pages/resources/invite.mdx`, `Get Invite Target Users`, says the endpoint returns IDs allowed to see/accept the invite as a CSV with `user_id` header, requires a target users file, and requires `MANAGE_GUILD` or `VIEW_AUDIT_LOG` when the requester is not the inviter.
- Local xHyroM catalog was checked around `/invites/{invite_code}` and does not list the target-users route; the assigned target-users evidence is Userdoccers-only.

## Behavior

- Auth mode: bearer-authenticated; the existing no-auth rule remains limited to base `GET /invites/{invite_code}` and does not cover `/target-users`.
- Invite lookup: uses existing `Invite.findOneOrFail({ where: { code } })`; unknown invite codes still surface through `ErrorHandler` as the existing 404 entity-not-found response.
- Authorization: inviter can proceed; non-inviters must have `MANAGE_GUILD` or `VIEW_AUDIT_LOG` on the invite guild; non-guild invites cannot satisfy the guild permission fallback for non-inviters.
- Success behavior: returns typed `501 APIErrorResponse` with message `Invite target user files are not supported on this Spacebar instance.` until the target-users-file storage/job pipeline exists.

## Artifact Status

- Source catalog now includes `GET /invites/{invite_code}/target-users` with response refs `["APIErrorResponse"]`.
- Missing-route report moved from `missing=674`, `spacebar=506`, `discord=1128` to `missing=673`, `spacebar=507`, `discord=1128`.
- The assigned `GET` missing entry is gone. The out-of-scope `PUT /invites/{param}/target-users` entry remains as `PUT_INVITES_INVITE_CODE_TARGET_USERS`.
- Testing manifest now includes `api:http:GET:/invites/:invite_code/target-users` as bearer auth with response statuses `[401, 403, 404, 501]`.
- OpenAPI now includes `/invites/{invite_code}/target-users` `GET` with bearer security and `401`/`403`/`404`/`501` `APIErrorResponse` responses.
- HTTP contracts regenerated to `587` contracts.
- Suite coverage check was already current; no suite coverage regeneration was needed.
- Schemas were unchanged, so `npm run generate:schema` was not run.

## Commands Run

- `npm run build:src:tsgo` - passed.
- `npm run build --workspace @spacebar/automatic-reverse-engineering` - passed.
- `npm run build --workspace @spacebar/missing-routes` - passed.
- `node packages/automatic-reverse-engineering/dist/cli.js import-source-routes --root src/api/routes --out packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json` - passed.
- `npm run start --workspace @spacebar/missing-routes` - passed; wrote `missing=673`, `spacebar=507`, `discord=1128`.
- `npm run generate:testing-manifest` - passed; wrote `612` entries.
- `node scripts/testing-manifest/verify.js` - passed and verified `612` entries.
- `node scripts/testing-manifest/generate-contract-tests.js --check` - stale as expected.
- `npm run generate:contract-tests` - passed; wrote `587` contracts.
- `node scripts/testing-manifest/generate-contract-tests.js --check` - passed and verified `587` contracts.
- `node scripts/testing-manifest/generate-suite-coverage.js --check` - passed.
- `npm run generate:openapi` - passed; generated `412` paths and `994` schemas with only existing webhook route-metadata warnings.
- `npm run build:test-fixtures` - passed after artifact regeneration.
- `node -r dotenv/config -r module-alias/register --enable-source-maps --test dist-test/test/routes/inviteTargetUsersRoute.test.js` - passed, `10` tests.
- `node -r dotenv/config -r module-alias/register --enable-source-maps --test dist-test/test/routes/inviteFriendMembersRoute.test.js` - passed, `9` tests.
- `node --test test/generated/http-contracts.test.js test/generated/suite-coverage.test.js` - passed, `13` tests.
- `npx eslint src/api/routes/invites/index.ts test/routes/inviteTargetUsersRoute.test.ts` - passed.
- `npx prettier --write src/api/routes/invites/index.ts test/routes/inviteTargetUsersRoute.test.ts worker-progress/invites-param-target-users-get.md assets/testing-manifest.json packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json packages/missing-routes/missing.json test/generated/http-contracts.json assets/openapi.json` - passed.
- `npx prettier --check src/api/routes/invites/index.ts test/routes/inviteTargetUsersRoute.test.ts worker-progress/invites-param-target-users-get.md assets/testing-manifest.json packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json packages/missing-routes/missing.json test/generated/http-contracts.json assets/openapi.json` - passed.
- `git diff --check` - passed.
- `git diff --cached --check` - passed.
- `git diff --exit-code -- package.json package-lock.json package-lock.json apps/*/package.json packages/*/package.json` - passed.
- Changed-file malformed warranty-token scan - passed.

## Completion Audit

| Requirement                        | Evidence                                                                                                                       | Status |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ | ------ |
| Confirm assigned missing entry     | Initial missing report contained assigned `GET /invites/{param}/target-users`; source catalog/routes did not.                  | Done   |
| Compare source docs                | Userdoccers invite docs and local xHyroM invite catalog checked.                                                               | Done   |
| Implement only assigned route id   | Added only `GET /:invite_code/target-users`; no `PUT` or job-status handler.                                                   | Done   |
| Auth and permission behavior       | Route is bearer-only and checks inviter, `MANAGE_GUILD`, or `VIEW_AUDIT_LOG`.                                                  | Done   |
| Avoid fabricated unsupported state | Valid authorized requests fail closed with typed `501 APIErrorResponse`.                                                       | Done   |
| Focused tests                      | New route tests cover no-auth exclusion, metadata, permission helper, mounted 501, 404, source catalog, manifest, and OpenAPI. | Done   |
| Regenerated artifacts              | Source catalog, missing report, testing manifest, contracts, and OpenAPI regenerated; suite coverage checked current.          | Done   |
| Final hygiene                      | Focused ESLint, Prettier check, diff checks, package guard, and changed-file warranty scan passed.                             | Done   |

## Risks And Next Tasks

- Full CSV success requires a durable target-users-file model, multipart invite-create support for `target_users_file`, invite acceptance enforcement against that file, and the paired `PUT /invites/{param}/target-users` plus job-status route. Those are intentionally outside this worker.
- The remaining `PUT /invites/{param}/target-users` missing entry should be assigned separately with the storage/job design, not patched independently from GET success behavior.
