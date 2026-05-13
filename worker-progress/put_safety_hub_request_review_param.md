# PUT /safety-hub/request-review/{param}

## Summary

Implemented the assigned `PUT /safety-hub/request-review/{classification_id}` route only. The route is authenticated, validates the documented request body without scalar coercion, advertises the documented `appeal_id` success response shape, and fails closed with `501` for valid local submissions because Spacebar does not currently persist Safety Hub classifications or appeal records.

## Assigned Route

- Assigned path: `/safety-hub/request-review/{param}`
- Assigned method: `PUT`
- Assigned route name: `PUT_SAFETY_HUB_REQUEST_REVIEW_CLASSIFICATION_ID`
- Implemented source route: `/safety-hub/request-review/{classification_id}`
- Sibling routes intentionally untouched: `OPTIONS /safety-hub/request-review/{param}`, `PUT /safety-hub/suspended/request-review/{param}`, suspended Safety Hub verification routes, and existing Safety Hub `GET` routes.

## Evidence Gathered

- `packages/missing-routes/missing.json` had the assigned missing entry for `PUT /safety-hub/request-review/{param}` with source route `/safety-hub/request-review/{classification_id}`.
- `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json` did not contain the route before implementation and now contains `PUT /safety-hub/request-review/{classification_id}` with route name `PUT_SAFETY_HUB_REQUEST_REVIEW_CLASSIFICATION_ID`.
- Userdoccers catalog and docs identify request fields `signal` and `user_input` with response body `appeal_id`: https://docs.discord.food/resources/safety-hub
- `packages/automatic-reverse-engineering/data/catalogs/routes.xhyrom.catalog.json` confirms xHyroM has `PUT /safety-hub/request-review/{param}`.
- Existing `src/api/routes/safety-hub/@me/index.ts` and `src/api/routes/safety-hub/suspended/@me.ts` return empty local classification arrays, and no local Safety Hub classification or appeal persistence entity exists.

## Changed Files

- `src/api/routes/safety-hub/request-review/#classification_id.ts`
- `src/api/routes/safety-hub/request-review/#classification_id.test.ts`
- `src/schemas/uncategorised/SafetyHubRequestReviewSchema.ts`
- `src/schemas/responses/SafetyHubRequestReviewResponse.ts`
- `src/schemas/uncategorised/index.ts`
- `src/schemas/responses/index.ts`
- `tsconfig.test.json`
- `assets/schemas.json`
- `assets/openapi.json`
- `assets/testing-manifest.json`
- `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`
- `packages/missing-routes/missing.json`
- `test/generated/http-contracts.json`

## Behavior

- Validates `signal` as one of the documented appeal ingestion signals `0..3`.
- Validates `user_input` as a string with max length `1000`.
- Rejects malformed `classification_id` path params with a route-local `404` API error.
- Rejects otherwise valid local review submissions with a route-local `501` API error instead of fabricating an unpersisted `appeal_id`.

## Missing-Route Movement

- Worker branch movement before integration: `missing_entries = 489 -> 488`, `routes = 399 -> 398`.
- Current-base integration movement: `missing_entries = 486 -> 485`, `routes = 396 -> 395`, `spacebar = 694 -> 695`, `discord = 1128`.
- Current generated artifacts: OpenAPI `562` paths / `1222` schemas, testing manifest `800` entries, generated HTTP contracts `775`.
- Removed only `PUT_SAFETY_HUB_REQUEST_REVIEW_CLASSIFICATION_ID` for `/safety-hub/request-review/{param}`.

## Commands Run

- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run build:src:tsgo` failed before dependencies were installed because `node_modules/.bin/tsgo` was absent in the assigned worktree.
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
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run build:test-fixtures`
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" node -r dotenv/config -r module-alias/register --enable-source-maps --test 'dist-test/src/api/routes/safety-hub/request-review/#classification_id.test.js'`
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run test:manifest`
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run test:suite-coverage`
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" node scripts/testing-manifest/generate-contract-tests.js --check`
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" node scripts/testing-manifest/generate-suite-coverage.js --check`
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run test:contracts`
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npx eslint 'src/api/routes/safety-hub/request-review/#classification_id.ts' 'src/api/routes/safety-hub/request-review/#classification_id.test.ts' src/schemas/uncategorised/SafetyHubRequestReviewSchema.ts src/schemas/responses/SafetyHubRequestReviewResponse.ts src/schemas/uncategorised/index.ts src/schemas/responses/index.ts`
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npx prettier --check 'src/api/routes/safety-hub/request-review/#classification_id.ts' 'src/api/routes/safety-hub/request-review/#classification_id.test.ts' src/schemas/uncategorised/SafetyHubRequestReviewSchema.ts src/schemas/responses/SafetyHubRequestReviewResponse.ts src/schemas/uncategorised/index.ts src/schemas/responses/index.ts tsconfig.test.json worker-progress/put_safety_hub_request_review_param.md`
- `git diff --check`
- `git diff --exit-code -- package.json package-lock.json npm-shrinkwrap.json 'packages/*/package.json' 'packages/*/package-lock.json'`

## Verification Results

- Initial `npm run build:src:tsgo` failed because the assigned worktree had no installed dependencies. After `npm ci`, the required build command passed.
- Focused Safety Hub route test: passed, 5 tests.
- `npm run build:src:tsgo`: passed.
- `npm run build:test-fixtures`: passed after adding the test to `tsconfig.test.json`.
- `npm run test:manifest`: passed, 800 entries verified.
- `npm run test:suite-coverage`: passed.
- Generated contract check and suite coverage check: passed.
- Targeted ESLint: passed with the expected `tsconfig.test.json` ignore warning during current-base replay.
- Prettier check: passed after formatting the four replayed Safety Hub files.
- `git diff --check`: passed.
- Package/lockfile guard: no diff in `package.json` or `package-lock.json`.
- `npm run test:contracts`: static contract checks passed and runtime checks failed only on known unrelated `api:http:GET:/discovery/search` response schema assertion, `500 !== 200`.

## Risks And Blockers

- The route cannot produce a durable `appeal_id` until Safety Hub classification and appeal persistence/provider support exists. It fails closed with `501` to avoid accepting unsupported moderation appeal state.
- The generated contract sample path uses `value` for `classification_id`; this is acceptable for generated auth/body-boundary checks because body validation and auth middleware run before route-local classification handling.

## Recommended Next Tasks

- Implement a durable Safety Hub classification and appeal data model/provider before enabling `200 { appeal_id }` behavior.
- Scope the suspended-user appeal route separately because it requires token-body authentication semantics and should not share this authenticated-user route implementation without explicit design.

## Reconciliation Notes

- No package or lockfile changes were introduced by `npm ci`; the package/lockfile guard is empty.
- During current-base integration, schema index exports were patched manually instead of overwriting newer accepted exports such as `PartnerSdkApplicationSkuCreateSchema`.
- The route was regenerated into the source catalog as `/safety-hub/request-review/{classification_id}`, which reconciles the Userdoccers parameter name with the missing-route/xHyroM `{param}` placeholder.
- The assigned route no longer appears in `packages/missing-routes/missing.json`, while sibling Safety Hub routes remain in the missing-route backlog.
