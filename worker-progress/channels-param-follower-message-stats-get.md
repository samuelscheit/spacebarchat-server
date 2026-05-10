# channels-param-follower-message-stats-get

## Summary

Implemented `GET /channels/{channel_id}/follower-message-stats` as an authenticated channel route.
The route requires `VIEW_CHANNEL`, validates that the source channel is a guild announcement/news channel using the existing follower stats guard, and returns a conservative typed empty list because Spacebar does not persist Discord follower message-delivery analytics yet.

## Changed Files

- `src/api/routes/channels/#channel_id/follower-message-stats.ts`
- `src/api/routes/channels/#channel_id/follower-message-stats.test.ts`
- `src/api/util/utility/ChannelFollowers.ts`
- `src/api/util/utility/ChannelFollowers.test.ts`
- `src/schemas/responses/ChannelFollowerMessageStatsResponse.ts`
- `src/schemas/responses/index.ts`
- `tsconfig.test.json`
- `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`
- `packages/missing-routes/missing.json`
- `assets/schemas.json`
- `assets/testing-manifest.json`
- `assets/openapi.json`
- `test/generated/http-contracts.json`
- `test/generated/suite-coverage.json`

## Commands Run

- `sed -n '1,240p' /Users/user/Developer/Developer/spacebarchat/WORKER_BRIEF.md`
- `rg -n 'follower-message-stats|CHANNEL_FOLLOWER_MESSAGE_STATS|/channels/\{param\}/follower-message-stats' packages/missing-routes/missing.json packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json src/api/routes`
- `rg --files src/api/routes | rg 'channels|followers|webhooks|announcements|messages'`
- `sed -n '1700,1765p' packages/missing-routes/missing.json`
- `sed -n '1418,1465p' packages/automatic-reverse-engineering/data/catalogs/routes.xhyrom.catalog.json`
- `curl -L --fail --silent https://raw.githubusercontent.com/discord-userdoccers/discord-userdoccers/master/pages/resources/channel.mdx | rg -n -C 3 'Followed Channel|followers|follower-stats|follower-message-stats|announcement|Announcement|CHANNEL_FOLLOWER'`
- `curl -L --fail --silent https://raw.githubusercontent.com/discord-userdoccers/discord-userdoccers/master/pages/resources/message.mdx | rg -n -C 3 'publish|Publish|crosspost|follower|announcement|message stats|stats'`
- `curl -L --fail --silent https://raw.githubusercontent.com/discord-userdoccers/discord-userdoccers/master/pages/resources/webhook.mdx` checks via web/open and local search
- Discord client asset search for `follower-message-stats` and `CHANNEL_FOLLOWER_MESSAGE_STATS`
- `npm ci`
- `npm run build:src:tsgo`
- `npm run build:test-fixtures`
- `node -r dotenv/config -r module-alias/register --enable-source-maps --test dist-test/src/api/util/utility/ChannelFollowers.test.js dist-test/src/api/routes/channels/#channel_id/follower-message-stats.test.js`
- `npm run build --workspace @spacebar/automatic-reverse-engineering`
- `node packages/automatic-reverse-engineering/dist/cli.js import-source-routes --root src/api/routes --out packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`
- `npm run build --workspace @spacebar/missing-routes`
- `npm run start --workspace @spacebar/missing-routes`
- `npm run generate:schema`
- `npm run generate:testing-manifest`
- `node scripts/testing-manifest/generate-contract-tests.js`
- `node scripts/testing-manifest/generate-suite-coverage.js`
- `node scripts/testing-manifest/verify.js`
- `node scripts/testing-manifest/generate-contract-tests.js --check`
- `node scripts/testing-manifest/generate-suite-coverage.js --check`
- `npm run generate:openapi`
- `git diff --check`
- Malformed warranty scan over changed source, generated, and worker-progress files.

## Evidence Gathered

- `packages/missing-routes/missing.json` initially contained one assigned missing entry:
  `GET /channels/{param}/follower-message-stats`, route name `CHANNEL_FOLLOWER_MESSAGE_STATS`, source `xhyrom:data/client/routes.json`.
- `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json` initially had no `follower-message-stats` route and now contains `GET /channels/{channel_id}/follower-message-stats` from `src/api/routes/channels/#channel_id/follower-message-stats.ts`.
- `src/api/routes/**` initially had adjacent `follower-stats.ts` and `followers.ts`, but no `follower-message-stats.ts`.
- Local xHyroM catalog reference: `packages/automatic-reverse-engineering/data/catalogs/routes.xhyrom.catalog.json` lists `GET`, `HEAD`, and `OPTIONS` for `/channels/{channel_id}/follower-message-stats`; the assigned missing report owned only `GET`.
- Upstream Userdoccers channel reference: `https://raw.githubusercontent.com/discord-userdoccers/discord-userdoccers/master/pages/resources/channel.mdx` documents `POST /channels/{channel.id}/followers`, announcement/news channels, and followed channel response, but has no `follower-message-stats` route.
- Upstream Userdoccers webhook reference: `https://raw.githubusercontent.com/discord-userdoccers/discord-userdoccers/master/pages/resources/webhook.mdx` documents `CHANNEL_FOLLOWER` webhooks as internal webhooks used to post new messages into followed channels.
- Upstream Userdoccers message reference: `https://raw.githubusercontent.com/discord-userdoccers/discord-userdoccers/master/pages/resources/message.mdx` documents crosspost/channel following message flags, but no exact follower message stats response.
- Current Discord client asset and public endpoint-list evidence only confirmed the route constant/path, not a response schema or client consumer.

## Assigned Path

- Assigned route path: `/channels/{channel_id}/follower-message-stats`
- Assigned missing route value: `/channels/{param}/follower-message-stats`

## Missing Methods Found

- `GET /channels/{param}/follower-message-stats`

## Methods Implemented

- `GET /channels/:channel_id/follower-message-stats/`

## What Changed

- Added the route with `route({ permission: "VIEW_CHANNEL" })`.
- Added response metadata for `200`, `400`, `401`, `403`, and `404`.
- Added `ChannelFollowerMessageStatsResponse` as a typed array response schema.
- Added `createChannelFollowerMessageStatsResponse()` returning `[]` with a code comment documenting the missing analytics backing state.
- Added focused route metadata/behavior tests and a helper test.
- Regenerated route source catalog, missing-route report, schemas, testing manifest, generated HTTP contracts, suite coverage, and OpenAPI.

## Missing-Route Count Movement

- Before regeneration: `missing: 842`, `spacebar: 338`, `discord: 1128`.
- After regeneration: `missing: 841`, `spacebar: 339`, `discord: 1128`.
- The assigned `/channels/{param}/follower-message-stats` route was removed from `missing_entries[]` and the top-level route list.

## Verification Results

- `npm run build:src:tsgo`: passed.
- `npm run build:test-fixtures`: passed.
- Focused compiled tests: passed, 15 tests.
- `npm run build --workspace @spacebar/automatic-reverse-engineering`: passed.
- Source route catalog import: passed.
- `npm run build --workspace @spacebar/missing-routes`: passed.
- `npm run start --workspace @spacebar/missing-routes`: passed and wrote updated report.
- `npm run generate:schema`: passed.
- `npm run generate:testing-manifest`: passed, 444 entries.
- Generated HTTP contracts: wrote 419 contracts; `--check` passed.
- Generated suite coverage: wrote 14 suites; `--check` passed.
- `node scripts/testing-manifest/verify.js`: passed.
- `npm run generate:openapi`: passed, 264 paths and 677 schemas.
- `git diff --check`: passed.
- Malformed warranty scan over changed relevant files: no matches.

## Risks Or Blockers

- Exact Discord response body for `GET /channels/{channel_id}/follower-message-stats` was not found in Userdoccers, the local xHyroM route catalog, or current client source usage.
- Spacebar currently marks source messages as crossposted but does not persist follower delivery/message analytics, so the route returns an empty list rather than invented per-message counters.
- If future evidence identifies Discord's exact response item shape, `ChannelFollowerMessageStatsResponse` should be tightened from `unknown[]` and backed by real analytics state.

## Recommended Next Tasks

- Add real follower delivery persistence when crossposting to follower webhooks is implemented.
- Capture source-backed response examples for `CHANNEL_FOLLOWER_MESSAGE_STATS` if a safe client trace becomes available.
- Tighten the response schema once exact per-message fields are known.

## Goal Status Evidence

- `create_goal` created objective: `implement the missing route path GET /channels/{channel_id}/follower-message-stats for the Spacebar server API.`
- `get_goal` returned status `active` for that objective before implementation work and again before handoff report writing.
- `update_goal`: status `complete`, tokens used `277037`, time used `559` seconds.
