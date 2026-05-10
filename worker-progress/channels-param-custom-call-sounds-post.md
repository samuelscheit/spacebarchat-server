# channels-param-custom-call-sounds-post

## Summary

Implemented `POST /channels/{param}/custom-call-sounds` as an authenticated private-call route. The route looks up the channel with recipients, enforces the same DM/GROUP_DM active-recipient eligibility used by the existing private-call routes, returns `204` when there is no active call to affect, and fails closed with `501` when an active call exists because Spacebar has no durable custom-call-sound state, source-backed request body semantics, or gateway event support for this feature.

## Assigned path

- Assigned path: `/channels/{param}/custom-call-sounds`
- Missing methods found: `POST`
- Source route name: `CUSTOM_CALL_SOUNDS`
- Source route: `/channels/{channel_id}/custom-call-sounds`
- Methods implemented: `POST`

## Changed files

- `src/api/routes/channels/#channel_id/custom-call-sounds.ts`: added route handler and response metadata.
- `src/api/routes/channels/#channel_id/custom-call-sounds.test.ts`: added focused compiled route tests.
- `src/api/util/handlers/ChannelPrivateCall.ts`: extracted reusable private-call eligibility helper.
- `src/api/routes/channels/#channel_id/call.ts`: switched existing call routes to the shared eligibility helper without changing call behavior.
- `tsconfig.test.json`: included the new route test in test fixture compilation.
- `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`: regenerated source route catalog.
- `packages/missing-routes/missing.json`: regenerated missing-route report.
- `assets/testing-manifest.json`: regenerated testing manifest.
- `test/generated/http-contracts.json`: regenerated generated HTTP contract matrix.
- `test/generated/suite-coverage.json`: regenerated generated suite coverage matrix.
- `assets/openapi.json`: regenerated OpenAPI.

## What changed

- Added bearer-authenticated route metadata with `204`, `400`, `401`, `403`, `404`, and `501` responses.
- Kept the route private-channel only: non-DM/GROUP_DM channels return Discord `50024`.
- Required the authenticated user to be an active recipient (`closed === false`), otherwise Discord `50013`.
- Counted active `VoiceState` rows for the target channel after eligibility checks.
- Returned `204` for no active call because there is no side effect to perform.
- Returned `501` for active calls rather than fabricating sound state, request schema fields, regions, ringing state, or gateway events.
- Did not add a request schema because no source-backed request body semantics were available for this xHyroM-only route.

## Missing-route count movement

- Before current-base regeneration: `missing = 771`, `spacebar = 409`.
- After current-base regeneration: `missing = 770`, `spacebar = 410`.
- `packages/missing-routes/missing.json` no longer contains any `missing_entries[]` item whose `route` is `/channels/{param}/custom-call-sounds`.

## Evidence gathered

- Confirmed assigned missing entry in `packages/missing-routes/missing.json` before implementation:
  - `POST /channels/{param}/custom-call-sounds`
  - `route_name: CUSTOM_CALL_SOUNDS`
  - `sources: ["xhyrom:data/client/routes.json"]`
- Confirmed the route was absent from `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json` and `src/api/routes/**` before implementation.
- xHyroM evidence used:
  - `packages/automatic-reverse-engineering/data/catalogs/routes.xhyrom.catalog.json` had `OPTIONS` and `POST` entries for `/channels/{channel_id}/custom-call-sounds` with route name `CUSTOM_CALL_SOUNDS`.
- Userdoccers evidence:
  - Local Userdoccers route catalog has adjacent call routes from `resources/channel.mdx` (`GET/PATCH /channels/{channel_id}/call`, `POST /call/ring`, `POST /call/stop-ringing`) but no `/custom-call-sounds` entry.
  - The assigned missing entry listed only xHyroM as a source, so no matching Userdoccers `resources/channel.mdx` evidence was used for request or response semantics.
- Existing private-call route evidence:
  - `src/api/routes/channels/#channel_id/call.ts` uses authenticated channel lookup with recipients, DM/GROUP_DM eligibility, active-recipient checks, and conservative `204`/`501` behavior for unsupported active-call mutations.
  - `src/api/routes/channels/#channel_id/call.test.ts` provided the focused compiled test harness pattern.

## Commands run

```bash
sed -n '1,240p' /Users/user/Developer/Developer/spacebarchat/WORKER_BRIEF.md
git status --short
find node_modules -maxdepth 0 -type l -print
rg -n 'custom-call-sounds|CUSTOM_CALL_SOUNDS|"route": "/channels/\{param\}/custom-call-sounds"' packages/missing-routes/missing.json packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json src/api/routes packages/automatic-reverse-engineering/data
rg --files src/api/routes/channels | sort
sed -n '4160,4205p' packages/missing-routes/missing.json
sed -n '1284,1308p' packages/automatic-reverse-engineering/data/catalogs/routes.xhyrom.catalog.json
sed -n '1,260p' src/api/routes/channels/#channel_id/call.ts
sed -n '1,760p' src/api/routes/channels/#channel_id/call.test.ts
rg -n --glob '!**/events.ndjson' --glob '!**/playwright-events.ndjson' --glob '!**/summary.json' 'custom[-_ ]call[-_ ]sounds|CUSTOM_CALL_SOUNDS|customCallSounds|call sound|call_sound|sound_id|soundId' packages/automatic-reverse-engineering/data src packages assets testing
jq '.missing_entries | length' packages/missing-routes/missing.json
if [ -L node_modules ]; then unlink node_modules; fi
if [ ! -d node_modules ]; then npm ci; fi
npm run build:src:tsgo
npm run build:test-fixtures
node -r dotenv/config -r module-alias/register --enable-source-maps --test 'dist-test/src/api/routes/channels/#channel_id/call.test.js' 'dist-test/src/api/routes/channels/#channel_id/custom-call-sounds.test.js'
npm run build --workspace @spacebar/automatic-reverse-engineering
node packages/automatic-reverse-engineering/dist/cli.js import-source-routes --root src/api/routes --out packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json
npm run build --workspace @spacebar/missing-routes
npm run start --workspace @spacebar/missing-routes
npm run generate:schema
npm run generate:testing-manifest
node scripts/testing-manifest/verify.js
node scripts/testing-manifest/generate-contract-tests.js --check
npm run generate:contract-tests
node scripts/testing-manifest/generate-contract-tests.js --check
node scripts/testing-manifest/generate-suite-coverage.js --check
node scripts/testing-manifest/generate-suite-coverage.js
node scripts/testing-manifest/generate-suite-coverage.js --check
npm run generate:openapi
git diff --check
files=$( { git diff --name-only; git ls-files --others --exclude-standard; } | rg '^(src|test|packages|assets|scripts|testing|tsconfig\.test\.json|worker-progress)' || true )
if [ -n "$files" ]; then printf '%s\n' "$files" | xargs rg -n '<malformed AGPL warranty token pattern from worker brief>' || true; fi
node scripts/testing-manifest/verify.js
node scripts/testing-manifest/generate-contract-tests.js --check
node scripts/testing-manifest/generate-suite-coverage.js --check
```

## Verification results

- `npm run build:src:tsgo`: passed after restoring the existing `DiscordApiErrors` import in `call.ts`.
- `npm run build:test-fixtures`: passed.
- Focused compiled tests: passed, 33 tests across existing call and new custom-call-sounds route.
- `npm run build --workspace @spacebar/automatic-reverse-engineering`: passed.
- Source route import: passed and added `/channels/{channel_id}/custom-call-sounds`.
- `npm run build --workspace @spacebar/missing-routes`: passed.
- `npm run start --workspace @spacebar/missing-routes`: passed, wrote `missing = 770` and `spacebar = 410`.
- `npm run generate:schema`: passed; no schema file diff remained.
- `npm run generate:testing-manifest`: passed.
- `node scripts/testing-manifest/verify.js`: passed, 515 entries.
- Generated HTTP contracts: regenerated, then `--check` passed with 490 contracts.
- Generated suite coverage: regenerated, then `--check` passed.
- `npm run generate:openapi`: passed, 327 paths and 815 schemas.
- `git diff --check`: passed.
- Malformed AGPL warranty token scan: passed.

## Risks or blockers

- Request body shape and successful active-call side effects are not source-backed. The route intentionally has no request schema and returns `501` for active calls instead of inventing custom sound semantics.
- Spacebar currently lacks custom-call-sound persistence and gateway event behavior. Implementing real sound delivery should wait for source evidence or a designed call-event abstraction.
- No blocker remains for this assigned route; the missing entry is removed.

## Recommended next tasks

- Reverse-engineer the actual Discord request body and gateway side effects for custom call sounds if clients need full support.
- Add a durable call event or transient gateway notification abstraction before changing the active-call `501` behavior.
- Keep adjacent missing call routes, soundboard routes, and voice-state routes assigned separately; they were not implemented here.

## Goal status evidence

- `create_goal` was called before file reads or commands with objective: `implement the missing route path POST /channels/{param}/custom-call-sounds for the Spacebar server API`.
- `get_goal` after creation reported status `active` with the same objective.
- `get_goal` before this report reported status `active`, objective `implement the missing route path POST /channels/{param}/custom-call-sounds for the Spacebar server API`, thread `019e1260-8ab1-7903-b52e-058058484337`.
- `update_goal(status: "complete")` reported status `complete` for the same objective, thread `019e1260-8ab1-7903-b52e-058058484337`.
- Goal completion budget report: `Goal achieved. Report final budget usage to the user: time used: 598 seconds.`
