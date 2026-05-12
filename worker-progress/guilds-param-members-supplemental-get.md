# GET /guilds/{param}/members/supplemental

## Summary

Implemented `GET /guilds/{guild_id}/members/supplemental` only. The route requires bearer auth plus `MANAGE_GUILD`, confirms the guild exists, and returns the only locally durable member provenance Spacebar currently has: `Member.joined_by` as `inviter_id` with `join_source_type` set to `Unspecified`.

## Changed Files

- `src/api/routes/guilds/#guild_id/members/supplemental.ts`
- `src/schemas/responses/GuildMembersSupplementalResponse.ts`
- `src/schemas/responses/index.ts`
- `test/routes/guilds-members-supplemental-route.test.ts`
- `assets/schemas.json`
- `assets/openapi.json`
- `assets/testing-manifest.json`
- `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`
- `packages/missing-routes/missing.json`
- `test/generated/http-contracts.json`
- `test/generated/suite-coverage.json`

## Evidence Gathered

- `packages/missing-routes/missing.json` had `DELETE`, `GET`, `PATCH`, `POST`, and `PUT` entries for `/guilds/{param}/members/supplemental`.
- xHyroM's route catalog identifies `GET /guilds/{guild_id}/members/supplemental` as `MEMBER_SAFETY_SUPPLEMENTAL`.
- Userdoccers documents the supplemental member object shape but only documents a POST operation for "Get Guild Members Supplemental".
- Local persistence has `Member.joined_by`, but no durable store for Discord's private member-safety risk signals, unusual-DM data, invite graph, source invite code, or integration-source metadata.

## Behavior

- `GET /guilds/:guild_id/members/supplemental/`
  - Auth mode: bearer via normal route registration.
  - Access: `permission: "MANAGE_GUILD"`.
  - Guild lookup: `Guild.findOneOrFail({ where: { id }, select: { id: true } })`.
  - Member lookup: members in the guild with non-null `joined_by`, selecting only `id` and `joined_by`.
  - Response: `GuildMembersSupplementalResponse`, with entries shaped as `{ user_id, join_source_type, inviter_id }`.
  - The implementation does not fabricate unsupported source invite codes, integration data, risk flags, or safety signals.

## Missing-Route Movement

- Worker base: `6ebafd60d`.
- Worker-base regeneration: total missing `573`, implemented Spacebar routes `607`, Discord routes `1128`.
- Assigned `GET /guilds/{param}/members/supplemental` was removed from missing routes.
- Adjacent methods remain missing and intentionally untouched: `DELETE`, `PATCH`, `POST`, `PUT`.

## Commands Run

- `npm ci` to install worktree-local dependencies; package files stayed unchanged.
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
- `node -r dotenv/config -r module-alias/register --enable-source-maps --test dist-test/test/routes/guilds-members-supplemental-route.test.js`
- `node scripts/testing-manifest/verify.js`
- `node scripts/testing-manifest/generate-contract-tests.js --check`
- `node --test test/generated/http-contracts.test.js`
- `npm run test:suite-coverage`
- `node -r dotenv/config -r module-alias/register --enable-source-maps --test dist-test/test/generated/http-auth-runtime-contracts.test.js`
- `git diff --check`
- `git diff -- package.json package-lock.json`

## Verification Notes

- Focused supplemental route test passes: 7 tests, 0 failures, including bearer-auth rejection, real `MANAGE_GUILD` permission rejection before repository access, successful provenance serialization, missing-guild 404, generated artifact assertions, GET missing-route removal, and adjacent-method preservation.
- Testing manifest verification passes: 712 entries.
- Generated contract checks pass: 687 contracts.
- Generated suite coverage check passes, and `test/generated/suite-coverage.json` includes `api:http:GET:/guilds/:guild_id/members/supplemental/`.
- OpenAPI regeneration passes and includes `GET /guilds/{guild_id}/members/supplemental/` with bearer security, `x-permission-required: MANAGE_GUILD`, and 200/401/403/404 response schemas.
- Package and lockfile guard is clean.
- License-header typo scan for the new files is clean.

## Known Unrelated Failure

`node -r dotenv/config -r module-alias/register --enable-source-maps --test dist-test/test/generated/http-auth-runtime-contracts.test.js` still fails on the unrelated baseline public schema contract:

- `api:http:GET:/discovery/search` returns `500` where the generated runtime check expects `200`.

The auth-boundary portions of that generated runtime file passed, and the failure is not for the supplemental endpoint.

## Risks And Follow-Ups

- The response is intentionally conservative because Spacebar lacks durable Discord member-safety supplemental data. If future storage adds invite graph, source invite code, integration metadata, or safety/risk fields, this route should be expanded from that persisted data rather than inferred.
- Do not treat the remaining `DELETE`, `PATCH`, `POST`, or `PUT` missing entries for the same path as implemented by this change.

## Integration Acceptance

- Integrated onto main checkout base `9cdd20695 Implement current user linked users route`.
- Current-main missing-route movement: `570 -> 569`.
- Current-main Spacebar/implemented route movement: `610 -> 611`.
- Discord route count remained `1128`.
- Regenerated current-main artifacts: `1149` schemas, `501` OpenAPI paths, `716` testing-manifest entries, `691` HTTP contracts, and `15` suite groups.
- Focused route test passed through the repository runner: 7 tests.
- Focused built fixture test passed: 7 tests.
- A direct `node --test` invocation against the TypeScript source file failed on Node's ESM directory-import handling for `src/api/middlewares`; the repository `npm run test -- test/routes/guilds-members-supplemental-route.test.ts` runner passed and is the accepted source-level verification.
- Generated checks passed:
  - `node scripts/testing-manifest/verify.js`
  - `node scripts/testing-manifest/generate-contract-tests.js --check`
  - `node --test test/generated/http-contracts.test.js test/contracts/*.test.cjs`
  - `node scripts/testing-manifest/generate-suite-coverage.js --check`
  - `node --test test/generated/suite-coverage.test.js`
- `npm run lint` passed.
- `git diff --check` passed.
- Package guard passed for `package.json`, `package-lock.json`, `packages/automatic-reverse-engineering/package.json`, and `packages/missing-routes/package.json`.
- License-header typo scan for the new files passed.
- `npm run test:contracts` completed static generated checks and failed only on the known unrelated runtime contract `api:http:GET:/discovery/search` returning `500 !== 200`; pre-existing analytics query route-registration warnings were also present.
