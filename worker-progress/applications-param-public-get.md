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

# /applications/{param}/public GET

## Goal Evidence

- `create_goal` objective: Implement production-ready support for the assigned missing route path `/applications/{param}/public` on the current-base worker branch, with focused tests, regenerated route catalogs and generated route artifacts, verification evidence, and a complete handoff report.
- `get_goal` immediately after setup: status `active`, objective matched the assigned worker objective.
- `get_goal` before handoff report: status `active`, same objective, tokens used `276387`, time used `891s`.

## Assigned Scope

- Assigned missing route path: `/applications/{param}/public`.
- Missing methods found for the assigned route: `GET /applications/{application_id}/public`.
- Route name: `GET_APPLICATIONS_APPLICATION_ID_PUBLIC`.
- Implemented methods: `GET /applications/:application_id/public/`.
- Adjacent application owner mutation, bot management, store layout, emoji, entitlement, command, and plural public application routes were not changed.

## Source Evidence

- `packages/missing-routes/missing.json` identified one missing entry for `/applications/{param}/public`, sourced from `userdoccers:resources/application.mdx` and `xhyrom:data/client/routes.json`.
- `packages/automatic-reverse-engineering/data/catalogs/routes.userdoccers.catalog.json` records `GET /applications/{application_id}/public` with summary `Get Partial Application`.
- `packages/automatic-reverse-engineering/data/catalogs/routes.xhyrom.catalog.json` records `GET /applications/{application_id}/public` under `APPLICATION_PUBLIC`.
- Userdoccers application docs at `https://raw.githubusercontent.com/discord-userdoccers/discord-userdoccers/master/pages/resources/application.mdx` describe the endpoint as returning public partial application fields and document the optional `with_guild` query flag.

## Behavior Summary

- Added a bearer-authenticated route at `src/api/routes/applications/#application_id/public.ts`.
- The route returns a constrained `PublicApplicationResponse` instead of serializing the full `Application` entity.
- Public serialization includes local public application fields such as `id`, `name`, `description`, `icon`, `type`, `flags`, `verify_key`, integration flags, bot install flags when a bot exists, partial bot user data, install params, policy URLs, tags, cover image, and custom install URL when persisted.
- The serializer omits owner, team, redirect URI, and other private/developer-only entity state.
- `with_guild=true` or `with_guild=1` loads the linked guild relation and includes `guild` only when the guild has the discoverable feature; otherwise only `guild_id` is retained.
- Unknown application IDs return `DiscordApiErrors.UNKNOWN_APPLICATION` with HTTP 404.
- Route metadata declares `200 PublicApplicationResponse`, `401 APIErrorResponse`, and `404 APIErrorResponse`.

## Changed Files

- `src/api/routes/applications/#application_id/public.ts`
- `src/schemas/responses/PublicApplicationResponse.ts`
- `src/schemas/responses/index.ts`
- `test/routes/applications-public.test.ts`
- `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`
- `packages/missing-routes/missing.json`
- `assets/schemas.json`
- `assets/testing-manifest.json`
- `assets/openapi.json`
- `test/generated/http-contracts.json`
- `test/generated/suite-coverage.json`

## Generated Evidence

- Source catalog now contains `GET /applications/{application_id}/public` from `src/api/routes/applications/#application_id/public.ts` with response schemas `APIErrorResponse` and `PublicApplicationResponse`.
- Testing manifest now contains `api:http:GET:/applications/:application_id/public/`, auth mode `bearer`, response statuses `200`, `401`, and `404`, and `hasQuery: true`.
- OpenAPI now contains `/applications/{application_id}/public/` with `with_guild` query documentation and bearer security.
- Generated HTTP contracts now include the new route; current-base contract count is `465`.
- Testing manifest entry count is `490`.

## Missing-Route Count Movement

- Before regeneration at current base `501a6270d`: `missing_entries` length `796`.
- After regeneration: `missing_entries` length `795`.
- `packages/missing-routes/missing.json` no longer contains `/applications/{param}/public`.
- CLI output after regeneration: `Spacebar is missing 795`, `Spacebar implements 385`, `Discord implements 1128`.

## Commands Run

- `npm run build:src:tsgo` passed.
- `npm run build:test-fixtures` passed.
- `node -r dotenv/config -r module-alias/register --enable-source-maps --test dist-test/test/routes/applications-public.test.js` passed: 7 tests.
- `npm run build --workspace @spacebar/automatic-reverse-engineering` passed.
- `node packages/automatic-reverse-engineering/dist/cli.js import-source-routes --root src/api/routes --out packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json` passed.
- `npm run build --workspace @spacebar/missing-routes` passed.
- `npm run start --workspace @spacebar/missing-routes` passed and wrote `packages/missing-routes/missing.json`.
- `npm run generate:schema` passed and wrote `748` schemas.
- `npm run generate:testing-manifest` passed and wrote `490` entries.
- `node scripts/testing-manifest/verify.js` passed.
- `npm run generate:contract-tests` passed and wrote `465` contracts.
- `node scripts/testing-manifest/generate-contract-tests.js --check` passed.
- `npm run generate:suite-coverage` passed and wrote `15` suites.
- `node scripts/testing-manifest/generate-suite-coverage.js --check` passed.
- `npm run generate:openapi` passed and wrote `305` paths / `748` schemas; existing webhook route metadata warnings remained.
- `node --test test/generated/http-contracts.test.js test/generated/suite-coverage.test.js` passed: 13 tests.
- `git diff --check` passed.
- `git diff -- package.json package-lock.json npm-shrinkwrap.json --exit-code` passed.
- Changed-file warranty spelling scan over changed and untracked files printed no output.

## Risks And Blockers

- No blockers.
- The response is intentionally limited to fields available in local application persistence. Discord fields without local persistence, such as storefront or directory-only values, are not fabricated.
- `with_guild` only returns a guild object for a locally linked guild with the discoverable feature; this follows the source constraint without widening guild discovery behavior.

## Recommended Next Tasks

- Assign remaining adjacent application routes separately, especially plural `/applications/public` and other public/store/discovery application routes, because they need distinct request semantics and should not be folded into this route.
