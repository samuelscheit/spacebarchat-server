<!--
	Spacebar: A FOSS re-implementation and extension of the Discord.com backend.
	Copyright (C) 2026 Spacebar and Spacebar Contributors

	This program is free software: you can redistribute it and/or modify
	it under the terms of the GNU Affero General Public License as published
	by the Free Software Foundation, either version 3 of the License, or
	(at your option) any later version.

	This program is distributed in the hope that it will be useful,
	but WITHOUT ANY WARRANTY; without even the implied warranty of
	MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
	GNU Affero General Public License for more details.

	You should have received a copy of the GNU Affero General Public License
	along with this program.  If not, see <https://www.gnu.org/licenses/>.
-->

# users-me-devices-sync-token-get-2

## Goal Evidence

- `create_goal`: created active goal for production-ready support of `GET /users/@me/devices/sync-token`.
- `get_goal`: status `active`; objective matched the assigned route implementation objective.
- `update_goal`: status `complete`; final tool usage was 589 seconds and 813454 tokens.

## Assignment

- Assigned path: `/users/@me/devices/sync-token`.
- Missing methods found: `GET`.
- Missing route name found: `GET_USERS__ME_DEVICES_SYNC_TOKEN`.
- Methods implemented: `GET`.
- Out-of-scope adjacent paths: `/users/@me/devices`, `/users/@me/devices/sync`, notification-center routes, user-settings routes, console-device routes.

## Evidence Gathered

- `packages/missing-routes/missing.json` had exactly one owned `missing_entries[]` item for `/users/@me/devices/sync-token`.
- `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json` and `src/api/routes/**` had no source route for the assigned path before implementation.
- Local Userdoccers catalog listed `GET /users/@me/devices/sync-token`, source `userdoccers:topics/push-notifications.mdx`, summary `Get Device Sync Token`.
- Local xHyroM catalog listed `GET`, `HEAD`, and `OPTIONS` for `/users/@me/devices/sync-token`; `HEAD` and `OPTIONS` are ignored methods in the missing-route report.
- `packages/automatic-reverse-engineering/data/catalogs/source-refs.json` records `userdoccers_commit` `259d8f8cf97ff357c4d1255afdf30e2e05672742` and `xhyrom_routes_commit` `0d792408fc6f5f67140fe1b4cad48b386ae1fd44`.
- Userdoccers pinned source `pages/topics/push-notifications.mdx` documents authenticated push notification usage and a `200` response body containing `token: string`.
- Prior read-only attempt `5afeda097` was inspected for reference only; the implementation was adapted to the current base and current test layout.

## Behavior

- Auth mode: bearer-authenticated by default; the route is not in no-auth routes.
- Response schema: `DeviceSyncTokenResponse`, an object with required `token: string`.
- Error semantics: explicit `401: { body: "APIErrorResponse" }` route metadata; no request body validation or new `400` path.
- Data source: no database writes. Spacebar has no durable push-device registration or cross-account sync state for this path.
- Token behavior: returns a scoped ES512-signed JWT with `typ: "push_sync"`, `sub`, `iat`, `exp`, `kid`, `ver`, and optional `did` session id. TTL is 15 minutes. This avoids minting a normal user auth token or fabricating push-device sync state.

## Changed Files

- `src/api/routes/users/@me/devices/sync-token.ts`
- `src/schemas/responses/DeviceSyncTokenResponse.ts`
- `src/schemas/responses/index.ts`
- `test/routes/usersMeDevicesRoute.test.ts`
- `assets/schemas.json`
- `assets/openapi.json`
- `assets/testing-manifest.json`
- `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`
- `packages/missing-routes/missing.json`
- `test/generated/http-contracts.json`
- `test/generated/suite-coverage.json`
- `worker-progress/users-me-devices-sync-token-get-2.md`

## Verification

- Worker-base verification passed: source build, schema generation, test fixture build, ARE build and source catalog import, missing-route regeneration, testing manifest verification, generated contract regeneration/checks, generated suite coverage regeneration/checks, generated contract/suite tests 13/13, OpenAPI generation, focused compiled route tests 12/12, `git diff --check`, package manifest/lockfile guard, ignored `node_modules` check, and changed-file malformed warranty-string scan.
- Current-base orchestrator verification passed:
  - `npm run build:src:tsgo`
  - `npm run generate:schema` (`845` schemas)
  - `npm run build:test-fixtures`
  - `npm run build --workspace @spacebar/automatic-reverse-engineering`
  - `node packages/automatic-reverse-engineering/dist/cli.js import-source-routes --root src/api/routes --out packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`
  - `npm run build --workspace @spacebar/missing-routes`
  - `npm run start --workspace @spacebar/missing-routes` (`745` missing, `435` implemented, `1128` Discord)
  - `npm run generate:testing-manifest` (`540` entries)
  - `node scripts/testing-manifest/verify.js`
  - `npm run generate:contract-tests`; `node scripts/testing-manifest/generate-contract-tests.js --check` (`515` contracts)
  - `npm run generate:suite-coverage`; `node scripts/testing-manifest/generate-suite-coverage.js --check`
  - `npm run generate:openapi` (`344` paths, `845` schemas)
  - `node -r dotenv/config -r module-alias/register --enable-source-maps --test dist-test/test/routes/usersMeDevicesRoute.test.js` (`12/12`)
  - `node --test test/generated/http-contracts.test.js test/generated/suite-coverage.test.js` (`13/13`)

## Missing-Route Count Movement

- Worker-base movement: `748 -> 747`; implemented count `432 -> 433`.
- Current-base movement after later merges: `746 -> 745`; implemented count `434 -> 435`.

## Risks And Blockers

- Spacebar still lacks durable push-device registration and multi-account device sync persistence. This route intentionally returns the source-documented token envelope only.
- Future `/users/@me/devices/sync` support must validate `typ: "push_sync"` scoped tokens explicitly and must not treat them as normal auth tokens.

## Recommended Next Tasks

- Implement `/users/@me/devices` registration and durable push-token storage under a separate assignment.
- Implement `/users/@me/devices/sync` under a separate assignment and validate scoped device-sync tokens there.
