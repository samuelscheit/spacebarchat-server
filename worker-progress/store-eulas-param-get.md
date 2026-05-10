<!--
This file is part of Spacebar.

Spacebar is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

Spacebar is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with Spacebar.  If not, see <https://www.gnu.org/licenses/>.
-->

# Worker Progress: store-eulas-param-get

## Goal Evidence

- `create_goal`: created active goal `019e141a-0b87-74c3-82b9-e2627b1ac9be`.
- `get_goal`: status `active`; objective `Implement production-ready support for the missing route path GET /store/eulas/{param} on the current integration branch, with focused tests, regenerated route catalogs and generated route artifacts, verification evidence, and a complete handoff report.`
- Final `update_goal(status: "complete")`: status `complete`; final tool report recorded `timeUsedSeconds: 768`.

## Status

- Implementation, verification, and final goal closeout complete.

## Assignment

- Worker id: `store-eulas-param-get`.
- Assigned missing path: `/store/eulas/{param}`.
- Missing methods found at `HEAD`: `GET` only.
- Missing entry owned: `GET_STORE_EULAS_EULA_ID`.
- Methods implemented: `GET`.
- Source route: `/store/eulas/{eula_id}`.
- Out of scope and not implemented: adjacent store, SKU, storefront, EULA list, price tier, billing, subscription-plan, published listing, purchase, and virtual-currency routes.

## Evidence Gathered

- `packages/missing-routes/missing.json` had one owned `missing_entries[]` item: `GET /store/eulas/{param}`, route name `GET_STORE_EULAS_EULA_ID`, sources `userdoccers:resources/store.mdx` and `xhyrom:data/client/routes.json`, source route `/store/eulas/{eula_id}`.
- `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json` had no `GET_STORE_EULAS_EULA_ID`, `/store/eulas/{param}`, or `/store/eulas/{eula_id}` entry.
- The current base tracked store routes only had price tier and published listing files under `src/api/routes/store/**`; the EULA route file is new.
- Userdoccers `pages/resources/store.mdx` at commit `259d8f8cf97ff357c4d1255afdf30e2e05672742` documents `GET /store/eulas/{eula.id}` as unauthenticated and describes `Get EULA` as returning a EULA object for the given ID. The EULA object has `id`, `name`, and `content` string fields.
- xHyroM `data/client/routes.json` at commit `0d792408fc6f5f67140fe1b4cad48b386ae1fd44` maps `STORE_EULA` to `/store/eulas/:param` with allowed methods `GET`, `HEAD`, and `OPTIONS`.
- Current generated source catalog now includes `GET_STORE_EULAS_EULA_ID` from `src/api/routes/store/eulas/#eula_id.ts` with response schema refs `APIErrorResponse` and `StoreEulaResponse`.
- Current testing manifest now includes `api:http:GET:/store/eulas/:eula_id/` with `authMode: public`, response statuses `200` and `404`, and response bodies `StoreEulaResponse` and `APIErrorResponse`.

## Behavior Summary

- Auth mode: public/no bearer token required, matching the Userdoccers unauthenticated route evidence.
- Request parsing: `:eula_id` path parameter is accepted only as a snowflake-shaped ID before lookup.
- Data source: `Config.get().store.customEulas`, typed as `StoreEulaConfiguration[]`. The route serializes only source-backed `id`, `name`, and `content` fields.
- Default data: empty `customEulas`; no legal text is fabricated.
- Success response: `200` JSON `StoreEulaResponse`.
- Not found and invalid ID behavior: `404` `APIErrorResponse` with code `10044` and message `Unknown EULA`.
- Cache behavior: no route-specific cache headers added; it follows the existing route stack defaults.
- Metadata: `200` and `404` bodies are declared. `401` is intentionally omitted because the route is public.
- Shared compatibility: added a no-auth matcher for `GET`/`HEAD` `/store/eulas/<id>`; no adjacent routes are marked public.

## Changed Files

- `src/api/routes/store/eulas/#eula_id.ts`: new route, lookup helpers, public route metadata, and response/error behavior.
- `src/schemas/responses/StoreEulaResponse.ts`: new response schema type.
- `src/schemas/responses/index.ts`: exports the new response schema.
- `src/util/config/types/StoreConfiguration.ts`: adds `StoreEulaConfiguration` and default-empty `customEulas`.
- `src/api/middlewares/NoAuthorizationRoutes.ts`: adds public `GET`/`HEAD` matcher for the exact EULA item route.
- `test/routes/store-eulas-route.test.ts`: focused route/auth/schema/catalog/artifact tests.
- Regenerated artifacts: `assets/schemas.json`, `assets/openapi.json`, `assets/testing-manifest.json`, `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`, `packages/missing-routes/missing.json`, and `test/generated/http-contracts.json`.

## Verification

- Current-base port: scoped files were ported onto `d18379f7a Implement store price tier lookup route`; old-base generated artifacts were regenerated instead of copied.
- `npm run build:src:tsgo`: passed.
- `npm run generate:schema`: passed; found 407 schemas and wrote 877 schema definitions.
- `npm run build:test-fixtures`: passed.
- `NODE_OPTIONS=--preserve-symlinks node -r dotenv/config -r module-alias/register --enable-source-maps --test dist-test/test/routes/store-eulas-route.test.js`: passed, 5 tests.
- `npm run build --workspace @spacebar/automatic-reverse-engineering`: passed.
- `node packages/automatic-reverse-engineering/dist/cli.js import-source-routes --root src/api/routes --out packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`: passed.
- `npm run build --workspace @spacebar/missing-routes`: passed.
- `npm run start --workspace @spacebar/missing-routes`: passed; reported `Spacebar is missing 728`, `Spacebar implements 452`, `Discord implements 1128`.
- `npm run generate:testing-manifest`: passed; wrote 557 entries.
- `node scripts/testing-manifest/verify.js`: passed.
- `node scripts/testing-manifest/generate-contract-tests.js --check`: initially stale; `npm run generate:contract-tests` wrote 532 contracts and the check then passed.
- `node scripts/testing-manifest/generate-suite-coverage.js --check`: passed.
- `node --test test/generated/http-contracts.test.js test/generated/suite-coverage.test.js`: passed.
- `npm run generate:openapi`: passed; specification contains 360 paths and 877 schemas.
- `npx eslint src/api/routes/store/eulas/#eula_id.ts src/schemas/responses/StoreEulaResponse.ts src/schemas/responses/index.ts src/util/config/types/StoreConfiguration.ts src/api/middlewares/NoAuthorizationRoutes.ts test/routes/store-eulas-route.test.ts`: passed.
- `npx prettier --check src/api/routes/store/eulas/#eula_id.ts src/schemas/responses/StoreEulaResponse.ts src/schemas/responses/index.ts src/util/config/types/StoreConfiguration.ts src/api/middlewares/NoAuthorizationRoutes.ts test/routes/store-eulas-route.test.ts worker-progress/store-eulas-param-get.md`: failed initially for the copied test file; it was formatted with Prettier and the check was rerun successfully.
- `git diff --check`: passed.
- Package manifest/lockfile cleanliness check: passed; no manifest or lockfile diff.
- Changed-file malformed warranty-string scan: passed.

## Missing Route Movement

- Before regeneration on current base: `missing` 729, `spacebar` 451, `discord` 1128.
- After regeneration on current base: `missing` 728, `spacebar` 452, `discord` 1128.
- The owned `GET_STORE_EULAS_EULA_ID` missing entry is removed from `packages/missing-routes/missing.json`.

## Risks And Blockers

- No blocker remains.
- EULA persistence is configuration-backed instead of database-backed. This is intentional because no durable Spacebar EULA table/source was found, and the route must not invent legal text.
- Operators need to configure `store.customEulas` for this route to return legal content; the default behavior is conservative `404`.
- Worker output included an unrelated `src/api/util/handlers/ChannelMessageCreateRoute.ts` type annotation from its old-base verification environment. That change was not ported to the current integration worktree.

## Recommended Next Tasks

- Consider durable EULA storage only if a broader store/legal-content implementation is planned.
- Implement adjacent store routes through separate assigned workers, using their own source evidence and tests.
