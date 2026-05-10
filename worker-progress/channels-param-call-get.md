# GET and PATCH /channels/{param}/call

## Summary

Implemented the assigned exact path `/channels/{param}/call` as `GET /channels/{channel_id}/call` and `PATCH /channels/{channel_id}/call`.

`GET` returns private-channel call eligibility without inventing call/session state. `PATCH` implements authenticated modify-call request handling with source-backed validation and private-channel authorization, returns `204` when there is no active call to modify, and fails closed with `501` for active call region changes because Spacebar has no private-call region persistence or Call Update event backing.

## Assigned Path

- Assigned path: `/channels/{param}/call`
- Source route: `/channels/{channel_id}/call`
- Missing methods found: `GET_CHANNELS_CHANNEL_ID_CALL` and `PATCH_CHANNELS_CHANNEL_ID_CALL`
- Methods implemented: `GET` and `PATCH`
- Remaining exact-path entries: none
- Out of scope and not implemented: `/channels/{param}/call/ring`, `/channels/{param}/call/stop-ringing`, adjacent message/thread/summary/poll/directory/store routes, call start routes, voice-state routes, and stage routes.

## Changed Files

- `src/api/routes/channels/#channel_id/call.ts`
- `src/api/routes/channels/#channel_id/call.test.ts`
- `src/schemas/responses/ChannelCallEligibilityResponse.ts`
- `src/schemas/responses/index.ts`
- `src/schemas/uncategorised/ChannelCallModifySchema.ts`
- `src/schemas/uncategorised/index.ts`
- `tsconfig.test.json`
- `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`
- `packages/missing-routes/missing.json`
- `assets/schemas.json`
- `assets/testing-manifest.json`
- `assets/openapi.json`
- `test/generated/http-contracts.json`
- `test/generated/suite-coverage.json`
- `worker-progress/channels-param-call-get.md`

## What Changed

- Added `ChannelCallEligibilityResponse` with required boolean `ringable`.
- Added `ChannelCallModifySchema` with optional string `region`.
- Added `GET /channels/:channel_id/call/` route metadata with `200`, `400`, `401`, `403`, and `404` response schemas.
- Added `PATCH /channels/:channel_id/call/` route metadata with `ChannelCallModifySchema`, non-coerced request validation, `204`, and `400/401/403/404/501` error response schemas.
- Implemented shared private-channel eligibility:
  - `DM` and `GROUP_DM` are accepted.
  - Other channel types throw `CANNOT_EXECUTE_ON_THIS_CHANNEL_TYPE`.
  - The requester must have a loaded recipient row with `closed === false`; otherwise `MISSING_PERMISSIONS`.
  - `GET` returns `ringable: true` when the private channel has at least one other recipient.
- Implemented `PATCH` active-call compatibility behavior:
  - Loads the channel with recipients, then applies the same private-channel eligibility rules as `GET`.
  - Checks existing `VoiceState` rows for the channel to determine whether Spacebar has an active private call signal.
  - Returns `204` without persistence when there are no active voice states, matching source evidence that the route requires an active call to do anything.
  - Returns `501` for active-call `region` changes because no exact private-call region state, persistence column, or Call Update dispatch model exists locally.
- Added focused compiled route tests covering GET metadata/behavior and PATCH metadata, schema validation, no-active-call `204`, active-region fail-closed `501`, non-private rejection, and inactive-recipient rejection.
- Regenerated source route catalog, missing-route report, schemas, testing manifest, generated HTTP contracts, suite coverage, and OpenAPI.

## Evidence Gathered

- `packages/missing-routes/missing.json` contained exact-path missing entries for `GET /channels/{param}/call` (`GET_CHANNELS_CHANNEL_ID_CALL`) and `PATCH /channels/{param}/call` (`PATCH_CHANNELS_CHANNEL_ID_CALL`).
- Before implementation, `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json` and `src/api/routes/**` did not contain the exact path.
- Current source catalog contains `GET_CHANNELS_CHANNEL_ID_CALL` and `PATCH_CHANNELS_CHANNEL_ID_CALL` for `/channels/{channel_id}/call`.
- Current missing-route report has no `missing_entries[]` whose route is `/channels/{param}/call`.
- Local Userdoccers catalog lists:
  - `GET /channels/{channel_id}/call` from `userdoccers:resources/channel.mdx` with summary `Get Call Eligibility`.
  - `PATCH /channels/{channel_id}/call` from the same source with summary `Modify Call`.
- Local xHyroM catalog lists the same path under route name `CALL`, including `GET` and `PATCH`.
- Matching upstream Userdoccers source documents:
  - `GET /channels/{channel.id}/call`, `supportsOAuth2="voice"`, checks whether the current user is eligible to ring a call in the DM channel, and returns `ringable`.
  - `PATCH /channels/{channel.id}/call`, `supportsOAuth2="voice"`, accepts JSON param `region? string`, requires an active call to do anything, and fires `Call Update`.
- Nearby Spacebar private-channel pattern: `src/api/routes/channels/#channel_id/linked-accounts.ts` rejects wrong private channel types with `CANNOT_EXECUTE_ON_THIS_CHANNEL_TYPE`, requires the requester to be an active recipient, and declares `401/403/404` API error responses.
- Existing channel permission backing: `Channel.canViewDmChannel` treats private-channel visibility as a recipient row where `closed === false`.

## Missing Route Count Movement

- Original GET worker regeneration: `missing = 830`, `spacebar = 350`, `discord = 1128`.
- After GET only: `missing = 829`, `spacebar = 351`, `discord = 1128`.
- After continuation PATCH regeneration: `missing = 828`, `spacebar = 352`, `discord = 1128`.
- Current master base before merge: `missing = 811`, `spacebar = 369`, `discord = 1128`.
- Current master base after merge: `missing = 809`, `spacebar = 371`, `discord = 1128`.
- Exact-path movement: both `GET /channels/{param}/call` and `PATCH /channels/{param}/call` disappeared from `missing_entries[]`.
- Remaining exact-path entries: none.

## Commands Run

- `sed -n '1,240p' /Users/user/Developer/Developer/spacebarchat/WORKER_BRIEF.md`
- `jq '.missing_entries[] | select(.route=="/channels/{param}/call")' packages/missing-routes/missing.json`
- `rg -n 'channels/\{param\}/call|channels/\{channel_id\}/call|GET_CHANNELS_CHANNEL_ID_CALL|PATCH_CHANNELS_CHANNEL_ID_CALL|/call' packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json packages/missing-routes/missing.json src/api/routes`
- `curl -L --fail --silent https://raw.githubusercontent.com/discord-userdoccers/discord-userdoccers/master/pages/resources/channel.mdx | rg -n -C 12 'Get Call Eligibility|Modify Call|Ring Channel Recipients|Stop Ringing'`
- `if [ -L node_modules ]; then unlink node_modules; fi`
- `if [ ! -d node_modules ]; then npm ci; fi`
- `npm run build:src:tsgo`
- `npm run build:test-fixtures`
- `node -r dotenv/config -r module-alias/register --enable-source-maps --test 'dist-test/src/api/routes/channels/#channel_id/call.test.js'`
- `npm run build --workspace @spacebar/automatic-reverse-engineering`
- `node packages/automatic-reverse-engineering/dist/cli.js import-source-routes --root src/api/routes --out packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`
- `npm run build --workspace @spacebar/missing-routes`
- `npm run start --workspace @spacebar/missing-routes`
- `npm run generate:schema`
- `npm run generate:testing-manifest`
- `node scripts/testing-manifest/verify.js`
- `node scripts/testing-manifest/generate-contract-tests.js --check`
- `npm run generate:contract-tests`
- `node scripts/testing-manifest/generate-contract-tests.js --check`
- `node scripts/testing-manifest/generate-suite-coverage.js --check`
- `npm run generate:suite-coverage`
- `node scripts/testing-manifest/generate-suite-coverage.js --check`
- `npm run generate:openapi`
- `jq '[.missing_entries[] | select(.route=="/channels/{param}/call")]' packages/missing-routes/missing.json`
- `jq '{missing, spacebar, discord, exact_path: [.missing_entries[] | select(.route=="/channels/{param}/call")]}' packages/missing-routes/missing.json`
- `git diff --check`
- Ran the provided scoped malformed AGPL warranty-token scan over changed and untracked files.

## Verification Results

- Source build passed.
- Test fixture build passed.
- Focused compiled route test passed: 11 tests, 11 passed.
- Automatic reverse-engineering workspace build passed.
- Source route catalog regeneration passed and now includes both `GET_CHANNELS_CHANNEL_ID_CALL` and `PATCH_CHANNELS_CHANNEL_ID_CALL`.
- Missing-route workspace build passed.
- Missing-route regeneration passed with current counts: `missing = 828`, `spacebar = 352`, `discord = 1128`.
- Exact-path missing check returned `[]`.
- Schema generation passed and includes `ChannelCallEligibilityResponse` and `ChannelCallModifySchema`.
- Testing manifest generation and verification passed.
- Generated HTTP contract check initially reported stale after PATCH, then passed after `npm run generate:contract-tests`.
- Generated suite coverage check initially reported stale after PATCH, then passed after `npm run generate:suite-coverage`.
- OpenAPI generation passed and documents `GET` and `PATCH` at `/channels/{channel_id}/call/`.
- `git diff --check` passed.
- Scoped malformed AGPL warranty-token scan passed.

## Current-Base Port Verification

- Ported only source, schema, focused test, `tsconfig.test.json`, and worker report changes from the worker; regenerated artifacts were produced on current master.
- `npm run build:src:tsgo`
    - passed
- `npm run generate:schema`
    - passed, wrote `736` schemas
- `npm run build:test-fixtures`
    - passed
- `node -r dotenv/config -r module-alias/register --enable-source-maps --test 'dist-test/src/api/routes/channels/#channel_id/call.test.js'`
    - passed, `11` tests
- `npm run build --workspace @spacebar/automatic-reverse-engineering`
    - passed
- `node packages/automatic-reverse-engineering/dist/cli.js import-source-routes --root src/api/routes --out packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`
    - passed
- `npm run build --workspace @spacebar/missing-routes`
    - passed
- `npm run start --workspace @spacebar/missing-routes`
    - passed with `Spacebar is missing 809`, `Spacebar implements 371`, `Discord implements 1128`
- `npm run generate:testing-manifest`
    - passed, wrote `476` manifest entries
- `node scripts/testing-manifest/verify.js`
    - passed
- `npm run generate:contract-tests`
    - passed, wrote `451` contracts
- `node scripts/testing-manifest/generate-contract-tests.js --check`
    - passed
- `npm run generate:suite-coverage`
    - passed, wrote `15` suites
- `node scripts/testing-manifest/generate-suite-coverage.js --check`
    - passed
- `node --test test/generated/http-contracts.test.js test/generated/suite-coverage.test.js`
    - passed, `13` tests
- `npm run generate:openapi`
    - passed with `292` paths and `736` schemas; only the repository's pre-existing webhook route metadata warnings
- `git diff --check`
    - passed
- `git diff -- package.json package-lock.json npm-shrinkwrap.json pnpm-lock.yaml yarn.lock --exit-code`
    - passed
- malformed warranty grep over changed/untracked scoped files
    - passed
- `jq '{missing, spacebar, exact_path: [.missing_entries[] | select(.route=="/channels/{param}/call")]}' packages/missing-routes/missing.json`
    - returned `missing = 809`, `spacebar = 371`, and `exact_path = []`

## Risks Or Blockers

- Spacebar does not have exact private-call/session/ringing state for this endpoint. The implementation intentionally uses existing private-channel recipient state and `VoiceState` presence instead of fabricating call state.
- `PATCH` region modification for an active call fails closed with `501` until Spacebar has private-call region persistence and a Call Update event model.
- The source documents `supportsOAuth2="voice"`, but Spacebar has no route-level OAuth voice-scope enforcement pattern for normal bearer compatibility. Both routes stay authenticated through standard bearer auth and include `401` response metadata.

## Recommended Next Tasks

- Implement `/channels/{param}/call/ring` and `/channels/{param}/call/stop-ringing` only after deciding how Spacebar should model private-call ringing state.
- Add exact private-call region persistence and Call Update dispatch before changing the active-call `PATCH` path from fail-closed `501` to mutation behavior.
- Consider a shared private-channel recipient authorization helper if more private-channel call routes are implemented.

## Goal Status Evidence

- Original required `create_goal` objective: `implement the missing route path \`GET /channels/{param}/call\` for the Spacebar server API.`
- Original `get_goal` result after setup: status `active`, same objective.
- Continuation `create_goal` attempt was blocked because this thread already had the previous goal; the tool returned that a new goal could not be created while the thread already has a goal.
- Current `get_goal` result during finalization: status `complete`, objective `implement the missing route path \`GET /channels/{param}/call\` for the Spacebar server API.`, `tokensUsed = 297460`, `timeUsedSeconds = 612`.
