# guilds-param-soundboard-sounds-param-get

## Summary

Implemented `GET /guilds/{guild_id}/soundboard-sounds/{sound_id}` on current
main by porting the scoped worker route/test changes and regenerating artifacts
from commit `0068de444`.

## Changed Files

- `src/api/routes/guilds/#guild_id/soundboard-sounds.ts`
- `test/routes/guilds-param-soundboard-sounds-param-get.test.ts`
- `assets/testing-manifest.json`
- `assets/openapi.json`
- `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`
- `packages/missing-routes/missing.json`
- `test/generated/http-contracts.json`
- `test/generated/suite-coverage.json`

## Evidence

- Assigned path: `GET /guilds/{param}/soundboard-sounds/{param}`
- Route name: `GET_GUILDS_GUILD_ID_SOUNDBOARD_SOUNDS_SOUND_ID`
- Implemented method: `GET`
- Missing-route movement after current-main regeneration: `649 -> 648`
- Implemented-route movement after current-main regeneration: `531 -> 532`
- Discord-route count after regeneration: `1128`
- Source catalog now contains
  `/guilds/{guild_id}/soundboard-sounds/{sound_id}` from
  `src/api/routes/guilds/#guild_id/soundboard-sounds.ts`.
- The adjacent `PATCH` and `DELETE`
  `/guilds/{param}/soundboard-sounds/{param}` entries remain missing and out of
  scope.
- The route reuses existing guild existence, guild membership, and expression
  permission checks from the list route.
- Until Spacebar has durable guild soundboard persistence, the default
  production path fails closed with `10097 Unknown sound`.

## Verification

- `npm run build:src:tsgo`
- `npm run generate:schema`
- `npm run build --workspace @spacebar/automatic-reverse-engineering`
- `node packages/automatic-reverse-engineering/dist/cli.js import-source-routes --root src/api/routes --out packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`
- `npm run build --workspace @spacebar/missing-routes`
- `npm run start --workspace @spacebar/missing-routes`
- `npm run generate:testing-manifest`
- `node scripts/testing-manifest/verify.js`
- `node scripts/testing-manifest/generate-contract-tests.js --check`
- `npm run generate:contract-tests`
- `node scripts/testing-manifest/generate-contract-tests.js --check`
- `node scripts/testing-manifest/generate-suite-coverage.js --check`
- `npm run generate:suite-coverage`
- `node scripts/testing-manifest/generate-suite-coverage.js --check`
- `npm run generate:openapi`
- `npm run build:test-fixtures`
- `node -r dotenv/config -r module-alias/register --enable-source-maps --test dist-test/test/routes/guilds-param-soundboard-sounds-param-get.test.js dist-test/test/routes/guilds-param-soundboard-sounds-get.test.js dist-test/test/routes/soundboard-sounds-param-guild-param-get.test.js dist-test/test/routes/soundboard-default-sounds.test.js`
- `node --test test/generated/http-contracts.test.js test/generated/suite-coverage.test.js`
- `npm run test:manifest`
- `npm run test:suite-coverage`
- `npx eslint src/api/routes/guilds/#guild_id/soundboard-sounds.ts test/routes/guilds-param-soundboard-sounds-param-get.test.ts test/routes/guilds-param-soundboard-sounds-get.test.ts`
- `git diff --check`
- package/lockfile guard
- malformed warranty-token scan over changed files

## Risks

- Positive production detail responses are blocked on future soundboard
  persistence. The route is wired with an optional direct lookup dependency and
  a list fallback so that future storage can enable backed responses without
  changing the public route contract.
- Broad generated runtime HTTP contracts were not used as acceptance evidence
  because the worker already documented an unrelated `/discovery/search`
  runtime failure. Focused route coverage and generated static contract/suite
  checks passed on current main.
