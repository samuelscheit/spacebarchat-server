# PUT /guilds/{param}/incident-actions

## Summary

Implemented `PUT /guilds/{guild_id}/incident-actions`. The route stores AutoMod
incident action timestamps in `Guild.incidents_data`, accepts nullable ISO8601
`invites_disabled_until` and `dms_disabled_until`, preserves omitted fields,
rejects expirations more than 24 hours in the future, returns the current
incident action state, and emits `GUILD_UPDATE`.

## Missing-Route Movement

- Current base before regeneration: `478` missing / `702` implemented / `1128`
  Discord.
- After regeneration: `477` missing / `703` implemented / `1128` Discord.
- Removed missing entry: `PUT_GUILDS_GUILD_ID_INCIDENT_ACTIONS` for
  `/guilds/{param}/incident-actions`.

## Changed Files

- `src/api/routes/guilds/#guild_id/incident-actions.ts`
- `src/api/routes/guilds/#guild_id/incident-actions.test.ts`
- `src/schemas/api/guilds/Automod.ts`
- `src/schemas/responses/GuildCreateResponse.ts`
- `src/schemas/uncategorised/AutomodRuleSchema.test.ts`
- `src/util/entities/Guild.ts`
- `src/util/migration/postgres/1778520000000-GuildIncidentsData.ts`
- `src/util/migration/postgres/__tests__/1778520000000-GuildIncidentsData.test.ts`
- `tsconfig.test.json`
- Regenerated `assets/schemas.json`, `assets/openapi.json`,
  `assets/testing-manifest.json`,
  `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`,
  `packages/missing-routes/missing.json`,
  `test/generated/http-contracts.json`, and
  `test/generated/suite-coverage.json`.

## Evidence

- Userdoccers `resources/auto-moderation.mdx` documents this route with
  `MANAGE_GUILD`, `GUILD_UPDATE`, nullable incident action timestamps, and a
  24-hour future cap.
- Local xhyrom route catalog names the route `GUILD_INCIDENT_ACTIONS`.
- Generated OpenAPI now exposes `PUT /guilds/{guild_id}/incident-actions/` with
  `AutomodIncidentActionsSchema` and `AutomodIncidentActionsResponse`.
- Generated testing manifest and HTTP contracts include auth, permission,
  request schema, response schema, database state, event emission, and
  rate-limit coverage for the route.

## Verification

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
- `node -r dotenv/config -r module-alias/register --enable-source-maps --test 'dist-test/src/api/routes/guilds/#guild_id/incident-actions.test.js' dist-test/src/schemas/uncategorised/AutomodRuleSchema.test.js dist-test/src/util/migration/postgres/__tests__/1778520000000-GuildIncidentsData.test.js`
- `npm run test:manifest`
- `npm run test:suite-coverage`
- `npx eslint 'src/api/routes/guilds/#guild_id/incident-actions.ts' 'src/api/routes/guilds/#guild_id/incident-actions.test.ts' src/schemas/api/guilds/Automod.ts src/schemas/responses/GuildCreateResponse.ts src/schemas/uncategorised/AutomodRuleSchema.test.ts src/util/entities/Guild.ts src/util/migration/postgres/1778520000000-GuildIncidentsData.ts src/util/migration/postgres/__tests__/1778520000000-GuildIncidentsData.test.ts`
- `git diff --check`
- `git diff --exit-code -- package.json package-lock.json`
- `npm run test:contracts` passed generated/static checks and failed only on
  the known unrelated runtime assertion:
  `api:http:GET:/discovery/search` returned `500 !== 200`.

## Notes

- `OPTIONS /guilds/{guild_id}/incident-actions` and adjacent AutoMod incident
  reporting/action routes remain intentionally untouched.
- No audit-log write was added; the available route evidence documents only
  `GUILD_UPDATE`.
- The implementation uses the documented 24-hour maximum rather than the extra
  tolerance mentioned in Discord API issue discussion.
