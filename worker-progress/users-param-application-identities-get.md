# users-param-application-identities-get

## Summary

Implemented `GET /users/{user_id}/application-identities` only.

The route now:
- Requires normal bearer authentication through the existing API auth boundary.
- Resolves `@me` to the authenticated user id.
- Verifies the target user exists before returning data.
- Returns `{ "identities": [] }` conservatively because Spacebar does not yet persist durable application-scoped external identities or application profile data.

Generic `ConnectedAccount` rows are deliberately not exposed as application identities because they are not scoped to a requesting application and do not carry the documented provider/application profile fields.

## Assigned Path

- Route id: `users-param-application-identities-get`
- Route name: `GET_USERS_USER_ID_APPLICATION_IDENTITIES`
- Method/path: `GET /users/{user_id}/application-identities`
- Source reference used: `userdoccers:resources/user.mdx`
- Missing methods found: `GET`
- Methods implemented: `GET`
- Adjacent routes intentionally not implemented: bulk `POST /application-identities`, linked connections, OAuth callbacks, application identity persistence, user profile/settings/relationship routes.

## Changed Files

Primary implementation:
- `src/api/routes/users/#user_id/application-identities.ts`
- `src/api/routes/users/#user_id/application-identities.test.ts`
- `src/schemas/responses/ApplicationIdentitiesResponse.ts`
- `src/schemas/uncategorised/ApplicationIdentitiesSchema.test.ts`
- `tsconfig.test.json`

Generated artifacts:
- `assets/schemas.json`
- `assets/openapi.json`
- `assets/testing-manifest.json`
- `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`
- `packages/missing-routes/missing.json`
- `test/generated/http-contracts.json`
- `test/generated/suite-coverage.json`

## Evidence Gathered

- `packages/missing-routes/missing.json` contained `GET /users/{param}/application-identities` before the current-base merge.
- `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json` and `src/api/routes/**` had no user-scoped application identities route before implementation.
- Userdoccers documents `Get User Application Identities` with response object field `identities`, identity fields `application_id` and `provider_issued_user_id`, and optional `profile` or `profiles`.
- Existing local persistence has generic connected accounts but no durable application-scoped identity or profile table, so the endpoint returns only locally backed data: currently an empty array.
- Current-base missing-route movement: `644 -> 643` missing and `536 -> 537` implemented.
- Assigned missing entry count moved from `1` to `0`.
- Source catalog now contains `GET /users/{user_id}/application-identities` from `src/api/routes/users/#user_id/application-identities.ts` with `UserApplicationIdentitiesResponse`.
- Testing manifest now contains `api:http:GET:/users/:user_id/application-identities/` with bearer auth mode.
- HTTP contracts now contain the generated route contract with auth, response-shape, ownership-boundary, schema-validation, and db-state cases.
- OpenAPI now contains `/users/{user_id}/application-identities/` with `200`, `401`, and `404` responses.

## Commands Run

Setup and focused verification:
- `npm run build:src:tsgo` - passed.
- `npm run generate:schema` - passed, wrote `1021` schemas.
- `npm run build:test-fixtures` - passed.
- `node -r dotenv/config -r module-alias/register --enable-source-maps --test dist-test/src/schemas/uncategorised/ApplicationIdentitiesSchema.test.js dist-test/src/api/routes/application-identities.test.js 'dist-test/src/api/routes/users/#user_id/application-identities.test.js'` - passed, `11` tests.

Generated artifacts:
- `npm run build --workspace @spacebar/automatic-reverse-engineering` - passed.
- `node packages/automatic-reverse-engineering/dist/cli.js import-source-routes --root src/api/routes --out packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json` - passed.
- `npm run build --workspace @spacebar/missing-routes` - passed.
- `npm run start --workspace @spacebar/missing-routes` - passed, wrote `missing = 643`, `spacebar = 537`, `discord = 1128`.
- `npm run generate:testing-manifest` - passed, wrote `642` entries.
- `node scripts/testing-manifest/verify.js` - passed.
- `node scripts/testing-manifest/generate-contract-tests.js --check` - first reported stale contracts as expected after adding the route.
- `npm run generate:contract-tests` - passed, wrote `617` contracts.
- `node scripts/testing-manifest/generate-contract-tests.js --check` - passed.
- `node scripts/testing-manifest/generate-suite-coverage.js --check` - first reported stale suite coverage as expected after adding the route.
- `npm run generate:suite-coverage` - passed, wrote `15` suites.
- `node scripts/testing-manifest/generate-suite-coverage.js --check` - passed.
- `npm run generate:openapi` - passed, wrote `431` paths and `1021` schemas with only pre-existing webhook route middleware warnings.

Generated/static tests:
- `node --test test/generated/http-contracts.test.js test/contracts/*.test.cjs` - passed, `10` tests.
- `node --test test/generated/suite-coverage.test.js` - passed, `4` tests.
- `npm run test:manifest` - passed, `30` tests plus manifest verification.
- `npm run test:suite-coverage` - passed.
- `npm run test:contracts` - static contract matrix passed, then runtime contracts failed on unrelated public response-schema coverage:
  - `api:http:GET:/discovery/search should return a successful response for schema validation`
  - actual status `500`, expected `200`
  - This is outside the assigned application identities route and matches the known current-base blocker.

Final hygiene:
- `npm run lint` - passed.
- `git diff --check` - passed.
- Package/lockfile guard - no `package.json` or `package-lock.json` changes.
- Malformed warranty-token scan across `src`, `test`, `packages`, `scripts`, `assets`, and `worker-progress` - no matches.

## Artifact Status

- Schemas regenerated and contain `UserApplicationIdentitiesResponse`.
- OpenAPI regenerated and contains the new route.
- Source catalog regenerated and contains the new route.
- Missing report regenerated and removed only the assigned GET entry.
- Testing manifest regenerated and verified.
- HTTP contracts regenerated and verified.
- Suite coverage regenerated and verified.

## Completion Audit

- Assigned route only: yes.
- Missing entry confirmed absent before implementation: yes.
- Userdoccers compared for response shape and local support limits: yes.
- Production behavior implemented without fabricating unsupported Discord data: yes.
- Focused route and schema tests added and passed: yes.
- Required generated artifacts refreshed: yes.
- Package and lockfile guard clean: yes.
- Malformed warranty-token scan clean: yes.

## Risks / Blockers

- Spacebar still lacks durable application-scoped identity/profile persistence. The endpoint intentionally returns `[]` until such storage exists.
- `npm run test:contracts` remains blocked by the unrelated runtime `/discovery/search` failure returning `500` instead of `200`.

## Recommended Next Tasks

- Add durable application identity/profile persistence before returning non-empty `identities`.
- Define authorization/privacy rules for target-user visibility and `with_profiles=true` when persistence exists.
- Triage the existing `/discovery/search` runtime contract failure separately.
