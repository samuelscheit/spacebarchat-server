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

# Worker Progress: discovery-valid-term-get-2

## Goal Evidence

- `create_goal` objective: Implement the missing route path `GET /discovery/valid-term` for the Spacebar server API, with focused tests and regenerated route artifacts.
- `get_goal` status: active.
- `get_goal` objective: Implement the missing route path `GET /discovery/valid-term` for the Spacebar server API, with focused tests and regenerated route artifacts.
- Final `update_goal(status: "complete")`: complete; objective unchanged; time used 571 seconds.

## Scope

- Assigned path: `/discovery/valid-term`.
- Missing methods found: `GET`, route name `GET_DISCOVERY_VALID_TERM`.
- Methods implemented: `GET /discovery/valid-term`.
- Out-of-scope adjacent paths not implemented: discovery search, discoverable guild search, discovery categories beyond preserving existing behavior, guild discovery metadata, guild discovery requirements, discovery subcategory routes.

## Evidence Gathered

- `packages/missing-routes/missing.json` initially listed one assigned missing entry for `GET /discovery/valid-term`, sourced from `userdoccers:resources/discovery.mdx`.
- `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json` initially had no `/discovery/valid-term` entry.
- `src/api/routes/discovery.ts` initially only implemented `GET /discovery/categories`.
- Userdoccers discovery source: `https://raw.githubusercontent.com/discord-userdoccers/discord-userdoccers/master/pages/resources/discovery.mdx`.
  - Defines "Validate Discovery Search Term".
  - Query parameter: required `term` string.
  - Response body: `valid` boolean.
  - Nearby discovery search docs cap search query length at 100 characters.
  - Docs do not define a concrete banned-term service or detailed error semantics.
- Existing local auth middleware keeps `/discovery/valid-term` behind bearer auth because it is not a no-authorization route.

## Behavior

- Auth mode: bearer-authenticated normal API route, documented with `401 APIErrorResponse`.
- Success response: `200` with `DiscoveryValidTermResponse`, shape `{ "valid": boolean }`.
- Query validation: missing or repeated/non-string `term` returns `400 Invalid Form Body` field error for `term`.
- Term validation: returns `valid: true` only for non-empty trimmed terms up to 100 characters; empty/whitespace or overlong terms return `valid: false`.
- Data source: local structural validation only. No discovery search, Algolia, or unavailable moderation/banned-term infrastructure was introduced.
- Existing `GET /discovery/categories` behavior is unchanged.

## Changed Files

- `src/api/routes/discovery.ts`
- `src/api/routes/discovery.test.ts`
- `src/schemas/responses/DiscoverableGuildsResponse.ts`
- `src/schemas/responses/DiscoveryCategoryResponse.test.ts`
- `test/routes/discovery-valid-term.test.ts`
- `assets/schemas.json`
- `assets/openapi.json`
- `assets/testing-manifest.json`
- `test/generated/http-contracts.json`
- `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`
- `packages/missing-routes/missing.json`
- `worker-progress/discovery-valid-term-get-2.md`

## Verification

- `npm run build:src:tsgo` - passed on the orchestrator current checkout after port.
- `npm run generate:schema` - passed.
- `npm run build:test-fixtures` - passed.
- Focused compiled route tests passed: `dist-test/src/api/routes/discovery.test.js` and `dist-test/test/routes/discovery-valid-term.test.js`.
- `TS_NODE_TRANSPILE_ONLY=1 node -r dotenv/config -r ts-node/register/transpile-only -r module-alias/register --enable-source-maps --test src/schemas/responses/DiscoveryCategoryResponse.test.ts` - passed.
- `npm run build --workspace @spacebar/automatic-reverse-engineering` - passed.
- `node packages/automatic-reverse-engineering/dist/cli.js import-source-routes --root src/api/routes --out packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json` - passed.
- `npm run build --workspace @spacebar/missing-routes` - passed.
- `npm run start --workspace @spacebar/missing-routes` - passed.
- `npm run generate:testing-manifest` - passed.
- `node scripts/testing-manifest/verify.js` - passed.
- `npm run generate:contract-tests` - passed.
- `node scripts/testing-manifest/generate-contract-tests.js --check` - passed.
- `node scripts/testing-manifest/generate-suite-coverage.js --check` - passed.
- `node --test test/generated/http-contracts.test.js test/generated/suite-coverage.test.js` - passed.
- `npm run generate:openapi` - passed with pre-existing webhook route-metadata warnings.
- `git diff --check` - passed.
- Package/lockfile guard - passed; no package manager metadata changed.
- Malformed warranty-token scan over changed scoped files - passed.

## Missing-Route Movement

- Worker-base regeneration moved `780 -> 779`.
- Orchestrator current-base regeneration after port moved `777 -> 776`, and implemented count moved `403 -> 404`.
- Source catalog now contains `GET_DISCOVERY_VALID_TERM` at `/discovery/valid-term` from `src/api/routes/discovery.ts`, with response schemas `APIErrorResponse` and `DiscoveryValidTermResponse`.

## Self-Review

- Security: route remains authenticated through existing middleware; no external calls or persistence side effects added.
- Response shape: route, schema asset, OpenAPI, testing manifest, and generated contract artifact all reference `DiscoveryValidTermResponse`.
- Generated artifacts: source catalog, missing routes, schema, OpenAPI, testing manifest, and contract JSON are refreshed.
- Scoped diff: implementation only touches assigned discovery valid-term route, focused tests, and generated artifacts needed for the route.

## Risks And Next Tasks

- Risk: the Userdoccers source says whether a term is allowed, but does not document the underlying banned-term policy. This implementation uses local structural validation only and documents that limitation.
- Recommended next task: if Spacebar later adds shared content moderation or banned-term infrastructure, wire this route into that service while preserving the same response schema.
