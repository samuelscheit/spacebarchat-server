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

# Worker Progress: activities-shelf-get-2

## Goal Evidence

- `create_goal`: status `active`; objective `Implement production-ready support for the missing route path `/activities/shelf` on the current integration branch, with focused tests, regenerated route catalogs and generated route artifacts, verification evidence, and a complete handoff report.`
- `get_goal`: status `active`; objective matched the assignment.
- `update_goal`: status `complete`; time used 706 seconds.

## Assignment

- Worker id: `activities-shelf-get-2`.
- Assigned path: `/activities/shelf`.
- Missing methods found: `GET`.
- Methods implemented: `GET`.
- Out of scope: `/activities`, `/activities/{application_id}/instances/{channel_id}`, `/activities/{param}/test-mode`, `/activities/statistics/applications/{param}`, `/applications/shelf`, embedded activity launch/join/leave flows.

## Evidence

- `packages/missing-routes/missing.json` at launch had one owned entry: `GET /activities/shelf`, route name `GET_ACTIVITIES_SHELF`, summary `Get Embedded Activities`, sources `userdoccers:resources/application.mdx` and `xhyrom:data/client/routes.json`.
- `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json` had no `GET /activities/shelf` entry before implementation.
- `src/api/routes/**` had adjacent activity routes only; no `/activities/shelf` implementation existed.
- Userdoccers `resources/application.mdx` documents `Get Embedded Activities` as returning available embedded activities globally or for optional `guild_id`, with response fields `activities`, `applications`, and `assets`: https://raw.githubusercontent.com/discord-userdoccers/discord-userdoccers/master/pages/resources/application.mdx
- xHyroM catalog lists `GET`, `HEAD`, and `OPTIONS` for `/activities/shelf`; the owned missing method was only `GET`.
- Local coverage for `GET /activities/shelf` observed authenticated Discord traffic with `guild_id` query, status `200`, and response shape keys `activities`, `applications`, and `assets`.
- Read-only prior attempt `a812951b6` was checked for context but not ported as-is because it fabricated shelf activity configs from application flags. This implementation avoids unsupported activity catalog data.

## Behavior

- Auth mode: bearer authenticated. Route metadata declares `401: { body: "APIErrorResponse" }`; route is not in no-auth classification.
- Query: optional `guild_id` metadata is documented as a string.
- Response: `ActivityShelfResponse` with `{ activities: [], applications: [], assets: {} }`.
- Data source: conservative empty local shelf because Spacebar does not currently persist Discord's embedded activity shelf config or application asset catalog. The route does not fabricate ranks, platform config, assets, or application shelf entries.
- Error semantics: unauthenticated requests are rejected by the existing authentication middleware with `401`; no route-specific `403` or `404` evidence was found for this endpoint.

## Changed Files

- `src/api/routes/activities/shelf.ts`
- `src/schemas/responses/ActivityShelfResponse.ts`
- `src/schemas/responses/index.ts`
- `test/routes/activities-shelf.test.ts`
- `assets/schemas.json`
- `assets/openapi.json`
- `assets/testing-manifest.json`
- `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`
- `packages/missing-routes/missing.json`
- `test/generated/http-contracts.json`
- `worker-progress/activities-shelf-get-2.md`

## Verification

- Worker-base verification passed: source build, schema generation, test fixture build, focused compiled route tests 5/5, ARE build and source catalog import, missing-route regeneration, testing manifest verification, generated contract regeneration/checks, generated suite coverage checks, generated contract/suite tests 13/13, OpenAPI generation, `git diff --check`, package manifest/lockfile guard, and malformed warranty-string scan.
- Current-base orchestrator verification passed:
  - `npm run build:src:tsgo`
  - `npm run generate:schema` (`844` schemas)
  - `npm run build:test-fixtures`
  - `npm run build --workspace @spacebar/automatic-reverse-engineering`
  - `node packages/automatic-reverse-engineering/dist/cli.js import-source-routes --root src/api/routes --out packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`
  - `npm run build --workspace @spacebar/missing-routes`
  - `npm run start --workspace @spacebar/missing-routes` (`746` missing, `434` implemented, `1128` Discord)
  - `npm run generate:testing-manifest` (`539` entries)
  - `node scripts/testing-manifest/verify.js`
  - `npm run generate:contract-tests`; `node scripts/testing-manifest/generate-contract-tests.js --check` (`514` contracts)
  - `node scripts/testing-manifest/generate-suite-coverage.js --check`
  - `npm run generate:openapi` (`343` paths, `844` schemas)
  - rerun `npm run build:test-fixtures`
  - `node -r dotenv/config -r module-alias/register --enable-source-maps --test dist-test/test/routes/activities-shelf.test.js` (`5/5`)
  - `node --test test/generated/http-contracts.test.js test/generated/suite-coverage.test.js` (`13/13`)

## Missing Route Count Movement

- Worker-base movement: `761 -> 760`.
- Current-base movement after later merges: `747 -> 746`; implemented count `433 -> 434`.

## Risks And Follow-Up

- Risk: The endpoint returns an empty shelf until Spacebar gains a real persisted embedded activity catalog and application asset catalog. This is intentional to avoid fabricating unsupported Discord activity data.
- Risk: The optional `guild_id` is documented and accepted for compatibility, but it does not currently filter any local catalog data because there is no catalog.
- Recommended next task: design persistent embedded activity config and application asset storage before returning non-empty shelf entries.
