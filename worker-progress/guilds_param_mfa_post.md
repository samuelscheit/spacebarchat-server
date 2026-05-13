# guilds_param_mfa_post

## Summary

Implemented the assigned `POST /guilds/{param}/mfa` route only.

The new route is `src/api/routes/guilds/#guild_id/mfa.ts` and maps to
`POST_GUILDS_GUILD_ID_MFA`. It accepts `{ "level": 0 | 1 }`, requires bearer
auth through the normal API stack, requires the current user to be the guild
owner, updates `Guild.mfa_level`, emits `GUILD_UPDATE`, and returns
`{ "level": <new level> }`.

## Changed Files

- `src/api/routes/guilds/#guild_id/mfa.ts`
- `src/schemas/uncategorised/GuildMfaLevelSchema.ts`
- `src/schemas/uncategorised/index.ts`
- `test/routes/guilds-param-mfa-post.test.ts`
- `assets/schemas.json`
- `assets/openapi.json`
- `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`
- `packages/missing-routes/missing.json`
- `assets/testing-manifest.json`
- `test/generated/http-contracts.json`
- `test/generated/suite-coverage.json`

## Missing Route Movement

- Before regeneration: `missing: 510`, `spacebar: 670`
- After regeneration: `missing: 509`, `spacebar: 671`
- Removed missing entry:
  - `POST /guilds/{param}/mfa`
  - `POST_GUILDS_GUILD_ID_MFA`
- `packages/missing-routes/missing.json` no longer contains `/guilds/{param}/mfa`.
- Source catalog now contains `POST /guilds/{guild_id}/mfa` from
  `src/api/routes/guilds/#guild_id/mfa.ts`.

## Evidence Sources

- `packages/missing-routes/missing.json` listed only the assigned `POST` method
  for `/guilds/{param}/mfa`.
- `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`
  had no `POST_GUILDS_GUILD_ID_MFA` entry before implementation.
- Userdoccers `resources/guild.mdx` documents "Modify Guild MFA Level" as owner
  only, request/response field `level`, and `GUILD_UPDATE` side effect:
  `https://raw.githubusercontent.com/discord-userdoccers/discord-userdoccers/master/pages/resources/guild.mdx`
- Local xHyroM catalog confirms `POST /guilds/{guild_id}/mfa` exists as
  `GUILD_MFA` in `packages/automatic-reverse-engineering/data/catalogs/routes.xhyrom.catalog.json`.
- Nearby implementation patterns:
  - `src/api/routes/guilds/#guild_id/delete.ts` for owner-only guild operation semantics.
  - `src/api/routes/guilds/#guild_id/index.ts` for `GUILD_UPDATE` event emission.

## Commands Run

- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm ci`
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run build:src:tsgo` - passed
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run generate:schema` - passed
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run generate:openapi` - passed with existing warnings for three webhook routes missing `route()` middleware
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run build --workspace @spacebar/automatic-reverse-engineering` - passed
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" node packages/automatic-reverse-engineering/dist/cli.js import-source-routes --root src/api/routes --out packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json` - passed
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run build --workspace @spacebar/missing-routes` - passed
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run start --workspace @spacebar/missing-routes` - passed, wrote `missing: 509`
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run generate:testing-manifest` - passed, wrote 776 entries
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run generate:contract-tests` - passed, wrote 751 contracts
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run generate:suite-coverage` - passed
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run build:test-fixtures` - passed
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" node -r dotenv/config -r module-alias/register --enable-source-maps --test dist-test/test/routes/guilds-param-mfa-post.test.js` - passed, 3 tests
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run test:manifest` - passed
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run test:suite-coverage` - passed
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run test:contracts` - static/generated checks passed; runtime failed only on known unrelated `api:http:GET:/discovery/search` with `500 !== 200`
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npx eslint 'src/api/routes/guilds/#guild_id/mfa.ts' src/schemas/uncategorised/GuildMfaLevelSchema.ts test/routes/guilds-param-mfa-post.test.ts` - passed
- `git diff --check` - passed
- Package/lockfile guard: `git status --short package.json package-lock.json packages/*/package.json` and package diff checks showed no package or lockfile changes

## Risks / Blockers

- No blocker for the assigned route.
- `npm run test:contracts` has the known unrelated runtime failure:
  `api:http:GET:/discovery/search` expected 200 but returned 500.
- No audit-log persistence was added because nearby guild update routes do not
  create durable audit log records in this codebase.

## Sibling Routes Intentionally Untouched

- Did not implement `OPTIONS /guilds/{guild_id}/mfa` from xHyroM.
- Did not implement any adjacent guild migration, ownership transfer, or MFA
  user-account routes.

## Reconciliation Notes

- The route name in the regenerated source catalog is `POST_GUILDS_GUILD_ID_MFA`,
  matching the assigned route name from Userdoccers and the missing-route report.
- xHyroM uses `GUILD_MFA` for the same POST path; this was used as route-existence
  evidence only and was not used as the source route name.
- During main-branch reconciliation this was applied after the guild product
  route merges; current-base regeneration should move the missing count from
  `505` to `504` and implemented count from `675` to `676`.
