# GET /teams/{param}/identity/verification

## Summary

Implemented `GET /teams/{param}/identity/verification` as a bearer-authenticated
team route. The handler proves the team exists and that the caller is the owner
or an accepted team member, then fails closed with `501 APIErrorResponse`.
Spacebar has no durable team identity verification attempt state or Stripe
identity-provider integration, so it does not fabricate Discord verification
data.

## Changed Files

- `src/api/routes/teams/#team_id/identity/verification.ts`
- `test/routes/teams-param-identity-verification-get.test.ts`
- `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`
- `packages/missing-routes/missing.json`
- `assets/testing-manifest.json`
- `test/generated/http-contracts.json`
- `assets/openapi.json`

## Evidence Gathered

- Current missing report listed `GET /teams/{param}/identity/verification` with
  route name `GET_TEAMS_TEAM_ID_IDENTITY_VERIFICATION`.
- The source catalog and `src/api/routes/teams/**` had no matching GET route
  before this implementation.
- Existing team routes use owner-or-accepted-member access for team-scoped
  reads; this route follows that access model.
- Userdoccers documents the team identity verification surface as provider
  backed. Local `Team` persistence has no identity verification attempt state.

## Missing-Route Movement

- Missing routes moved from `637` to `636` on current integration base.
- Implemented routes moved from `543` to `544`.
- The assigned GET entry is gone from `packages/missing-routes/missing.json`.
- `POST /teams/{param}/identity/verification` remains missing and out of scope.

## Generated Artifacts

- Testing manifest verifies with `649` entries.
- Generated HTTP contracts verify with `624` contracts.
- Suite coverage check passed unchanged.
- OpenAPI generation reports `439` paths and `1029` schemas.
- Schema generation reports `1029` schemas; no schema file diff was needed.

## Commands Run

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
- `node scripts/testing-manifest/generate-suite-coverage.js --check`
- `npm run generate:openapi`
- `npm run build:test-fixtures`
- `node -r dotenv/config -r module-alias/register --enable-source-maps --test dist-test/test/routes/teams-param-identity-verification-get.test.js`
- `npm run test:manifest`
- `npm run test:suite-coverage`
- `node --test test/generated/http-contracts.test.js test/generated/suite-coverage.test.js`
- `npm run lint`
- `npm run test:contracts`
- `git diff --check`
- Package/lockfile diff guard
- Changed-file malformed warranty-token scan

## Verification Notes

- Focused route tests passed: `8/8`.
- `npm run test:manifest`, `npm run test:suite-coverage`, generated
  contract/suite tests, and `npm run lint` passed.
- `npm run test:contracts` passed static/generated contract checks, then failed
  in the unrelated generated runtime contract for
  `api:http:GET:/discovery/search` returning `500 !== 200`. This route does not
  touch discovery.

## Risks And Next Tasks

- The route intentionally returns `501` until Spacebar has durable team identity
  verification attempt state or a real provider integration.
- Implementing `POST /teams/{param}/identity/verification` remains a separate
  identity-provider integration task.
