# users-me-linked-users-get

## Summary

Implemented `GET /users/@me/linked-users` only.

The route returns the locally truthful Family Center linked-users shape:

```json
{
    "linked_users": [],
    "users": []
}
```

Spacebar currently has response schemas and empty Family Center compatibility routes, but no durable Family Center link/requestor/teen relationship persistence. Returning empty collections avoids fabricating link state, teen/parent relationships, consent flags, activity status, or Family Center metadata.

## Assigned Path

- Route id: `users_me_linked_users_get`
- Route name: `GET_USERS__ME_LINKED_USERS`
- Method/path: `GET /users/@me/linked-users`
- Missing methods found on the same path: `DELETE`, `GET`, `PATCH`, `POST`
- Methods implemented: `GET`
- Adjacent methods intentionally untouched: `DELETE`, `PATCH`, `POST`

## Changed Files

Primary implementation:

- `src/api/routes/users/@me/linked-users.ts`
- `src/schemas/responses/FamilyCenterResponse.ts`
- `test/routes/users-me-linked-users-get.test.ts`

Generated artifacts:

- `assets/schemas.json`
- `assets/openapi.json`
- `assets/testing-manifest.json`
- `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`
- `packages/missing-routes/missing.json`
- `test/generated/http-contracts.json`
- `test/generated/suite-coverage.json`

Handoff:

- `worker-progress/users-me-linked-users-get.md`

## Evidence Gathered

- `packages/missing-routes/missing.json` initially contained `GET /users/@me/linked-users` plus `DELETE`, `PATCH`, and `POST` for the same path.
- `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json` had no source implementation for `/users/@me/linked-users` before this change.
- xHyroM catalog evidence lists `FAMILY_CENTER_LINKED_USERS` for `GET`, `DELETE`, `PATCH`, `POST`, `HEAD`, and `OPTIONS`.
- Userdoccers `resources/family-center.mdx` documents `Get Linked Users` as returning a linked-users object with `linked_users` and `users` fields.
- Existing local `FamilyCenterResponse` already modeled `FamilyCenterLinkedUser`, link status/type enums, teen audit log, and link-code response.
- Existing `GET /family-center/@me` returns an empty Family Center overview, and `GET /family-center/@me/link-code` fails closed because link-code persistence is unsupported.
- Local gateway READY captures under `packages/automatic-reverse-engineering/data/runs/.../summary.json` consistently show `linked_users: []`.
- A source search found no Spacebar Family Center link persistence model beyond response types and empty compatibility routes.

Userdoccers source used: `https://raw.githubusercontent.com/discord-userdoccers/discord-userdoccers/master/pages/resources/family-center.mdx`

## Artifact Movement

- Worker-base missing count moved from `573` to `572`.
- `GET /users/@me/linked-users` was removed from `missing_entries`.
- Remaining `/users/@me/linked-users` missing entries are `DELETE`, `PATCH`, and `POST`.
- Source catalog now includes `GET_USERS__ME_LINKED_USERS` from `src/api/routes/users/@me/linked-users.ts`.
- OpenAPI now includes `/users/@me/linked-users/` with bearer security, `200` `FamilyCenterLinkedUsersResponse`, and `401` `APIErrorResponse`.
- Testing manifest now includes `api:http:GET:/users/@me/linked-users/`.
- HTTP contract matrix and suite coverage now include the new manifest id.

## Commands Run

- `npm run build:src:tsgo` - initially failed because the assigned worktree had no `node_modules` and `tsgo` was unavailable.
- `npm ci` - passed.
- `npm run build:src:tsgo` - passed.
- `npm run generate:schema` - passed.
- `npm run build --workspace @spacebar/automatic-reverse-engineering` - passed.
- `npm run build --workspace @spacebar/missing-routes` - passed.
- `npm run generate:openapi` - passed, with pre-existing webhook route metadata warnings.
- `node packages/automatic-reverse-engineering/dist/cli.js import-source-routes --root src/api/routes --out packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json` - passed.
- `npm run start --workspace @spacebar/missing-routes` - passed, wrote missing count `572`.
- `npm run generate:testing-manifest` - passed, wrote `713` entries.
- `npm run generate:contract-tests` - passed, wrote `688` contracts after rerun against the updated manifest.
- `npm run generate:suite-coverage` - passed, wrote `15` suites after rerun against the updated manifest.
- `npm run build:test-fixtures` - passed.
- `node -r dotenv/config -r module-alias/register --enable-source-maps --test dist-test/test/routes/users-me-linked-users-get.test.js` - passed, 3 tests.
- `node scripts/testing-manifest/verify.js` - passed.
- `npm run test:suite-coverage` - passed.
- `node --test test/generated/http-contracts.test.js test/contracts/*.test.cjs` - passed.
- `npm run test:contracts` - static generated checks passed, runtime failed only on the known unrelated `api:http:GET:/discovery/search` public schema check: `500 !== 200`.
- `git diff --check` - passed.
- `git diff --exit-code -- package.json package-lock.json` - passed, no dependency manifest changes.
- `git diff --check --no-index -- /dev/null src/api/routes/users/@me/linked-users.ts` - no whitespace errors.
- `git diff --check --no-index -- /dev/null test/routes/users-me-linked-users-get.test.ts` - no whitespace errors.

## Risks / Blockers

- The endpoint is intentionally conservative because Spacebar does not persist Family Center link/request state. If Family Center persistence is later added, this route should query links visible to the authenticated user and include referenced partial users.
- `npm run test:contracts` has an unrelated runtime failure on `/discovery/search` returning `500` during generated public response-schema validation.
- Runtime contract setup also logs pre-existing analytics query route registration errors for files that do not export default routers; these did not fail the run.

## Reconciliation

- Work was done on assigned branch `codex/current-missing-route-users-me-linked-users-get-agent` in the assigned worktree.
- Reconciliation to current main/integration may be needed if the orchestrator base has moved since `5b0c4bdcd Implement current user survey route`.

## Integration Acceptance

- Integrated onto main checkout base `7ec1bd2a4 Implement user activity secret route`.
- Current-main missing-route movement: `571 -> 570`.
- Current-main Spacebar/implemented route movement: `609 -> 610`.
- Discord route count remained `1128`.
- Regenerated current-main artifacts: `1146` schemas, `500` OpenAPI paths, `715` testing-manifest entries, `690` HTTP contracts, and `15` suite groups.
- Focused source route test passed: 3 tests.
- Focused built route test passed: 3 tests.
- Generated checks passed:
  - `node scripts/testing-manifest/verify.js`
  - `node scripts/testing-manifest/generate-contract-tests.js --check`
  - `node --test test/generated/http-contracts.test.js test/contracts/*.test.cjs`
  - `node scripts/testing-manifest/generate-suite-coverage.js --check`
  - `node --test test/generated/suite-coverage.test.js`
- `npm run lint` passed.
- `git diff --check` passed.
- Package guard passed for `package.json`, `package-lock.json`, `packages/automatic-reverse-engineering/package.json`, and `packages/missing-routes/package.json`.
- `npm run test:contracts` completed static generated checks and failed only on the known unrelated runtime contract `api:http:GET:/discovery/search` returning `500 !== 200`; pre-existing analytics query route-registration warnings were also present.
