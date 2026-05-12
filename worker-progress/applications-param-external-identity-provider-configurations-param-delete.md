# DELETE /applications/{param}/external-identity-provider-configurations/{param}

Stable worker id: `applications_param_external_identity_provider_configurations_param_delete`

Assigned route: `DELETE /applications/{param}/external-identity-provider-configurations/{param}`

Assigned route name: `DELETE_APPLICATIONS_APPLICATION_ID_EXTERNAL_IDENTITY_PROVIDER_CONFIGURATIONS_IDENTITY_PROVIDER_TYPE`

## Summary

Implemented the assigned DELETE route on the existing application external identity provider configurations router.

- Requires authenticated application-management access: owner, owning team owner, or accepted team admin/developer.
- Validates documented external provider path values: `OIDC`, `EPIC_ONLINE_SERVICES`, `STEAM`, `UNITY`, `APPLE`, `PLAYSTATION_NETWORK`.
- Rejects non-external or unknown provider types with `UNKNOWN_PROVIDER`.
- Deletes through an injected provider-configuration repository when durable backing exists.
- Fails closed with a 404 `UNKNOWN_PROVIDER` response by default because Spacebar does not currently persist external identity provider configuration state.

## Changed Files

- `src/api/routes/applications/#application_id/external-identity-provider-configurations.ts`
- `src/api/util/utility/ApplicationAuthorization.ts`
- `src/api/util/utility/ApplicationAuthorization.test.ts`
- `test/routes/applications-external-identity-provider-configurations-delete.test.ts`
- `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`
- `packages/missing-routes/missing.json`
- `assets/openapi.json`
- `assets/testing-manifest.json`
- `test/generated/http-contracts.json`
- `test/generated/suite-coverage.json`

## Evidence Sources

- Userdoccers `pages/resources/application.mdx` documents the application external identity provider configuration object, supported provider names, GET/PUT/DELETE endpoints, and DELETE returning a 204 empty response on success.
- Existing local GET route: `src/api/routes/applications/#application_id/external-identity-provider-configurations.ts`.
- Existing application/team authorization patterns: `src/api/util/utility/ApplicationAuthorization.ts`.
- Local persistence check: no durable `ApplicationExternalIdentityProviderConfiguration` entity, migration, or admin DB model exists.

## Current-Base Movement

Base commit: `0a632f187`

- `missing`: 543 -> 542
- `spacebar`: 637 -> 638
- `discord`: 1128
- Assigned DELETE route removed from `missing_entries`.
- Adjacent `PUT_APPLICATIONS_APPLICATION_ID_EXTERNAL_IDENTITY_PROVIDER_CONFIGURATIONS_IDENTITY_PROVIDER_TYPE` remains missing and untouched.

## Verification

Passed:

- `npm run build:src:tsgo`
- `npm run generate:openapi`
- `npm run build --workspace @spacebar/automatic-reverse-engineering`
- `node packages/automatic-reverse-engineering/dist/cli.js import-source-routes --root src/api/routes --out packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`
- `npm run build --workspace @spacebar/missing-routes`
- `npm run start --workspace @spacebar/missing-routes`
- `npm run generate:testing-manifest`
- `npm run generate:contract-tests`
- `npm run generate:suite-coverage`
- `npm run build:test-fixtures`
- Focused built tests: `ApplicationAuthorization`, existing external identity provider configurations GET tests, and new DELETE tests (`57/57`).
- `npm run test:manifest`
- `node scripts/testing-manifest/generate-contract-tests.js --check`
- `npm run test:suite-coverage`
- Targeted ESLint on touched TypeScript files
- `git diff --check`
- `git diff --exit-code -- package.json package-lock.json`

`npm run test:contracts` passed generated/static contract checks and failed only on the known unrelated runtime contract: `api:http:GET:/discovery/search` returned `500 !== 200`.

## Risks / Blockers

- Spacebar has no durable local state for external identity provider configurations, so the default DELETE behavior cannot truthfully return 204. It fails closed with 404 after successful authorization and provider validation.
- A future durable provider configuration entity/repository can plug into the injected `providerConfigurationRepository` path and return 204 when a row is actually deleted.

## Adjacent Routes Untouched

- `PUT /applications/{param}/external-identity-provider-configurations/{param}` remains missing and intentionally unimplemented.
- Existing GET behavior for `/applications/{param}/external-identity-provider-configurations` remains the same conservative empty list after access checks.
