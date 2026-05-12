# GET /users/{param}/sessions/{param}/activities/{param}/{param}

## Status

- Implemented and verified, except `npm run test:contracts` has the known unrelated `api:http:GET:/discovery/search` `500 !== 200` runtime-contract failure.

## Evidence

- Confirmed assigned missing entry in `packages/missing-routes/missing.json`: `GET /users/{param}/sessions/{param}/activities/{param}/{param}` with Userdoccers source `resources/presence.mdx`.
- Userdoccers `pages/resources/presence.mdx` (`https://raw.githubusercontent.com/discord-userdoccers/discord-userdoccers/master/pages/resources/presence.mdx`) documents Get Activity Secret as returning `{ "secret": string }`, only for `JOIN` and `SPECTATE`, requiring the matching activity flag and either rich presence invite context or party privacy flags.
- Local evidence: `Session.activities` persists activity `secrets`; `Relationship` persists friend relationships; `VoiceState` persists current user/channel voice state; `metadata.ts` in the same route family treats offline/invisible non-self sessions as not externally visible.

## Changes

- Added local route implementation for `GET /users/:user_id/sessions/:session_id/activities/:application_id/:activity_action_type`.
- Added `ActivitySecretResponse` schema.
- Added focused route tests for stored secret behavior, access boundaries, generated artifacts, adjacent route preservation, and missing-route removal.
- Added the focused test to `tsconfig.test.json` so it is included in compiled test fixtures.
- Regenerated `assets/schemas.json`, `assets/openapi.json`, `assets/testing-manifest.json`, `test/generated/http-contracts.json`, `test/generated/suite-coverage.json`, `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`, and `packages/missing-routes/missing.json`.

## Changed Files

- `src/api/routes/users/#user_id/sessions/#session_id/activities/#application_id/#activity_action_type.ts`
- `src/api/routes/users/#user_id/sessions/#session_id/activities/#application_id/#activity_action_type.test.ts`
- `src/schemas/responses/ActivitySecretResponse.ts`
- `src/schemas/responses/index.ts`
- `tsconfig.test.json`
- `assets/schemas.json`
- `assets/openapi.json`
- `assets/testing-manifest.json`
- `test/generated/http-contracts.json`
- `test/generated/suite-coverage.json`
- `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`
- `packages/missing-routes/missing.json`
- `worker-progress/users-param-sessions-param-activities-param-param-get.md`

## Behavior

- Returns only locally persisted `activity.secrets.join` or `activity.secrets.spectate`.
- Supports only action types `1` (`JOIN`) and `2` (`SPECTATE`).
- Requires the matching activity flag (`JOIN` or `SPECTATE`) before returning a secret.
- Allows self access to stored join/spectate secrets.
- Allows non-self access only for externally visible sessions and locally verifiable access:
  - friend relationship plus `PARTY_PRIVACY_FRIENDS`, or
  - shared persisted voice channel plus `PARTY_PRIVACY_VOICE_CHANNEL`.
- Does not fabricate activity secrets, join/spectate tokens, session metadata, or gateway state.
- Does not use rich-presence invite query parameters as an authorization bypass because validating invite access safely would require broader message/channel behavior outside this assignment.

## Missing Route Movement

- `missing`: 575 -> 574.
- `spacebar`: 605 -> 606.
- Removed assigned `GET /users/{param}/sessions/{param}/activities/{param}/{param}` from `missing_entries`.
- Adjacent `GET /users/{param}/sessions/{param}/activities/{param}/1` remains in `missing_entries` and was not removed from the missing catalog.

## Verification

- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm ci` - passed; installed worktree-local dependencies because `node_modules` was absent.
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run build:src:tsgo` - passed after `npm ci`; first attempt failed because `tsgo` was unavailable before dependencies were installed.
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run generate:schema` - passed.
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run generate:openapi` - passed with existing warnings about three webhook routes missing route metadata.
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run build --workspace @spacebar/automatic-reverse-engineering` - passed.
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" node packages/automatic-reverse-engineering/dist/cli.js import-source-routes --root src/api/routes --out packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json` - passed.
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run build --workspace @spacebar/missing-routes` - passed.
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run start --workspace @spacebar/missing-routes` - passed; wrote missing count 574.
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run generate:testing-manifest` - passed.
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run generate:contract-tests` - passed.
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run generate:suite-coverage` - passed.
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run test -- 'src/api/routes/users/#user_id/sessions/#session_id/activities/#application_id/#activity_action_type.test.ts'` - passed, 8 tests.
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run build:test-fixtures` - passed.
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" node -r dotenv/config -r module-alias/register --enable-source-maps --test 'dist-test/src/api/routes/users/#user_id/sessions/#session_id/activities/#application_id/#activity_action_type.test.js'` - passed, 8 tests.
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run test:manifest` - passed, manifest verified 711 entries.
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run test:suite-coverage` - passed.
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run test:contracts` - generated checks passed, runtime failed only on known unrelated `api:http:GET:/discovery/search should return a successful response for schema validation` (`500 !== 200`).
- `git diff --check` - passed.
- `git diff -- package.json package-lock.json && git status --short package.json package-lock.json` - no package or lockfile changes.
- Final artifact audit - assigned `GET /users/{param}/sessions/{param}/activities/{param}/{param}` missing entry count is `0`; adjacent `GET /users/{param}/sessions/{param}/activities/{param}/1` missing entry count is `1`; source catalog, OpenAPI, schema, testing manifest, HTTP contracts, and suite coverage all include the new route artifacts.

## Risks

- Rich-presence invite query parameters are documented but not used to bypass friend/voice-party privacy checks. This is intentional because local validation of rich-presence invite message/channel access is broader than the assigned route and should be implemented separately if needed.
- Non-self access uses persisted relationship and voice-state data only; it does not infer private Discord gateway session state.

## Reconciliation

- Assigned path implemented.
- Adjacent activity launch/join mutations, session updates, presence gateway behavior, metadata route behavior, and unrelated user/session/activity routes were not implemented.

## Integration Acceptance

- Integrated on main server branch at base `2e758424f`.
- Route movement after main-checkout regeneration: missing `572 -> 571`, implemented `608 -> 609`, Discord `1128`.
- Generated counts after regeneration: `1145` schemas, `499` OpenAPI paths, `714` manifest entries, `689` contracts, `15` suites.
- Focused activity-secret route tests passed in source and built fixtures: `8/8` and `8/8`.
- Generated checks passed: testing manifest verify, generated contract check, generated HTTP contracts, generated suite coverage check, generated suite coverage tests, `git diff --check`, and package/lockfile guard.
- `npm run lint` passed.
- Full `npm run test:contracts` failed only on the known unrelated runtime baseline: `api:http:GET:/discovery/search` returned `500 !== 200`.
- Recommended next task: implement the separate adjacent `GET /users/{param}/sessions/{param}/activities/{param}/1` route only if assigned, because it remains in `packages/missing-routes/missing.json`.
