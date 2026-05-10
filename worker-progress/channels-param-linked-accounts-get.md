# GET /channels/{channel_id}/linked-accounts

## Summary

Implemented the assigned missing route `GET /channels/{channel_id}/linked-accounts` only. The route is authenticated, fails closed unless the access token carries the source-backed `dm_channels.read` OAuth scope, requires the requester to be an active group-DM recipient, and returns a `linked_accounts` map of active group-DM user IDs to visible non-revoked Spacebar connected accounts serialized as `{ id, name }`.

## Goal Status Evidence

- Initial `create_goal` objective: `Implement the missing route path GET /channels/{channel_id}/linked-accounts for the Spacebar server API.`
- Initial `get_goal` status: `active`
- Initial `get_goal` objective: `Implement the missing route path GET /channels/{channel_id}/linked-accounts for the Spacebar server API.`

## Assigned Path

- Missing-route key: `/channels/{param}/linked-accounts`
- Source route: `/channels/{channel_id}/linked-accounts`
- Missing methods found before implementation: `GET`
- Methods implemented: `GET`
- Adjacent routes intentionally not touched: channel calls, integrations, summaries, message routes, store routes, and linked-account mutation flows.

## Evidence Gathered

- `packages/missing-routes/missing.json` initially had one assigned entry:
  - `GET /channels/{param}/linked-accounts`
  - `GET_CHANNELS_CHANNEL_ID_LINKED_ACCOUNTS`
  - source `userdoccers:resources/channel.mdx`
- `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json` initially had no `linked-accounts` entry.
- `src/api/routes/channels/#channel_id` initially had no `linked-accounts.ts` route.
- Userdoccers source used: `https://raw.githubusercontent.com/discord-userdoccers/discord-userdoccers/master/pages/resources/channel.mdx`
  - Documents that the endpoint is only usable with an OAuth2 access token with `dm_channels.read`.
  - Documents that it returns linked accounts for users in a group DM.
  - Documents query param `user_ids?` and response body `linked_accounts` as a map of user snowflakes to linked-account arrays.
  - Linked account shape is only `id` and `name`.
- xHyroM reference: none for this route. Local missing entry and Userdoccers catalog only list `userdoccers:resources/channel.mdx`.

## Changed Files

- `src/api/routes/channels/#channel_id/linked-accounts.ts`
- `src/api/routes/channels/#channel_id/linked-accounts.test.ts`
- `src/schemas/responses/ChannelLinkedAccountsResponse.ts`
- `src/schemas/responses/ChannelLinkedAccountsResponse.test.ts`
- `src/schemas/responses/index.ts`
- `tsconfig.test.json`
- Generated:
  - `assets/schemas.json`
  - `assets/openapi.json`
  - `assets/testing-manifest.json`
  - `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`
  - `packages/missing-routes/missing.json`
  - `test/generated/http-contracts.json`
  - `test/generated/suite-coverage.json`

## What Changed

- Added route metadata for `GET /channels/:channel_id/linked-accounts/`, including `401: { body: "APIErrorResponse" }`.
- Added `ChannelLinkedAccountsResponse` and `ChannelLinkedAccount` schema types.
- Added OAuth scope parsing for `scope`, `scopes`, and `scp` token claims.
- Added group-DM eligibility checks:
  - channel must be `GROUP_DM`;
  - requester must be an active non-closed recipient;
  - optional `user_ids` filters to active recipients only.
- Added response serialization:
  - response shape is `{ linked_accounts: { [user_id]: [{ id, name }] } }`;
  - account `id` is Spacebar `ConnectedAccount.external_id`;
  - only visible (`visibility != 0`) and non-revoked accounts are queried;
  - hidden, revoked, token, type, and metadata fields are not exposed.
- Added focused tests for route metadata, missing OAuth scope, non-group-DM rejection, inactive-recipient rejection, requested-recipient filtering, schema shape, and OpenAPI response shape.

## Intentional Compatibility Limitations

- The route requires a token scope claim containing `dm_channels.read`. Current Spacebar login tokens do not appear to be full third-party OAuth scoped access tokens, so ordinary tokens fail closed with Discord API error `50026 Missing required OAuth2 scope`. This is intentional because Userdoccers explicitly requires an OAuth2 access token with `dm_channels.read`, and silently accepting ordinary bearer tokens would broaden access.
- The implementation uses existing Spacebar `ConnectedAccount` rows as the linked-account backing store and exposes only visible, non-revoked accounts. The Userdoccers response shape contains only `id` and `name`, and this worker was not scoped to build broader OAuth/connection account management or an application-specific linked-account store.

## Missing-Route Count Movement

- Before regeneration:
  - `routes`: 668
  - `missing_entries`: 847
  - assigned entries: 1
- After regeneration:
  - `routes`: 667
  - `missing_entries`: 846
  - assigned entries: 0
- `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json` now includes:
  - `GET /channels/{channel_id}/linked-accounts`
  - route name `GET_CHANNELS_CHANNEL_ID_LINKED_ACCOUNTS`
  - source `src/api/routes/channels/#channel_id/linked-accounts.ts`

## Commands Run

- `find /Users/user/Developer/Developer -maxdepth 4 -name WORKER_BRIEF.md -print`
- `sed -n '1,260p' /Users/user/Developer/Developer/spacebarchat/WORKER_BRIEF.md`
- `rg -n 'linked-accounts|GET_CHANNELS_CHANNEL_ID_LINKED_ACCOUNTS|/channels/\\{param\\}/linked-accounts|/channels/\\{channel_id\\}/linked-accounts' packages/missing-routes/missing.json packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`
- `rg -n 'linked-accounts|GET_CHANNELS_CHANNEL_ID_LINKED_ACCOUNTS' packages/automatic-reverse-engineering/data/catalogs/routes.userdoccers.catalog.json packages/automatic-reverse-engineering/data/catalogs/routes.xhyrom.catalog.json packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`
- `npm run build:src:tsgo` (first attempt failed because dependencies were not installed and `@types/node` was missing)
- `npm ci`
- `npm run build:src:tsgo`
- `npm run build:test-fixtures`
- `node -r dotenv/config -r module-alias/register --enable-source-maps --test dist-test/src/api/routes/channels/#channel_id/linked-accounts.test.js`
- `npm run build --workspace @spacebar/automatic-reverse-engineering`
- `node packages/automatic-reverse-engineering/dist/cli.js import-source-routes --root src/api/routes --out packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`
- `npm run build --workspace @spacebar/missing-routes`
- `npm run start --workspace @spacebar/missing-routes`
- `npm run generate:schema`
- `npm run generate:testing-manifest`
- `node scripts/testing-manifest/verify.js`
- `node scripts/testing-manifest/generate-contract-tests.js --check || npm run generate:contract-tests`
- `node scripts/testing-manifest/generate-contract-tests.js --check`
- `node scripts/testing-manifest/generate-suite-coverage.js --check || npm run generate:suite-coverage`
- `node scripts/testing-manifest/generate-suite-coverage.js --check`
- `npm run generate:openapi`
- `npm run build:src:tsgo`
- `npm run build:test-fixtures`
- `node -r dotenv/config -r module-alias/register --enable-source-maps --test dist-test/src/api/routes/channels/#channel_id/linked-accounts.test.js dist-test/src/schemas/responses/ChannelLinkedAccountsResponse.test.js`
- `git diff --check`
- `git diff -- package.json package-lock.json npm-shrinkwrap.json --exit-code`
- Warranty typo scan over changed source, generated, test, and worker-progress files.

## Verification Results

- Continuation `get_goal`: status `active`, objective `Implement the missing route path GET /channels/{channel_id}/linked-accounts for the Spacebar server API.`
- Completion audit on the current tree:
  - Assigned route only: changed route implementation is `src/api/routes/channels/#channel_id/linked-accounts.ts`; no adjacent channel route files were added or edited.
  - Missing-method coverage: `packages/missing-routes/missing.json` no longer contains the assigned missing entry; missing count is `846`.
  - Source catalog coverage: `routes.source.catalog.json` includes `GET /channels/{channel_id}/linked-accounts` from the new route file.
  - Auth metadata coverage: route metadata includes `401: { body: "APIErrorResponse" }`.
  - Behavior coverage: focused tests cover OAuth scope rejection, non-group-DM rejection, inactive-recipient rejection, requested-recipient filtering, route metadata, schema shape, and OpenAPI response shape.
  - Generated artifact coverage: schemas, testing manifest, HTTP contracts, suite coverage, source catalog, missing-route data, and OpenAPI were regenerated and verified.
  - Dependency hygiene: package dependency files have no diff.
- `npm ci`: passed, no dependency file diff.
- `npm run build:src:tsgo`: passed after dependency install.
- `npm run build:test-fixtures`: passed.
- Focused compiled tests: passed, 7 tests.
- `npm run build --workspace @spacebar/automatic-reverse-engineering`: passed.
- Source route catalog import: passed.
- `npm run build --workspace @spacebar/missing-routes`: passed.
- `npm run start --workspace @spacebar/missing-routes`: passed, wrote missing count `846`.
- `npm run generate:schema`: passed.
- `npm run generate:testing-manifest`: passed.
- `node scripts/testing-manifest/verify.js`: passed.
- Contract test generation check: stale on first check, regenerated, then passed.
- Suite coverage generation check: stale on first check, regenerated, then passed.
- `npm run generate:openapi`: passed. Existing warnings about webhook routes missing route metadata remain unrelated.
- `git diff --check`: passed.
- Dependency diff check: passed.
- Warranty typo scan over changed files: no matches.

## Risks And Blockers

- Spacebar has `INVALID_OAUTH_TOKEN` and `MISSING_REQUIRED_OAUTH2_SCOPE` errors, but current OAuth app authorization code appears bot-focused and does not mint scoped user access tokens for `dm_channels.read`. The route is implemented to honor such claims when they exist, but broader token issuance is a separate OAuth infrastructure task.
- The route uses public Spacebar connected-account visibility as the privacy boundary. If future Discord-compatible behavior requires application-scoped linked accounts distinct from profile connected accounts, that should be modeled separately rather than added ad hoc to this route.

## Recommended Next Tasks

- Add scoped OAuth user access token issuance/validation for scopes such as `dm_channels.read`.
- Add a full scenario test once scoped OAuth access token fixtures exist.
- Investigate whether Discord's linked-account backing store is application-specific; if so, add a dedicated model before exposing non-profile linked accounts.
