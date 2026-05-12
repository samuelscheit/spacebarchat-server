# applications_public_patch

## Summary

Implemented the assigned `PATCH /applications/public` route as an authenticated fail-closed compatibility endpoint. The only PATCH evidence is `xhyrom:data/client/routes.json` with route name `APPLICATIONS_PUBLIC`; Userdoccers documents only the adjacent `GET /applications/public` bulk partial-application read route. Because there is no source-backed PATCH request shape, response shape, or local public-application mutation model, the route returns a 501 `APIErrorResponse` instead of mutating unrelated `Application` rows or fabricating public metadata.

## Changed Files

- `src/api/routes/applications/public.ts`
- `test/routes/applications-public-patch.test.ts`
- `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`
- `packages/missing-routes/missing.json`
- `assets/openapi.json`
- `assets/testing-manifest.json`
- `test/generated/http-contracts.json`
- `test/generated/suite-coverage.json`

## Assigned Route

- Assigned route: `PATCH /applications/public`
- Assigned route name: `APPLICATIONS_PUBLIC`
- Initial missing-route evidence: `packages/missing-routes/missing.json` listed `GET`, `PATCH`, and `PUT` for `/applications/public`; `PATCH` came only from `xhyrom:data/client/routes.json`.
- Source catalog before implementation had no `PATCH /applications/public` entry.
- Source catalog after implementation has `PATCH /applications/public` from `src/api/routes/applications/public.ts` with `APIErrorResponse`.
- Missing-route movement after regeneration: `missing` 539 -> 538; `spacebar` 641 -> 642.
- Adjacent `/applications/public` `GET` and `PUT` remain missing and untouched.

## Evidence Sources

- `packages/automatic-reverse-engineering/data/catalogs/routes.xhyrom.catalog.json`: `PATCH /applications/public`, route name `APPLICATIONS_PUBLIC`.
- `packages/automatic-reverse-engineering/data/catalogs/routes.userdoccers.catalog.json`: only `GET /applications/public`, summary `Get Partial Applications`.
- `https://docs.discord.food/resources/application`: Userdoccers documents `GET /applications/public` query `application_ids`, and does not document PATCH semantics.
- Nearby local public application read behavior: `src/api/routes/applications/#application_id/public.ts`.
- Nearby application owner mutation behavior: `src/api/routes/applications/#application_id/index.ts` and `src/api/routes/applications/@me.ts`; both mutate known application identities, unlike plural public PATCH.
- Nearby local truthful public/discovery routes: `src/api/routes/activities/shelf.ts`, `src/api/routes/applications/games-supplemental.ts`, `src/api/routes/application-directory/applications/#application_id.ts`, `src/api/routes/games/index.ts`.

## Commands Run

- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm ci` - passed; installed ignored dependencies in the assigned worktree.
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run build:src:tsgo` - initial attempt failed before `npm ci` because `tsgo` was unavailable; rerun passed.
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run build --workspace @spacebar/automatic-reverse-engineering` - passed.
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run build --workspace @spacebar/missing-routes` - passed.
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run generate:schema` - passed.
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run generate:openapi` - passed.
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" node packages/automatic-reverse-engineering/dist/cli.js import-source-routes --root src/api/routes --out packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json` - passed.
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run start --workspace @spacebar/missing-routes` - passed; wrote missing count 538.
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run generate:testing-manifest` - passed.
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run generate:contract-tests` - passed.
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run generate:suite-coverage` - passed.
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run test -- test/routes/applications-public-patch.test.ts test/routes/applications-public.test.ts` - passed.
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run test:manifest` - passed.
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run test:suite-coverage` - passed.
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run test:contracts` - failed only on known unrelated runtime contract `api:http:GET:/discovery/search` returning `500 !== 200`; static contract checks and the build steps inside the command completed.
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run build:test-fixtures` - passed standalone.
- `git diff --check` - passed.
- Package/lockfile guard: `git diff -- package.json package-lock.json packages/automatic-reverse-engineering/package.json packages/missing-routes/package.json` - empty.
- New-file malformed warranty scan against the route and test files - no matches.

## Risks And Blockers

- `PATCH /applications/public` remains semantically unsupported locally because the available evidence does not define a safe request body or mutation target. The route intentionally fails with 501 after bearer authentication.
- The generated coverage policy classifies the route under `api-applications` / `stateful-domain`; this is inherited from the path policy, not from actual DB mutation behavior.
- `npm run test:contracts` has the known unrelated `GET /discovery/search` runtime response-schema failure.

## Reconciliation Notes

- No package files or lockfiles changed.
- No adjacent routes were implemented: `GET /applications/public`, `PUT /applications/public`, `/applications/shelf`, `/applications/games-supplemental`, application-directory routes, and application owner mutation routes were left untouched.
- `node_modules`, `dist`, `dist-test`, and workspace package `dist` outputs were generated locally and are ignored.
