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

# Worker Progress: reporting-unauthenticated-capabilities-get-2

## Goal Evidence

- Worker `create_goal` and `get_goal` both recorded the objective for `GET /reporting/unauthenticated/capabilities` with status `active`.
- Worker `update_goal` completed after verification; the pane reported 270,629 tokens and 532 seconds.

## Summary

- Assigned path: `GET /reporting/unauthenticated/capabilities`.
- Missing method found: `GET`, route name `GET_REPORTING_UNAUTHENTICATED_CAPABILITIES`.
- Methods implemented: `GET`.
- Out of scope and not implemented: report submission, unauthenticated experiment, unauthenticated menu, verification code, verification token, guild/message/user report-specific routes, and authenticated reporting review endpoints.

## Evidence

- `packages/missing-routes/missing.json` listed the assigned route as missing from `userdoccers:topics/reports.mdx`.
- `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json` and `src/api/routes/**` did not contain the assigned route before implementation.
- Userdoccers reports docs say `GET /reporting/unauthenticated/capabilities` returns `{ capabilities: array[string] }` and is part of the unauthenticated DSA reporting flow.
- Userdoccers also notes unauthenticated reporting endpoints require either authentication or a fingerprint for experiment tracking.
- Spacebar's `Authentication` middleware hydrates a fingerprint cookie before no-auth routing, and public/no-bearer routes are controlled by `NO_AUTHORIZATION_ROUTES`.

## Behavior

- Auth mode: public/no bearer required, with fingerprint hydration handled by existing middleware.
- Response schema: `UnauthenticatedReportCapabilitiesResponse`.
- Response body: `{ "capabilities": [] }`.
- Data source: conservative static local response. Spacebar does not yet implement the DSA email verification and unauthenticated report submission flow, so the route does not advertise unsupported report menu types.
- Error semantics: no request parameters and no route-specific errors; normal middleware/runtime errors still use existing API error handling.

## Changed Files

- `src/api/routes/reporting/index.ts`
- `src/api/middlewares/NoAuthorizationRoutes.ts`
- `src/schemas/responses/ReportingMenuResponse.ts`
- `test/routes/reportingUnauthenticatedCapabilities.test.ts`
- `assets/schemas.json`
- `assets/openapi.json`
- `assets/testing-manifest.json`
- `test/generated/http-contracts.json`
- `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`
- `packages/missing-routes/missing.json`
- `worker-progress/reporting-unauthenticated-capabilities-get-2.md`

## Current-Base Regeneration Results

- Missing routes moved from `774 missing / 406 implemented` to `773 missing / 407 implemented`.
- `packages/missing-routes/missing.json` no longer contains `/reporting/unauthenticated/capabilities` or `GET_REPORTING_UNAUTHENTICATED_CAPABILITIES`.
- `routes.source.catalog.json` contains `GET /reporting/unauthenticated/capabilities`, route name `GET_REPORTING_UNAUTHENTICATED_CAPABILITIES`, and response ref `UnauthenticatedReportCapabilitiesResponse`.
- `assets/testing-manifest.json` contains `api:http:GET:/reporting/unauthenticated/capabilities` as public with `200` and `UnauthenticatedReportCapabilitiesResponse`.
- `assets/openapi.json` contains the public `GET /reporting/unauthenticated/capabilities` route with `200` only and no bearer security.
- `assets/schemas.json` contains required string-array `capabilities`.

## Verification

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
- `node -r dotenv/config -r module-alias/register --enable-source-maps --test dist-test/test/routes/reportingUnauthenticatedCapabilities.test.js dist-test/src/api/middlewares/Authentication.test.js`
- Final `npm run build:src:tsgo`
- `git diff --check`
- Malformed warranty-token scan over changed files
- Package and lockfile diff guard

## Risks And Next Tasks

- Risk: The empty capabilities response is intentionally conservative. It is production-safe for current Spacebar behavior but does not provide a complete upstream DSA reporting experience.
- Recommended next tasks: implement the remaining unauthenticated reporting flow endpoints together, including eligibility, menus, email code issuance, verification, and submission, then widen capabilities only to actually supported report types.
