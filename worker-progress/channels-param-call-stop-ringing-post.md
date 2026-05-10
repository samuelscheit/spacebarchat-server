# channels-param-call-stop-ringing-post

## Summary

Accepted and ported the worker implementation for `POST /channels/{param}/call/stop-ringing` onto the current main server checkout as `POST /channels/:channel_id/call/stop-ringing`.

The route is authenticated, private-channel scoped, reuses the existing call eligibility checks, validates optional nullable `recipients`, and stays conservative where Spacebar lacks Discord call state:

- Returns `204` when there is no active private call.
- Defaults omitted recipients to the current user.
- Returns `204` when an explicit recipient list targets no recipients.
- Returns `501` for active-call stop-ringing because Spacebar has no durable ringing state or production `CALL_UPDATE` gateway support.

## Worker Evidence

- Worker session: `spacebar-current-channels-param-call-stop-ringing-post`
- Worker pane state: `Goal achieved`
- Worker goal objective: `implement the missing route path \`POST /channels/{param}/call/stop-ringing\` for the Spacebar server API.`
- Worker final report path: `/Users/user/Developer/Developer/spacebarchat/worktrees/current-channels-param-call-stop-ringing-post/worker-progress/channels-param-call-stop-ringing-post.md`
- Worker report documented Userdoccers `resources/channel.mdx`, local Userdoccers/xHyroM route catalogs, missing-method evidence, verification commands, and risks.

## Current-Base Changes

- `src/api/routes/channels/#channel_id/call.ts`
- `src/api/routes/channels/#channel_id/call.test.ts`
- `src/schemas/uncategorised/ChannelCallStopRingingSchema.ts`
- `src/schemas/uncategorised/index.ts`
- `assets/schemas.json`
- `assets/openapi.json`
- `assets/testing-manifest.json`
- `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`
- `packages/missing-routes/missing.json`
- `test/generated/http-contracts.json`
- `test/generated/suite-coverage.json`
- `worker-progress/channels-param-call-stop-ringing-post.md`

## Current-Base Verification

- `npm run build:src:tsgo` - passed.
- `npm run generate:schema` - passed, wrote `745` schemas.
- `npm run build:test-fixtures` - passed.
- `node -r dotenv/config -r module-alias/register --enable-source-maps --test 'dist-test/src/api/routes/channels/#channel_id/call.test.js'` - passed, `28` tests.
- `npm run build --workspace @spacebar/automatic-reverse-engineering` - passed.
- `node packages/automatic-reverse-engineering/dist/cli.js import-source-routes --root src/api/routes --out packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json` - passed.
- `npm run build --workspace @spacebar/missing-routes` - passed.
- `npm run start --workspace @spacebar/missing-routes` - passed, reported `Spacebar is missing 799`, `Spacebar implements 381`, `Discord implements 1128`.
- `npm run generate:testing-manifest` - passed, wrote `486` entries.
- `node scripts/testing-manifest/verify.js` - passed.
- `npm run generate:contract-tests` - passed, wrote `461` contracts.
- `node scripts/testing-manifest/generate-contract-tests.js --check` - passed.
- `npm run generate:suite-coverage` - passed, wrote `15` suites.
- `node scripts/testing-manifest/generate-suite-coverage.js --check` - passed.
- `node --test test/generated/http-contracts.test.js test/generated/suite-coverage.test.js` - passed, `13` tests.
- `npm run generate:openapi` - passed, generated `301` paths and `745` schemas; only the repository's existing webhook route metadata warnings appeared.

## Missing-Route Movement

- Current base before port: `missing = 800`, `spacebar = 380`.
- Current base after port: `missing = 799`, `spacebar = 381`.
- Assigned route is no longer present in `packages/missing-routes/missing.json`.

## Risks And Follow-Up

- Active-call stop-ringing is not fully Discord-compatible until Spacebar has durable call ringing state and `CALL_UPDATE` gateway dispatch.
- The fail-closed `501` behavior mirrors the adjacent call ring/modify conservative behavior rather than pretending to mutate unsupported state.
