# GET /oauth2/applications/{param}/tokens

## Summary

Implemented exactly `GET /oauth2/applications/{application_id}/tokens` as an
authenticated developer-resource route.

The route authorizes application owners, owning team owners, and accepted
owning-team members, then returns `[]` because Spacebar does not currently
persist durable OAuth2 authorization grants. Broader grant storage, token
create/revoke flows, `/oauth2/tokens`, allowlist routes, asset routes, and
developer portal token management remain out of scope.

The original worker output included broad unrelated warranty-header cleanup.
The accepted current-base port intentionally excluded that unrelated cleanup and
kept only the scoped route, helper, schema, test, and generated artifact
changes.

## Changed Files

- `src/api/routes/oauth2/applications/#application_id/tokens.ts`
- `src/api/routes/oauth2/applications/#application_id/tokens.test.ts`
- `src/api/util/utility/ApplicationAuthorization.ts`
- `src/api/util/utility/ApplicationAuthorization.test.ts`
- `src/schemas/responses/OAuthAuthorizationsResponse.ts`
- `src/schemas/responses/OAuthAuthorizeInfoResponse.test.ts`
- `src/schemas/responses/index.ts`
- `tsconfig.test.json`
- `assets/schemas.json`
- `assets/openapi.json`
- `assets/testing-manifest.json`
- `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`
- `packages/missing-routes/missing.json`
- `test/generated/http-contracts.json`
- `test/generated/suite-coverage.json`

## Evidence

- Assigned missing entry before port:
  `GET /oauth2/applications/{param}/tokens`.
- Userdoccers source:
  `https://raw.githubusercontent.com/discord-userdoccers/discord-userdoccers/master/pages/topics/oauth2.mdx`.
- Current-base missing-route movement: `657 -> 656`.
- Current-base implemented-route movement: `523 -> 524`.
- Assigned missing entry is absent from regenerated `missing_entries`.
- Source catalog includes `GET /oauth2/applications/{application_id}/tokens`.
- Testing manifest includes
  `api:http:GET:/oauth2/applications/:application_id/tokens/`.
- OpenAPI includes `/oauth2/applications/{application_id}/tokens/` with
  `OAuthAuthorizationsResponse`.

## Verification

- `npm run build:src:tsgo`: passed.
- `npm run generate:schema`: passed; wrote 1003 schemas.
- `npm run build --workspace @spacebar/automatic-reverse-engineering`: passed.
- `node packages/automatic-reverse-engineering/dist/cli.js import-source-routes --root src/api/routes --out packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`:
  passed.
- `npm run build --workspace @spacebar/missing-routes`: passed.
- `npm run start --workspace @spacebar/missing-routes`: passed.
- `npm run generate:testing-manifest`: passed; wrote 629 entries.
- `node scripts/testing-manifest/verify.js`: passed.
- `npm run generate:contract-tests`: passed; wrote 604 contracts.
- `node scripts/testing-manifest/generate-contract-tests.js --check`: passed.
- `npm run generate:suite-coverage`: passed; wrote 15 suites.
- `node scripts/testing-manifest/generate-suite-coverage.js --check`: passed.
- `npm run generate:openapi`: passed; wrote 418 paths and 1003 schemas, with
  the existing unrelated webhook route metadata warnings.
- `npm run build:test-fixtures`: passed.
- Focused tests passed, 48/48:
  `dist-test/src/api/routes/oauth2/applications/#application_id/tokens.test.js`,
  `dist-test/src/api/util/utility/ApplicationAuthorization.test.js`, and
  `dist-test/src/schemas/responses/OAuthAuthorizeInfoResponse.test.js`.
- Generated contract/suite tests passed, 13/13.
- `npm run test:manifest`: passed.
- `npm run test:suite-coverage`: passed.

## Risks

- Until durable OAuth2 grant persistence exists, authorized callers get an empty
  authorization list.
- This route shares the same application developer-resource read boundary as
  gift-code batches and branches: owner, owning team owner, or accepted
  owning-team member.
