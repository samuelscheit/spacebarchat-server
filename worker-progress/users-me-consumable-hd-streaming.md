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

# users-me-consumable-hd-streaming

## Summary

Implemented the assigned `/users/@me/consumable/hd-streaming` path with
bearer-authenticated `GET` and `POST` handlers.

Spacebar still has no durable HD streaming consumable entitlement or inventory
model. `GET` therefore returns `{ "entitlement": null }`. `POST` validates the
`channel_id` body and then fails closed with `UNKNOWN_ENTITLEMENT`, avoiding
fabricated voice-channel mutation, inventory consumption, or `Channel Update`
gateway emission.

## Changed Files

- `assets/openapi.json`
- `assets/schemas.json`
- `assets/testing-manifest.json`
- `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`
- `packages/missing-routes/missing.json`
- `src/api/routes/users/@me/consumable/hd-streaming.ts`
- `src/api/util/index.ts`
- `src/api/util/utility/HDStreamingConsumable.test.ts`
- `src/api/util/utility/HDStreamingConsumable.ts`
- `src/schemas/responses/HDStreamingConsumableResponse.ts`
- `src/schemas/responses/index.ts`
- `src/schemas/uncategorised/HDStreamingConsumableApplySchema.ts`
- `src/schemas/uncategorised/index.ts`
- `test/generated/http-contracts.json`
- `test/generated/suite-coverage.json`
- `tsconfig.test.json`
- `worker-progress/users-me-consumable-hd-streaming.md`

## Assigned Path

- Assigned path: `/users/@me/consumable/hd-streaming`
- Missing methods found: `GET_USERS__ME_CONSUMABLE_HD_STREAMING`,
  `POST_USERS__ME_CONSUMABLE_HD_STREAMING`
- Methods implemented: `GET`, `POST`

## Missing Route Count Movement

- Current base before merge: `7933b1ecd`.
- Current-base missing count moved from `631` to `629`.
- Current-base implemented count moved from `549` to `551`.
- Discord target count remained `1128`.
- Current `packages/missing-routes/missing.json` has `0` entries whose `route`
  is `/users/@me/consumable/hd-streaming`.

## Evidence Gathered

- `packages/missing-routes/missing.json` contained the two assigned missing
  entries before regeneration.
- `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`
  had no `/users/@me/consumable/hd-streaming` entries before implementation.
- `src/api/routes/users/@me/consumable/` only contained `confetti.ts` before
  implementation.
- Userdoccers Store docs list:
  - `GET /users/@me/consumable/hd-streaming`: returns the active HD streaming
    entitlement for the user.
  - `POST /users/@me/consumable/hd-streaming`: applies an HD streaming potion
    to a voice channel, returns `204`, and fires `Channel Update` on success.
- `src/api/routes/users/@me/consumable/confetti.ts` and
  `src/api/util/utility/ConfettiConsumable.ts` establish the local consumable
  fail-closed pattern while durable consumable state is absent.
- Regenerated source catalog records both HD streaming methods from
  `src/api/routes/users/@me/consumable/hd-streaming.ts`.
- Regenerated OpenAPI exposes `/users/@me/consumable/hd-streaming/` with bearer
  security, `HDStreamingConsumableResponse`,
  `HDStreamingConsumableApplySchema`, and `APIErrorResponse` metadata.
- Regenerated testing manifest and HTTP contracts include both HD streaming
  methods.

## Userdoccers And xHyroM References

- Userdoccers Store docs: `https://docs.discord.food/resources/store`
- Local Userdoccers route catalog:
  `packages/automatic-reverse-engineering/data/catalogs/routes.userdoccers.catalog.json`
  - `GET_USERS__ME_CONSUMABLE_HD_STREAMING`
  - `POST_USERS__ME_CONSUMABLE_HD_STREAMING`
- Local xHyroM route catalog:
  `packages/automatic-reverse-engineering/data/catalogs/routes.xhyrom.catalog.json`
  - No matching consumable or HD streaming route entry.
- Local xHyroM experiments catalog:
  `packages/automatic-reverse-engineering/data/catalogs/experiments.xhyrom.catalog.json`
  - `2024-09_hd_streaming_potion` confirms HD streaming potion is
    experiment-gated client behavior.

## Commands Run

- `npm run build:src:tsgo` - passed.
- `npm run generate:schema` - passed; wrote 1041 schemas.
- `npm run build --workspace @spacebar/automatic-reverse-engineering` - passed.
- `node packages/automatic-reverse-engineering/dist/cli.js import-source-routes --root src/api/routes --out packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json` - passed.
- `npm run build --workspace @spacebar/missing-routes` - passed.
- `npm run start --workspace @spacebar/missing-routes` - passed; wrote
  `missing = 629`, `spacebar = 551`.
- `npm run generate:testing-manifest` - passed; wrote 656 entries.
- `node scripts/testing-manifest/verify.js` - passed; verified 656 entries.
- `node scripts/testing-manifest/generate-contract-tests.js --check` - first
  reported stale generated HTTP contracts.
- `npm run generate:contract-tests` - passed; wrote 631 contracts.
- `node scripts/testing-manifest/generate-contract-tests.js --check` - passed.
- `node scripts/testing-manifest/generate-suite-coverage.js --check` - first
  reported stale suite coverage.
- `npm run generate:suite-coverage` - passed; wrote 15 suites.
- `node scripts/testing-manifest/generate-suite-coverage.js --check` - passed.
- `npm run generate:openapi` - passed; wrote 445 paths and 1041 schemas.
  Existing unrelated webhook route metadata warnings remain.
- `npm run build:test-fixtures` - passed.
- `node -r dotenv/config -r module-alias/register --enable-source-maps --test dist-test/src/api/util/utility/HDStreamingConsumable.test.js` - passed; 7 tests.
- `node --test test/generated/http-contracts.test.js` - passed; 9 tests.
- `node --test test/generated/suite-coverage.test.js` - passed; 4 tests.
- `npm run test:manifest` - passed.
- `npm run test:suite-coverage` - passed.
- `npm run lint` - passed.
- `npm run test:contracts` - static/generated contract checks passed; runtime
  failed only on the known unrelated `api:http:GET:/discovery/search`
  returning `500` instead of `200`. Existing analytics `query.ts`
  route-registration noise remained unrelated.
- `git diff --check` - passed.
- `git diff -- package.json package-lock.json && git status --short package.json package-lock.json` - passed with no package or lockfile changes.
- Changed-file malformed warranty-token scan - passed with no matches.

## Artifact Status

- `assets/schemas.json`: regenerated and includes
  `HDStreamingConsumableResponse` and `HDStreamingConsumableApplySchema`.
- `assets/openapi.json`: regenerated and includes `GET`/`POST
  /users/@me/consumable/hd-streaming/`.
- `assets/testing-manifest.json`: regenerated and includes both HD streaming
  methods with `authMode: "bearer"`.
- `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`:
  regenerated and includes both HD streaming methods.
- `packages/missing-routes/missing.json`: regenerated and no longer lists the
  assigned path.
- `test/generated/http-contracts.json`: regenerated and includes both HD
  streaming contracts.
- `test/generated/suite-coverage.json`: regenerated and includes the focused HD
  streaming test.

## Risks And Blockers

- Spacebar still lacks a durable consumable entitlement/inventory model.
- `POST` intentionally does not mutate channel HD streaming fields or emit
  `Channel Update` until inventory consumption semantics exist.
- `GET` returns a conservative empty state and does not represent purchased HD
  streaming consumables.

## Recommended Next Tasks

- Add durable consumable entitlement/inventory persistence shared by confetti
  and HD streaming.
- Once inventory exists, wire successful HD streaming application to
  voice-channel state and `Channel Update` emission.
