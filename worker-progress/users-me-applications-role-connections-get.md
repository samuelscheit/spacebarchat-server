# GET /users/@me/applications/role-connections

## Summary

Accepted from worker `users_me_applications_role_connections_get` and
reconciled onto current main commit `1c53c2715`.

Implemented only `GET /users/@me/applications/role-connections`. The route is
bearer-authenticated and returns the locally truthful empty application role
connection list because Spacebar has no durable per-user application role
connection persistence.

## Changed Files

- `src/api/routes/users/@me/applications/role-connections.ts`
- `src/schemas/responses/ApplicationRoleConnectionsResponse.ts`
- `src/schemas/responses/ApplicationRoleConnectionsResponse.test.ts`
- `src/schemas/responses/index.ts`
- `test/routes/users-me-applications-role-connections.test.ts`
- `tsconfig.test.json`
- `assets/schemas.json`
- `assets/openapi.json`
- `assets/testing-manifest.json`
- `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`
- `packages/missing-routes/missing.json`
- `test/generated/http-contracts.json`
- `test/generated/suite-coverage.json`

## Evidence

- Userdoccers `resources/application.mdx` documents "Get User Application Role
  Connections" as a current-user route returning a list of application role
  connection objects.
- The xHyroM catalog contains `APPLICATION_USER_ROLE_CONNECTIONS` for
  `/users/@me/applications/role-connections`.
- Local code has application role connection metadata fields, but no durable
  current-user role connection storage. The accepted behavior therefore returns
  a fresh empty array instead of fabricating Discord-linked account state.
- Adjacent `GET` and `PUT /users/@me/applications/{param}/role-connection`
  entries remain missing and untouched.

## Current-Base Movement

- Before: `missing = 596`, `spacebar = 584`, `discord = 1128`.
- After regeneration: `missing = 595`, `spacebar = 585`, `discord = 1128`.
- The assigned route is absent from `missing_entries[]`.
- The adjacent `/users/@me/applications/{param}/role-connection` path remains
  present in `missing_entries[]`.

## Verification

Commands run with `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH"`:

- `npm run build:src:tsgo`
- `npm run generate:schema`
- `npm run generate:openapi`
- `npm run build --workspace @spacebar/automatic-reverse-engineering`
- `node packages/automatic-reverse-engineering/dist/cli.js import-source-routes --root src/api/routes --out packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`
- `npm run build --workspace @spacebar/missing-routes`
- `npm run start --workspace @spacebar/missing-routes`
- `npm run generate:testing-manifest`
- `npm run generate:contract-tests`
- `npm run generate:suite-coverage`
- `npm run build:test-fixtures`
- `node -r dotenv/config -r module-alias/register --enable-source-maps --test dist-test/src/schemas/responses/ApplicationRoleConnectionsResponse.test.js dist-test/test/routes/users-me-applications-role-connections.test.js`
- `node scripts/testing-manifest/verify.js`
- `node scripts/testing-manifest/generate-contract-tests.js --check`
- `node scripts/testing-manifest/generate-suite-coverage.js --check`
- `node --test test/generated/http-contracts.test.js test/generated/suite-coverage.test.js`
- `npm run test:suite-coverage`
- `npm run lint`
- `git diff --check`
- `git diff --exit-code -- package.json package-lock.json bun.lock`
- `npm run test:contracts`

Passing evidence:

- Focused schema and route tests passed: 5/5.
- OpenAPI regenerated with 476 paths and 1108 schemas.
- Testing manifest regenerated and verified with 690 entries.
- Generated HTTP contract tests regenerated and verified with 665 contracts.
- Generated contract/suite tests passed: 13/13.
- Suite coverage tests passed: 4/4.
- Lint, whitespace diff check, and package/lockfile guard passed.

Known unrelated failure:

- `npm run test:contracts` failed only on
  `api:http:GET:/discovery/search`, which returned runtime `500 !== 200`.
  The analytics `query.ts` route-registration warnings are existing baseline
  noise and unrelated to this route.
