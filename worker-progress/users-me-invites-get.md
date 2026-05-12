# GET /users/@me/invites

## Summary

Implemented `GET /users/@me/invites` in the assigned worktree only. The route is authenticated, lists durable local friend-invite rows created by the current user, filters out non-friend-invite rows and other users' rows, removes expired friend-invite rows, and returns a `UserInvitesResponse` array.

`DELETE /users/@me/invites` remains intentionally untouched and still appears in the missing-route report.

## Changed Files

- `src/api/routes/users/@me/invites.ts`
- `src/api/routes/users/@me/invites.test.ts`
- `src/api/util/utility/UserInvites.ts`
- `src/api/util/utility/UserInvites.test.ts`
- `src/schemas/responses/UserInviteResponse.ts`
- `src/util/util/UserInviteRoutes.test.ts`
- `tsconfig.test.json`
- `assets/schemas.json`
- `assets/openapi.json`
- `assets/testing-manifest.json`
- `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`
- `packages/missing-routes/missing.json`
- `test/generated/http-contracts.json`
- `test/generated/suite-coverage.json`

## Evidence Gathered

- Initial `packages/missing-routes/missing.json` listed both `GET /users/@me/invites` and `DELETE /users/@me/invites`.
- Initial source catalog only had `POST /users/@me/invites` from `src/api/routes/users/@me/invites.ts`.
- Userdoccers `resources/invite.mdx` documents "Get User Invites" as returning a list of friend invite objects with invite metadata for the current user: https://raw.githubusercontent.com/discord-userdoccers/discord-userdoccers/master/pages/resources/invite.mdx
- Local Userdoccers catalog contains `GET`, `POST`, and `DELETE` for `/users/@me/invites`.
- Local xHyroM catalog contains `GET`, `POST`, `DELETE`, `HEAD`, and `OPTIONS` for `/users/@me/invites` with route name `FRIEND_INVITES`.
- Existing local invite code already models friend invites as `Invite` rows with no `guild_id` or `channel_id`, an `inviter_id`, `type: 2` response serialization, and existing create/accept/revoke helpers.

## Behavior

- Added `listUserInvites(user_id)` to return active current-user friend invites using `toUserInviteResponse`.
- Expired current-user friend invites are deleted via `Invite.delete({ code })` and omitted from the response.
- Non-user invite rows, rows with guild/channel IDs, rows without an inviter, and rows not owned by the current user are omitted.
- `GET /users/@me/invites` declares `200 UserInvitesResponse` and `401 APIErrorResponse`.
- Existing `POST /users/@me/invites` behavior and metadata are preserved.

## Missing-Route Movement

- Before regeneration on this worker base: `missing: 582`, `spacebar: 598`, `discord: 1128`.
- After regeneration: `missing: 581`, `spacebar: 599`, `discord: 1128`.
- `GET /users/@me/invites` was removed from `missing_entries`.
- `DELETE /users/@me/invites` remains in `missing_entries` as `DELETE_USERS__ME_INVITES`.

## Commands Run

- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm ci`
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run build:src:tsgo`
  - First attempt before dependency install failed with `tsgo: command not found`; subsequent/final runs passed after `npm ci`.
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run generate:schema`
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run generate:openapi`
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run build --workspace @spacebar/automatic-reverse-engineering`
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" node packages/automatic-reverse-engineering/dist/cli.js import-source-routes --root src/api/routes --out packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run build --workspace @spacebar/missing-routes`
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run start --workspace @spacebar/missing-routes`
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run generate:testing-manifest`
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run generate:contract-tests`
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run generate:suite-coverage`
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run build:test-fixtures`
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" node -r dotenv/config -r module-alias/register --enable-source-maps --test dist-test/src/api/util/utility/UserInvites.test.js dist-test/src/api/routes/users/@me/invites.test.js dist-test/src/util/util/UserInviteRoutes.test.js`
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" node scripts/testing-manifest/verify.js`
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run generate:contract-tests -- --check`
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" node --test test/generated/http-contracts.test.js test/contracts/*.test.cjs`
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run test:suite-coverage`
- `git diff --check`
- `git diff -- package.json package-lock.json`
- `rg -n 'MERMER|MERCHANTIBILITY|MERMERCHANTIBILITY' src/api/routes/users/@me/invites.test.ts src/api/routes/users/@me/invites.ts src/api/util/utility/UserInvites.ts src/schemas/responses/UserInviteResponse.ts`

## Risks Or Blockers

- Full `npm run test:contracts` was not run; generated contract matrix checks and suite coverage checks were run instead.
- Listing uses the local `Invite` table's durable friend-invite representation. It does not fabricate Discord-only private client state.
- The query fetches by `inviter_id` and applies friend-invite ownership/type filtering in code. That keeps behavior conservative and testable; a future optimization could add DB-level null filters for `guild_id` and `channel_id`.
- `npm ci` reported existing dependency vulnerabilities; no package or lockfile changes were made.

## Adjacent Routes Intentionally Untouched

- `DELETE /users/@me/invites`
- `POST /users/@me/invites` behavior beyond dependency-injection refactor
- `/invites/{invite_code}` accept/delete routes
- invite target-user routes
- guild join-request routes
- relationship, billing, guild, and unrelated current-user routes

## Reconciliation

The worktree is still based on `35f4f386c650a9a961844893a509410359e8218e` (`Implement stage instances extra route`), matching the assigned integration base. No merge, rebase, commit, push, reset, or stash was performed. Reconciliation is only needed if the orchestrator's current integration branch has advanced after this assignment.

## Completion Audit

- Current branch: `codex/current-missing-route-users-me-invites-get-agent`
- Current base: `35f4f386c650a9a961844893a509410359e8218e`
- `packages/missing-routes/missing.json` now reports `missing: 581`, `spacebar: 599`, `discord: 1128`.
- `GET /users/@me/invites` has no remaining missing-route entry.
- `DELETE /users/@me/invites` remains the only missing entry for the assigned path.
- `assets/openapi.json` exposes only `get` and `post` for `/users/@me/invites/`; `get` is bearer-authenticated and returns `UserInvitesResponse` or `APIErrorResponse`.
- `assets/testing-manifest.json`, `test/generated/http-contracts.json`, and `test/generated/suite-coverage.json` all contain `api:http:GET:/users/@me/invites/`.
- Fresh final verification passed after this section was prepared: source build, test fixture build, focused tests, manifest verification, generated contract checks, suite coverage checks, `git diff --check`, and package/lockfile guard.

## Recommended Next Tasks

- Implement `DELETE /users/@me/invites` separately if assigned.
- Consider DB-level `IsNull()` filtering for friend-invite lists if invite volume becomes a performance concern.

## Integration Acceptance

Accepted into the main server checkout on top of `55bd3eb75` (`Implement guild role connections configurations route`).

Current-base movement:

- Before: `missing: 579`, `spacebar: 601`, `discord: 1128`.
- After: `missing: 578`, `spacebar: 602`, `discord: 1128`.
- Removed only `GET /users/@me/invites`; `DELETE /users/@me/invites` remains missing.

Current-base verification with `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH"`:

- `npm run build:src:tsgo` - passed.
- `npm run generate:schema` - passed; 1137 schemas.
- `npm run generate:openapi` - passed; 492 paths and 1137 schemas; pre-existing webhook route metadata warnings remained.
- `npm run build --workspace @spacebar/automatic-reverse-engineering` - passed.
- `node packages/automatic-reverse-engineering/dist/cli.js import-source-routes --root src/api/routes --out packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json` - passed.
- `npm run build --workspace @spacebar/missing-routes` - passed.
- `npm run start --workspace @spacebar/missing-routes` - passed; 578 missing / 602 implemented.
- `npm run generate:testing-manifest` - passed; 707 entries.
- `npm run generate:contract-tests` - passed; 682 contracts.
- `node scripts/testing-manifest/generate-suite-coverage.js` - passed; 15 suites.
- `npm run build:test-fixtures` - passed.
- `node -r dotenv/config -r module-alias/register --enable-source-maps --test dist-test/src/api/util/utility/UserInvites.test.js dist-test/src/api/routes/users/@me/invites.test.js dist-test/src/util/util/UserInviteRoutes.test.js` - passed; 18/18 focused route, utility, and metadata tests.
- `node scripts/testing-manifest/verify.js` - passed.
- `node scripts/testing-manifest/generate-contract-tests.js --check` - passed.
- `node --test test/generated/http-contracts.test.js` - passed; 9/9.
- `node scripts/testing-manifest/generate-suite-coverage.js --check` - passed.
- `node --test test/generated/suite-coverage.test.js` - passed; 4/4.
- `npm run lint` - passed.
- `git diff --check` - passed.
- Package/lockfile guard was empty.
- New-file malformed warranty-token scan was clean.
- `npm run test:contracts` - generated checks passed, then failed only on the known unrelated runtime assertion `api:http:GET:/discovery/search` returning `500 !== 200`; existing analytics `query.ts` route-registration warnings remained baseline noise.
