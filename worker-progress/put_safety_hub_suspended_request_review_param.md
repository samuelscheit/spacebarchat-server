# put_safety_hub_suspended_request_review_param

## Summary

Implemented the assigned method-scoped route `PUT /safety-hub/suspended/request-review/{param}` as source route
`PUT /safety-hub/suspended/request-review/{classification_id}` with route name
`PUT_SAFETY_HUB_SUSPENDED_REQUEST_REVIEW_CLASSIFICATION_ID`.

The route is a suspended-user token-in-body flow, so it is public at the bearer-auth boundary. Spacebar has no durable Safety Hub classification appeal provider or suspended-user token verifier, so the default implementation validates the request and fails closed with `501` instead of fabricating appeal state. A dependency-injected provider path can return the documented `appeal_id` response when a real implementation is wired.

## Changed Files

- `src/api/routes/safety-hub/suspended/request-review/#classification_id.ts`
- `src/api/routes/safety-hub/suspended/request-review/#classification_id.test.ts`
- `src/api/middlewares/NoAuthorizationRoutes.ts`
- `src/schemas/uncategorised/SafetyHubSuspendedClassificationReviewSchema.ts`
- `src/schemas/uncategorised/index.ts`
- `src/schemas/responses/SafetyHubClassificationReviewResponse.ts`
- `src/schemas/responses/index.ts`
- `assets/schemas.json`
- `assets/openapi.json`
- `assets/testing-manifest.json`
- `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`
- `packages/missing-routes/missing.json`
- `test/generated/http-contracts.json`

## Evidence Gathered

- `packages/missing-routes/missing.json` initially contained one assigned missing entry:
  `PUT /safety-hub/suspended/request-review/{param}` with route name
  `PUT_SAFETY_HUB_SUSPENDED_REQUEST_REVIEW_CLASSIFICATION_ID`.
- `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json` initially had no matching `safety-hub/suspended/request-review` source route.
- Userdoccers local catalog:
  `packages/automatic-reverse-engineering/data/catalogs/routes.userdoccers.catalog.json` lists
  `PUT /safety-hub/suspended/request-review/{classification_id}` from `userdoccers:resources/safety-hub.mdx`.
- xHyroM local catalog:
  `packages/automatic-reverse-engineering/data/catalogs/routes.xhyrom.catalog.json` lists
  `PUT /safety-hub/suspended/request-review/{param}` as `SAFETY_HUB_REQUEST_SUSPENDED_USER_REVIEW`.
- Userdoccers source content checked at
  `https://raw.githubusercontent.com/discord-userdoccers/discord-userdoccers/master/pages/resources/safety-hub.mdx`.
  It documents the suspended-user review body fields `token`, `signal`, `user_input` with `user_input` max 1000 chars, and response body `appeal_id`.

## Route Movement

- Before regeneration: `missing = 487`, `spacebar = 693`, `discord = 1128`.
- After regeneration: `missing = 486`, `spacebar = 694`, `discord = 1128`.
- Current-base acceptance regeneration: `missing = 483 -> 482`, `spacebar = 697 -> 698`, `discord = 1128`.
- Removed missing entry:
  `PUT /safety-hub/suspended/request-review/{param}` /
  `PUT_SAFETY_HUB_SUSPENDED_REQUEST_REVIEW_CLASSIFICATION_ID`.
- Added source catalog entry:
  `PUT /safety-hub/suspended/request-review/{classification_id}` from
  `src/api/routes/safety-hub/suspended/request-review/#classification_id.ts`.

## Behavior Implemented

- Public bearer-auth boundary for `PUT /safety-hub/suspended/request-review/:classification_id`.
- Strict request schema `SafetyHubSuspendedClassificationReviewSchema`:
  `token` string length 1..4096, `signal` enum `0..3`, `user_input` string max 1000.
- Response schema `SafetyHubClassificationReviewResponse` with `appeal_id` snowflake string.
- `classification_id` path validation before provider dispatch.
- Default provider fails closed with `501` and a local explanatory `APIErrorResponse`.
- Dependency-injected provider receives `classification_id`, `token`, `signal`, `user_input`, `ip`, and `userAgent`, and can return `{ appeal_id }`.

## Sibling Routes Intentionally Untouched

- `PUT /safety-hub/request-review/{param}`
- `POST /safety-hub/suspended/@me`
- `POST /safety-hub/suspended/check-verification`
- `POST /safety-hub/suspended/request-verification`
- Existing `GET /safety-hub/@me` and `GET /safety-hub/suspended/@me`

## Commands Run

- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm ci`
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run build:src:tsgo`
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run generate:schema`
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run generate:openapi`
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run build --workspace @spacebar/automatic-reverse-engineering`
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" node packages/automatic-reverse-engineering/dist/cli.js import-source-routes --root src/api/routes --out packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run build --workspace @spacebar/missing-routes`
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run start --workspace @spacebar/missing-routes`
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run generate:testing-manifest`
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run generate:contract-tests`
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run generate:suite-coverage`
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npx prettier --write ...touched files...`
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" TS_NODE_TRANSPILE_ONLY=1 node -r dotenv/config -r ts-node/register/transpile-only -r module-alias/register --enable-source-maps --test 'src/api/routes/safety-hub/suspended/request-review/#classification_id.test.ts'`
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run build:test-fixtures`
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run test:manifest`
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run test:suite-coverage`
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run test:contracts`
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npx eslint ...touched files...`
- `git diff --check`
- package/lockfile guard: `git diff -- package.json package-lock.json packages/automatic-reverse-engineering/package.json packages/missing-routes/package.json` and matching `git status --short ...`

## Verification Results

- Initial `npm run build:src:tsgo` could not start because this worktree had no installed `tsgo`; `npm ci` populated dependencies from the existing lockfile, and subsequent `npm run build:src:tsgo` runs passed.
- Focused route test passed: 6 tests passing.
- `npm run build:src:tsgo` passed.
- `npm run build:test-fixtures` passed.
- `npm run test:manifest` passed after regenerating manifest-dependent files.
- `npm run test:suite-coverage` passed.
- Targeted ESLint passed.
- `git diff --check` passed.
- Package/lockfile guard passed: no package or lockfile changes.
- `npm run test:contracts` failed only in the known unrelated runtime contract:
  `api:http:GET:/discovery/search` returned `500 !== 200`. The generated contract matrix check passed before runtime.

## Risks Or Blockers

- Successful appeal creation is provider-gated. The default route does not persist appeal state or generate appeal IDs because Spacebar has no local Safety Hub appeal model or suspended-user token verifier.
- Public runtime contract output also logs unrelated existing route-registration errors for analytics query modules that do not export default routers. They did not affect this route's focused test or manifest checks.

## Recommended Next Tasks

- Implement durable Safety Hub classification and appeal persistence if Spacebar wants `200 { appeal_id }` behavior by default.
- Implement the sibling suspended Safety Hub token routes as separately scoped tasks.

## Reconciliation Notes

- Worker handoff made no commits, pushes, rebases, resets, stashes, or remote changes.
- `node_modules` was installed locally with `npm ci`; package manifests and lockfiles are unchanged.
- Work remained inside the assigned worktree after reading the worker brief.
- Accepted onto the current integration branch after `4b220af01` by copying only new route/schema/test/report files and patching shared exports/authorization allowlist against the current branch.
- Current-base verification reran source build, schema/OpenAPI generation, source route import, missing-route generation, testing manifest generation, generated contracts, suite coverage generation, fixture build, focused suspended review route test, manifest/suite checks, targeted ESLint, `git diff --check`, package/lockfile guard, and full contracts.
- Full contracts failed only on the known unrelated runtime assertion: `api:http:GET:/discovery/search` returned `500 !== 200`.
