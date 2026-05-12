# users-me-linked-users-delete

## Summary

Implemented `DELETE /users/@me/linked-users` only.

The route is authenticated and deliberately fails closed with `DiscordApiErrors.FEATURE_TEMPORARILY_DISABLED` because Spacebar does not persist Discord Family Center link/requestor/teen relationship state. It does not delete user relationship rows, account data, or adjacent Family Center state.

## Assigned Path

- Worker id: `users_me_linked_users_delete`
- Assigned route name: `FAMILY_CENTER_LINKED_USERS`
- Method/path: `DELETE /users/@me/linked-users`
- Missing methods found on the same path at start: `DELETE`, `PATCH`, `POST`
- Methods implemented: `DELETE`
- Adjacent methods intentionally untouched: `POST /users/@me/linked-users`, `PATCH /users/@me/linked-users`

## Changed Files

Primary implementation:

- `src/api/routes/users/@me/linked-users.ts`
- `test/routes/users-me-linked-users-get.test.ts`

Generated artifacts:

- `assets/openapi.json`
- `assets/testing-manifest.json`
- `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`
- `packages/missing-routes/missing.json`
- `test/generated/http-contracts.json`
- `test/generated/suite-coverage.json`

Handoff:

- `worker-progress/users-me-linked-users-delete.md`

## Evidence Gathered

- `packages/missing-routes/missing.json` initially had `DELETE /users/@me/linked-users` with route name `FAMILY_CENTER_LINKED_USERS`.
- `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json` initially had `GET /users/@me/linked-users` only for this source file.
- `packages/automatic-reverse-engineering/data/catalogs/routes.xhyrom.catalog.json` lists `DELETE /users/@me/linked-users` as `FAMILY_CENTER_LINKED_USERS`.
- Userdoccers `resources/family-center.mdx` documents Family Center linked users, link statuses, link types, GET linked users, POST create request, and PATCH modify link status, including removal via status `3`; it does not document a DELETE route.
- Existing `GET /family-center/@me/link-code` already fails closed with `FEATURE_TEMPORARILY_DISABLED` because Family Center link-code persistence is unsupported.
- Local source search found no durable Family Center link persistence model beyond empty compatibility response builders and schemas.

Userdoccers source used: `https://raw.githubusercontent.com/discord-userdoccers/discord-userdoccers/master/pages/resources/family-center.mdx`

## Behavior

- `DELETE /users/@me/linked-users` stays behind bearer auth.
- Authenticated calls return the shared unsupported Family Center error:

```json
{
    "code": 40006,
    "message": "This feature has been temporarily disabled server-side"
}
```

- Route metadata documents `400` and `401` `APIErrorResponse` responses.
- No gateway event or audit side effect is emitted because no durable Family Center link mutation occurs.

## Artifact Movement

- Missing-route count moved from `541` to `540`.
- Implemented source-route count moved from `639` to `640`.
- Discord target route count remained `1128`.
- `DELETE /users/@me/linked-users` was removed from `missing_entries`.
- Remaining `/users/@me/linked-users` missing entries are `POST` and `PATCH`.
- Source catalog now includes `DELETE_USERS__ME_LINKED_USERS` from `src/api/routes/users/@me/linked-users.ts`.
- OpenAPI, testing manifest, HTTP contracts, and suite coverage now include `api:http:DELETE:/users/@me/linked-users/`.

## Commands Run

- `npm run build:src:tsgo` - initially failed because `node_modules` was missing and `tsgo` was unavailable.
- `npm ci` - passed; no package or lockfile changes.
- `npm run build:src:tsgo` - passed.
- `npm run generate:openapi` - passed with pre-existing webhook route metadata warnings.
- `npm run build --workspace @spacebar/automatic-reverse-engineering` - passed.
- `npm run build --workspace @spacebar/missing-routes` - passed.
- `node packages/automatic-reverse-engineering/dist/cli.js import-source-routes --root src/api/routes --out packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json` - passed.
- `npm run start --workspace @spacebar/missing-routes` - passed; wrote missing count `540`.
- `npm run generate:testing-manifest` - passed; wrote `745` entries.
- `npm run generate:contract-tests` - passed; final run wrote `720` contracts.
- `npm run generate:suite-coverage` - passed; wrote `15` suites.
- `npm run build:test-fixtures` - passed.
- `node -r dotenv/config -r module-alias/register --enable-source-maps --test dist-test/test/routes/users-me-linked-users-get.test.js` - passed, 4 tests.
- `npm run test:manifest` - passed.
- `npm run test:suite-coverage` - passed.
- `node scripts/testing-manifest/generate-contract-tests.js --check` - passed.
- `node --test test/generated/http-contracts.test.js test/contracts/*.test.cjs` - passed.
- `npm run test:contracts` - static checks passed; runtime failed only on known unrelated `api:http:GET:/discovery/search` schema validation, `500 !== 200`.
- `git diff --check` - passed.
- `git diff --exit-code -- package.json package-lock.json packages/automatic-reverse-engineering/package.json packages/missing-routes/package.json` - passed.

## Risks / Blockers

- Family Center links are not durably modeled locally. This route should be changed from fail-closed to real unlink semantics only after Spacebar has a dedicated Family Center link model with requestor/linked-user privacy boundaries and event semantics.
- The DELETE route is source-catalog complete, but behavior is intentionally conservative rather than Discord-complete.
- `npm run test:contracts` has the known unrelated runtime failure on `api:http:GET:/discovery/search` returning `500 !== 200`.
- Runtime contract setup still logs pre-existing analytics query route registration warnings for helper files that do not export default routers.

## Reconciliation Notes

- Work was done only in assigned worktree `/Users/user/Developer/Developer/spacebarchat/worktrees/current-users-me-linked-users-delete-agent`.
- Branch: `codex/current-missing-route-users-me-linked-users-delete-agent`.
- Base commit in assignment: `7a6f93609 Implement application subscription group listing delete`.
- No commits, pushes, merges, rebases, resets, stashes, or remote modifications were performed.
