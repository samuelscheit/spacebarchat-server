# content_inventory_users_me_applications_param_patch

## Scope

- Assigned route: `PATCH /content-inventory/users/@me/applications/{param}`
- Assigned route name: `MY_CONTENT_INVENTORY_APPLICATION`
- Missing methods found for assigned path: `PATCH`
- Methods implemented for assigned path: `PATCH`
- Implemented source route: `PATCH /content-inventory/users/@me/applications/{application_id}`
- Sibling methods and adjacent content-inventory routes intentionally left untouched.

## Evidence

- `packages/missing-routes/missing.json` listed the assigned xHyroM route with `route_name: "MY_CONTENT_INVENTORY_APPLICATION"` and source route `/content-inventory/users/@me/applications/{application_id}`.
- xHyroM client route data contains `PATCH /content-inventory/users/@me/applications/{application_id}`.
- Discord web client asset evidence showed `Bo.patch({ url: Rsh.MY_CONTENT_INVENTORY_APPLICATION(e), body: { is_sharing: t }, rejectWithError: false })` for running-game detection/delete entry flows.
- Userdoccers did not provide a matching route source for this assigned route in the local missing-route data; implementation evidence came from xHyroM `data/client/routes.json` and Discord web client behavior.
- No local durable provider exists for per-user per-application content-inventory sharing state.

## Changes

- Added `src/api/routes/content-inventory/users/@me/applications/#application_id.ts`.
  - Authenticated PATCH route using `ContentInventoryApplicationUpdateSchema`.
  - Validates `application_id` as a snowflake-like numeric string.
  - Fails closed with `501 APIErrorResponse` after validation because Spacebar does not persist this content-inventory sharing state.
- Added `src/schemas/uncategorised/ContentInventoryApplicationUpdateSchema.ts` with `is_sharing: boolean`.
- Exported the schema from `src/schemas/uncategorised/index.ts`.
- Added focused route tests in `test/routes/contentInventoryApplicationRoute.test.ts`.
- Updated `test/routes/contentInventorySimilarGamesRoute.test.ts` so its missing-route assertion reflects the assigned PATCH route now being implemented.
- Regenerated:
  - `assets/schemas.json`
  - `assets/openapi.json`
  - `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`
  - `packages/missing-routes/missing.json`
  - `assets/testing-manifest.json`
  - `test/generated/http-contracts.json`

## Missing-Route Movement

- Missing routes: `533 -> 532`
- Spacebar implemented routes: `647 -> 648`
- The assigned `PATCH /content-inventory/users/@me/applications/{param}` entry is removed from `missing_entries`.
- Remaining sibling/adjacent missing routes were preserved, including:
  - `GET /content-inventory/users/@me?refresh_token={param}`
  - `POST /content-inventory/users/@me/spotify`
  - `DELETE /content-inventory/users/@me/outbox/entries/id/{param}/history`

## Reconciliation Notes

- Replayed into main at `696b166a8` after the scheduled-message PATCH merge. Regeneration on the current base moved missing routes `529 -> 528` and Spacebar implemented routes `651 -> 652`; OpenAPI now has `536` paths and `1190` schemas, the testing manifest has `757` entries, and generated HTTP contracts have `732` contracts.
- Source catalog now contains only the implemented method-scoped route for this assignment: `PATCH /content-inventory/users/@me/applications/{application_id}` from `src/api/routes/content-inventory/users/@me/applications/#application_id.ts`.
- Missing-route reconciliation removed `MY_CONTENT_INVENTORY_APPLICATION` from the missing report and did not claim adjacent content-inventory routes.
- The OpenAPI and testing manifest entries declare bearer auth, `ContentInventoryApplicationUpdateSchema`, and only `APIErrorResponse` outcomes because valid requests fail closed with `501`.

## Verification

- `npm ci` passed.
- `npm run build:src:tsgo` passed.
- `npm run generate:schema && npm run generate:openapi` passed.
- `npm run build --workspace @spacebar/automatic-reverse-engineering` passed.
- `node packages/automatic-reverse-engineering/dist/cli.js import-source-routes --root src/api/routes --out packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json` passed.
- `npm run build --workspace @spacebar/missing-routes` passed.
- `npm run start --workspace @spacebar/missing-routes` passed and reported `Spacebar is missing 532`, `implements 648`, `Discord implements 1128`.
- `npm run generate:testing-manifest && npm run generate:contract-tests && npm run generate:suite-coverage` passed.
- `npm run build:test-fixtures` passed.
- Focused route tests passed:
  - `node -r dotenv/config -r module-alias/register --enable-source-maps --test dist-test/test/routes/contentInventoryApplicationRoute.test.js dist-test/test/routes/contentInventorySimilarGamesRoute.test.js`
- `npm run test:manifest` passed.
- `npm run test:suite-coverage` passed.
- Targeted ESLint passed for touched source/test files.
- `git diff --check` passed.
- Package/lockfile guard passed: no `package.json` or `package-lock.json` changes.

## Known Failure

- `npm run test:contracts` failed only in the documented unrelated runtime contract:
  - `api:http:GET:/discovery/search should return a successful response for schema validation`
  - Actual `500`, expected `200`
- Generated contract checks before the runtime phase passed.

## Risks / Blockers

- The endpoint returns `501` for valid requests because there is no durable local per-user application sharing provider/state. This is intentional fail-closed behavior to avoid fabricating state or mutating unrelated presence settings.

## Recommended Next Tasks

- Add a durable content-inventory sharing provider before changing this route from `501` to a mutating success response.
- Keep `GET /content-inventory/users/@me?refresh_token={param}`, `POST /content-inventory/users/@me/spotify`, and outbox-history routes assigned separately.
