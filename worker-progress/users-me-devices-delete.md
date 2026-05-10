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

# Worker Progress: users-me-devices-delete

## Goal Evidence

- Worker `create_goal`: status `active`; objective `Implement production-ready support for the missing route path DELETE /users/@me/devices on the current integration branch, with focused tests, regenerated route catalogs and generated route artifacts, verification evidence, and a complete handoff report.`
- Worker `get_goal`: status `active`; same objective confirmed before implementation.
- Worker final `update_goal(status: "complete")`: status `complete`; tokens used `252309`; time used `527` seconds.

## Scope

- Assigned path: `/users/@me/devices`.
- Missing methods found: `DELETE` only.
- Methods implemented: `DELETE`.
- Out of scope and intentionally unchanged: `/users/@me/devices/sync`, `/users/@me/devices/sync-token`, notification-center routes, user-settings routes, and console-device routes.

## Evidence

- `packages/missing-routes/missing.json` had exactly one owned missing entry on the worker base: `DELETE_USERS__ME_DEVICES`, with sources `userdoccers:topics/push-notifications.mdx` and `xhyrom:data/client/routes.json`.
- Current-base pre-port check still showed `DELETE /users/@me/devices` as missing after `GET /oauth2/keys` was merged.
- `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json` had `POST /users/@me/devices` only; after regeneration it has `DELETE_USERS__ME_DEVICES` with `request_schema_ref: PushNotificationDeviceUnregisterSchema`.
- Userdoccers raw source: https://raw.githubusercontent.com/discord-userdoccers/discord-userdoccers/master/pages/topics/push-notifications.mdx. It documents authenticated mobile push notification registration, unregistering with JSON `provider` and `token`, and a `204` empty success response.
- xHyroM raw source: https://raw.githubusercontent.com/xHyroM/discord-datamining/master/data/client/routes.json. Entry `DEVICES` maps to `/users/@me/devices` and allows `DELETE`, `OPTIONS`, and `POST`.

## Behavior

- Auth mode: bearer-authenticated; route is not in `NO_AUTHORIZATION_ROUTES`.
- Request schema: `PushNotificationDeviceUnregisterSchema` requires `provider` and non-empty `token`. `provider` is limited to the documented push providers: `gcm`, `apns`, `apns_internal`, `apns_voip`, `apns_internal_voip`.
- Response schema: `204` empty body on success; `400` and `401` document `APIErrorResponse`.
- Data source and persistence: Spacebar does not currently persist Discord push-device registrations. The route validates the documented unregister payload and acknowledges removal without fabricating storage state.
- Error semantics: malformed bodies fail schema validation with Discord-style invalid form body response; missing auth remains handled by the normal bearer auth middleware.

## Changed Files

- `src/api/routes/users/@me/devices.ts`
- `src/schemas/uncategorised/PushNotificationDeviceUnregisterSchema.ts`
- `src/schemas/uncategorised/index.ts`
- `test/routes/usersMeDevicesRoute.test.ts`
- `assets/schemas.json`
- `assets/openapi.json`
- `assets/testing-manifest.json`
- `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`
- `packages/missing-routes/missing.json`
- `test/generated/http-contracts.json`
- `test/generated/suite-coverage.json`
- `worker-progress/users-me-devices-delete.md`

## Verification

- Worker verification on old base passed: source build, schema generation, OpenAPI generation, test fixture build, focused route/schema test 5/5, source catalog import, missing-route regeneration, testing manifest checks, generated contract/suite checks and tests, diff checks, package manifest/lockfile cleanliness, and malformed warranty-string scan.
- Current-base `npm run build:src:tsgo`: passed.
- Current-base `npm run generate:schema`: passed and wrote 833 schemas.
- Current-base `npm run build:test-fixtures`: passed after generated artifact refresh.
- Current-base focused compiled test `dist-test/test/routes/usersMeDevicesRoute.test.js`: passed, 5/5.
- Current-base automatic reverse engineering build and source route import: passed.
- Current-base missing-routes build/start: passed, `749 -> 748` missing and `431 -> 432` implemented.
- Current-base testing manifest generation/verification: passed with 537 entries.
- Current-base contract generation/check: passed with 512 contracts.
- Current-base suite coverage generation/check: passed with 15 suites.
- Current-base generated contract/suite tests: passed, 13/13.
- Current-base OpenAPI generation: passed with 341 paths and 833 schemas; existing webhook metadata warnings only.
- Current-base `git diff --check`: passed.
- Current-base package manifest/lockfile cleanliness check: passed.
- Current-base malformed warranty-string scan: passed.

## Missing-Route Movement

- Worker-base movement: `750 -> 749`; implemented count `430 -> 431`.
- Current-base movement after `GET /oauth2/keys` merge: `749 -> 748`; implemented count `431 -> 432`.
- Adjacent `/users/@me/devices/sync` and `/users/@me/devices/sync-token` remain missing and out of scope.

## Risks And Next Tasks

- Risk: this is a compatibility no-op for storage because durable push-device registration storage does not exist yet.
- Risk: existing `POST /users/@me/devices` remains a pre-existing TODO/no-op and was not changed to avoid widening scope.
- Recommended next task: implement a durable push-device registration model and then update POST/DELETE to create and remove rows transactionally.
- Recommended next task: separately implement `/users/@me/devices/sync` and `/users/@me/devices/sync-token` when assigned.
