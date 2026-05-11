# users_me_dms_param_get

## Summary

- Accepted implementation for `GET /users/@me/dms/{user_id}`.
- Assigned missing entry confirmed: `GET_USERS__ME_DMS_USER_ID` for `/users/@me/dms/{param}`.
- Userdoccers evidence: `resources/channel.mdx` documents getting an existing DM channel for a user and notes OAuth2 `dm_channels.read` support.
- Current-base missing-route count moved from `627` to `626`; implemented routes moved from `553` to `554`; Discord route count remained `1128`.

## Changed Files

- `src/api/routes/users/@me/dms/#user_id.ts`
- `assets/openapi.json`
- `assets/testing-manifest.json`
- `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`
- `packages/missing-routes/missing.json`
- `test/generated/http-contracts.json`
- `test/generated/suite-coverage.json`
- `test/routes/users-me-dms-param-get.test.ts`
- `test/scenarios/users-supplemental.test.ts`
- `worker-progress/users-me-dms-param-get.md`

## Behavior

- Requires bearer authentication through the normal API route stack.
- Requires `dm_channels.read` only for OAuth-style tokens carrying scope claims.
- Verifies the target user exists.
- Looks only at active current-user `Recipient` rows and returns a local one-to-one `ChannelType.DM` whose recipients exactly match current user plus target user.
- Returns `404 UNKNOWN_CHANNEL` when no active local one-to-one DM exists.
- Does not create, reopen, or fabricate DM channels and does not emit events.

## Current-Base Artifacts

- `packages/missing-routes/missing.json`: `626` missing / `554` implemented / `1128` Discord.
- `assets/schemas.json`: unchanged at `1043` schemas; the route uses existing `DmChannelDTO`.
- `assets/openapi.json`: `448` paths and includes `GET /users/@me/dms/{user_id}/`.
- `assets/testing-manifest.json`: `659` entries and includes `api:http:GET:/users/@me/dms/:user_id/`.
- `test/generated/http-contracts.json`: `634` contracts and includes the DMS manifest id.
- Source catalog includes `GET /users/@me/dms/{user_id}` with response schemas `APIErrorResponse` and `DmChannelDTO`.

## Commands

- `npm run build:src:tsgo` - passed.
- `npm run build --workspace @spacebar/automatic-reverse-engineering` - passed.
- `node packages/automatic-reverse-engineering/dist/cli.js import-source-routes --root src/api/routes --out packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json` - passed.
- `npm run build --workspace @spacebar/missing-routes` - passed.
- `npm run start --workspace @spacebar/missing-routes` - passed; current report is `626` missing / `554` implemented / `1128` Discord.
- `npm run generate:testing-manifest && node scripts/testing-manifest/verify.js` - passed; verified `659` entries.
- `npm run generate:contract-tests && node scripts/testing-manifest/generate-contract-tests.js --check` - passed; verified `634` contracts.
- `npm run generate:suite-coverage && node scripts/testing-manifest/generate-suite-coverage.js --check` - passed.
- `npm run generate:openapi` - passed; wrote `448` paths and `1043` schemas.
- `npm run build:test-fixtures` - passed.
- `node -r dotenv/config -r module-alias/register --enable-source-maps --test dist-test/test/routes/users-me-dms-param-get.test.js` - passed, `9` tests.
- `node -r dotenv/config -r module-alias/register --enable-source-maps --test --test-concurrency=1 dist-test/test/scenarios/users-supplemental.test.js` - skipped because no Postgres admin URL is configured in this environment.
- `node --test test/generated/http-contracts.test.js` - passed, `9` tests.
- `node --test test/generated/suite-coverage.test.js` - passed, `4` tests.
- `npm run test:manifest` - passed; verified `659` entries.
- `npm run test:suite-coverage` - passed.
- `npm run lint` - passed.
- `npm run test:contracts` - static generated contract checks passed, then runtime contracts failed only on the known unrelated `api:http:GET:/discovery/search` response-schema check returning `500` instead of expected `200`; existing analytics `query.ts` route-registration noise was also logged.
- `git diff --check` - passed.
- `git diff -- package.json package-lock.json npm-shrinkwrap.json yarn.lock pnpm-lock.yaml` - empty; package/lockfile guard passed.
- Malformed warranty-token scan over changed source/test files - passed.

## Risks

- The endpoint intentionally does not create or reopen DMs. Clients expecting Discord-side creation behavior receive `404 UNKNOWN_CHANNEL` when Spacebar has no active local one-to-one DM.
- OAuth scope enforcement is conditional on scope claims so existing Spacebar bearer/session tokens without OAuth scope claims remain compatible.
- The Postgres-backed scenario is covered in source but self-skipped locally because this environment lacks the Postgres admin fixture.
- The full runtime contracts gate still has the unrelated `/discovery/search` failure noted above.

## Next Tasks

- Orchestrator commit, push, close the managed worker, prune its worktree/branch, and refill the top-level worker pool with `spawn_agent` if below the cap.
