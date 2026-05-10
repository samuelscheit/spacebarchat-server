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

# GET /gifs/suggest

## Summary

Implemented the assigned `GET /gifs/suggest` route. The route is public per Userdoccers source evidence, validates required `q`, clamps `limit` to `1..50` with default `20`, defaults provider to `tenor` and locale to `en-US`, proxies Tenor autocomplete, filters non-string upstream terms, returns `[]` for unsupported documented providers, and converts upstream non-2xx responses to `502`.

## Goal Evidence

- `create_goal` objective: `Implement production-ready support for the assigned missing route path /gifs/suggest on the current-base worker branch, with focused tests, regenerated route catalogs and generated route artifacts, verification evidence, and a complete handoff report.`
- `get_goal` immediately after setup reported status `active` with the same objective.

## Source Evidence

- Current-base missing entry: `GET /gifs/suggest`, route name `GET_GIFS_SUGGEST`, summary `Get Suggested GIF Search Terms`, sources `userdoccers:resources/integration.mdx` and `xhyrom:data/client/routes.json`.
- Local Userdoccers catalog: `packages/automatic-reverse-engineering/data/catalogs/routes.userdoccers.catalog.json` lists `GET /gifs/suggest`, route name `GET_GIFS_SUGGEST`, source `userdoccers:resources/integration.mdx`.
- Local xHyroM catalog: `packages/automatic-reverse-engineering/data/catalogs/routes.xhyrom.catalog.json` lists `GET`, `HEAD`, and `OPTIONS` for `/gifs/suggest`, route name `GIFS_SUGGEST`.
- Userdoccers page used: `https://docs.discord.food/resources/integration`, section `Get Suggested GIF Search Terms (Unauthenticated)`, documents `provider`, required `q`, `limit` default `20`, `locale` default `en-US`, and string search-term response behavior.
- Tenor documentation used: `https://tenor.com/gifapi/documentation`, `Autocomplete` endpoint, documents `/v1/autocomplete` for completed search terms from a partial query.

## Changed Files

- `src/api/routes/gifs/suggest.ts`: new route implementation, query parser, Tenor URL builder, provider handling, upstream error mapping, route metadata.
- `src/api/middlewares/NoAuthorizationRoutes.ts`: added public auth boundary for `GET /gifs/suggest`; corrected the touched AGPL warranty line.
- `test/routes/gifsSuggestRoute.test.ts`: focused route tests for parsing, Tenor URL construction, successful proxy/filtering, unsupported providers, missing query error, upstream failure, and public middleware behavior.
- `test/scenarios/search-discovery-public.test.ts`: added `/gifs/suggest` to GIF scenario coverage with Tenor autocomplete stubbing; scenario is skipped locally without Postgres admin URL.
- `testing/suite-coverage-policy.json`: assigns the new GIF route to existing search/discovery public scenario coverage.
- Regenerated artifacts: `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`, `packages/missing-routes/missing.json`, `assets/testing-manifest.json`, `test/generated/http-contracts.json`, `test/generated/suite-coverage.json`, `assets/openapi.json`.

## Missing-Route Movement

- Before regeneration on current base `35716db52`: `Spacebar is missing 794`, `Spacebar implements 386`.
- After regeneration: `Spacebar is missing 793`, `Spacebar implements 387`.
- `/gifs/suggest` no longer appears in `packages/missing-routes/missing.json`; remaining missing entries for that route: `0`.

## Verification

- `npm run build:src:tsgo` passed.
- `npm run build:test-fixtures` passed.
- Focused route test passed: `node -r dotenv/config -r module-alias/register --enable-source-maps --test dist-test/test/routes/gifsSuggestRoute.test.js`.
- `npm run build --workspace @spacebar/automatic-reverse-engineering` passed.
- `node packages/automatic-reverse-engineering/dist/cli.js import-source-routes --root src/api/routes --out packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json` passed.
- `npm run build --workspace @spacebar/missing-routes` passed.
- `npm run start --workspace @spacebar/missing-routes` passed and wrote `missing.json`.
- `npm run generate:schema` passed and wrote `749` schemas; no schema file changed because existing `TenorTrendingSearchResponse` covers the string-array response.
- `npm run generate:testing-manifest` passed and wrote `492` entries.
- `node scripts/testing-manifest/verify.js` passed.
- `npm run generate:contract-tests` regenerated `467` contracts; `node scripts/testing-manifest/generate-contract-tests.js --check` passed.
- `npm run generate:suite-coverage` regenerated `15` suites; `node scripts/testing-manifest/generate-suite-coverage.js --check` passed.
- `npm run generate:openapi` passed with `307` paths / `749` schemas and the pre-existing warning about 3 webhook routes missing route metadata.
- `node --test test/generated/http-contracts.test.js test/generated/suite-coverage.test.js` passed: 13/13 tests.
- `node -r dotenv/config -r module-alias/register --enable-source-maps --test dist-test/test/scenarios/search-discovery-public.test.js` skipped locally because the integration scenario requires Postgres admin configuration.
- `git diff --check` passed.
- `git diff -- package.json package-lock.json npm-shrinkwrap.json --exit-code` passed.
- Changed/untracked-file malformed warranty spelling scan printed no output.

## Risks And Blockers

- No blocker remains for the assigned route.
- Only Tenor is proxied because existing GIF routes use Tenor and there is no local Giphy/Klipy integration. Unsupported documented providers return `[]`, matching the existing `/gifs/trending-search` compatibility pattern.
- The implementation uses Tenor's legacy `/v1/autocomplete` host to stay consistent with existing local Tenor routes. A future broader GIF provider migration should update all GIF routes together rather than this isolated path.
- The full search/discovery scenario was not executed end-to-end in this worktree because local Postgres admin configuration is unavailable.

## Recommended Next Tasks

- Run `test/scenarios/search-discovery-public.test.ts` in an environment with Postgres admin access if scenario-level evidence is required before merge.
- Consider a separate, non-scoped cleanup to align existing `/gifs/search`, `/gifs/trending`, and `/gifs/trending-search` auth behavior with the same Userdoccers unauthenticated GIF endpoint evidence.
