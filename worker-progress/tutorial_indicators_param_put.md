# tutorial_indicators_param_put

## Scope

- Assigned route: `PUT /tutorial/indicators/{param}`
- Assigned route name: `PUT_TUTORIAL_INDICATORS_INDICATOR`
- Implemented only the assigned method-scoped route.
- Intentionally untouched sibling routes:
  - `POST /tutorial/indicators/suppress`
  - `PUT /tutorial/indicators/suppress`

## Evidence

- `packages/missing-routes/missing.json` initially contained exactly one assigned missing entry:
  - `PUT /tutorial/indicators/{param}` / `PUT_TUTORIAL_INDICATORS_INDICATOR`
- `packages/automatic-reverse-engineering/data/catalogs/routes.userdoccers.catalog.json` lists:
  - `PUT /tutorial/indicators/{indicator}` / `PUT_TUTORIAL_INDICATORS_INDICATOR` / "Confirm Tutorial Indicator"
- `packages/automatic-reverse-engineering/data/catalogs/routes.xhyrom.catalog.json` lists:
  - `PUT /tutorial/indicators/{param}` / `TUTORIAL_INDICATOR`
- Userdoccers source checked:
  - `https://raw.githubusercontent.com/discord-userdoccers/discord-userdoccers/master/pages/resources/user.mdx`
  - Relevant text says "Confirm Tutorial Indicator" confirms a tutorial indicator and returns a `204` empty response on success.
- Existing local implementation evidence:
  - `src/api/routes/tutorial.ts` already returned `204` from `GET /tutorial` because Spacebar does not persist tutorial progress yet.

## Changes

- `src/api/routes/tutorial.ts`
  - Added `confirmTutorialIndicator(userId, indicator)` helper.
  - Added `router.put("/indicators/:indicator", ...)` with summary `Confirm Tutorial Indicator`.
  - Route returns documented `204` and does not fabricate persisted tutorial state.
- `test/routes/tutorial.test.ts`
  - Added focused `PUT /tutorial/indicators/:indicator` behavior coverage.
  - Added source/catalog/OpenAPI/manifest/missing-route assertions for the assigned route.
- Regenerated artifacts:
  - `assets/openapi.json`
  - `assets/testing-manifest.json`
  - `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`
  - `packages/missing-routes/missing.json`
  - `test/generated/http-contracts.json`

## Missing-Route Movement

- Before regeneration: `missing: 513`, `spacebar: 667`, `discord: 1128`
- After regeneration: `missing: 512`, `spacebar: 668`, `discord: 1128`
- Assigned entry removed:
  - `PUT /tutorial/indicators/{param}` / `PUT_TUTORIAL_INDICATORS_INDICATOR`
- Sibling suppress entries remain missing as intended:
  - `POST /tutorial/indicators/suppress`
  - `PUT /tutorial/indicators/suppress`

## Commands Run

- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run build:src:tsgo`
  - First attempt failed because `node_modules` was absent and `tsgo` was not installed.
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm ci`
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run build:src:tsgo`
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run generate:schema`
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run generate:openapi`
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run generate:testing-manifest`
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run build --workspace @spacebar/automatic-reverse-engineering`
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" node packages/automatic-reverse-engineering/dist/cli.js import-source-routes --root src/api/routes --out packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run build --workspace @spacebar/missing-routes`
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run start --workspace @spacebar/missing-routes`
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run build:test-fixtures`
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" node -r dotenv/config -r module-alias/register --enable-source-maps --test dist-test/test/routes/tutorial.test.js`
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npx eslint src/api/routes/tutorial.ts test/routes/tutorial.test.ts`
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run test:manifest`
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run test:contracts`
  - First run failed before runtime because `test/generated/http-contracts.json` was stale.
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run generate:contract-tests`
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run test:contracts`
  - Runtime reached the known unrelated failure: `api:http:GET:/discovery/search` returned `500 !== 200`.
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run test:suite-coverage`
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run test:public-assets`
- `git diff --check`
- Package/lockfile guard:
  - `git status --short package.json package-lock.json packages/automatic-reverse-engineering/package.json packages/missing-routes/package.json`
  - No package or lockfile changes.

## Verification Results

- Passed:
  - `npm ci`
  - `npm run build:src:tsgo`
  - `npm run generate:schema`
  - `npm run generate:openapi`
  - `npm run generate:testing-manifest`
  - `npm run build --workspace @spacebar/automatic-reverse-engineering`
  - `node packages/automatic-reverse-engineering/dist/cli.js import-source-routes --root src/api/routes --out packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`
  - `npm run build --workspace @spacebar/missing-routes`
  - `npm run start --workspace @spacebar/missing-routes`
  - `npm run build:test-fixtures`
  - Focused tutorial route test: `dist-test/test/routes/tutorial.test.js`
  - Targeted ESLint for touched source/test
  - `npm run test:manifest`
  - `npm run generate:contract-tests`
  - `npm run test:suite-coverage`
  - `npm run test:public-assets`
  - `git diff --check`
- Known unrelated:
  - `npm run test:contracts` fails only in runtime on `api:http:GET:/discovery/search` with `500 !== 200`, matching the brief's known unrelated failure.

## Risks / Blockers

- Spacebar still has no durable per-user tutorial progress persistence. The route acknowledges the client action with Discord's documented `204` while keeping `GET /tutorial` locally truthful by continuing to return no tutorial state.
- No gateway or audit-log side effect is documented for this endpoint in the consulted Userdoccers source.

## Reconciliation Notes

- `assets/testing-manifest.json` and `test/generated/http-contracts.json` also update a pre-existing stale line number for `src/api/routes/applications/#application_id/activities/#instance_location_id/instances/#instance_instance_id/leave.ts` from `233` to the actual `228`.
- No package files or lockfiles changed.

## Recommended Next Tasks

- Implement tutorial persistence before making `GET /tutorial` return confirmed indicator state.
- Leave suppress routes for their assigned workers:
  - `POST /tutorial/indicators/suppress`
  - `PUT /tutorial/indicators/suppress`
