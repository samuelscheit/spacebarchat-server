# GET /guilds/{guild_id}/admin-server-eligibility

## Summary

Implemented the assigned `GET /guilds/{guild_id}/admin-server-eligibility` route on top of current base `ec90108a8`.

The route is authenticated, requires `MANAGE_GUILD`, verifies the target guild exists, and returns:

```json
{ "eligible_for_admin_server": false }
```

Spacebar does not currently operate Discord's Admin Community or persist Admin Community join state, and the adjacent join route is outside this assignment. Returning `false` is a conservative compatibility response rather than claiming unsupported eligibility.

## Changed files

- `src/api/routes/guilds/#guild_id/admin-server-eligibility.ts`
- `src/api/routes/guilds/#guild_id/admin-server-eligibility.test.ts`
- `src/api/openapi/GuildAdminServerEligibility.openapi.test.ts`
- `src/schemas/responses/GuildAdminServerEligibilityResponse.ts`
- `src/schemas/responses/GuildAdminServerEligibilityResponse.test.ts`
- `src/schemas/responses/index.ts`
- `tsconfig.test.json`
- `assets/schemas.json`
- `assets/openapi.json`
- `assets/testing-manifest.json`
- `test/generated/http-contracts.json`
- `test/generated/suite-coverage.json`
- `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`
- `packages/missing-routes/missing.json`
- `worker-progress/guilds-param-admin-server-eligibility-get.md`

## Evidence gathered

- Current base missing report contained exactly one assigned entry: `GET /guilds/{param}/admin-server-eligibility`, route name `GET_GUILDS_GUILD_ID_ADMIN_SERVER_ELIGIBILITY`.
- Current base source catalog had no `/guilds/{guild_id}/admin-server-eligibility` entry before regeneration.
- Current base `src/api/routes/guilds/#guild_id/` had no `admin-server-eligibility` route file before this route addition.
- Userdoccers `resources/guild.mdx` documents "Get Admin Community Eligibility" as requiring `MANAGE_GUILD` and returning `eligible_for_admin_server: boolean`: https://docs.discord.food/resources/guild
- Local xHyroM catalog confirms `/guilds/{guild_id}/admin-server-eligibility` as `GUILD_ADMIN_SERVER_ELIGIBILITY` in `packages/automatic-reverse-engineering/data/catalogs/routes.xhyrom.catalog.json`.
- Existing `MANAGE_GUILD` guild routes used as patterns: `src/api/routes/guilds/#guild_id/discovery-metadata.ts`, `src/api/routes/guilds/#guild_id/integrations.ts`, and `src/api/routes/guilds/#guild_id/invites.ts`.

## Assigned path and methods

- Assigned path: `/guilds/{param}/admin-server-eligibility`
- Missing methods found: `GET` only.
- Methods implemented: `GET /guilds/{guild_id}/admin-server-eligibility`.
- Adjacent paths, including `/guilds/{guild_id}/join-admin-server`, were not implemented.

## What changed

- Added `GuildAdminServerEligibilityResponse` with required boolean field `eligible_for_admin_server`.
- Added route metadata for `200`, `403`, and `404` responses.
- Added `MANAGE_GUILD` permission enforcement through existing `route()` middleware.
- Added a scoped guild existence check with `Guild.findOneOrFail({ where: { id: guild_id }, select: { id: true } })`.
- Added focused tests for route behavior/metadata, schema generation, and OpenAPI documentation.
- Regenerated schema, OpenAPI, testing manifest, generated HTTP contracts, suite coverage, source-route catalog, and missing-route report.

## Missing-route count movement

- Current base `ec90108a8`: `677` missing entries.
- After regeneration in this worktree: `676` missing entries.
- Assigned route after regeneration: no remaining `missing_entries[]` item where `route == "/guilds/{param}/admin-server-eligibility"`.
- Source catalog now includes `GET /guilds/{guild_id}/admin-server-eligibility` from `src/api/routes/guilds/#guild_id/admin-server-eligibility.ts`.

## Commands run

- Read `/Users/user/Developer/Developer/spacebarchat/WORKER_BRIEF.md`.
- `git branch codex/backup-guilds-param-admin-server-eligibility-get-old-head HEAD`
- `git rebase ec90108a8` and conflict resolution for generated artifacts.
- `rg` and `jq` checks for the assigned route in missing routes, source catalog, Userdoccers/xHyroM catalogs, OpenAPI, schema, testing manifest, contracts, and suite coverage.
- `npm run build:src:tsgo` initially failed before dependency installation: TypeScript could not find type definition file `node`.
- `npm ci`: passed.
- `npm run build:src:tsgo`: passed.
- `npm run generate:schema`: passed.
- `npm run generate:openapi`: passed.
- `npm run build --workspace @spacebar/automatic-reverse-engineering`: passed.
- `node packages/automatic-reverse-engineering/dist/cli.js import-source-routes --root src/api/routes --out packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`: passed.
- `npm run build --workspace @spacebar/missing-routes`: passed.
- `npm run start --workspace @spacebar/missing-routes`: passed and wrote `Spacebar is missing 676`.
- `npm run generate:testing-manifest`: passed.
- `npm run generate:contract-tests`: passed.
- `npm run generate:suite-coverage`: passed.
- `npm run build:test-fixtures`: passed.
- `node -r dotenv/config -r module-alias/register --enable-source-maps --test 'dist-test/src/api/routes/guilds/#guild_id/admin-server-eligibility.test.js' 'dist-test/src/schemas/responses/GuildAdminServerEligibilityResponse.test.js' 'dist-test/src/api/openapi/GuildAdminServerEligibility.openapi.test.js'`: passed, 6 tests.
- `npm run test:manifest`: passed, 30 tests and manifest verification.
- `npm run test:contracts`: static generated contract checks passed, then runtime failed on unrelated public route `api:http:GET:/gifs/suggest/` because it returned `400` instead of expected `200`.
- `npm run test:suite-coverage`: passed.
- `git diff --check`: passed.
- Package/lockfile guard with `git diff --name-only -- package.json package-lock.json`: passed, no output.
- Conflict marker scan with `rg -n "^(<<<<<<<|>>>>>>>|=======$)" assets packages src test tsconfig.test.json worker-progress`: passed, no output.
- Malformed warranty-token scan over changed source/test/progress files: passed, no output.
- `GIT_EDITOR=true git commit --amend --no-edit`: passed; branch now contains the rebased source and regenerated artifacts in one commit.
- Final committed-diff checks after amend: `git diff --check ec90108a8..HEAD` passed, package/lockfile guard had no output, conflict-marker scan had no output, malformed warranty-token scan had no output, and `git status --short --branch` showed a clean branch.

## Artifact status

- `assets/schemas.json` includes `GuildAdminServerEligibilityResponse`.
- `assets/openapi.json` includes `GET /guilds/{guild_id}/admin-server-eligibility/` with `200`, `403`, and `404` response bodies.
- `assets/testing-manifest.json` includes `api:http:GET:/guilds/:guild_id/admin-server-eligibility/`.
- `test/generated/http-contracts.json` includes the assigned route with bearer auth, `MANAGE_GUILD`, guild rate-limit metadata, and response schema metadata.
- `test/generated/suite-coverage.json` includes the assigned route in generated coverage groups.
- `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json` includes the assigned source route.
- `packages/missing-routes/missing.json` removed the assigned missing entry.

## Risks or blockers

- `npm run test:contracts` has an unrelated runtime failure for `GET /gifs/suggest/`; no assigned route files or generated assigned-route artifacts reference that endpoint.
- The route always returns `eligible_for_admin_server: false` until Spacebar has an Admin Community equivalent or persisted join eligibility state.
- `npm ci` reported existing dependency audit findings; no package or lockfile changes were made.

## Recommended next tasks

- Implement `/guilds/{guild_id}/join-admin-server` separately if Spacebar wants Admin Community joining behavior.
- Add configurable/persisted Admin Community state before this endpoint can return `true`.
