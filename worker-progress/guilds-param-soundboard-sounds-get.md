# guilds-param-soundboard-sounds-get

## Summary

Implemented `GET /guilds/{param}/soundboard-sounds`
(`GET_GUILDS_GUILD_ID_SOUNDBOARD_SOUNDS`) as
`src/api/routes/guilds/#guild_id/soundboard-sounds.ts`.

The route:

- Requires bearer auth through the normal route boundary.
- Verifies the guild exists before member or sound lookups.
- Requires the authenticated user to be a guild member.
- Returns `{ "items": [] }` until Spacebar has guild soundboard sound
  persistence.
- Includes creator `user` data only when the requester can create or manage
  guild expressions.
- Leaves `POST /guilds/{guild_id}/soundboard-sounds`, per-sound routes,
  upload/storage persistence, and broader soundboard management out of scope.

## Assigned Path

- Assigned route: `GET /guilds/{param}/soundboard-sounds`
- Route id: `guilds-param-soundboard-sounds-get`
- Route name: `GET_GUILDS_GUILD_ID_SOUNDBOARD_SOUNDS`
- Sources: `userdoccers:resources/soundboard.mdx`,
  `xhyrom:data/client/routes.json`
- Source route: `/guilds/{guild_id}/soundboard-sounds`
- Implemented methods: `GET`
- Adjacent missing methods intentionally not implemented:
  `POST /guilds/{param}/soundboard-sounds`

## Evidence Gathered

- Confirmed `packages/missing-routes/missing.json` had the assigned GET entry
  before regeneration.
- Confirmed the source catalog had default/global soundboard routes but no
  `/guilds/{guild_id}/soundboard-sounds` route.
- Reviewed existing guild membership patterns and soundboard default/detail
  response schemas.
- Reviewed Userdoccers soundboard documentation for the response shape and
  creator-user visibility rule.
- Read-only audit confirmed the worker source/test diff was scoped and
  acceptable to port, with generated artifacts regenerated on current main.

## Changed Files

- `src/api/routes/guilds/#guild_id/soundboard-sounds.ts`: new guild list
  route, guild/member checks, response serialization, repository seams.
- `src/schemas/responses/SoundboardDefaultSoundsResponse.ts`: added
  `GuildSoundboardSoundsResponse`.
- `test/routes/guilds-param-soundboard-sounds-get.test.ts`: focused route,
  auth, serialization, schema, OpenAPI, catalog, manifest, and missing-report
  tests.
- `assets/schemas.json`: regenerated schema asset.
- `assets/openapi.json`: regenerated OpenAPI asset.
- `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`:
  regenerated source route catalog.
- `packages/missing-routes/missing.json`: regenerated missing-route report.
- `assets/testing-manifest.json`: regenerated testing manifest.
- `test/generated/http-contracts.json`: regenerated HTTP contract matrix.
- `test/generated/suite-coverage.json`: regenerated suite coverage matrix.

## Missing Count Movement

Compared with current-main base `c41ffa60438e0ea8c863f8eb79eaa2ed593fbd2c`:

- Base missing count: `651`
- Current missing count: `650`
- Movement: `-1`
- Base implemented count: `529`
- Current implemented count: `530`
- Discord implemented count: `1128`
- Base had assigned GET entry: yes
- Current has assigned GET entry: no
- Sibling `POST /guilds/{param}/soundboard-sounds` remains missing: yes

Regenerated source catalog now includes:

- `GET /guilds/{guild_id}/soundboard-sounds`
- `route_name`: `GET_GUILDS_GUILD_ID_SOUNDBOARD_SOUNDS`
- `response_schema_refs`: `APIErrorResponse`, `GuildSoundboardSoundsResponse`
- `source`: `src/api/routes/guilds/#guild_id/soundboard-sounds.ts`

## Commands Run

- `npm run build:src:tsgo` - passed.
- `npm run generate:schema` - passed; wrote `1009` schemas.
- `npm run build --workspace @spacebar/automatic-reverse-engineering` -
  passed.
- `node packages/automatic-reverse-engineering/dist/cli.js import-source-routes --root src/api/routes --out packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json` -
  passed.
- `npm run build --workspace @spacebar/missing-routes` - passed.
- `npm run start --workspace @spacebar/missing-routes` - passed; wrote `650`
  missing / `530` implemented / `1128` Discord.
- `npm run generate:testing-manifest` - passed; wrote `635` entries.
- `node scripts/testing-manifest/verify.js` - passed.
- `node scripts/testing-manifest/generate-contract-tests.js --check` -
  initially stale.
- `npm run generate:contract-tests` - passed; wrote `610` contracts.
- `node scripts/testing-manifest/generate-contract-tests.js --check` -
  passed.
- `node scripts/testing-manifest/generate-suite-coverage.js --check` -
  initially stale.
- `npm run generate:suite-coverage` - passed; wrote `15` suites.
- `node scripts/testing-manifest/generate-suite-coverage.js --check` -
  passed.
- `npm run generate:openapi` - passed; wrote `424` paths and `1009` schemas;
  existing warning: 3 routes missing route middleware.
- `npm run build:test-fixtures` - passed.
- `node -r dotenv/config -r module-alias/register --enable-source-maps --test dist-test/test/routes/guilds-param-soundboard-sounds-get.test.js` -
  passed, `7/7`.
- `node --test test/generated/http-contracts.test.js test/generated/suite-coverage.test.js` -
  passed, `13/13`.
- `npm run test:manifest` - passed.
- `npm run test:suite-coverage` - passed.
- `npx eslint "src/api/routes/guilds/#guild_id/soundboard-sounds.ts" src/schemas/responses/SoundboardDefaultSoundsResponse.ts test/routes/guilds-param-soundboard-sounds-get.test.ts` -
  passed.

## Verification Notes

Focused tests passing:

- bearer auth gate stays active
- authenticated guild members receive `{ items: [] }` by default
- source-backed sound serialization strips creator user data without expression
  permissions
- creator user data is included with expression permissions
- unknown guild returns `404`
- non-member returns `403`
- schema, OpenAPI, source catalog, manifest, and missing report artifacts
  include the assigned GET and keep the sibling POST missing

Generated artifacts:

- Source catalog: regenerated and includes assigned route.
- Missing report: regenerated and assigned GET removed from `missing_entries`.
- Testing manifest: regenerated and verified, `635` entries.
- HTTP contracts: regenerated and verified, `610` contracts.
- Suite coverage: regenerated and verified, `15` suites.
- Schemas/OpenAPI: regenerated and include `GuildSoundboardSoundsResponse` plus
  `/guilds/{guild_id}/soundboard-sounds/`.

## Risks / Blockers

- Spacebar does not yet persist guild soundboard sounds, so the default
  production behavior is an empty list after guild/member checks.
- If future persistence adds extra creator fields beyond `user`, revisit the
  serializer visibility rule. The current implementation mirrors available
  response schema fields and strips `user` when creator details are not
  visible.
- The worker reported an unrelated generated runtime contract failure for
  `GET /discovery/search`; this integration did not rerun broad runtime
  contracts.

## Recommended Next Tasks

- Implement `POST /guilds/{guild_id}/soundboard-sounds` separately once
  persistence/upload behavior is defined.
- Fix the existing `GET /discovery/search` public response runtime contract
  failure in a dedicated change.
