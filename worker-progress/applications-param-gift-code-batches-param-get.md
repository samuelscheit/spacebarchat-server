# applications-param-gift-code-batches-param-get

## Summary

Implemented `GET /applications/{param}/gift-code-batches/{param}` for the exact assigned path. The route authorizes application owners and accepted owning-team members, validates that the requested batch belongs to the application, reads persisted codes for that batch, and returns a CSV download.

This adds narrow durable storage for gift-code batches and gift codes because the CSV endpoint cannot be production-ready without persistent batch/code rows. Adjacent gift-code-batch list/create routes remain missing and were not implemented.

## Changed Files

- `src/api/routes/applications/#application_id/gift-code-batches/#gift_code_batch_id.ts`
- `src/api/util/utility/ApplicationAuthorization.ts`
- `src/api/util/utility/ApplicationAuthorization.test.ts`
- `src/util/entities/GiftCodeBatch.ts`
- `src/util/entities/GiftCode.ts`
- `src/util/entities/index.ts`
- `src/util/migration/postgres/1778408500000-GiftCodeBatches.ts`
- `test/routes/applications-gift-code-batches.test.ts`
- `tsconfig.test.json`
- `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`
- `packages/missing-routes/missing.json`
- `assets/testing-manifest.json`
- `test/generated/http-contracts.json`
- `test/generated/suite-coverage.json`
- `assets/openapi.json`
- `worker-progress/applications-param-gift-code-batches-param-get.md`

Package manifests and lockfiles were not changed.

## Assigned Path

- Assigned path: `/applications/{param}/gift-code-batches/{param}`
- Worker id: `applications-param-gift-code-batches-param-get`
- Branch: `codex/current-missing-route-applications-param-gift-code-batches-param-get`
- Base commit: `36c8f066b`

## Missing Methods Found

- Found exactly one missing entry for the assigned exact path:
  - `GET /applications/{param}/gift-code-batches/{param}`
  - Source route: `/applications/{application_id}/gift-code-batches/{gift_code_batch_id}`
  - Source: `userdoccers:resources/entitlement.mdx`
  - Summary: `Get Application Gift Code Batch`

The adjacent `GET /applications/{param}/gift-code-batches` route remains missing and was not implemented.

## Methods Implemented

- Implemented `GET /applications/:application_id/gift-code-batches/:gift_code_batch_id/`.
- Response:
  - `200` sends `text/csv; charset=utf-8`.
  - `Content-Disposition` uses a sanitized `gift-code-batch-<batch>.csv` filename.
  - CSV output has a `code` header, CRLF rows, and standard escaping for quotes, commas, and line breaks.
- Auth and authorization:
  - Bearer-authenticated route metadata includes `401: APIErrorResponse`.
  - Allows application owner, owning-team owner, and accepted owning-team members.
  - Does not allow bot-user access by application id alone.
- Error behavior:
  - Missing application throws `UNKNOWN_APPLICATION`.
  - Unauthorized caller throws `ACTION_NOT_AUTHORIZED_ON_APPLICATION`.
  - Missing application batch throws `UNKNOWN_GIFT_CODE`.
  - Local `ApiError` semantics are represented as `400: APIErrorResponse` plus the required `401`.
- Persistence:
  - Added `gift_code_batches` with application ownership, SKU, amount, optional description, and optional entitlement branch/window fields.
  - Added `gift_codes` with code primary key, application id, optional batch id, SKU, usage fields, optional expiry, optional entitlement branches, and optional gift style.
  - Added a PostgreSQL migration and exported the entities through `@spacebar/util`.

## Evidence Gathered

- `packages/missing-routes/missing.json` initially contained the assigned `GET` entry.
- `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json` initially had `333` entries and no `gift-code-batches` route.
- `src/api/routes/**` initially had no `gift-code-batches` route for applications.
- Userdoccers documents this endpoint as returning a CSV file with all gift codes in a batch and requiring the application owner or a member of the owning team.
- After implementation and regeneration:
  - `packages/missing-routes/missing.json` has `846` missing entries and no assigned missing entry.
  - `routes.source.catalog.json` has `334` source entries and includes the new `GET /applications/{application_id}/gift-code-batches/{gift_code_batch_id}` route.
  - `assets/testing-manifest.json` has `439` entries and includes `api:http:GET:/applications/:application_id/gift-code-batches/:gift_code_batch_id/` with bearer auth and `200`, `400`, `401` metadata.
  - `test/generated/http-contracts.json` has `414` contracts and includes the route.
  - `assets/openapi.json` has `259` paths and includes the route with bearer security and `200`, `400`, `401` responses.

## Userdoccers References Used

- `https://raw.githubusercontent.com/discord-userdoccers/discord-userdoccers/master/pages/resources/entitlement.mdx`
- `https://docs.discord.food/resources/entitlement`

Relevant source evidence:

- Gift Code Batch object fields include `id`, `sku_id`, `amount`, optional `description`, optional entitlement branches, and optional entitlement start/end timestamps.
- `GET /applications/{application.id}/gift-code-batches/{gift_code_batch.id}` returns a CSV file containing all gift codes in the given batch.
- User must be the owner of the application or a member of the owning team.

## Commands Run

- `npm run build:src:tsgo` - passed.
- `npm run build:test-fixtures` - passed.
- `npm run build --workspace @spacebar/automatic-reverse-engineering` - passed.
- `node packages/automatic-reverse-engineering/dist/cli.js import-source-routes --root src/api/routes --out packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json` - passed.
- `npm run build --workspace @spacebar/missing-routes` - passed.
- `npm run start --workspace @spacebar/missing-routes` - passed; reported `Spacebar is missing 846`, `Spacebar implements 334`, `Discord implements 1128`.
- `npm run generate:schema` - passed; wrote `671` schemas.
- `npm run generate:testing-manifest` - passed; wrote `439` entries.
- `node scripts/testing-manifest/verify.js` - passed with `439` entries.
- `node scripts/testing-manifest/generate-contract-tests.js --check || npm run generate:contract-tests` - first check found stale generated contracts, regeneration passed with `414` contracts.
- `node scripts/testing-manifest/generate-contract-tests.js --check` - passed.
- `node scripts/testing-manifest/generate-suite-coverage.js --check || npm run generate:suite-coverage` - first check found stale generated suite coverage, regeneration passed with `14` suites.
- `node scripts/testing-manifest/generate-suite-coverage.js --check` - passed.
- `npm run generate:openapi` - passed; generated `259` paths and `671` schemas. It reported the existing route-middleware warning count.
- Focused tests:
  - `node -r dotenv/config -r module-alias/register --enable-source-maps --test dist-test/src/api/util/utility/ApplicationAuthorization.test.js dist-test/test/routes/applications-gift-code-batches.test.js`
  - Passed: `22` tests, `3` suites.
- Final route/artifact audit command - passed; assigned missing entry absent, source catalog route present, testing manifest route present.
- `git diff --check` - passed.
- `git diff -- package.json package-lock.json npm-shrinkwrap.json --exit-code` - passed.
- Changed-file malformed warranty-word scan using the assignment-provided pattern - passed with no matches.

## Missing-Route Count Movement

- Before implementation: `847` missing, `333` implemented.
- After regeneration: `846` missing, `334` implemented.
- Movement: assigned route removed from missing backlog, `-1` missing route.

## Focused Tests

- `src/api/util/utility/ApplicationAuthorization.test.ts`
  - Covers existing application command authorization behavior.
  - Covers new gift-code-batch access policy: owner, team owner, accepted team members, bot denial, invited member denial, repository relation loading, and unauthorized error.
- `test/routes/applications-gift-code-batches.test.ts`
  - Covers CSV escaping.
  - Covers authorization before batch/code lookup.
  - Covers application/batch scoping for repository queries.
  - Covers successful mounted CSV download.
  - Covers mounted missing-batch error.
  - Covers mounted unauthorized caller behavior.

## Completion Audit

Objective restated as deliverables:

- Implement production-ready support for the exact assigned `GET /applications/{param}/gift-code-batches/{param}` route.
- Add focused tests.
- Regenerate route catalogs and generated route artifacts.
- Run the expected verification commands.
- Provide this complete handoff report.
- Mark the active goal complete only after real evidence shows the deliverables are complete.

Prompt-to-artifact checklist:

| Requirement | Evidence | Status |
| --- | --- | --- |
| Create and record active goal | Goal was created before repo work by the prior worker turn; latest `get_goal` shows objective active and matching this task. | Done |
| Read worker brief | `/Users/user/Developer/Developer/spacebarchat/WORKER_BRIEF.md` was read and followed. | Done |
| Verify assigned missing entry | `missing.json` initially contained exactly `GET /applications/{param}/gift-code-batches/{param}` for this path. | Done |
| Confirm method absent before implementation | Initial source catalog and route-tree checks found no application gift-code-batch detail route. | Done |
| Stay in assigned route scope | Only the detail `GET` route was added; adjacent list/create routes remain missing. | Done |
| Use Userdoccers evidence | Userdoccers source evidence used for CSV response, object fields, and owner/team-member authorization. | Done |
| Correct auth mode | Route has bearer metadata with required `401: APIErrorResponse`; testing manifest reports bearer auth. | Done |
| Correct permission check | Shared helper allows owner/owning team members and denies bot-only/invited/outsider callers; focused tests pass. | Done |
| Correct response shape | Handler sends CSV with code rows, CSV escaping, content type, and download disposition; focused tests pass. | Done |
| Persistence behavior | Durable batch/code entities and migration added; handler scopes batch and code queries by application id and batch id. | Done |
| Error semantics | Uses local `ApiError` constants for unknown application, unauthorized application action, and unknown gift code. | Done |
| Focused tests | `22` focused tests pass across auth helper and route behavior. | Done |
| Regenerated source catalog | Catalog has `334` entries and the new route. | Done |
| Regenerated missing routes | Missing count moved from `847` to `846`; assigned entry removed. | Done |
| Regenerated schemas/manifest/contracts/coverage/OpenAPI | All generation commands passed; manifest/contracts/OpenAPI include the new route. | Done |
| Package manifests unchanged | Package manifest/lockfile diff check passed. | Done |
| License headers and warranty word | New source/test/migration files include the AGPL header with `MERCHANTABILITY`; changed-file malformed warranty scan passed. | Done |
| Handoff report complete | This file contains summary, changed files, commands, evidence, assigned path, methods, count movement, references, risks, next tasks, and goal evidence. | Done |

Audit conclusion: the objective is achieved. The route is implemented, tested, regenerated into route artifacts, and verified.

## Risks And Blockers

- Adjacent gift-code-batch list/create routes remain missing, so this branch adds storage and read-side export but no public API path to populate batches.
- The Userdoccers source says the detail endpoint returns a CSV containing all gift codes, but it does not specify a formal CSV schema. The implementation uses a single `code` column with standard CSV escaping.
- OpenAPI route metadata can express the bearer/error responses but does not model the `text/csv` success body because local route metadata currently models schema refs for JSON responses.

## Recommended Next Tasks

- Implement the adjacent application gift-code-batch list/create routes using the new durable state.
- Add create-route tests that prove generated gift-code counts match `GiftCodeBatch.amount`.
- Consider extending route metadata/OpenAPI generation to represent non-JSON success bodies such as CSV downloads.

## Goal Evidence

- Latest `get_goal` before completion audit:
  - Status: `active`
  - Objective: `Implement production-ready support for the assigned missing route path /applications/{param}/gift-code-batches/{param} on the current-base worker branch, with focused tests, regenerated route catalogs and generated route artifacts, verification evidence, and a complete handoff report.`
  - Time used: `1613` seconds
  - Token budget: none
