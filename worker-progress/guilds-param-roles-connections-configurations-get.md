# GET /guilds/{param}/roles/connections-configurations

## Summary

Implemented `GET /guilds/{guild_id}/roles/connections-configurations` only.

The route is authenticated, requires the caller to be a guild member, and returns Spacebar's locally truthful linked-role configuration list. Spacebar does not currently have durable guild linked-role configuration storage, so the default response is an empty array:

```json
[]
```

The implementation does not fabricate role connection rules, application metadata, eligibility state, role assignments, or Discord-only linked-role configuration.

## Changed Files

- `src/api/routes/guilds/#guild_id/roles/connections-configurations.ts`
- `src/schemas/responses/GuildRoleConnectionsConfigurationsResponse.ts`
- `src/schemas/responses/index.ts`
- `test/routes/guilds-param-roles-connections-configurations-get.test.ts`
- `assets/schemas.json`
- `assets/openapi.json`
- `assets/testing-manifest.json`
- `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`
- `packages/missing-routes/missing.json`
- `test/generated/http-contracts.json`
- `test/generated/suite-coverage.json`

## Assigned Path Movement

- Assigned method: `GET`
- Assigned missing path: `/guilds/{param}/roles/connections-configurations`
- Source route: `/guilds/{guild_id}/roles/connections-configurations`
- Route name: `GET_GUILDS_GUILD_ID_ROLES_CONNECTIONS_CONFIGURATIONS`
- Before regeneration: `missing=585`, `spacebar=595`
- After regeneration: `missing=584`, `spacebar=596`
- Discord catalog count remained `1128`
- The assigned GET entry was removed from `packages/missing-routes/missing.json`.

## Evidence Gathered

- `packages/missing-routes/missing.json` initially included `GET /guilds/{param}/roles/connections-configurations` with sources `userdoccers:resources/guild.mdx` and `xhyrom:data/client/routes.json`.
- `packages/automatic-reverse-engineering/data/catalogs/routes.userdoccers.catalog.json` includes `GET /guilds/{guild_id}/roles/connections-configurations`, route name `GET_GUILDS_GUILD_ID_ROLES_CONNECTIONS_CONFIGURATIONS`, and summary `Get Guild Role Connections Configurations`.
- `packages/automatic-reverse-engineering/data/catalogs/routes.xhyrom.catalog.json` includes `GET`, `DELETE`, `HEAD`, `OPTIONS`, and `PATCH` entries for `/guilds/{guild_id}/roles/connections-configurations`.
- Userdoccers guild documentation states the route returns role connection rule objects and that the user must be a guild member: https://docs.discord.food/resources/guild
- Nearby local patterns:
  - `GET /guilds/{guild_id}/roles` and `GET /guilds/{guild_id}/roles/member-counts` use `Member.IsInGuildOrFail`.
  - Single-role read uses guild membership.
  - Role mutation routes use `MANAGE_ROLES`; this route does not, matching the Userdoccers membership requirement for the guild-wide list route.

## Behavior Notes

- Missing bearer auth remains `401 Missing Authorization Header`.
- Non-members receive the existing `403` path from `Member.IsInGuildOrFail`.
- Guild members receive `200 []` until durable linked-role configuration state exists.
- A provider seam is exposed for focused tests and future durable storage without changing route registration.

## Adjacent Routes Intentionally Untouched

- `DELETE /guilds/{guild_id}/roles/connections-configurations`
- `PATCH /guilds/{guild_id}/roles/connections-configurations`
- `GET /guilds/{guild_id}/roles/{role_id}/connections/configuration`
- `PUT /guilds/{guild_id}/roles/{role_id}/connections/configuration`
- Role connection eligibility, assign, and unassign routes
- Application role-connection metadata routes
- Role creation, mutation, deletion, and member assignment routes

## Commands Run

- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" node --version && PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm --version`
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run build:src:tsgo`
  - Initial attempt failed because this worktree had no `node_modules` and `tsgo` was not installed.
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm ci`
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run build:src:tsgo`
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run generate:schema`
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run build --workspace @spacebar/automatic-reverse-engineering`
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run build --workspace @spacebar/missing-routes`
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run generate:openapi`
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" node packages/automatic-reverse-engineering/dist/cli.js import-source-routes --root src/api/routes --out packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run generate:testing-manifest`
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run start --workspace @spacebar/missing-routes`
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run generate:contract-tests`
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run generate:suite-coverage`
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npx prettier --write src/api/routes/guilds/#guild_id/roles/connections-configurations.ts src/schemas/responses/GuildRoleConnectionsConfigurationsResponse.ts test/routes/guilds-param-roles-connections-configurations-get.test.ts`
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" TS_NODE_TRANSPILE_ONLY=1 node -r dotenv/config -r ts-node/register/transpile-only -r module-alias/register --enable-source-maps --test test/routes/guilds-param-roles-connections-configurations-get.test.ts`
  - Initial attempt failed on an overly strict generated schema assertion; the assertion was corrected to match the generated nested-array schema.
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" TS_NODE_TRANSPILE_ONLY=1 node -r dotenv/config -r ts-node/register/transpile-only -r module-alias/register --enable-source-maps --test test/routes/guilds-param-roles-connections-configurations-get.test.ts`
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run build:src:tsgo`
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run build:test-fixtures`
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" node scripts/testing-manifest/verify.js`
  - Initial post-formatting attempt reported stale manifest line metadata.
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run generate:testing-manifest`
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run generate:contract-tests`
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run generate:suite-coverage`
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" node scripts/testing-manifest/verify.js`
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run build:test-fixtures`
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" node scripts/testing-manifest/generate-contract-tests.js --check`
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" node scripts/testing-manifest/generate-suite-coverage.js --check`
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" node --test test/generated/http-contracts.test.js test/contracts/*.test.cjs`
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" node --test test/generated/suite-coverage.test.js`
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run test:contracts`
  - Failed only on the known unrelated runtime contract: `api:http:GET:/discovery/search` returned `500 !== 200`.
- `git diff --check`
- `git diff -- package.json package-lock.json`
- New-file malformed warranty spelling guard across the changed source and test files
- Missing-route movement check script against `packages/missing-routes/missing.json`

## Verification Result

Passing:

- Source build via `npm run build:src:tsgo`
- Focused route/schema test
- Schema/OpenAPI generation
- Source route catalog generation
- Missing-route regeneration
- Testing manifest generation and verification
- Generated HTTP contract generation/check
- Generated suite coverage generation/check
- Generated HTTP contract tests
- Generated suite coverage tests
- `npm run build:test-fixtures`
- `git diff --check`
- Package/lockfile guard: no `package.json` or `package-lock.json` diff
- New file warranty spelling guard

Known unrelated failure:

- `npm run test:contracts` fails in runtime public response-schema coverage for `api:http:GET:/discovery/search` with `500 !== 200`, matching the prompt's known unrelated failure condition.

## Risks Or Blockers

- The response is an empty list because Spacebar has no durable guild linked-role configuration storage today.
- The response schema models the Userdoccers role connection rule object shape, but the default implementation does not emit non-empty rules until storage exists.
- The route verifies membership and does not validate role/application existence because no durable configuration rows are read yet.
- `npm ci` was required because the assigned worktree initially had no dependencies installed; it produced no package or lockfile diff.

## Reconciliation

No merge, rebase, reset, stash, push, or commit was performed. Reconcile against current main before orchestrator merge if main advanced beyond the assigned integration base `47ea815f9`.

## Integration Acceptance

Accepted into the main server checkout on top of `83e2eb369` (`Implement current user guild join request route`).

Current-base movement:

- Before: `missing: 580`, `spacebar: 600`, `discord: 1128`.
- After: `missing: 579`, `spacebar: 601`, `discord: 1128`.
- Removed only `GET /guilds/{param}/roles/connections-configurations`; adjacent `DELETE` and `PATCH` entries remain missing.

Current-base verification with `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH"`:

- `npm run build:src:tsgo` - passed.
- `npm run generate:schema` - passed; 1136 schemas.
- `npm run generate:openapi` - passed; 492 paths and 1136 schemas; pre-existing webhook route metadata warnings remained.
- `npm run build --workspace @spacebar/automatic-reverse-engineering` - passed.
- `node packages/automatic-reverse-engineering/dist/cli.js import-source-routes --root src/api/routes --out packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json` - passed.
- `npm run build --workspace @spacebar/missing-routes` - passed.
- `npm run start --workspace @spacebar/missing-routes` - passed; 579 missing / 601 implemented.
- `npm run generate:testing-manifest` - passed; 706 entries.
- `npm run generate:contract-tests` - passed; 681 contracts.
- `node scripts/testing-manifest/generate-suite-coverage.js` - passed; 15 suites.
- `npm run build:test-fixtures` - passed.
- `node -r dotenv/config -r module-alias/register --enable-source-maps --test dist-test/test/routes/guilds-param-roles-connections-configurations-get.test.js` - passed; 6/6 focused route/schema tests.
- `node scripts/testing-manifest/verify.js` - passed.
- `node scripts/testing-manifest/generate-contract-tests.js --check` - passed.
- `node --test test/generated/http-contracts.test.js` - passed; 9/9.
- `node scripts/testing-manifest/generate-suite-coverage.js --check` - passed.
- `node --test test/generated/suite-coverage.test.js` - passed; 4/4.
- `npm run lint` - passed.
- `git diff --check` - passed.
- Package/lockfile guard was empty.
- `npm run test:contracts` - generated checks passed, then failed only on the known unrelated runtime assertion `api:http:GET:/discovery/search` returning `500 !== 200`; existing analytics `query.ts` route-registration warnings remained baseline noise.
