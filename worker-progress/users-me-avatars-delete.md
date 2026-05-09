# users-me-avatars-delete

## Summary

Implemented production support for `DELETE /users/@me/avatars/{avatar_id}`. The route deletes one recent-avatar row scoped to the authenticated user and removes the backing `/avatars/{user_id}/{storage_hash}` blob only when that blob is not still referenced by another recent-avatar row for the same user or by the user's current avatar.

## Changed Files

- `src/api/routes/users/@me/avatars.ts`
  - Added `DELETE /:avatar_id` with the existing `route()` wrapper and `204`/`404` response metadata.
- `src/api/util/utility/RecentAvatars.ts`
  - Added `deleteUserRecentAvatar(userId, avatarId)`.
  - Shared the CDN blob deletion helper between pruning and explicit deletion.
  - Added reference checks before deleting avatar blobs.
- `src/api/util/utility/RecentAvatars.test.ts`
  - Added focused route and utility coverage for delete success, unknown avatar ids, user scoping, blob cleanup, shared hash protection, current-avatar protection, and CDN delete failure tolerance.
- `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`
  - Regenerated from `src/api/routes`.
- `packages/missing-routes/missing.json`
  - Regenerated after source catalog update.
- `worker-progress/users-me-avatars-delete.md`
  - This handoff report.

## Commands Run

- `sed -n '1,240p' /Users/user/Developer/Developer/spacebarchat/WORKER_BRIEF.md` - read worker brief.
- `git status --short` - checked initial state; no tracked changes.
- Missing-route and source checks with `rg` and `node` - confirmed assigned entry and absence from source catalog/routes.
- `npx prettier --write src/api/routes/users/@me/avatars.ts src/api/util/utility/RecentAvatars.ts src/api/util/utility/RecentAvatars.test.ts` - formatting check; unchanged.
- `npm run build:src:tsgo` - initially failed because this worktree had no `node_modules` and `tsgo` was not found.
- `ln -s /Users/user/Developer/Developer/spacebarchat/server/node_modules node_modules` and `npm run build:src:tsgo` - exposed a symlink-only TypeScript portability error in unrelated `ChannelMessageCreateRoute.ts`.
- `rm node_modules && npm ci --ignore-scripts` - installed local dependencies for reliable worktree verification.
- `npm run build:src:tsgo` - passed after local install and route type fix.
- `npm run build:test-fixtures` - passed.
- `node -r dotenv/config -r module-alias/register --enable-source-maps --test dist-test/src/api/util/utility/RecentAvatars.test.js` - passed, 20 tests.
- `npm run build --workspace @spacebar/automatic-reverse-engineering` - passed.
- `node packages/automatic-reverse-engineering/dist/cli.js import-source-routes --root src/api/routes --out packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json` - passed; source catalog regenerated.
- `npm run build --workspace @spacebar/missing-routes` - passed.
- `npm run start --workspace @spacebar/missing-routes` - passed; wrote `packages/missing-routes/missing.json`.
- `npm run build:src:tsgo` - final required source build passed.
- `git diff --check` - passed.

## Evidence Gathered

- `packages/missing-routes/missing.json` initially had exactly one assigned missing entry for `/users/@me/avatars/{param}`:
  - method: `DELETE`
  - route name: `DELETE_USERS__ME_AVATARS_AVATAR_ID`
  - source route: `/users/@me/avatars/{avatar_id}`
  - sources: `userdoccers:resources/user.mdx`, `xhyrom:data/client/routes.json`
- `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json` initially had no `/users/@me/avatars` entries.
- `src/api/routes/users/@me/avatars.ts` initially implemented only `GET /`.
- `src/api/util/utility/RecentAvatars.ts` already handled list, select, prune, and CDN cleanup behavior but lacked a direct delete primitive.
- Subagent checks independently confirmed the missing-route scope and the shared-utility root cause.

## Assigned Path And Methods

- Assigned path: `/users/@me/avatars/{param}`
- Missing methods found: `DELETE /users/@me/avatars/{avatar_id}` / `DELETE_USERS__ME_AVATARS_AVATAR_ID`
- Methods implemented: `DELETE /users/@me/avatars/{avatar_id}`

## What Changed

- Added `deleteUserRecentAvatar` as the root deletion primitive.
- The primitive:
  - reads only a recent-avatar row matching both `id` and `user_id`;
  - throws `HTTPError("Unknown avatar", 404)` if absent or concurrently deleted;
  - deletes only that user's matching row;
  - checks the current user avatar and remaining recent-avatar rows for the same `storage_hash`;
  - deletes `/avatars/{user_id}/{storage_hash}` only when unreferenced;
  - logs and continues if CDN deletion fails, matching prune behavior.
- Added `DELETE /:avatar_id` to the existing avatars route file and returned `204 No Content`.

## Missing-Route Movement

- Before regeneration from `HEAD`: `missing: 866`, `spacebar: 311`, `discord: 1128`
- After regeneration: `missing: 849`, `spacebar: 331`, `discord: 1128`
- Delta: `missing: -17`, `spacebar: +20`, `discord: 0`
- Assigned entry status after regeneration: `DELETE /users/@me/avatars/{param}` is no longer present in `missing_entries`.
- Adjacent route still missing and intentionally out of scope: `DELETE /users/@me/avatars/discordify`.

## Userdoccers And xHyroM References

- `packages/automatic-reverse-engineering/data/catalogs/routes.userdoccers.catalog.json`
  - `DELETE /users/@me/avatars/{avatar_id}`
  - `DELETE_USERS__ME_AVATARS_AVATAR_ID`
  - summary: `Delete Recent Avatar`
- `packages/automatic-reverse-engineering/data/catalogs/routes.xhyrom.catalog.json`
  - `DELETE /users/@me/avatars/{param}`
  - route name: `RECENT_AVATARS_DELETE`
- No additional request body, response body, permission, or event side-effect evidence was found or needed for this no-content authenticated user route.

## Risks Or Blockers

- No code blockers remain.
- The first build attempt failed because the worktree had no local dependencies; this was resolved with `npm ci --ignore-scripts`.
- The missing-route count moved by more than one because regenerating the full source catalog picked up other existing source routes not present in the previous catalog. No adjacent avatar route was implemented.

## Recommended Next Tasks

- Implement the separate adjacent missing route `DELETE /users/@me/avatars/discordify` in its own scoped worker assignment.
- Review the broader source-catalog diff from regeneration if the orchestrator wants to separate catalog churn from route implementation during merge.

## Goal Evidence

- `create_goal` was called before research or file reads with objective: `Implement production-ready DELETE /users/@me/avatars/{param} support in Spacebarchat, with focused tests, source-catalog regeneration, missing-route report regeneration, and a complete handoff report.`
- `get_goal` returned status `active` for the same objective after setup.
- `update_goal(status: "complete")` is intentionally deferred until after this report is written and the completion audit confirms all deliverables are present.
