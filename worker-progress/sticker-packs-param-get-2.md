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

# Worker Progress: sticker-packs-param-get-2

## Goal Evidence

- Worker `create_goal`: created active goal for `Implement production-ready support for the missing route path /sticker-packs/{param} on the current integration branch, with focused tests, regenerated route catalogs and generated route artifacts, verification evidence, and a complete handoff report.`
- Worker `get_goal`: status `active`; objective matched the created goal.
- Worker `update_goal(status: "complete")`: completed after implementation, regeneration, verification, and report updates. Goal status `complete`; time used `860` seconds.

## Scope

- Assigned path: `/sticker-packs/{param}`.
- Missing methods found: `GET_STICKER_PACKS_STICKER_PACK_ID`.
- Methods implemented: `GET /sticker-packs/{sticker_pack_id}`.
- Out of scope and not implemented: `/sticker-packs/directory-v2/{param}`, adjacent sticker routes, guild sticker routes, store/SKU routes, and sticker-pack list behavior beyond focused regression coverage.

## Evidence

- `packages/missing-routes/missing.json` had one owned entry on the worker base: `GET /sticker-packs/{param}`, route name `GET_STICKER_PACKS_STICKER_PACK_ID`, sources `userdoccers:resources/sticker.mdx` and `xhyrom:data/client/routes.json`, source route `/sticker-packs/{sticker_pack_id}`.
- Current-base pre-port check still showed `GET /sticker-packs/{param}` as missing after the OAuth2 keys and device unregister merges.
- `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json` initially had only `GET /sticker-packs`; the parameter route was absent.
- `src/api/routes/**` had `src/api/routes/sticker-packs/index.ts`, `src/api/routes/stickers/#sticker_id/index.ts`, and guild sticker routes; no `/sticker-packs/{param}` route existed.
- Userdoccers catalog confirms `GET /sticker-packs/{sticker_pack_id}`, summary `Get Sticker Pack`, source `userdoccers:resources/sticker.mdx`.
- xHyroM catalog confirms `GET /sticker-packs/{param}`, route name `STICKER_PACK`.
- External docs checked by the worker: Userdoccers raw sticker docs and rendered docs at `https://raw.githubusercontent.com/discord-userdoccers/discord-userdoccers/master/pages/resources/sticker.mdx` and `https://docs.discord.food/resources/sticker`.

## Behavior

- Auth mode: bearer-authenticated. The route is not in `NO_AUTHORIZATION_ROUTES`, the adjacent list route is bearer in the generated manifest, and Userdoccers marks the individual pack route as bot-supported rather than unauthenticated. Route metadata explicitly declares `401: { body: "APIErrorResponse" }`.
- Response schema: `StickerPackResponse` with `id`, `stickers`, `name`, `description`, optional `sku_id`, optional `cover_sticker_id`, and optional `banner_asset_id`.
- Data source: `StickerPack.findOneOrFail({ where: { id: sticker_pack_id }, relations: { stickers: true } })`.
- Response mapping: returns a clean API response object, maps stickers to `StickerResponse`, defaults nullable descriptions to `null`, defaults missing sticker tags to `""`, includes optional fields only when present, and does not expose TypeORM relation internals.
- SKU behavior: current Spacebar `StickerPack` persistence does not define a durable `sku_id`; the route does not synthesize one. If a future entity or custom row includes `sku_id`, the mapper passes it through.
- Missing-pack behavior: TypeORM `EntityNotFoundError` flows through the existing `ErrorHandler` as HTTP 404 `APIErrorResponse` with message `StickerPack could not be found`.
- Adjacent list behavior: unchanged; focused test asserts the existing `/sticker-packs/` response shape remains `{ sticker_packs: [...] }`.

## Changed Files

- `src/api/routes/sticker-packs/#sticker_pack_id/index.ts`
- `src/schemas/api/guilds/Sticker.ts`
- `test/routes/sticker-pack-get-route.test.ts`
- `assets/schemas.json`
- `assets/openapi.json`
- `assets/testing-manifest.json`
- `test/generated/http-contracts.json`
- `test/generated/suite-coverage.json`
- `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`
- `packages/missing-routes/missing.json`
- `worker-progress/sticker-packs-param-get-2.md`

The worker's old-base `ChannelMessageCreateRoute.ts` build workaround was not ported because current-base verification does not require it.

## Verification

- Worker verification on old base passed: source build, schema/OpenAPI generation, test fixture build, focused route/schema test 6/6, source catalog import, missing-route regeneration, testing manifest checks, generated contract/suite checks and tests, diff checks, package manifest/lockfile cleanliness, and malformed warranty-string scan.
- Current-base orchestrator verification passed:
  - `npm run build:src:tsgo`
  - `npm run generate:schema` (`834` schemas)
  - `npm run build:test-fixtures`
  - `npm run build --workspace @spacebar/automatic-reverse-engineering`
  - `node packages/automatic-reverse-engineering/dist/cli.js import-source-routes --root src/api/routes --out packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`
  - `npm run build --workspace @spacebar/missing-routes`
  - `npm run start --workspace @spacebar/missing-routes` (`747` missing, `433` implemented, `1128` Discord)
  - `npm run generate:testing-manifest` (`538` entries)
  - `node scripts/testing-manifest/verify.js`
  - `npm run generate:contract-tests`; `node scripts/testing-manifest/generate-contract-tests.js --check` (`513` contracts)
  - `node scripts/testing-manifest/generate-suite-coverage.js --check`
  - `npm run generate:openapi` (`342` paths, `834` schemas)
  - rerun `npm run build:test-fixtures`
  - `node -r dotenv/config -r module-alias/register --enable-source-maps --test dist-test/test/routes/sticker-pack-get-route.test.js` (`6/6`)
  - `node --test test/generated/http-contracts.test.js test/generated/suite-coverage.test.js` (`13/13`)
  - `git diff --check`
  - package manifest/lockfile drift guard
  - malformed AGPL warranty-token scan

## Missing-Route Count Movement

- Worker-base movement: `752 -> 751`; implemented count `428 -> 429`.
- Current-base movement after later merges: `748 -> 747`; implemented count `432 -> 433`.

## Risks And Notes

- `sku_id` is optional in `StickerPackResponse` because the current Spacebar `StickerPack` entity/schema does not persist it. A separate persistence migration/backfill should own exact SKU parity if the project wants to require that field.
- The existing `/sticker-packs/` list route still has older response metadata (`StickersResponse`) even though its runtime shape is `{ sticker_packs: [...] }`; this worker did not alter pack-list scope.
- Keep `/sticker-packs/directory-v2/{param}` assigned separately; it was not implemented here.
