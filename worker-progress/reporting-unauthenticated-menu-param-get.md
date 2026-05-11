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

# reporting-unauthenticated-menu-param-get

## Summary

- Implemented only `GET /reporting/unauthenticated/menu/{param}` as `GET /reporting/unauthenticated/menu/:type`.
- Auth mode is public/no bearer required, matching Userdoccers' unauthenticated DSA menu route and Spacebar's existing fingerprint hydration behavior.
- The route is intentionally gated by `getUnauthenticatedReportCapabilities()`. Spacebar currently advertises `capabilities: []` because DSA email verification/submission is not implemented, so the route returns a `400` API error for current report types instead of exposing unsupported unauthenticated menu flows.
- If capabilities are widened later, the route will serve the existing static report menu fixture, validate the optional `variant` query, and return `204` when a requested variant is unavailable.

## Assigned Scope

- Route id: `reporting-unauthenticated-menu-param-get`.
- Route name: `GET_REPORTING_UNAUTHENTICATED_MENU_TYPE`.
- Method/path: `GET /reporting/unauthenticated/menu/{param}`.
- Sources: `userdoccers:topics/reports.mdx`, `xhyrom:data/client/routes.json`.
- Out of scope and untouched: `/reporting/menu/{param}`, report submit routes, `/report`, `/report/options`, `/reporting/unauthenticated/submit`, unauthenticated code/verify/submit routes, and broader DSA email verification infrastructure.

## Evidence

- Before implementation, `packages/missing-routes/missing.json` had one assigned missing entry for `GET /reporting/unauthenticated/menu/{param}` with summary `Get Unauthenticated Report Menu`.
- Before implementation, `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json` had no `GET /reporting/unauthenticated/menu/{type}` entry.
- Before implementation, `src/api/routes/reporting/index.ts` had `GET /reporting/menu/:type` and `GET /reporting/unauthenticated/capabilities`, but no unauthenticated menu route.
- Userdoccers raw source used: `https://raw.githubusercontent.com/discord-userdoccers/discord-userdoccers/master/pages/topics/reports.mdx`. It documents the unauthenticated menu response as the same report menu object, with optional `variant`, and says the requested type must be returned by `GET /reporting/unauthenticated/capabilities`.
- xHyroM local catalog used: `packages/automatic-reverse-engineering/data/catalogs/routes.xhyrom.catalog.json`. It lists `GET`, `HEAD`, and `OPTIONS` for `/reporting/unauthenticated/menu/{param}` under `GET_UNAUTHENTICATED_REPORT_MENU`; the assignment was GET-only.
- Existing reporting fixtures inspected under `assets/temp_report_menu_responses`.
- Existing `getUnauthenticatedReportCapabilities()` returns an empty static capability set and documents that Spacebar does not implement the DSA email verification/submission flow yet.

## Changed Files

- `src/api/routes/reporting/index.ts`
- `src/api/middlewares/NoAuthorizationRoutes.ts`
- `src/api/middlewares/Authentication.test.ts`
- `test/routes/reportingUnauthenticatedCapabilities.test.ts`
- `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`
- `packages/missing-routes/missing.json`
- `assets/testing-manifest.json`
- `assets/openapi.json`
- `test/generated/http-contracts.json`
- `worker-progress/reporting-unauthenticated-menu-param-get.md`

## Artifact Status

- Source catalog now contains `GET /reporting/unauthenticated/menu/{type}`, route name `GET_REPORTING_UNAUTHENTICATED_MENU_TYPE`, source `src/api/routes/reporting/index.ts`, and response refs `APIErrorResponse` plus `ReportingMenuResponse`.
- Missing routes moved from `missing = 669`, `spacebar = 511` to `missing = 668`, `spacebar = 512`; assigned missing entry count is now `0`.
- Orchestrator current-base regeneration after `249188e59` moved `missing = 666`, `spacebar = 514` to `missing = 665`, `spacebar = 515`, with `discord = 1128`; assigned missing entry count remains `0`.
- Testing manifest now contains `api:http:GET:/reporting/unauthenticated/menu/:type` as `authMode: public`, statuses `[200, 204, 400]`, response bodies `APIErrorResponse` and `ReportingMenuResponse`, and `hasQuery: true`.
- OpenAPI now contains public `GET /reporting/unauthenticated/menu/{type}` with no bearer security and no `401` response.
- Generated HTTP contracts now contain the assigned route contract. Suite coverage was already current after manifest regeneration.
- `assets/schemas.json` was regenerated and remained without a final diff.

## Commands Run

- `npm run build:src:tsgo` initially failed before code compilation because this worktree had no `node_modules`; exact failure: `TS2688: Cannot find type definition file for 'node'.`
- `npm ci` passed and installed dependencies from `package-lock.json`; package and lockfile remained unchanged.
- `npm run build:src:tsgo` passed after dependency install.
- `npm run generate:schema` passed.
- `npm run build --workspace @spacebar/automatic-reverse-engineering` passed.
- `node packages/automatic-reverse-engineering/dist/cli.js import-source-routes --root src/api/routes --out packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json` passed.
- `npm run build --workspace @spacebar/missing-routes` passed.
- `npm run start --workspace @spacebar/missing-routes` passed and wrote `Spacebar is missing 668`, `Spacebar implements 512`, `Discord implements 1128`.
- `npm run generate:testing-manifest` passed and wrote `617` entries.
- `node scripts/testing-manifest/verify.js` passed.
- `node scripts/testing-manifest/generate-contract-tests.js --check` reported stale contracts.
- `npm run generate:contract-tests` passed and wrote `592` contracts.
- `node scripts/testing-manifest/generate-contract-tests.js --check` passed.
- `node scripts/testing-manifest/generate-suite-coverage.js --check` passed.
- `npm run generate:openapi` passed and wrote `407` paths and `997` schemas. The remaining webhook `route()` middleware warnings were pre-existing and unrelated.
- `npm run build:test-fixtures` passed.
- Focused compiled tests passed: `node -r dotenv/config -r module-alias/register --enable-source-maps --test dist-test/test/routes/reportingUnauthenticatedCapabilities.test.js dist-test/src/api/middlewares/Authentication.test.js dist-test/src/api/tests/reporting/createReport.test.js` passed `41/41`.
- Generated contract/suite tests passed: `node --test test/generated/http-contracts.test.js test/generated/suite-coverage.test.js` passed `13/13`.
- Final `npm run build:src:tsgo` passed.
- `npx prettier --check src/api/routes/reporting/index.ts src/api/middlewares/NoAuthorizationRoutes.ts src/api/middlewares/Authentication.test.ts test/routes/reportingUnauthenticatedCapabilities.test.ts worker-progress/reporting-unauthenticated-menu-param-get.md` initially flagged `test/routes/reportingUnauthenticatedCapabilities.test.ts`; `npx prettier --write test/routes/reportingUnauthenticatedCapabilities.test.ts` fixed it.
- After formatting, `npm run build:test-fixtures` and the focused compiled test command passed again with `41/41`.
- Final `git diff --check` passed.
- Final direct artifact audit passed for missing report removal, source catalog, testing manifest, OpenAPI, and generated HTTP contract presence.
- Package/lockfile guard showed no diffs for `package.json`, `package-lock.json`, `npm-shrinkwrap.json`, `yarn.lock`, `pnpm-lock.yaml`, or `bun.lock`.
- Changed-file malformed warranty-token scan passed; changed licensed files use `MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the`.

Orchestrator current-base acceptance after porting to `249188e59`:

- Ported only the route/auth/test/progress changes, then regenerated artifacts on the current base.
- `npx prettier --write src/api/routes/reporting/index.ts src/api/middlewares/NoAuthorizationRoutes.ts src/api/middlewares/Authentication.test.ts test/routes/reportingUnauthenticatedCapabilities.test.ts worker-progress/reporting-unauthenticated-menu-param-get.md` - passed, unchanged.
- `npm run build:src:tsgo` - passed.
- `npm run generate:schema` - passed; `assets/schemas.json` remained without a diff.
- `npm run build --workspace @spacebar/automatic-reverse-engineering` - passed.
- `node packages/automatic-reverse-engineering/dist/cli.js import-source-routes --root src/api/routes --out packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json` - passed.
- `npm run build --workspace @spacebar/missing-routes` - passed.
- `npm run start --workspace @spacebar/missing-routes` - passed; wrote `Spacebar is missing 665`, `Spacebar implements 515`, `Discord implements 1128`.
- `npm run generate:testing-manifest` - passed; wrote 620 entries.
- `node scripts/testing-manifest/verify.js` - passed.
- `node scripts/testing-manifest/generate-contract-tests.js --check` - failed because `test/generated/http-contracts.json` was stale.
- `npm run generate:contract-tests` - passed; wrote 595 contracts.
- `node scripts/testing-manifest/generate-contract-tests.js --check` - passed.
- `node scripts/testing-manifest/generate-suite-coverage.js --check` - passed.
- `npm run generate:openapi` - passed; wrote 409 paths and 997 schemas with the existing unrelated webhook route metadata warnings.
- `npm run build:test-fixtures` - passed.
- `node -r dotenv/config -r module-alias/register --enable-source-maps --test dist-test/test/routes/reportingUnauthenticatedCapabilities.test.js dist-test/src/api/middlewares/Authentication.test.js dist-test/src/api/tests/reporting/createReport.test.js` - passed, 41 tests.
- `node --test test/generated/http-contracts.test.js test/generated/suite-coverage.test.js` - passed, 13 tests.
- `npm run test:manifest` - passed, 30 tests plus manifest verification.
- `npm run test:suite-coverage` - passed, 4 tests.
- `npx eslint src/api/routes/reporting/index.ts src/api/middlewares/NoAuthorizationRoutes.ts src/api/middlewares/Authentication.test.ts test/routes/reportingUnauthenticatedCapabilities.test.ts` - passed.
- `npx prettier --check src/api/routes/reporting/index.ts src/api/middlewares/NoAuthorizationRoutes.ts src/api/middlewares/Authentication.test.ts test/routes/reportingUnauthenticatedCapabilities.test.ts worker-progress/reporting-unauthenticated-menu-param-get.md` - passed.
- `git diff --check` - passed.
- `git diff --exit-code -- package.json package-lock.json packages/automatic-reverse-engineering/package.json packages/missing-routes/package.json` - passed, no package/lockfile changes.
- Changed-file conflict-marker scan - passed with no matches.
- Changed-file malformed warranty-token scan - passed with no matches.

## Risks And Blockers

- No blocker for the assigned GET route.
- Behavior is intentionally conservative: while the route exists and is public, it will not return a report menu until `getUnauthenticatedReportCapabilities()` advertises supported types backed by the rest of the unauthenticated DSA reporting flow.
- `npm ci` reported existing dependency audit findings; no package metadata was changed for this route.

## Recommended Next Tasks

- Implement the remaining unauthenticated DSA reporting code, verify, and submit endpoints as separate assignments.
- Widen `getUnauthenticatedReportCapabilities()` only when the advertised report types can actually be submitted safely.

## Completion Audit

- Assigned route implemented: yes.
- Adjacent routes avoided: yes.
- Public auth boundary added and tested: yes.
- Query and response metadata regenerated: yes.
- Source catalog regenerated: yes.
- Missing report regenerated and assigned entry removed: yes.
- Testing manifest verified: yes.
- HTTP contracts regenerated and verified: yes.
- Suite coverage checked: yes.
- OpenAPI regenerated: yes.
- Focused route/auth tests passed: yes.
- Final build passed: yes.
