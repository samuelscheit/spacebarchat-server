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

# Worker Progress: user-profile-effects-get-2

## Goal Evidence

- `create_goal` succeeded.
- Worker report recorded `get_goal` status as `active` before final completion.
- Tmux pane showed the worker marked the goal complete after verification; final budget report was 508 seconds.
- Objective: implement production-ready `GET /user-profile-effects` on the current integration branch with focused tests, regenerated route catalogs and generated route artifacts, verification evidence, and a complete handoff report.

## Scope

- Assigned path: `/user-profile-effects`.
- Missing method found: `GET /user-profile-effects`.
- Expected missing route name: `GET_USER_PROFILE_EFFECTS`.
- Methods implemented: `GET`.
- Adjacent collectible shop, product, category, gift, and profile customization routes were not implemented.

## Evidence Gathered

- `packages/missing-routes/missing.json` listed `GET_USER_PROFILE_EFFECTS` for `/user-profile-effects`, sourced from `userdoccers:resources/collectibles.mdx`.
- `packages/automatic-reverse-engineering/data/catalogs/routes.userdoccers.catalog.json` lists `GET /user-profile-effects` as `Get Profile Effects`.
- `packages/automatic-reverse-engineering/data/catalogs/routes.xhyrom.catalog.json` has no `/user-profile-effects` entry.
- `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json` had no `/user-profile-effects` entry before the worker implementation.
- Upstream Userdoccers source: `https://raw.githubusercontent.com/discord-userdoccers/discord-userdoccers/master/pages/resources/collectibles.mdx`.
- Userdoccers documents the route as deprecated, with query params `locale` and `with_unpublished`, and response body field `profile_effect_configs`.
- Spacebar has no bundled or persisted profile-effect catalog, so the default response is an empty `profile_effect_configs` array.

## Changed Files

- `src/api/routes/user-profile-effects.ts`
- `src/schemas/responses/UserProfileEffectsResponse.ts`
- `src/schemas/responses/index.ts`
- `src/schemas/responses/UserProfileEffectsResponse.test.ts`
- `test/routes/user-profile-effects-route.test.ts`
- `tsconfig.test.json`
- `assets/schemas.json`
- `assets/openapi.json`
- `assets/testing-manifest.json`
- `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`
- `packages/missing-routes/missing.json`
- `test/generated/http-contracts.json`
- `worker-progress/user-profile-effects-get-2.md`

## Implementation Notes

- Added `UserProfileEffectsResponse` and nested profile-effect config, animation, position, and source schema types.
- Added an authenticated root route module for `GET /user-profile-effects`.
- Declared documented `locale` and `with_unpublished` query metadata.
- Marked the endpoint deprecated in route metadata.
- Declared `200: UserProfileEffectsResponse` and explicit `401: APIErrorResponse`.
- Added injectable catalog-provider helpers so tests can verify non-empty responses without inventing production data.
- Returned `{ "profile_effect_configs": [] }` by default.

## Current-Base Regeneration Results

- Missing routes moved from `776 missing / 404 implemented` to `775 missing / 405 implemented`.
- `packages/missing-routes/missing.json` no longer contains `/user-profile-effects` or `GET_USER_PROFILE_EFFECTS`.
- `routes.source.catalog.json` contains `GET /user-profile-effects`, route name `GET_USER_PROFILE_EFFECTS`, source `src/api/routes/user-profile-effects.ts`, and response refs `APIErrorResponse` and `UserProfileEffectsResponse`.
- `assets/testing-manifest.json` contains `api:http:GET:/user-profile-effects/` as bearer-authenticated with query and response metadata.
- `test/generated/http-contracts.json` contains the generated route contract.
- `assets/openapi.json` contains `/user-profile-effects/` with `deprecated: true`, bearer security, query parameters, and `200`/`401` response schemas.

## Verification Commands

- `npm run build:src:tsgo`
- `npm run generate:schema`
- `npm run build:test-fixtures`
- `npm run build --workspace @spacebar/automatic-reverse-engineering`
- `node packages/automatic-reverse-engineering/dist/cli.js import-source-routes --root src/api/routes --out packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`
- `npm run build --workspace @spacebar/missing-routes`
- `npm run start --workspace @spacebar/missing-routes`
- `npm run generate:testing-manifest`
- `node scripts/testing-manifest/verify.js`
- `node scripts/testing-manifest/generate-contract-tests.js --check`
- `npm run generate:contract-tests`
- `node scripts/testing-manifest/generate-contract-tests.js --check`
- `node scripts/testing-manifest/generate-suite-coverage.js --check`
- `node --test test/generated/http-contracts.test.js test/generated/suite-coverage.test.js`
- `npm run generate:openapi`
- `node -r dotenv/config -r module-alias/register --enable-source-maps --test dist-test/test/routes/user-profile-effects-route.test.js dist-test/src/schemas/responses/UserProfileEffectsResponse.test.js`
- Final `npm run build:src:tsgo`
- `git diff --check`
- Malformed warranty-token scan over changed files
- Package and lockfile diff guard

## Focused Test Coverage

- Manifest id for `api:http:GET:/user-profile-effects/`.
- Bearer-auth classification and unauthenticated `401`.
- Query parsing for `locale` and `with_unpublished`.
- Injected non-empty profile-effect response shape.
- Empty default response with no fabricated profile-effect assets.
- Generated schema, OpenAPI, and manifest metadata.
- JSON schema validation rejects extra fields in profile-effect wrappers and nested sources.

## Risks

- Spacebar still has no real profile-effect catalog, so clients receive an empty list until a catalog or persistence layer is added.
- The upstream route is deprecated in favor of collectible product data; future compatibility work may be better handled through a shared collectibles catalog.
- `npm run generate:openapi` still reports pre-existing webhook route-metadata warnings unrelated to this route.
