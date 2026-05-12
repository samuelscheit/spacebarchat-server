# GET /oauth2/authorize/webhook-channels

## Summary

Implemented `GET /oauth2/authorize/webhook-channels` as an authenticated, read-only OAuth authorize helper route.

The route requires `guild_id`, loads the selected guild, current member, and guild channels, then returns only named text or announcement channels where the current user has both `VIEW_CHANNEL` and `MANAGE_WEBHOOKS`. It does not create webhooks, mutate followers, issue OAuth tokens or codes, or change the existing `GET`/`POST /oauth2/authorize` behavior.

## Changed Files

- `src/api/routes/oauth2/authorize/webhook-channels.ts`
- `src/schemas/responses/OAuthAuthorizeWebhookChannelsResponse.ts`
- `src/schemas/responses/index.ts`
- `test/routes/oauth2-authorize-webhook-channels.test.ts`
- `assets/schemas.json`
- `assets/openapi.json`
- `assets/testing-manifest.json`
- `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`
- `packages/missing-routes/missing.json`
- `test/generated/http-contracts.json`
- `test/generated/suite-coverage.json`
- `worker-progress/oauth2-authorize-webhook-channels-get.md`

## Evidence Gathered

- `packages/missing-routes/missing.json` had one assigned missing entry before implementation:
    - `GET /oauth2/authorize/webhook-channels`
    - `route_name`: `OAUTH2_AUTHORIZE_WEBHOOK_CHANNELS`
    - source: `xhyrom:data/client/routes.json`
- xHyroM route catalogs include the path as `/oauth2/authorize/webhook-channels`.
- Discord web client usage showed a `guild_id` query and consumed the response as a sortable channel array keyed by `id` and `name`.
- Existing source routes did not contain `GET_OAUTH2_AUTHORIZE_WEBHOOK_CHANNELS` before implementation.

## Behavior

- `GET /oauth2/authorize/webhook-channels` is bearer-authenticated.
- Missing `guild_id` returns the local `FieldErrors` 400 shape.
- Unknown guild returns `UNKNOWN_GUILD`.
- Current user missing from the guild returns `MISSING_ACCESS` with HTTP 403.
- Response body is `OAuthAuthorizeWebhookChannelsResponse`, an array of `{ id, name, type, guild_id }`.
- Exposed channel types are intentionally narrow: `GUILD_TEXT` and `GUILD_NEWS`.
- Channels are filtered by guild, type, presence of `name`, `VIEW_CHANNEL`, and `MANAGE_WEBHOOKS`.
- Results sort by guild `channel_ordering`, then `name`, then `id`.

## Generated Artifacts

- Source catalog now contains `GET /oauth2/authorize/webhook-channels`, `GET_OAUTH2_AUTHORIZE_WEBHOOK_CHANNELS`, source `src/api/routes/oauth2/authorize/webhook-channels.ts`, and response schemas `APIErrorResponse` plus `OAuthAuthorizeWebhookChannelsResponse`.
- OpenAPI now contains `/oauth2/authorize/webhook-channels/` with bearer security, required `guild_id` query metadata, and 200/400/401/403/404 response metadata.
- Testing manifest now contains `api:http:GET:/oauth2/authorize/webhook-channels/` as an authenticated route.
- HTTP contracts increased from 667 to 668.
- Missing-route movement: `missing: 593 -> 592`, `spacebar: 587 -> 588`, `discord: 1128`.
- The assigned `GET /oauth2/authorize/webhook-channels` entry is absent from `packages/missing-routes/missing.json`.

## Verification

- `npm install` - completed because `node_modules` was absent; no package or lockfile changes.
- `npm run build:src:tsgo` - passed.
- `npm run generate:schema` - passed.
- `npm run generate:openapi` - passed, with existing unrelated warnings about webhook routes missing route middleware.
- `npm run build --workspace @spacebar/automatic-reverse-engineering` - passed.
- `node packages/automatic-reverse-engineering/dist/cli.js import-source-routes --root src/api/routes --out packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json` - passed.
- `npm run build --workspace @spacebar/missing-routes` - passed.
- `npm run start --workspace @spacebar/missing-routes` - passed and reported `Spacebar is missing 592`, `Spacebar implements 588`, `Discord implements 1128`.
- `npm run generate:testing-manifest` - passed.
- `npm run generate:contract-tests` - passed and wrote 668 contracts.
- `npm run generate:suite-coverage` - passed.
- `npm run test -- test/routes/oauth2-authorize-webhook-channels.test.ts src/api/routes/oauth2/authorize.test.ts src/api/util/utility/OAuthAuthorize.test.ts src/schemas/responses/OAuthAuthorizeInfoResponse.test.ts` - passed.
- `npm run build:test-fixtures` - passed.
- `node scripts/testing-manifest/verify.js` - passed.
- `node scripts/testing-manifest/generate-contract-tests.js --check` - passed.
- `node scripts/testing-manifest/generate-suite-coverage.js --check` - passed.
- `node --test test/generated/http-contracts.test.js test/contracts/*.test.cjs` - passed.
- `node --test test/generated/suite-coverage.test.js` - passed.
- `node -r dotenv/config -r module-alias/register --enable-source-maps --test dist-test/test/routes/oauth2-authorize-webhook-channels.test.js dist-test/src/api/routes/oauth2/authorize.test.js dist-test/src/api/util/utility/OAuthAuthorize.test.js dist-test/src/schemas/responses/OAuthAuthorizeInfoResponse.test.js` - passed.
- `git diff --check` - passed.
- `git diff -- package.json package-lock.json` - showed no changes.

## Completion Audit

- Assigned worktree verified: `/Users/user/Developer/Developer/spacebarchat/worktrees/current-oauth2-authorize-webhook-channels-get-agent`.
- Assigned branch verified: `codex/current-missing-route-oauth2-authorize-webhook-channels-get-agent`.
- Current HEAD verified: `a77fdc750`, matching the stated current integration base.
- Fresh Node path verified: `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH"` reports `node v26.1.0` and `npm 11.13.0`.
- Fresh `npm run build:src:tsgo` with the required Node path passed.
- Fresh `npm run build:test-fixtures` with the required Node path passed.
- Fresh focused source route/schema test command passed: 20 tests, 0 failures.
- Fresh compiled dist route/schema test command passed: 20 tests, 0 failures.
- Fresh `node scripts/testing-manifest/verify.js` passed with 693 entries.
- Fresh `node scripts/testing-manifest/generate-contract-tests.js --check` passed with 668 contracts.
- Fresh `node scripts/testing-manifest/generate-suite-coverage.js --check` passed.
- Fresh `node --test test/generated/http-contracts.test.js test/contracts/*.test.cjs` passed: 10 tests, 0 failures.
- Fresh `node --test test/generated/suite-coverage.test.js` passed: 4 tests, 0 failures.
- Fresh generated-artifact probe confirmed:
    - `packages/missing-routes/missing.json`: `missing = 592`, `spacebar = 588`, `discord = 1128`.
    - assigned `GET /oauth2/authorize/webhook-channels` entry is absent from `missing_entries`.
    - source catalog has `GET_OAUTH2_AUTHORIZE_WEBHOOK_CHANNELS` from `src/api/routes/oauth2/authorize/webhook-channels.ts`.
    - manifest has `api:http:GET:/oauth2/authorize/webhook-channels/` with `authMode: "bearer"`.
    - generated HTTP contracts have the matching manifest id and response metadata.
    - OpenAPI has `/oauth2/authorize/webhook-channels/`.
    - schemas have `OAuthAuthorizeWebhookChannelsResponse` and `OAuthAuthorizeWebhookChannel`.
- Fresh `git diff --check` passed.
- Fresh package/lockfile guard showed no `package.json` or `package-lock.json` changes.
- Fresh reconciliation check `git merge-base --is-ancestor a77fdc750 HEAD` exited `0`; no reconciliation is needed against the stated current integration base.

## Risks And Notes

- Endpoint shape evidence is limited to xHyroM route data and Discord web client usage, so the response is intentionally narrow and local-safe.
- Forum, media, voice, and other channel types are intentionally omitted until stronger evidence shows Discord exposes them for this authorize webhook picker.
- Adjacent routes are untouched: existing `GET`/`POST /oauth2/authorize`, Samsung OAuth, OAuth token routes, webhook execution, and channel follower routes.
- Full runtime `npm run test:contracts` was not rerun. Static/generated contract checks passed; the known unrelated runtime caveat is `api:http:GET:/discovery/search` possibly failing with `500 !== 200`.
- No merge, rebase, commit, push, reset, or stash was performed.

## Integration Acceptance

- Accepted into the main checkout on 2026-05-12 from current integration base `5c3e6ce23`.
- Ported only the worker-owned route, response schema, schema export, focused test, and worker progress report; generated artifacts were regenerated from the main checkout.
- Current main missing-route movement after regeneration: `588 -> 587` missing, `592 -> 593` implemented, Discord `1128` unchanged.
- `npm run build:src:tsgo`: passed.
- `npm run generate:schema`: passed; wrote 1120 schemas.
- `npm run generate:openapi`: passed; wrote 484 paths and 1120 schemas with the existing unrelated webhook route metadata warnings.
- `npm run build --workspace @spacebar/automatic-reverse-engineering`: passed.
- Source route catalog import, missing-routes build, and `npm run start --workspace @spacebar/missing-routes`: passed; wrote 587 missing / 593 implemented.
- `npm run generate:testing-manifest`: passed; wrote 698 entries.
- `npm run generate:contract-tests`: passed; wrote 673 contracts.
- `npm run generate:suite-coverage`: passed; wrote 15 suites.
- `npm run build:test-fixtures`: passed.
- `npm run test -- test/routes/oauth2-authorize-webhook-channels.test.ts src/api/routes/oauth2/authorize.test.ts src/api/util/utility/OAuthAuthorize.test.ts src/schemas/responses/OAuthAuthorizeInfoResponse.test.ts`: passed, 20 tests.
- `node scripts/testing-manifest/verify.js`: passed, 698 entries.
- `npm run generate:contract-tests -- --check`: passed, 673 contracts.
- `npm run generate:suite-coverage -- --check`: passed.
- `npm run test:manifest`: passed, 30 tests and manifest verify.
- `node --test test/generated/http-contracts.test.js test/contracts/*.test.cjs`: passed, 10 tests.
- `npm run test:suite-coverage`: passed, 4 tests.
- `npm run lint`: passed.
- `git diff --check`: passed.
- Package and lockfile guard: passed; no package or lockfile changes.
- Changed-file AGPL malformed warranty-token scan: passed.
- `npm run test:contracts`: failed only on the known unrelated baseline runtime assertion `api:http:GET:/discovery/search` returning `500 !== 200`; generated contract checks passed before that failure.
