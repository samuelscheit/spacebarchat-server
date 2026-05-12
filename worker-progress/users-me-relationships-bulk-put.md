# PUT /users/@me/relationships/bulk

## Summary

Implemented only the assigned `PUT /users/@me/relationships/bulk` route for route name `USER_BULK_RELATIONSHIPS`.

The route is bearer-authenticated and intentionally fails closed with a typed `501 APIErrorResponse`. The only source evidence for the `PUT` method is the xHyroM client route catalog, while Userdoccers documents only `POST /users/@me/relationships/bulk` as contact-sync bulk add. Spacebar has no local request semantics for bulk replacement/update and no contact-sync bulk-add token persistence, so the handler does not create, delete, rewrite, or emit relationship events for ambiguous bulk state.

## Changed Files

- `src/api/routes/users/@me/relationships.ts`
- `test/routes/usersMeRelationshipsBulkPutRoute.test.ts`
- `assets/openapi.json`
- `assets/testing-manifest.json`
- `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`
- `packages/missing-routes/missing.json`
- `test/generated/http-contracts.json`
- `test/generated/suite-coverage.json`
- `worker-progress/users-me-relationships-bulk-put.md`

## Missing-Route Movement

- Before regeneration from `HEAD`: `missing: 534`, `spacebar: 646`, `discord: 1128`.
- After regeneration: `missing: 533`, `spacebar: 647`, `discord: 1128`.
- Removed only `PUT /users/@me/relationships/bulk` from `packages/missing-routes/missing.json`.
- Remaining same-path missing methods intentionally untouched: `DELETE`, `PATCH`, and `POST`.
- Source catalog now includes `PUT /users/@me/relationships/bulk` with `APIErrorResponse` and generated route name `PUT_USERS__ME_RELATIONSHIPS_BULK`.

## Evidence Sources

- `packages/missing-routes/missing.json`: assigned path initially had `DELETE`, `PATCH`, `POST`, and `PUT`; this worker owned only `PUT`.
- `packages/automatic-reverse-engineering/data/catalogs/routes.xhyrom.catalog.json`: lists `PUT /users/@me/relationships/bulk` as `USER_BULK_RELATIONSHIPS`, without request or response shape.
- `packages/automatic-reverse-engineering/data/catalogs/routes.userdoccers.catalog.json`: documents only `POST /users/@me/relationships/bulk` for this path.
- Userdoccers raw source: `https://raw.githubusercontent.com/discord-userdoccers/discord-userdoccers/master/pages/resources/relationships.mdx` documents bulk add as contact-sync `POST` with `user_ids` and `token`, but no `PUT` semantics.
- Local relationship evidence: `src/api/routes/users/@me/relationships.ts` and `src/api/util/utility/Relationships.ts` implement single-user add/block/accept/remove semantics and reciprocal gateway events; no local bulk replacement model exists.

## Behavior

- Authenticated `PUT /users/@me/relationships/bulk` returns:
  - status `501`
  - body `{ "code": 0, "message": "Bulk relationship replacement is not supported on this Spacebar instance." }`
- Unauthenticated requests still fail through bearer authentication with `401`.
- No request body schema was added because `PUT` payload shape is not source-backed.
- The `/bulk` route is registered before `/:user_id` so it cannot fall through to single-user relationship mutation semantics.

## Commands Run

- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run build:src:tsgo` failed initially because `tsgo` was not installed in this worktree.
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm ci` passed.
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run build:src:tsgo` passed.
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run build --workspace @spacebar/automatic-reverse-engineering` passed.
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" node packages/automatic-reverse-engineering/dist/cli.js import-source-routes --root src/api/routes --out packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json` passed.
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run build --workspace @spacebar/missing-routes` passed.
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run start --workspace @spacebar/missing-routes` passed and wrote `missing: 533`, `spacebar: 647`, `discord: 1128`.
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run generate:openapi` passed; pre-existing webhook route-metadata warnings remained.
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run generate:testing-manifest` passed with 752 entries.
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run generate:contract-tests` passed with 727 contracts.
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run generate:suite-coverage` passed with 15 suites.
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run build:test-fixtures` passed.
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" node -r dotenv/config -r module-alias/register --enable-source-maps --test dist-test/test/routes/usersMeRelationshipsBulkPutRoute.test.js` passed: 5 tests.
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run test:manifest` passed.
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run test:suite-coverage` passed.
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npx eslint src/api/routes/users/@me/relationships.ts test/routes/usersMeRelationshipsBulkPutRoute.test.ts` passed.
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run test:contracts` failed only on the known unrelated runtime contract: `api:http:GET:/discovery/search` returned `500 !== 200`. Generated contract checks passed before runtime.
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" node -r dotenv/config -r module-alias/register --enable-source-maps --test dist-test/test/scenarios/users-relationships.test.js` skipped because the Postgres admin fixture was unavailable.
- `git diff --check` passed.
- `git diff -- package.json package-lock.json` showed no package or lockfile changes.

## Risks And Blockers

- Successful `PUT` semantics are not source-backed. Implementing a mutation would risk corrupting current-user relationships, reciprocal request state, block semantics, or gateway event consistency.
- `POST /users/@me/relationships/bulk` remains missing and should be implemented separately only with a real contact-sync token model or another source-backed local equivalent.

## Reconciliation Notes

- This branch does not implement sibling `DELETE`, `PATCH`, or `POST` methods on `/users/@me/relationships/bulk`.
- It does not implement `/users/@me/relationships/{user_id}/ignore`, game relationships, single-user relationship changes, contact sync, or friend suggestions.
- No schema type was added; only route/OpenAPI/catalog/testing artifacts changed.

## Orchestrator Replay Notes

- Replayed onto current main after `dc75288be`.
- Current-base regeneration moved missing routes from `533` to `532`, implemented routes from `647` to `648`, with `1128` Discord routes.
- Current-base generated artifacts now contain `753` testing manifest entries and `728` generated HTTP contracts.
- Current-base focused route test, manifest tests, generated contract matrix, suite coverage tests, targeted ESLint, `git diff --check`, and package/lockfile guard passed.
- Full `npm run test:contracts` still fails only on the known unrelated runtime contract `api:http:GET:/discovery/search` returning `500 !== 200`; generated contract checks passed before runtime.
