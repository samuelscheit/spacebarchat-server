# branches_post Progress

## Summary

Implemented the assigned `POST /branches` route (`APPLICATION_BRANCHES`) as an authenticated compatibility endpoint for looking up branch live build metadata by branch IDs.

The external behavior evidence shows this endpoint accepts `{ "branch_ids": [...] }` and returns branch records whose `live_build_id` values are used by clients. Spacebar does not currently persist application branches or live build metadata, so the default implementation validates the request and returns an empty list rather than fabricating branch/build IDs. A narrow repository injection boundary is present for future durable branch persistence and filters repository output to requested branch IDs.

## Assigned Route

- Assigned route: `POST /branches`
- Assigned route name: `APPLICATION_BRANCHES`
- Missing methods found for assigned route: `POST`
- Methods implemented: `POST`
- Sibling routes intentionally untouched:
    - `OPTIONS /branches`
    - `POST /applications/{application_id}/branches`
    - application branch build routes such as build size/live build siblings

## Changed Files

- `src/api/routes/branches.ts`
- `src/api/routes/branches.test.ts`
- `src/schemas/uncategorised/ApplicationBranchesSchema.ts`
- `src/schemas/uncategorised/index.ts`
- `tsconfig.test.json`
- `assets/schemas.json`
- `assets/openapi.json`
- `assets/testing-manifest.json`
- `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`
- `packages/missing-routes/missing.json`
- `test/generated/http-contracts.json`
- `worker-progress/branches_post.md`

## Behavior

- Adds strict `ApplicationBranchesSchema` request validation:
    - required `branch_ids`
    - 1 to 100 items
    - each item must be a 1 to 20 digit string
- Adds `ApplicationBranchesResponse` response metadata and OpenAPI request/response documentation.
- Keeps auth required by leaving `/branches` out of `NoAuthorizationRoutes`.
- Returns `[]` by default because local branch/live-build persistence does not exist.
- Passes `userId` and unique requested branch IDs to an optional repository boundary if durable support is later added.
- Filters injected repository results to requested IDs and deduplicates returned branch IDs.

## Missing-Route Movement

- Base `b764b04ca`: `missing=519`, `spacebar=661`, `discord=1128`.
- Before reconciliation on main: `missing=516`, `spacebar=664`, `discord=1128`.
- After main regeneration: `missing=515`, `spacebar=665`, `discord=1128`.

## Evidence Sources

- Local missing-route data:
    - `packages/missing-routes/missing.json` initially contained `POST /branches` with route name `APPLICATION_BRANCHES`.
- Local xHyroM catalog:
    - `packages/automatic-reverse-engineering/data/catalogs/routes.xhyrom.catalog.json` contains `POST /branches` and `OPTIONS /branches`, both route name `APPLICATION_BRANCHES`.
- Local Userdoccers catalog:
    - `packages/automatic-reverse-engineering/data/catalogs/routes.userdoccers.catalog.json` has no `/branches` entry.
- Local source catalog:
    - `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json` had no `/branches` source route before implementation and now has `POST /branches`.
- External library evidence:
    - `https://raw.githubusercontent.com/dolfies/discord.py-self/master/discord/http.py`
        - `get_build_ids` sends `POST /branches` with payload `{ "branch_ids": branch_ids }`.
    - `https://raw.githubusercontent.com/dolfies/discord.py-self/master/discord/client.py`
        - `fetch_live_build_ids` returns a mapping from returned branch IDs to `live_build_id`.
    - `https://raw.githubusercontent.com/dolfies/discord.py-self/master/discord/types/application.py`
        - `Branch` has `id`, optional `live_build_id`, optional `created_at`, optional `name`.

## Verification

- `npm run build:src:tsgo` - passed.
- `npm run generate:schema` - passed; generated 1198 schemas.
- `npm run generate:openapi` - passed with existing warnings about webhook routes missing route metadata; generated 549 paths and 1198 schemas.
- `npm run build --workspace @spacebar/automatic-reverse-engineering` - passed.
- `node packages/automatic-reverse-engineering/dist/cli.js import-source-routes --root src/api/routes --out packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json` - passed.
- `npm run build --workspace @spacebar/missing-routes` - passed.
- `npm run start --workspace @spacebar/missing-routes` - passed; final output was `Spacebar is missing 515`, `Spacebar implements 665`, `Discord implements 1128`.
- `npm run generate:testing-manifest` - passed; generated 770 entries.
- `npm run generate:contract-tests` - passed; generated 745 contracts.
- `npm run generate:suite-coverage` - passed; generated 15 suites.
- `npm run build:test-fixtures` - passed.
- `node -r dotenv/config -r module-alias/register --enable-source-maps --test dist-test/src/api/routes/branches.test.js` - passed, 3 tests.
- `node scripts/testing-manifest/verify.js` - passed.
- `node scripts/testing-manifest/generate-contract-tests.js --check` - passed.
- `node --test test/generated/http-contracts.test.js test/contracts/*.test.cjs` - passed, 10 tests.
- `node scripts/testing-manifest/generate-suite-coverage.js --check` - passed.
- `npm run test:manifest` - passed.
- `npm run test:suite-coverage` - passed.
- `npx eslint src/api/routes/branches.ts src/api/routes/branches.test.ts src/schemas/uncategorised/ApplicationBranchesSchema.ts src/schemas/uncategorised/index.ts` - passed.
- `npm run test:contracts` - failed only on the known unrelated runtime failure: `api:http:GET:/discovery/search should return a successful response for schema validation`, `500 !== 200`. Generated/static contract checks and runtime build steps completed before that unrelated failure.
- `git diff --check` - passed.
- Package/lockfile guard passed: `git diff -- package.json package-lock.json` and `git status --short -- package.json package-lock.json` produced no output.

## Risks Or Blockers

- Spacebar still lacks durable branch/live-build persistence. The route therefore returns no branch records by default.
- Future branch persistence should enforce visibility/ownership for branch IDs before returning live build IDs. The current repository boundary passes the authenticated `userId` to support that check.

## Reconciliation Notes

- Work was isolated to `/Users/user/Developer/Developer/spacebarchat/worktrees/current-branches-post-agent`.
- No sibling methods or adjacent routes were implemented.
- The route was implemented as locally truthful compatibility behavior, not fabricated branch/build metadata.
