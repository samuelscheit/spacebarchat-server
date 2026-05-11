# users-me-linked-connections-get

## Summary

Implemented `GET /users/@me/linked-connections` only.

The route now:
- Requires an OAuth2-style token containing the `connections` scope.
- Requires an application claim (`application_id`, `client_id`, nested `application.id`, `azp`, or `aud`) so normal user tokens and ambiguous scoped tokens cannot use the endpoint.
- Returns an empty `LinkedConnectionsResponse` because Spacebar currently has `ConnectedAccount.two_way_link` but no durable application-scoped linked-connection grant that can prove which OAuth application owns a two-way link. This fails closed instead of exposing all local two-way connected accounts to any app with the `connections` scope.

## Assigned Path

- Route id: `users-me-linked-connections-get`
- Route name: `GET_USERS__ME_LINKED_CONNECTIONS`
- Method/path: `GET /users/@me/linked-connections`
- Source reference used: `userdoccers:resources/connected-accounts.mdx` via `https://docs.discord.food/resources/connected-accounts`
- Missing methods found: `GET`
- Methods implemented: `GET`

## Changed Files

Primary implementation:
- `src/api/routes/users/@me/linked-connections.ts`
- `src/api/routes/users/@me/linked-connections.test.ts`
- `src/schemas/responses/LinkedConnectionsResponse.ts`
- `src/schemas/responses/LinkedConnectionsResponse.test.ts`
- `src/schemas/responses/index.ts`
- `tsconfig.test.json`

Generated artifacts:
- `assets/schemas.json`
- `assets/openapi.json`
- `assets/testing-manifest.json`
- `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`
- `packages/missing-routes/missing.json`
- `test/generated/http-contracts.json`
- `test/generated/suite-coverage.json`

Handoff hygiene:
- Fixed preexisting malformed warranty spelling variants found by the required scan in affected source/test files. No package or lockfile changes.

## Evidence Gathered

- `packages/missing-routes/missing.json` initially contained `GET /users/@me/linked-connections`.
- `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json` and `src/api/routes/**` had no implementation before this worker.
- Userdoccers documents this endpoint as OAuth2-only with the `connections` scope, returning connection objects that have a two-way link with the requesting application.
- Existing local support has `ConnectedAccount.two_way_link` and token data, but no application-scoped linked-connection grant or application id on connected accounts. Returning local connected accounts would overexpose data, so the route returns only locally backed application-specific data: currently `[]`.
- Regenerated source catalog now includes `GET_USERS__ME_LINKED_CONNECTIONS` from `src/api/routes/users/@me/linked-connections.ts`.
- Worker-base missing-route count moved from 647 to 646; the assigned missing entry is gone.
- Current-base orchestrator merge movement is `645 -> 644` missing and `535 -> 536` implemented.
- Testing manifest now includes `api:http:GET:/users/@me/linked-connections/`.
- OpenAPI now includes `/users/@me/linked-connections/` with `LinkedConnectionsResponse`, `APIErrorResponse` 400, and `APIErrorResponse` 401.

## Commands Run

Setup and focused verification:
- `npm run build:src:tsgo` initially failed because this worktree had no `node_modules` and TypeScript could not find `@types/node`.
- `npm ci`
- `npm run build:src:tsgo` - passed
- `npm run generate:schema` - passed; current-base orchestrator merge wrote 1016 schemas
- `npm run build:test-fixtures` - passed
- `node -r dotenv/config -r module-alias/register --enable-source-maps --test dist-test/src/api/routes/users/@me/linked-connections.test.js dist-test/src/schemas/responses/LinkedConnectionsResponse.test.js` - passed

Generated artifacts:
- `npm run build --workspace @spacebar/automatic-reverse-engineering` - passed
- `node packages/automatic-reverse-engineering/dist/cli.js import-source-routes --root src/api/routes --out packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json` - passed
- `npm run build --workspace @spacebar/missing-routes` - passed
- `npm run start --workspace @spacebar/missing-routes` - passed, wrote missing count 646 on the worker base and 644 on the current-base orchestrator merge
- `npm run generate:testing-manifest` - passed, wrote 639 entries on the worker base and 641 entries on the current-base orchestrator merge
- `npm run test:manifest` - passed
- `node scripts/testing-manifest/generate-contract-tests.js --check` - failed stale as expected after adding the route
- `npm run generate:contract-tests` - passed, wrote 614 contracts on the worker base and 616 contracts on the current-base orchestrator merge
- `node scripts/testing-manifest/generate-suite-coverage.js --check` - failed stale as expected after adding the route
- `npm run generate:suite-coverage` - passed, wrote 15 suites
- `npm run generate:openapi` - passed, wrote 428 paths and 1013 schemas on the worker base and 430 paths and 1016 schemas on the current-base orchestrator merge, with only pre-existing webhook route middleware warnings
- `node scripts/testing-manifest/generate-contract-tests.js --check && node scripts/testing-manifest/generate-suite-coverage.js --check` - passed
- `npm run test:suite-coverage` - passed

Generated contract tests:
- `npm run test:contracts` - static contract matrix passed, auth-runtime aggregate started and verified missing/malformed bearer-token coverage, then failed on unrelated public response schema route:
  - `api:http:GET:/discovery/search should return a successful response for schema validation`
  - actual status `500`, expected `200`
  - This is outside the assigned linked-connections route and reproduced unchanged during current-base orchestrator merge.

Final hygiene:
- `git diff --check` - passed
- `git diff -- package.json package-lock.json` - empty
- Malformed warranty-token scan across `src packages test scripts assets worker-progress` - no matches after mechanical header spelling fix
- Final `npm run build:src:tsgo` - passed

## Artifact Status

- Source catalog regenerated and contains the route.
- Missing routes regenerated and assigned route removed.
- Testing manifest regenerated and verified.
- HTTP contracts regenerated and `--check` verified.
- Suite coverage regenerated and verified.
- OpenAPI regenerated and contains the route.
- Schemas regenerated and contain `LinkedConnectionsResponse`.

## Completion Audit

- Assigned route only: yes, implementation is limited to `GET /users/@me/linked-connections`.
- Missing entry confirmed absent before implementation: yes.
- Userdoccers compared for auth and response behavior: yes.
- Production behavior implemented without fabricating unsupported Discord data: yes, OAuth scope/application gate plus fail-closed empty response.
- Focused route and schema tests added and passed: yes.
- Required generated artifacts refreshed: yes.
- Package and lockfile guard clean: yes.
- Malformed warranty-token scan clean: yes.

## Risks / Blockers

- Spacebar still lacks durable application-scoped linked-connection grant persistence. The endpoint is intentionally conservative and returns `[]` until such storage exists.
- `npm run test:contracts` has an unrelated runtime failure on `/discovery/search` returning 500 during generated public response-schema validation.

## Recommended Next Tasks

- Add application-scoped linked-connection persistence if Spacebar later supports Discord's two-way linked role/app connection model, then update this route to return only grants for the requesting application.
- Triage the existing generated contract runtime failure for `/discovery/search`.
