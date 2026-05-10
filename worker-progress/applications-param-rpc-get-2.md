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

# applications-param-rpc-get-2

## Goal Evidence
- create_goal: status active; objective: Implement production-ready support for the missing route path `GET /applications/{param}/rpc` on the current integration branch, with focused tests, regenerated route catalogs and generated route artifacts, verification evidence, and a complete handoff report.
- get_goal: status active; objective: Implement production-ready support for the missing route path `GET /applications/{param}/rpc` on the current integration branch, with focused tests, regenerated route catalogs and generated route artifacts, verification evidence, and a complete handoff report.
- update_goal: status complete; time used 847 seconds.

## Progress
- Initialized worker progress report before repository inspection.
- Read `/Users/user/Developer/Developer/spacebarchat/WORKER_BRIEF.md` and confirmed this worker owns only `/applications/{param}/rpc`.
- Missing report lookup found one owned method: `GET /applications/{param}/rpc` (`GET_APPLICATIONS_APPLICATION_ID_RPC`) from `userdoccers:resources/application.mdx`, source route `/applications/{application_id}/rpc`.
- Absence checks before implementation: no `GET /applications/{application_id}/rpc` source route existed in `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`; no `src/api/routes/applications/#application_id/rpc.ts` route existed in the applications route tree.
- Userdoccers source evidence: `pages/resources/application.mdx` marks `<RouteHeader method="GET" url="/applications/{application.id}/rpc" unauthenticated>` and describes the route as returning a partial application with RPC-related fields.
- Live unauthenticated Discord probe on 2026-05-10 for `/api/v10/applications/880218394199220334/rpc` returned HTTP 200 and a partial application payload containing public/RPC-safe fields including id, name, description, icon, summary, type, cover image, hook, bot public flags, policy URLs, install params, verify key, flags, and tags.

## Assigned Path
- Assigned path: `/applications/{param}/rpc`.
- Missing methods found: `GET`.
- Methods implemented: `GET`.
- Expected missing entry removed: `GET_APPLICATIONS_APPLICATION_ID_RPC`.
- Out of scope and not implemented: `/applications/{param}`, `/applications/{param}/public`, `/applications/{param}/can-delete`, `/applications/{param}/verification`, storefront/game/application-directory routes, and `/oauth2/applications/{param}/rpc`.

## Evidence
- `packages/missing-routes/missing.json` initially listed exactly one owned missing entry for `/applications/{param}/rpc`.
- `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json` now contains `GET /applications/{application_id}/rpc` sourced from `src/api/routes/applications/#application_id/rpc.ts`.
- `packages/automatic-reverse-engineering/data/catalogs/routes.userdoccers.catalog.json` contains `GET /applications/{application_id}/rpc` from `userdoccers:resources/application.mdx` with summary `Get RPC Application`.
- `packages/automatic-reverse-engineering/data/catalogs/routes.xhyrom.catalog.json` contains only adjacent `/oauth2/applications/{application_id}/rpc` entries for this RPC naming area; those were treated as out of scope.
- External docs used: `https://raw.githubusercontent.com/discord-userdoccers/discord-userdoccers/master/pages/resources/application.mdx`.
- Live unauthenticated probe used only public Discord API data to confirm auth mode and shape; no credentials were sent.

## Behavior
- Auth mode: public/unauthenticated. Added a no-auth middleware rule for exactly `GET`/`HEAD /applications/{application_id}/rpc`; OpenAPI and testing manifest classify the route as public.
- Response schema: `ApplicationRpcResponse`.
- Response projection: conservative partial application fields backed by Spacebar's `Application` entity: id, name, description, icon, summary, type, cover image, hook, bot public/code grant flags, policy URLs, install params, verify key, flags, and tags.
- Data source: `Application.getRepository().findOne` with a narrow `select` for the projection fields only.
- Error semantics: unknown or absent application throws `DiscordApiErrors.UNKNOWN_APPLICATION`, producing `404 APIErrorResponse`.
- Cache behavior: no local cache headers are set; source evidence did not require application-level caching.
- Omitted fields: owner, team, redirect URIs, interactions endpoint URL, custom install URL, integration flags, and derived monetization/discoverability booleans are not exposed unless Spacebar has source-backed route-specific persistence later.

## Changed Files
- `src/api/routes/applications/#application_id/rpc.ts`
- `src/schemas/responses/ApplicationRpcResponse.ts`
- `src/schemas/responses/index.ts`
- `src/api/middlewares/NoAuthorizationRoutes.ts`
- `test/routes/applications-rpc.test.ts`
- `test/scenarios/applications-commands.test.ts`
- `assets/schemas.json`
- `assets/openapi.json`
- `assets/testing-manifest.json`
- `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`
- `packages/automatic-reverse-engineering/data/catalogs/routes.catalog.json`
- `packages/missing-routes/missing.json`
- `test/generated/http-contracts.json`
- `test/generated/suite-coverage.json`
- `worker-progress/applications-param-rpc-get-2.md`

## Verification
- Orchestrator ported the scoped source, test, schema, no-auth, scenario, and report changes onto current master after `1d213dab9`; stale worker-generated `routes.catalog.json` was not ported.
- `npm run build:src:tsgo` passed.
- `npm run generate:schema` passed, wrote `865` schemas.
- `npm run build --workspace @spacebar/automatic-reverse-engineering` passed.
- `node packages/automatic-reverse-engineering/dist/cli.js import-source-routes --root src/api/routes --out packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json` passed.
- `npm run build --workspace @spacebar/missing-routes` passed.
- `npm run start --workspace @spacebar/missing-routes` passed; missing-route report moved `738 -> 737` and implemented routes moved `442 -> 443`.
- `npm run generate:testing-manifest` passed, wrote `548` entries.
- `node scripts/testing-manifest/verify.js` passed, verified `548` entries.
- `npm run generate:contract-tests` passed, wrote `523` contracts.
- `node scripts/testing-manifest/generate-contract-tests.js --check` passed.
- `npm run generate:suite-coverage` passed, wrote `15` suites.
- `node scripts/testing-manifest/generate-suite-coverage.js --check` passed.
- `npm run generate:openapi` passed, wrote `352` paths and `865` schemas; the existing unrelated webhook `route()` middleware warnings remain.
- `npm run build:test-fixtures` passed.
- `node -r dotenv/config -r module-alias/register --enable-source-maps --test dist-test/test/routes/applications-rpc.test.js` passed, 9/9 tests.
- `node -r dotenv/config -r module-alias/register --enable-source-maps --test dist-test/test/scenarios/applications-commands.test.js` passed with its single scenario skipped by existing environment gating.
- `node --test test/generated/http-contracts.test.js test/generated/suite-coverage.test.js` passed, 13/13 tests.
- `git diff --check` passed.
- Package manifest/lockfile cleanliness check passed; no dependency manifest changes.
- Changed-file malformed warranty-string scan passed.

## Missing-Route Count Movement
- Before current-base regeneration: missing `738`, Spacebar implemented `442`, Discord targets `1128`.
- After current-base regeneration: missing `737`, Spacebar implemented `443`, Discord targets `1128`.
- Owned entry count in `missing_entries[]` for `/applications/{param}/rpc`: `0`.

## Risks And Follow-Ups
- Spacebar does not currently persist every field Discord may return from the live RPC application payload, such as derived monetization/discoverability booleans or max participants. The route intentionally omits fields that are not locally source-backed.
- Recommended next task: implement adjacent `/oauth2/applications/{param}/rpc` separately if assigned; it appears only in the xHyroM catalog and may have different client/OAuth semantics.
