# users_me_scheduled_messages_param_patch

## Summary

Implemented only the assigned `PATCH /users/@me/scheduled-messages/{param}` route, route name `SCHEDULED_MESSAGE`, in the assigned worktree on base `dc75288be`.

Spacebar has no durable local scheduled-message state. The PATCH route is therefore exposed as an authenticated compatibility endpoint that validates the scheduled-message route id as a snowflake and fails closed with a typed `501` API error rather than fabricating or mutating message delivery state.

## Changed Files

- `src/api/routes/users/@me/scheduled-messages.ts`
- `src/api/routes/users/@me/scheduled-messages.test.ts`
- `assets/openapi.json`
- `assets/testing-manifest.json`
- `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`
- `packages/missing-routes/missing.json`
- `test/generated/http-contracts.json`
- `test/generated/suite-coverage.json`
- `worker-progress/users_me_scheduled_messages_param_patch.md`

## Missing-Route Movement

- Before on `HEAD`/base: `packages/missing-routes/missing.json` reported `533` missing routes.
- After regeneration: `532` missing routes.
- Initial entries for `/users/@me/scheduled-messages/{param}`:
  - `DELETE`, route name `SCHEDULED_MESSAGE`
  - `PATCH`, route name `SCHEDULED_MESSAGE`
- Final entries for `/users/@me/scheduled-messages/{param}`:
  - `DELETE`, route name `SCHEDULED_MESSAGE`
- Assigned `PATCH` is now present in source catalog as `PATCH /users/@me/scheduled-messages/{param}` from `src/api/routes/users/@me/scheduled-messages.ts`.

## Evidence Sources

- Local xHyroM target catalog: `packages/automatic-reverse-engineering/data/catalogs/routes.xhyrom.catalog.json` lists `PATCH /users/@me/scheduled-messages/{param}` as `SCHEDULED_MESSAGE`.
- Local source catalog before implementation only listed `GET /users/@me/scheduled-messages`.
- Userdoccers GitHub pages checked via repository tree and raw `pages/resources/message.mdx` / `pages/resources/user.mdx`; no scheduled-message route documentation was found.
- Existing scheduled-message GET route documents that Spacebar does not currently persist user scheduled-message state.
- Existing fail-closed unsupported mutation patterns reviewed: `src/api/routes/stage-instances/extra.ts` and `src/api/routes/applications/shelf.ts`.

## Commands Run

- `npm ci` - passed; installed missing worktree dependencies. `package.json` and `package-lock.json` remained unchanged.
- `npm run build:src:tsgo` - passed.
- `npm run generate:schema` - passed.
- `npm run generate:openapi` - passed; existing route-metadata warnings only.
- `npm run build --workspace @spacebar/automatic-reverse-engineering` - passed.
- `node packages/automatic-reverse-engineering/dist/cli.js import-source-routes --root src/api/routes --out packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json` - passed.
- `npm run build --workspace @spacebar/missing-routes` - passed.
- `npm run start --workspace @spacebar/missing-routes` - passed; wrote missing count `532`.
- `npm run generate:testing-manifest` - passed; wrote `753` entries.
- `npm run generate:contract-tests` - passed; wrote `728` contracts.
- `npm run generate:suite-coverage` - passed; wrote `15` suites.
- `npm run build:test-fixtures` - passed.
- `node -r dotenv/config -r module-alias/register --enable-source-maps --test dist-test/src/api/routes/users/@me/scheduled-messages.test.js` - passed, 5 tests.
- `npm run test:manifest` - passed.
- `npm run test:suite-coverage` - passed.
- `npm run test:contracts` - static contract checks passed; runtime phase failed only on known unrelated `api:http:GET:/discovery/search` returning `500 !== 200`.
- `npx eslint src/api/routes/users/@me/scheduled-messages.ts src/api/routes/users/@me/scheduled-messages.test.ts` - passed.
- `git diff --check` - passed.
- `git diff -- package.json package-lock.json` - empty.

## Sibling Routes Intentionally Untouched

- `DELETE /users/@me/scheduled-messages/{param}` remains missing and intentionally unimplemented.
- `POST /users/@me/scheduled-messages` remains missing and intentionally unimplemented.
- Existing `GET /users/@me/scheduled-messages` behavior remains unchanged.

## Risks / Blockers

- No durable scheduled-message persistence/provider exists in this worktree, and Userdoccers does not document the request/response body for this client route. The route therefore cannot truthfully update scheduled-message data yet.
- Runtime contract suite has the known unrelated `GET /discovery/search` failure. No scheduled-message contract failed.

## Reconciliation Notes

- Replayed into main at `0fd439f61` after the age-verification merge. Regeneration on the current base moved missing routes `530 -> 529` and Spacebar implemented routes `650 -> 651`; OpenAPI now has `535` paths, the testing manifest has `756` entries, and generated HTTP contracts have `731` contracts.
- The route is method-scoped to the assigned PATCH method.
- Generated source catalog, missing-route report, OpenAPI, testing manifest, HTTP contracts, and suite coverage were regenerated after the code change.
- Package and lockfile were not modified by dependency installation or verification.
