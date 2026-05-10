# game-invite-me

## Summary

Integrated the completed `spacebar-current-game-invite-me` worker onto current `master` base `a46bf0d99`.

The assigned path `/game-invite/@me` has two missing methods: `DELETE` and `POST`. Both are Xbox OAuth integration routes. Spacebar has no durable game-invite state, expiry handling, launch-token model, or `GAME_INVITE_*` gateway-event support, so both methods validate the caller and fail closed with a typed `501 APIErrorResponse` instead of fabricating success state.

## Changed Files

- `src/api/routes/game-invite/@me.ts`
- `src/schemas/uncategorised/GameInviteCreateSchema.ts`
- `src/schemas/uncategorised/index.ts`
- `test/routes/gameInviteMeRoute.test.ts`
- `assets/schemas.json`
- `assets/testing-manifest.json`
- `assets/openapi.json`
- `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`
- `packages/missing-routes/missing.json`
- `test/generated/http-contracts.json`
- `test/generated/suite-coverage.json`
- `worker-progress/game-invite-me.md`

Package manifests and lockfiles were not changed.

## Source Evidence

- Userdoccers `resources/game-invite.mdx` documents:
  - `DELETE /game-invite/@me` as `Delete Game Invites`.
  - `POST /game-invite/@me` as `Create Game Invite`.
  - Xbox-only OAuth application ID `622174530214821906`.
  - Create body fields `recipient_id`, `launch_parameters`, `application_asset`, `application_name`, optional `fallback_url`, and optional `ttl`.
  - Success behavior involving invite IDs and gateway events.
- xHyroM confirms `DELETE`, `OPTIONS`, and `POST` for `/game-invite/@me`; only the assigned `DELETE` and `POST` were implemented.
- The adjacent `/game-invite/@me/{game_invite_invite_id}` route remains missing by design.

## Count Movement

- Before integration on current base: `821` missing, `359` implemented.
- Expected after current-base regeneration: `819` missing, `361` implemented.
- Movement: assigned route removed two missing entries from the backlog.

## Verification

The worker verified the implementation on its original base with source build, schema generation, test-fixture build, focused compiled route tests, source-catalog import, missing-route generation, testing-manifest generation and verification, contract/suite generation checks, OpenAPI generation, generated static tests, `git diff --check`, and malformed warranty-token scanning.

Current-base orchestrator verification after porting onto `a46bf0d99`:

- `npm run build:src:tsgo` - passed.
- `npm run build:test-fixtures` - passed.
- Initial focused test run correctly failed before schema regeneration because `GameInviteCreateSchema` was not yet in `assets/schemas.json`.
- `npm run generate:schema` - passed, wrote `722` schemas.
- `npm run build:test-fixtures` - passed after schema regeneration.
- `node -r dotenv/config -r module-alias/register --enable-source-maps --test dist-test/test/routes/gameInviteMeRoute.test.js` - passed, `8` tests.
- `npm run build --workspace @spacebar/automatic-reverse-engineering` - passed.
- `node packages/automatic-reverse-engineering/dist/cli.js import-source-routes --root src/api/routes --out packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json` - passed.
- `npm run build --workspace @spacebar/missing-routes` - passed.
- `npm run start --workspace @spacebar/missing-routes` - passed; reported `Spacebar is missing 819`, `Spacebar implements 361`, `Discord implements 1128`.
- `npm run generate:testing-manifest` - passed, wrote `466` entries.
- `node scripts/testing-manifest/verify.js` - passed.
- `npm run generate:contract-tests` and `node scripts/testing-manifest/generate-contract-tests.js --check` - passed, `441` contracts.
- `npm run generate:suite-coverage` and `node scripts/testing-manifest/generate-suite-coverage.js --check` - passed, `15` suites.
- `node --test test/generated/http-contracts.test.js test/generated/suite-coverage.test.js` - passed, `13` tests.
- `npm run generate:openapi` - passed, generated `285` paths and `722` schemas with only existing webhook route-metadata warnings.

## Completion Audit

| Requirement | Evidence | Status |
| --- | --- | --- |
| Implement exact assigned path | `src/api/routes/game-invite/@me.ts` adds only `DELETE` and `POST` for `/game-invite/@me/`. | Done |
| Keep route authenticated | Route is not in `NO_AUTHORIZATION_ROUTES` and declares `401 APIErrorResponse`. | Done |
| Enforce Xbox OAuth-only source constraint | Handler accepts only token application ID `622174530214821906`; otherwise it throws `INVALID_OAUTH_TOKEN`. | Done |
| Avoid fabricated game-invite state | Both methods throw a typed `501` unsupported error after auth/source checks. | Done |
| Validate POST body | `GameInviteCreateSchema` models source-backed fields and focused tests cover invalid body rejection. | Done |
| Avoid adjacent route ownership | No `/game-invite/@me/{param}` handler or success invite ID is added. | Done |

Audit conclusion: the worker changes are scoped and suitable for current-base regeneration and commit.
