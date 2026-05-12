# applications-param-users-param-identities-param-profile-get

## Summary

Implemented `GET /applications/{application_id}/users/{user_id}/identities/{external_user_id}/profile` only. The route requires a bearer token with an OAuth/application claim matching the path application ID, returns a documented `UserApplicationProfileResponse` when a local provider supplies one, and otherwise fails closed with `404` instead of fabricating external provider profile data.

## Changed Files

- `src/api/routes/applications/#application_id/users/#user_id/identities/#external_user_id/profile.ts`
- `src/schemas/responses/ApplicationIdentitiesResponse.ts`
- `src/schemas/uncategorised/ApplicationIdentitiesSchema.test.ts`
- `test/routes/applications-param-users-param-identities-param-profile-get.test.ts`
- `assets/schemas.json`
- `assets/openapi.json`
- `assets/testing-manifest.json`
- `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`
- `packages/missing-routes/missing.json`
- `test/generated/http-contracts.json`
- `test/generated/suite-coverage.json`

## Commands Run

- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm ci`
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run build:src:tsgo`
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run generate:schema`
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run generate:openapi`
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run build --workspace @spacebar/automatic-reverse-engineering`
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" node packages/automatic-reverse-engineering/dist/cli.js import-source-routes --root src/api/routes --out packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run build --workspace @spacebar/missing-routes`
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run start --workspace @spacebar/missing-routes`
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run generate:testing-manifest`
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run generate:contract-tests`
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run generate:suite-coverage`
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run build:test-fixtures`
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" node -r dotenv/config -r module-alias/register --enable-source-maps --test dist-test/test/routes/applications-param-users-param-identities-param-profile-get.test.js dist-test/src/schemas/uncategorised/ApplicationIdentitiesSchema.test.js`
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run test:manifest`
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run test:suite-coverage`
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run test:contracts`
- `git diff --check`
- `git diff --exit-code -- package.json package-lock.json`
- `git status --short package.json package-lock.json package-lock.json apps/*/package.json packages/*/package.json`

## Verification Results

- Focused route/schema tests passed: 11 tests.
- `npm run build:src:tsgo` passed standalone and inside `npm run test:contracts`.
- `npm run build:test-fixtures` passed standalone and inside `npm run test:contracts`.
- `npm run test:manifest` passed.
- `npm run test:suite-coverage` passed.
- `git diff --check` passed.
- Package/lockfile guard passed; no `package.json` or `package-lock.json` changes.
- `npm run test:contracts` generated/static contract checks passed, then failed only in runtime on known unrelated `api:http:GET:/discovery/search` returning `500 !== 200`.
- Current-base merge verification repeated source build, schema/OpenAPI/source-catalog/missing-route/testing-manifest/contract/suite regeneration, generated-artifact checks, conflict-marker scan, package/lockfile guard, test-fixture build, focused compiled route/schema tests, `test:manifest`, and `test:suite-coverage`: pass.
- Current-base OpenAPI contains 526 paths and 1183 schemas; testing manifest has 742 entries; generated HTTP contracts have 717 contracts.
- Current-base `npm run test:contracts` generated/static contract checks pass, then fails only on the known unrelated runtime assertion `api:http:GET:/discovery/search` returning `500 !== 200`; existing analytics `query` route-registration warnings also appear.

## Evidence Gathered

- `packages/missing-routes/missing.json` had GET and PATCH entries for `/applications/{param}/users/{param}/identities/{param}/profile` before implementation.
- `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json` had no route entry for `/applications/{application_id}/users/{user_id}/identities/{external_user_id}/profile` before implementation.
- Userdoccers `resources/application.mdx` documents `Get User Application Profile`, says it returns a user application profile for the application/user/external-user IDs, and says the endpoint is not usable by user accounts: `https://raw.githubusercontent.com/discord-userdoccers/discord-userdoccers/master/pages/resources/application.mdx`
- Userdoccers `gateway/gateway-events.mdx` documents the user application profile fields: username, metadata, optional data/data_trusted, external_id, and avatar_hash: `https://raw.githubusercontent.com/discord-userdoccers/discord-userdoccers/master/pages/gateway/gateway-events.mdx`
- Nearby local routes used for behavior patterns: `src/api/routes/application-identities.ts`, `src/api/routes/users/#user_id/application-identities.ts`, `src/api/routes/users/@me/applications/#application_id/role-connection.ts`, and `src/api/routes/applications/#application_id/external-identity-provider-configurations.ts`.

## Missing-Route Movement

- Before regeneration on this base: `missing: 550`, `spacebar: 630`, `discord: 1128`.
- After regeneration: `missing: 549`, `spacebar: 631`, `discord: 1128`.
- Current integration base before merge: `missing: 544`, `spacebar: 636`, `discord: 1128`.
- Current integration base after regeneration: `missing: 543`, `spacebar: 637`, `discord: 1128`.
- Removed missing entry: `GET_APPLICATIONS_APPLICATION_ID_USERS_USER_ID_IDENTITIES_EXTERNAL_USER_ID_PROFILE`.
- Preserved adjacent missing entry: `PATCH_APPLICATIONS_APPLICATION_ID_USERS_USER_ID_IDENTITIES_EXTERNAL_USER_ID_PROFILE`.

## Risks And Blockers

- Spacebar still has no durable application-scoped external identity profile persistence. The default implementation returns `404` for absent local profile data to avoid fabricating external provider state.
- A future storage/provider layer can supply `UserApplicationProfileResponse` through the route provider without changing the auth, schema, or route metadata.
- `npm run test:contracts` remains blocked by the unrelated known runtime `GET /discovery/search` `500 !== 200` failure.

## Adjacent Routes Untouched

- Did not implement `PATCH /applications/{param}/users/{param}/identities/{param}/profile`.
- Did not modify identity mutation, OAuth callback, user profile mutation, connection, application ownership, or role-connection routes.
- Did not change package metadata, package lockfiles, remotes, branches, or git history.

## Reconciliation Notes

- New source catalog entry exactly matches `GET_APPLICATIONS_APPLICATION_ID_USERS_USER_ID_IDENTITIES_EXTERNAL_USER_ID_PROFILE`.
- `assets/openapi.json`, `assets/testing-manifest.json`, `test/generated/http-contracts.json`, and `test/generated/suite-coverage.json` all include the new GET route with bearer auth and `200/400/401/404` response metadata.
- Only the GET missing entry moved; PATCH remains in `packages/missing-routes/missing.json` for a separate assignment.
