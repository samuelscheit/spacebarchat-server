<!--
Spacebar: A FOSS re-implementation and extension of the Discord.com backend.
Copyright (C) 2026 Spacebar and Spacebar Contributors

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as published
by the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program.  If not, see <https://www.gnu.org/licenses/>.
-->

# Worker Progress: soundboard-default-sounds-get-2

## Goal Evidence

- `create_goal`: active, objective `Implement the missing route path GET /soundboard-default-sounds for the Spacebar server API, with focused tests and regenerated route artifacts.`
- `get_goal`: active, same objective.
- `update_goal`: complete; final tool time reported 693 seconds.

## Assignment

- Assigned path: `/soundboard-default-sounds`
- Missing methods found: `GET` only, route name `GET_SOUNDBOARD_DEFAULT_SOUNDS`
- Methods implemented: `GET /soundboard-default-sounds`
- Out of scope: guild soundboard routes, mutation/media/CDN behavior, and sound playback.

## Evidence Gathered

- `packages/missing-routes/missing.json` initially contained `GET /soundboard-default-sounds` with sources `userdoccers:resources/soundboard.mdx` and `xhyrom:data/client/routes.json`.
- `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json` had zero `/soundboard-default-sounds` entries before implementation.
- Userdoccers soundboard docs: `https://docs.discord.food/resources/soundboard`
  - Soundboard sound object fields: `sound_id`, `name`, `volume`, optional emoji/guild/user fields, `available`, and observed `user_id`.
  - `GET /soundboard-default-sounds` returns a list of soundboard sound objects usable by all users.
- Discord docs cross-check: `https://docs.discord.com/developers/resources/soundboard`
  - Confirms default sounds are returned as an array of soundboard sound objects.
- xHyroM evidence:
  - `packages/automatic-reverse-engineering/data/catalogs/routes.xhyrom.catalog.json`
  - Listed `GET`, `HEAD`, and `OPTIONS` for `/soundboard-default-sounds`.

## Behavior Summary

- Auth mode: bearer authenticated. The route is not added to `NO_AUTHORIZATION_ROUTES`; unauthenticated requests return the existing 401 API error path.
- Response schema: `SoundboardDefaultSoundsResponse`, an array of `SoundboardSoundResponse` objects. `volume` uses a `SoundboardVolume` schema alias so generated JSON Schema/OpenAPI keep it as `number`, not integer.
- Data source: currently an empty local default sound catalog. Spacebar does not persist Discord default soundboard sounds or ship matching sound files, so the endpoint returns `[]` rather than fabricating unusable default sounds.
- Error semantics: no route-specific 4xx/5xx behavior; authentication errors are handled by existing middleware.

## Changed Files

- `src/api/routes/soundboard-default-sounds.ts`
- `src/schemas/responses/SoundboardDefaultSoundsResponse.ts`
- `src/schemas/responses/index.ts`
- `test/routes/soundboard-default-sounds.test.ts`
- `assets/schemas.json`
- `assets/openapi.json`
- `assets/testing-manifest.json`
- `test/generated/http-contracts.json`
- `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`
- `packages/missing-routes/missing.json`
- `worker-progress/soundboard-default-sounds-get-2.md`

## Commands Run

- `npm run build:src:tsgo` - passed on the orchestrator current checkout after port.
- `npm run generate:schema` - passed.
- `npm run build:test-fixtures` - passed.
- `node -r dotenv/config -r module-alias/register --enable-source-maps --test dist-test/test/routes/soundboard-default-sounds.test.js` - passed.
- `npm run build --workspace @spacebar/automatic-reverse-engineering` - passed.
- `node packages/automatic-reverse-engineering/dist/cli.js import-source-routes --root src/api/routes --out packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json` - passed.
- `npm run build --workspace @spacebar/missing-routes` - passed.
- `npm run start --workspace @spacebar/missing-routes` - passed.
- `npm run generate:testing-manifest` - passed.
- `node scripts/testing-manifest/verify.js` - passed.
- `node scripts/testing-manifest/generate-contract-tests.js --check` - passed after `npm run generate:contract-tests`.
- `node scripts/testing-manifest/generate-suite-coverage.js --check` - passed.
- `node --test test/generated/http-contracts.test.js test/generated/suite-coverage.test.js` - passed.
- `npm run generate:openapi` - passed with pre-existing webhook route-metadata warnings.
- `git diff --check` - passed.
- Package/lockfile guard - passed; no package manager metadata changed.
- Malformed warranty-token scan over changed scoped files - passed.

## Missing-Route Movement

- Worker base regeneration: `783 -> 782` missing.
- Orchestrator current-base regeneration after port: `779 -> 778` missing, `401 -> 402` implemented.

## Self-Review

- Security: bearer auth preserved via normal API authentication middleware; no public-route exception added.
- Response shape: route returns a JSON array; schema matches documented soundboard object fields and preserves floating-point `volume`.
- Generated artifacts: source catalog, missing-routes report, schemas, OpenAPI, testing manifest, and HTTP contract matrix regenerated and freshness checks pass.
- Scope: only the assigned root default-sounds route was implemented; guild soundboard, mutation, sound playback, and CDN behavior remain untouched.

## Risks And Blockers

- Spacebar still has no durable/default soundboard sound catalog or bundled sound files. Returning `[]` is conservative and avoids advertising sounds that cannot be fetched or played.
- Clients expecting Discord's built-in default sounds will see an empty default sound list until a real local/default catalog and media source are implemented.

## Recommended Next Tasks

- Add a real Spacebar-managed default soundboard catalog only if matching local media delivery is also provided.
- Implement guild soundboard routes separately, with persistence, permissions, audit-log/gateway behavior, and media upload constraints.
