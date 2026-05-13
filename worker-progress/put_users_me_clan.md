# PUT /users/@me/clan

## Summary

Implemented `PUT /users/@me/clan` / `PUT_USERS__ME_CLAN` only.

The route now:

- accepts `UserClanModifySchema` with `identity_enabled` and `identity_guild_id`.
- requires any selected guild to be one of the current user's memberships.
- persists `User.primary_guild`.
- returns the updated current private user.
- emits existing `USER_UPDATE` and `GUILD_MEMBER_UPDATE` semantics through `emitUserUpdateEvents`.
- uses the local guild `profile_tag` as the clan tag and keeps `badge` as `null` because Spacebar has no durable guild identity badge asset state.

## Changed Files

- `src/api/routes/users/@me/clan.ts`
- `src/api/routes/users/@me/clan.test.ts`
- `src/schemas/uncategorised/UserClanModifySchema.ts`
- `src/schemas/uncategorised/index.ts`
- `src/schemas/api/users/User.ts`
- `src/util/entities/User.ts`
- `tsconfig.test.json`
- `assets/schemas.json`
- `assets/openapi.json`
- `assets/testing-manifest.json`
- `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`
- `packages/missing-routes/missing.json`
- `test/generated/http-contracts.json`
- `test/generated/suite-coverage.json`

## Evidence Gathered

- `packages/missing-routes/missing.json` initially had exactly one assigned entry:
  `PUT /users/@me/clan`, `PUT_USERS__ME_CLAN`, summary `Set Guild Identity`.
- `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json` had no matching source route before implementation.
- `packages/automatic-reverse-engineering/data/catalogs/routes.userdoccers.catalog.json` lists `PUT /users/@me/clan` as `PUT_USERS__ME_CLAN` from `userdoccers:resources/user.mdx`.
- Userdoccers source checked: `https://raw.githubusercontent.com/discord-userdoccers/discord-userdoccers/master/pages/resources/user.mdx`.
    - Primary Guild Structure documents `identity_enabled`, `identity_guild_id`, `tag`, and `badge`, all nullable.
    - Set Guild Identity documents optional JSON params `identity_enabled?: ?boolean` and `identity_guild_id?: ?snowflake`, returns a user object, and fires a User Update event.
- `packages/automatic-reverse-engineering/data/catalogs/routes.xhyrom.catalog.json` lists `PUT /users/@me/clan` and sibling `OPTIONS /users/@me/clan` as `USER_SET_CLAN_IDENTITY`.
- Existing local model evidence:
    - `src/schemas/api/users/User.ts` defines `PrimaryGuild`.
    - `src/util/entities/User.ts` already persists `primary_guild`.
    - `src/util/entities/Guild.ts` already persists `profile_tag`.
    - `src/api/routes/guilds/#guild_id/profile.ts` exposes the local guild profile tag.
    - `src/api/util/UserUpdateEvents.ts` owns user and guild-member update emission.

## Missing-Route Movement

- Worker branch movement before integration: `missing_entries.length = 487 -> 486`, assigned route absent.
- Current-base integration movement: `missing_entries.length = 485 -> 484`, `routes.length = 395 -> 394`.
- Spacebar implemented count moved `695 -> 696`.
- Discord implemented count stayed `1128`.
- Current generated artifacts: OpenAPI `563` paths / `1223` schemas, testing manifest `801` entries, generated HTTP contracts `776`.

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
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" node -r dotenv/config -r module-alias/register --enable-source-maps --test dist-test/src/api/routes/users/@me/clan.test.js`
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run test:manifest`
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run test:suite-coverage`
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" node scripts/testing-manifest/generate-contract-tests.js --check`
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" node scripts/testing-manifest/generate-suite-coverage.js --check`
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run test:contracts`
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npx eslint src/api/routes/users/@me/clan.ts src/api/routes/users/@me/clan.test.ts src/schemas/uncategorised/UserClanModifySchema.ts src/schemas/uncategorised/index.ts src/schemas/api/users/User.ts src/util/entities/User.ts`
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npx prettier --check src/api/routes/users/@me/clan.ts src/api/routes/users/@me/clan.test.ts src/schemas/uncategorised/UserClanModifySchema.ts src/schemas/uncategorised/index.ts src/schemas/api/users/User.ts src/util/entities/User.ts tsconfig.test.json worker-progress/put_users_me_clan.md`
- `git diff --check`
- `git diff --exit-code -- package.json package-lock.json npm-shrinkwrap.json 'packages/*/package.json' 'packages/*/package-lock.json'`

## Verification Results

- `npm run build:src:tsgo`: passed.
- `npm run build:test-fixtures`: passed.
- focused `dist-test/src/api/routes/users/@me/clan.test.js`: passed, 5 tests.
- `npm run test:manifest`: passed, 801 entries verified.
- `npm run test:suite-coverage`: passed.
- Generated contract check and suite coverage check: passed.
- targeted ESLint: passed with the expected `tsconfig.test.json` ignore warning during current-base replay.
- Prettier check: passed after formatting the replayed route, test, and progress report.
- `git diff --check`: passed.
- package/lockfile guard: no package or lockfile diff.
- `npm run test:contracts`: generated/static contract checks passed, runtime phase failed only on known unrelated `api:http:GET:/discovery/search` public response-schema contract with `500 !== 200`, matching the worker brief's known unrelated failure.

## Scope Notes

- Implemented only `PUT /users/@me/clan`.
- Intentionally did not implement xHyroM sibling `OPTIONS /users/@me/clan`.
- Intentionally did not implement adjacent `/users/@me/*` missing routes.
- No audit-log behavior was added because this is a current-user profile state route, not a guild moderation action.

## Risks / Blockers

- Guild identity badge assets are not modeled durably in the local data layer. The route therefore persists `badge: null` instead of fabricating a badge hash.
- `identity_enabled: false` persists a public disabled identity object with `identity_guild_id`, `tag`, and `badge` set to `null`; there is no hidden local backing field to remember a disabled selected guild.

## Recommended Next Tasks

- Add durable guild identity badge state if Spacebar wants non-null `PrimaryGuild.badge` support.
- Address the unrelated `GET /discovery/search` runtime contract failure separately.
