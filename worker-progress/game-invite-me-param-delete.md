# game-invite-me-param-delete

## Summary

Integrated the assigned `DELETE /game-invite/@me/{param}` compatibility route as `DELETE /game-invite/@me/:game_invite_invite_id`.

The route is authenticated, validates the documented `game_invite_invite_id` snowflake path parameter, enforces the Xbox OAuth application ID used by the existing `/game-invite/@me` compatibility route, and then fails closed with the existing typed `501 APIErrorResponse` because Spacebar still has no durable game-invite persistence or `GAME_INVITE_DELETE` gateway event backing.

## Changed files

- `src/api/routes/game-invite/@me.ts`
- `test/routes/gameInviteMeRoute.test.ts`
- `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`
- `packages/missing-routes/missing.json`
- `assets/testing-manifest.json`
- `test/generated/http-contracts.json`
- `assets/openapi.json`
- `worker-progress/game-invite-me-param-delete.md`

## Assigned path and methods

- Assigned path: `/game-invite/@me/{param}`
- Missing methods found: `DELETE` only, route name `DELETE_GAME_INVITE__ME_GAME_INVITE_INVITE_ID`, summary `Delete Game Invite`
- Methods implemented: `DELETE /game-invite/@me/:game_invite_invite_id`
- Out of scope and not implemented: `OPTIONS`, broader collection behavior, Xbox handoff, connected-account flows, durable invite storage, and gateway event emission

## Evidence gathered

- Current-base `packages/missing-routes/missing.json` contained the assigned `DELETE /game-invite/@me/{param}` entry.
- `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json` contained only `DELETE /game-invite/@me` and `POST /game-invite/@me`.
- `src/api/routes/game-invite/@me.ts` had the collection game-invite compatibility route but no parameterized delete handler.
- Userdoccers `resources/game-invite.mdx` documents `DELETE /game-invite/@me/{game_invite_invite_id}` as `Delete Game Invite`.
- Local xHyroM catalog confirms `DELETE /game-invite/@me/{param}` as `GAME_INVITE`.
- Local gateway catalog lists `GAME_INVITE_CREATE`, `GAME_INVITE_DELETE`, and `GAME_INVITE_DELETE_MANY` as received events.
- Existing Spacebar route evidence used: `src/api/routes/game-invite/@me.ts` already checks Xbox OAuth application ID `622174530214821906` and returns typed unsupported `501` responses instead of fabricating invite state.

## What changed

- Added `assertValidGameInviteInviteId` with a 17-20 digit snowflake check for `game_invite_invite_id`.
- Added `DELETE /:game_invite_invite_id` route metadata with `400`, `401`, and `501` `APIErrorResponse` responses.
- Reused existing Xbox OAuth validation and unsupported game-invite error behavior.
- Added focused tests for malformed IDs, non-Xbox OAuth rejection, Xbox fail-closed behavior, route metadata, and helper validation.

## Missing-route count movement

- Before current-base integration: `818` missing, `362` implemented.
- Expected after regeneration: `817` missing, `363` implemented.
- The assigned `DELETE /game-invite/@me/{param}` entry should disappear from `packages/missing-routes/missing.json`.

## Verification result

The worker verified the route on its original base with source build, fixture build, focused compiled tests, source catalog import, missing-route generation, schema generation, manifest/contracts, suite coverage, OpenAPI, static generated tests, diff check, and malformed warranty-token scan.

Current-base orchestrator verification after porting onto `0b832e0d2`:

- `npm run build:src:tsgo` - passed.
- `npm run build:test-fixtures` - passed.
- `node -r dotenv/config -r module-alias/register --enable-source-maps --test dist-test/test/routes/gameInviteMeRoute.test.js` - passed, `12` tests.
- `npm run generate:schema` - passed, wrote `725` schemas.
- `npm run build --workspace @spacebar/automatic-reverse-engineering` - passed.
- `node packages/automatic-reverse-engineering/dist/cli.js import-source-routes --root src/api/routes --out packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json` - passed.
- `npm run build --workspace @spacebar/missing-routes` - passed.
- `npm run start --workspace @spacebar/missing-routes` - passed; reported `Spacebar is missing 817`, `Spacebar implements 363`, `Discord implements 1128`.
- `npm run generate:testing-manifest` - passed, wrote `468` entries.
- `node scripts/testing-manifest/verify.js` - passed.
- `npm run generate:contract-tests` and `node scripts/testing-manifest/generate-contract-tests.js --check` - passed, `443` contracts.
- `npm run generate:suite-coverage` and `node scripts/testing-manifest/generate-suite-coverage.js --check` - passed, `15` suites.
- `node --test test/generated/http-contracts.test.js test/generated/suite-coverage.test.js` - passed, `13` tests.
- `npm run generate:openapi` - passed, generated `287` paths and `725` schemas with only existing webhook route-metadata warnings.

## Risks and blockers

- Discord documents success as `204` with a `GAME_INVITE_DELETE` gateway event, but Spacebar lacks the durable invite model and gateway event support needed to safely perform that behavior.
- The implemented compatibility route intentionally returns a typed `501 APIErrorResponse` for valid Xbox OAuth requests until that backing exists.

## Recommended next tasks

- Design durable game-invite storage, expiry, ownership checks, and launch-token handling before changing this route to return `204`.
- Add `GAME_INVITE_CREATE`, `GAME_INVITE_DELETE`, and `GAME_INVITE_DELETE_MANY` gateway event support with tests before enabling successful game-invite mutations.

## Goal status evidence

- Initial `create_goal` objective: `implement the missing route path DELETE /game-invite/@me/{param} for the Spacebar server API.`
- Initial `get_goal` status: `active`
- Initial `get_goal` objective: `implement the missing route path DELETE /game-invite/@me/{param} for the Spacebar server API.`
