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

# Worker Progress: discovery-search-get

## Summary

Integrated the assigned public `GET /discovery/search` route on the current base `9d38b2f01`. The route searches local published discoverable guilds and returns an Algolia-style `DiscoverySearchResponse` envelope with `hits`, `nbHits`, pagination fields, `params`, timing fields, `aggregateFacets`, and `totalNbHits`.

The managed worker was based on older commit `ec90108a8`, so source/test/schema/report changes were ported onto `9d38b2f01` and all generated artifacts were regenerated from this checkout.

## Scope

- Assigned path: `/discovery/search`.
- Missing methods found on current base: `GET`, route name `GET_DISCOVERY_SEARCH`.
- Methods implemented: `GET /discovery/search`.
- Source: `userdoccers:resources/discovery.mdx`.
- Summary: `Search Published Guilds`.
- Adjacent routes intentionally not implemented: `/discovery/{param}`, `/discovery/valid-term`, discovery categories/subcategories, `/discoverable-guilds/search`, and guild discovery metadata routes.

## Behavior

- Auth mode: public/unauthenticated. `GET` and inherited `HEAD` matching are allowed through `NoAuthorizationRoutes`; adjacent `/discovery/categories` and `/discovery/valid-term` remain authenticated.
- Query params:
    - `query` is optional and defaults to `""`.
    - `limit` defaults to `48` and must be `1..48`.
    - `offset` defaults to `0` and must be `0..2999`.
- Search filters:
    - `features` contains `DISCOVERABLE`.
    - `discovery_excluded = false`.
    - `member_count > 0`.
    - `presence_count > 0`.
- Text search matches `name` or `description` using escaped case-insensitive SQL `LIKE`.
- Ordering is deterministic: `discovery_weight DESC`, `member_count DESC`, `id ASC`.
- Response maps Spacebar guild/category rows to published discovery search hits, including `approximate_member_count`, `approximate_presence_count`, `discovery_splash`, `primary_category`, `categories`, `objectID`, and excludes persistence-only fields such as `discovery_weight`, `member_count`, and `presence_count`.

## Changed Files

- `src/api/routes/discovery.ts`
- `src/api/routes/discovery.test.ts`
- `src/api/middlewares/NoAuthorizationRoutes.ts`
- `src/api/middlewares/Authentication.test.ts`
- `src/schemas/responses/DiscoverySearchResponse.ts`
- `src/schemas/responses/DiscoverySearchResponse.test.ts`
- `src/schemas/responses/index.ts`
- `test/routes/discovery-search.test.ts`
- `test/scenarios/search-discovery-public.test.ts`
- `testing/suite-coverage-policy.json`
- `assets/schemas.json`
- `assets/openapi.json`
- `assets/testing-manifest.json`
- `test/generated/http-contracts.json`
- `test/generated/suite-coverage.json`
- `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`
- `packages/missing-routes/missing.json`
- `worker-progress/discovery-search-get.md`

## Evidence Gathered

- Current base `packages/missing-routes/missing.json` had exactly one assigned missing entry:
    - method: `GET`
    - route: `/discovery/search`
    - route name: `GET_DISCOVERY_SEARCH`
    - source: `userdoccers:resources/discovery.mdx`
    - summary: `Search Published Guilds`
- Current base source catalog and `src/api/routes/**` had no `/discovery/search` / `GET_DISCOVERY_SEARCH` entry.
- Userdoccers source: `https://raw.githubusercontent.com/discord-userdoccers/discord-userdoccers/master/pages/resources/discovery.mdx`.
    - `GET /discovery/search` is marked `unauthenticated`.
    - Query params are `query?`, `limit?`, and `offset?`.
    - It is a proxy for discovery search and returns discoverable guild objects with landing pages.
    - Immutable filters listed: member count, presence count, `auto_removed: false`, and `is_published: true`.
- xHyroM local catalog has adjacent `/discoverable-guilds/search`, `/discovery/{param}`, and `/discovery/categories` routes, but no `/discovery/search` entry.
- Direct Discord probes on 2026-05-11:
    - `GET https://discord.com/api/v9/discovery/search?query=gaming&limit=1` returned `200`.
    - Shape included `hits`, `nbHits`, `offset`, `length`, `exhaustiveNbHits`, `exhaustiveTypo`, `exhaustive`, `query`, `params`, timing fields, `aggregateFacets`, and `totalNbHits`.
    - Current wire `params` used `approximate_member_count>0`; implementation follows that current wire filter rather than the stale Userdoccers `>200` text.

## Missing-Route Movement

- Before regeneration on current base `9d38b2f01`: `missing_entries` count was `676`; `/discovery/search` was present.
- After regeneration: `missing_entries` count is `675`; `/discovery/search` is absent.
- Implemented route count moved from `504` to `505`; Discord route count remains `1128`.
- `routes.source.catalog.json` now includes:
    - method: `GET`
    - route: `/discovery/search`
    - route name: `GET_DISCOVERY_SEARCH`
    - response schemas: `APIErrorResponse`, `DiscoverySearchResponse`
- Testing manifest now includes `api:http:GET:/discovery/search` with `authMode: "public"`.

## Verification

- `git rev-parse --short HEAD` - confirmed current base `9d38b2f01` before accepting the worker changes.
- `git diff` / worker worktree inspection - confirmed the managed worker was stale against the current base, so only scoped source/test/schema/report files were ported and generated artifacts were rebuilt locally.
- `jq '.missing_entries[] | select(.route == "/discovery/search")' packages/missing-routes/missing.json` - confirmed assigned missing entry on current base.
- `rg 'discovery/search|GET_DISCOVERY_SEARCH|Search Published Guilds' ...` - confirmed source absence on current base before implementation.
- `curl -fsSL https://raw.githubusercontent.com/discord-userdoccers/discord-userdoccers/master/pages/resources/discovery.mdx` - passed.
- `curl -sS -D - 'https://discord.com/api/v9/discovery/search?query=gaming&limit=1'` - returned `200`.
- `curl -sS -D - 'https://discord.com/api/v9/discovery/search?limit=1'` - returned `200` with empty query behavior.
- `curl -sS -D - 'https://discord.com/api/v9/discovery/search?query=gaming&limit=99&offset=4000'` - returned `400` for limit max.
- `npm run build:src:tsgo` - passed.
- `npm run generate:schema` - passed; `DiscoverySearchResponse` generated in `assets/schemas.json`; final schema count is 993.
- `npm run build:test-fixtures` - passed.
- `npm run build --workspace @spacebar/automatic-reverse-engineering` - passed.
- `node packages/automatic-reverse-engineering/dist/cli.js import-source-routes --root src/api/routes --out packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json` - passed.
- `npm run build --workspace @spacebar/missing-routes` - passed.
- `npm run start --workspace @spacebar/missing-routes` - passed; final output: `Spacebar is missing 675`, `Spacebar implements 505`, `Discord implements 1128`.
- `npm run generate:testing-manifest` - passed; 610 entries.
- `node scripts/testing-manifest/verify.js` - passed; 610 entries.
- `node scripts/testing-manifest/generate-contract-tests.js --check` - first reported stale output after manifest regeneration.
- `npm run generate:contract-tests` - passed; 585 contracts.
- `node scripts/testing-manifest/generate-contract-tests.js --check` - passed; 585 contracts.
- `node scripts/testing-manifest/generate-suite-coverage.js --check` - first reported stale output after manifest regeneration.
- `npm run generate:suite-coverage` - passed; 15 suites.
- `node scripts/testing-manifest/generate-suite-coverage.js --check` - passed.
- `npm run generate:openapi` - passed; 410 paths and 993 schemas, with pre-existing webhook route-metadata warnings.
- Focused compiled tests passed:
    - `dist-test/src/api/routes/discovery.test.js`
    - `dist-test/src/api/middlewares/Authentication.test.js`
    - `dist-test/src/schemas/responses/DiscoverySearchResponse.test.js`
    - `dist-test/test/routes/discovery-search.test.js`
    - `dist-test/test/scenarios/search-discovery-public.test.js` skipped its Postgres integration body because the local Postgres admin URL is not configured.
- `node --test test/generated/http-contracts.test.js test/generated/suite-coverage.test.js` - passed.
- `npx eslint` over touched TypeScript files - passed.
- `npx prettier --check` over touched source/test/report/generated artifact files - passed.
- `git diff --check` - passed.
- Package/lockfile guard: `git diff -- package.json package-lock.json npm-shrinkwrap.json pnpm-lock.yaml yarn.lock` produced no diff.
- Malformed warranty-token scan over changed and newly added files passed.

## Artifact Status

- Source catalog regenerated and includes `GET_DISCOVERY_SEARCH`.
- Missing-routes report regenerated and removed the assigned missing entry.
- Schema asset regenerated and includes `DiscoverySearchResponse`, `DiscoverySearchGuild`, and related nested definitions.
- Testing manifest regenerated and marks `/discovery/search` public.
- Generated HTTP contracts and suite coverage regenerated and verified.
- OpenAPI regenerated and exposes `/discovery/search` with `DiscoverySearchResponse` `200` and `APIErrorResponse` `400`.

## Risks And Tradeoffs

- Spacebar does not maintain Discord's Algolia index, typo matching, highlight payloads, or true aggregate facet infrastructure. This implementation preserves the main search response envelope and uses deterministic database search until a dedicated search index exists.
- `aggregateFacets` currently returns an empty `categories.id` map rather than global search-result facet counts. This avoids expensive full-result aggregation while keeping the response envelope compatible.
- Spacebar persists only a primary discovery category for guilds. Search hits include that category in `primary_category` and `categories`; subcategory data remains unavailable until the adjacent metadata/storage routes exist.
- The live Discord wire filter on 2026-05-11 used `approximate_member_count > 0`; Userdoccers currently says `> 200`. This implementation follows current wire behavior and records the difference.

## Recommended Next Tasks

- Implement assigned adjacent discovery routes separately when scheduled.
- Add persisted discovery keywords/subcategories if the discovery metadata routes are expanded later.
- Consider a dedicated discovery search index for ranking, highlights, typo handling, and aggregate facets.
