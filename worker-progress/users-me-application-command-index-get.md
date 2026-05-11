# users-me-application-command-index-get

## Summary

Implemented `GET /users/@me/application-command-index` only.

The route is authenticated and returns an `ApplicationCommandIndexResponse` with empty `applications` and `application_commands` plus a generated `version`. This is intentional: Spacebar currently has no durable per-user application install table or user-scoped `applications.commands` authorization storage. Returning an empty locally-backed index avoids fabricating Discord/user-installed command data or leaking guild-installed commands into the user command index.

## Changed Files

- `src/api/routes/users/@me/application-command-index.ts`
- `src/api/routes/users/@me/application-command-index.test.ts`
- `src/schemas/responses/ApplicationCommandIndexResponse.ts`
- `src/schemas/responses/ApplicationCommandIndexResponse.test.ts`
- `src/schemas/responses/index.ts`
- `test/scenarios/applications-commands.test.ts`
- `tsconfig.test.json`
- `assets/schemas.json`
- `assets/openapi.json`
- `assets/testing-manifest.json`
- `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`
- `packages/missing-routes/missing.json`
- `test/generated/http-contracts.json`
- `test/generated/suite-coverage.json`

## Evidence Gathered

- `packages/missing-routes/missing.json` had exactly one assigned missing entry:
  - method `GET`
  - route `/users/@me/application-command-index`
  - route_name `GET_USERS__ME_APPLICATION_COMMAND_INDEX`
  - source `userdoccers:interactions/application-commands.mdx`
- `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json` had no source entry for `/users/@me/application-command-index` before implementation.
- `src/api/routes/**` had only `src/api/routes/guilds/#guild_id/application-command-index.ts`; no user route existed.
- Userdoccers reference used:
  - `https://github.com/discord-userdoccers/discord-userdoccers/blob/master/pages/interactions/application-commands.mdx`
  - It documents the Application Command Index object shape and says the user command index contains commands from applications installed to the current user's account.
- xHyroM references used: none needed for this route.
- Local storage review found guild command indexing is backed by guild bot membership plus `ApplicationCommand`; OAuth2 authorization endpoints explicitly document missing durable grant storage, and there is no user-install entity/table for user-scoped command installs.

## Missing Count Movement

- Worker-base regeneration: `644 -> 643`.
- Current-base acceptance regeneration: `642 -> 641`, implemented routes
  `538 -> 539`, Discord routes `1128`.
- Assigned missing entry removed from `packages/missing-routes/missing.json`.
- Source catalog now includes:
  - `GET /users/@me/application-command-index`
  - `src/api/routes/users/@me/application-command-index.ts`
  - response schema refs `APIErrorResponse` and `ApplicationCommandIndexResponse`

## Artifact Status

- Regenerated source catalog.
- Regenerated missing-routes report.
- Regenerated schemas after adding `ApplicationCommandIndexResponse`.
- Regenerated testing manifest.
- Current-base testing manifest contains `644` entries.
- Regenerated generated HTTP contracts after stale check.
- Current-base generated HTTP contracts contain `619` contracts.
- Regenerated suite coverage after stale check.
- Regenerated OpenAPI.
- Current-base OpenAPI contains `434` paths and `1025` schemas.
- Current-base schema generation writes `ApplicationCommandIndexApplicationResponse.flags`
  as an `integer`, matching existing application flag bitfields.
- Added focused route and schema tests to `tsconfig.test.json`.

## Commands Run

- `npm ci` - passed; installed worktree-local dependencies because the worktree initially had no `node_modules`.
- `npm run build:src:tsgo` - initially failed before dependency install: `TS2688 Cannot find type definition file for 'node'`; passed after `npm ci`.
- Final `npm run build:src:tsgo` re-run - passed.
- `npm run generate:schema` - passed.
- `npm run build:test-fixtures` - passed.
- `node -r dotenv/config -r module-alias/register --enable-source-maps --test dist-test/src/api/routes/users/@me/application-command-index.test.js dist-test/src/schemas/responses/ApplicationCommandIndexResponse.test.js` - passed.
- One final focused test invocation was accidentally started while `build:src:tsgo` was clearing/rebuilding `dist/`, causing a transient `dist/api/util/handlers/route.js` module-resolution failure; the same focused command passed after the build completed.
- `node -r dotenv/config -r module-alias/register --enable-source-maps --test --test-concurrency=1 dist-test/test/scenarios/applications-commands.test.js` - skipped because the Postgres admin fixture is not configured in this environment.
- `npm run build --workspace @spacebar/automatic-reverse-engineering` - passed.
- `node packages/automatic-reverse-engineering/dist/cli.js import-source-routes --root src/api/routes --out packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json` - passed.
- `npm run build --workspace @spacebar/missing-routes` - passed.
- `npm run start --workspace @spacebar/missing-routes` - passed; wrote `Spacebar is missing 643`.
- `npm run generate:testing-manifest` - passed.
- `node scripts/testing-manifest/verify.js` - passed.
- `node scripts/testing-manifest/generate-contract-tests.js --check` - first failed stale, then passed after `npm run generate:contract-tests`.
- `npm run generate:contract-tests` - passed.
- `node scripts/testing-manifest/generate-suite-coverage.js --check` - first failed stale, then passed after `npm run generate:suite-coverage`.
- `npm run generate:suite-coverage` - passed.
- `npm run generate:openapi` - passed; retained existing unrelated warnings about webhook routes missing route metadata and reported 3 unrelated routes missing route middleware.
- `node --test test/generated/http-contracts.test.js test/generated/suite-coverage.test.js` - passed.
- `npm run test:manifest` - passed.
- `npm run test:suite-coverage` - passed.
- `node scripts/testing-manifest/generate-contract-tests.js --check && node --test test/generated/http-contracts.test.js test/contracts/*.test.cjs` - passed.
- `npm run test:contracts:runtime` - failed outside scope after build steps passed: generated public response-schema contract expected `GET /discovery/search` to return 200, but the real API returned 500. The assigned route is authenticated and was not part of that failed public response-schema case.
- `git diff --check` - passed.
- Package/lockfile guard: `git diff --name-only -- package.json package-lock.json npm-shrinkwrap.json pnpm-lock.yaml yarn.lock` produced no output.
- Malformed warranty-token scan across TS/JS/JSON/MD files produced no source-header matches.

## Current-Base Acceptance Commands

- `npm run build:src:tsgo`
- `npm run generate:schema`
- `npm run build --workspace @spacebar/automatic-reverse-engineering`
- `node packages/automatic-reverse-engineering/dist/cli.js import-source-routes --root src/api/routes --out packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`
- `npm run build --workspace @spacebar/missing-routes`
- `npm run start --workspace @spacebar/missing-routes`
- `npm run generate:testing-manifest`
- `node scripts/testing-manifest/verify.js`
- `npm run generate:contract-tests`
- `node scripts/testing-manifest/generate-contract-tests.js --check`
- `npm run generate:suite-coverage`
- `node scripts/testing-manifest/generate-suite-coverage.js --check`
- `npm run generate:openapi`
- `npm run build:test-fixtures`
- `node -r dotenv/config -r module-alias/register --enable-source-maps --test dist-test/src/api/routes/users/@me/application-command-index.test.js dist-test/src/schemas/responses/ApplicationCommandIndexResponse.test.js`
- `node -r dotenv/config -r module-alias/register --enable-source-maps --test --test-concurrency=1 dist-test/test/scenarios/applications-commands.test.js`
  - Skipped by the existing Postgres admin fixture guard.
- `node --test test/generated/http-contracts.test.js test/generated/suite-coverage.test.js`
- `npm run test:manifest`
- `npm run test:suite-coverage`
- `npm run lint`
- `npm run test:contracts`
  - Failed only on known unrelated runtime contract
    `api:http:GET:/discovery/search` returning `500 !== 200`.
- `git diff --check`
- Package/lockfile guard.
- Malformed warranty-token scan over `src`, `test`, `packages`, `scripts`,
  `assets`, and `worker-progress`.

## Risks Or Blockers

- The user command index is intentionally empty until Spacebar has durable per-user application install/authorization storage. This is a conservative compatibility response, not a full Discord user-install implementation.
- Runtime contract suite has an unrelated existing failure for public `GET /discovery/search` returning 500.
- Applications scenario integration test could not execute without the Postgres admin test fixture and was skipped by the existing test guard.

## Final Audit

- Scope stayed limited to `GET /users/@me/application-command-index`; no adjacent command-index, search, mutation, install-flow, or settings route was implemented.
- Route remains authenticated, declares 200 and 401 response metadata, and is present in the source catalog, OpenAPI, testing manifest, generated contracts, and suite coverage.
- Response behavior is locally backed: empty applications and commands with a generated snowflake version until durable user application install storage exists.
- Focused tests cover route metadata, authenticated-route boundary, empty response behavior, and generated schema shape.
- Generated artifacts are current after schema, source catalog, missing-routes, manifest, contract, suite coverage, and OpenAPI regeneration.
- Final hygiene checks passed: whitespace diff check, package/lockfile guard, and malformed warranty-token scan.

## Recommended Next Tasks

- Implement durable user application install / OAuth `applications.commands` grant storage before returning user-installed command data from this endpoint.
- Investigate the unrelated generated runtime contract failure for `GET /discovery/search`.
