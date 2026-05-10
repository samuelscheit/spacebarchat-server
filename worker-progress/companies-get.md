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

# /companies GET Worker Report

## Goal Evidence

- Worker `spacebar-current-companies-get-2` called `create_goal` before setup.
- Worker `get_goal` after setup reported status `active` with the assigned `/companies` objective.
- Worker completed its goal and marked it complete after writing the handoff report.

## Assigned Scope

- Assigned missing route path: `/companies`.
- Missing method implemented: `GET /companies`.
- Adjacent `/company/{company_id}`, team-company mutation, team, application, billing, and organization routes were not changed.

## Source Evidence

- Current missing report had one assigned missing entry: `GET /companies`, route name `GET_COMPANIES`, source `userdoccers:resources/team.mdx`, summary `Search Companies`.
- Source catalog and `src/api/routes/**` had no `/companies` implementation before this merge.
- Userdoccers documents the Company object as `{ id, name }`, an optional `name` query, and a no-query `204` response.
- xHyroM did not add extra `/companies` behavior beyond the Userdoccers route.

## Behavior Summary

- Added bearer-authenticated route metadata for `GET /companies/`.
- Documented `name` query metadata, `200 CompanySearchResponse`, `204`, and explicit `401 APIErrorResponse`.
- `name` query parsing trims strings, accepts the first repeated value, and treats missing or blank names as no query.
- Requests without a usable `name` return `204` with no body and do not touch persistence.
- Requests with `name` search an injectable company repository using a minimal `{ id, name }` projection, stable name ordering, and a default limit of 25.
- Default production behavior returns `[]` for searched names until a real company backing repository is wired.

## Changed Files

- `src/api/routes/companies.ts`
- `src/schemas/responses/CompanySearchResponse.ts`
- `src/schemas/responses/index.ts`
- `test/routes/companies-get.test.ts`
- `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`
- `packages/missing-routes/missing.json`
- `assets/schemas.json`
- `assets/testing-manifest.json`
- `assets/openapi.json`
- `test/generated/http-contracts.json`
- `worker-progress/companies-get.md`

## Current-Base Evidence

- Source catalog contains `GET /companies`, route name `GET_COMPANIES`, source `src/api/routes/companies.ts`, response refs `APIErrorResponse` and `CompanySearchResponse`.
- Missing-route report moved from `789` missing / `391` implemented to `788` missing / `392` implemented.
- Testing manifest contains `api:http:GET:/companies/`, auth mode `bearer`, statuses `200`, `204`, and `401`, `hasQuery: true`, and response bodies `APIErrorResponse` and `CompanySearchResponse`.
- `assets/schemas.json` contains `CompanySearchResponse` as an array of `CompanyResponse`.
- OpenAPI contains `/companies/` with bearer security, `name` query documentation, `200 CompanySearchResponse`, `204`, and `401 APIErrorResponse`.
- Generated HTTP contracts verified with `472` contracts; generated suite coverage verified.

## Verification

- `npm run build:src:tsgo`
- `npm run generate:schema`
- `npm run build:test-fixtures`
- `node -r dotenv/config -r module-alias/register --enable-source-maps --test dist-test/test/routes/companies-get.test.js` (`7/7`)
- `npm run build --workspace @spacebar/automatic-reverse-engineering`
- `node packages/automatic-reverse-engineering/dist/cli.js import-source-routes --root src/api/routes --out packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`
- `npm run build --workspace @spacebar/missing-routes`
- `npm run start --workspace @spacebar/missing-routes`
- `npm run generate:testing-manifest`
- `node scripts/testing-manifest/verify.js`
- `npm run generate:contract-tests`
- `node scripts/testing-manifest/generate-contract-tests.js --check`
- `node scripts/testing-manifest/generate-suite-coverage.js --check`
- `node --test test/generated/http-contracts.test.js test/generated/suite-coverage.test.js` (`13/13`)
- `npm run generate:openapi`
- Final `npm run build:src:tsgo`
- `git diff --check`
- `git diff -- package.json package-lock.json npm-shrinkwrap.json pnpm-lock.yaml yarn.lock --exit-code`
- Changed-file malformed warranty scan

## Risks Or Blockers

- Spacebar still has no concrete Company persistence model. This route follows the existing injectable company repository pattern from `GET /company/{company_id}` and fails closed to empty results by default.
- A future real Company repository should be shared by `GET /company/{company_id}`, `GET /companies`, and `/teams/{team_id}/companies`.
