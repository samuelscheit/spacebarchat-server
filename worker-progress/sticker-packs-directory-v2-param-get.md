# sticker-packs-directory-v2-param-get

## Summary

Accepted and integrated `GET /sticker-packs/directory-v2/{param}` as
`GET /sticker-packs/directory-v2/:param/` on current base `fef56617c`.

The route is bearer-authenticated and returns locally persisted sticker packs as
`StickerPacksDirectoryResponse`. The path parameter is passed to an injectable
provider for future directory-specific support, but the default provider returns
only existing local `StickerPack` rows with stickers. It does not fabricate
Discord storefront directory layout, ranking, SKU pricing, entitlement, Nitro,
collectible, or marketplace metadata.

## Changed Files

- `src/api/routes/sticker-packs/directory-v2/#param/index.ts`
- `src/api/util/utility/StickerPack.ts`
- `src/api/routes/sticker-packs/#sticker_pack_id/index.ts`
- `src/schemas/api/guilds/Sticker.ts`
- `test/routes/sticker-packs-directory-v2-param-get.test.ts`
- `assets/openapi.json`
- `assets/schemas.json`
- `assets/testing-manifest.json`
- `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`
- `packages/missing-routes/missing.json`
- `test/generated/http-contracts.json`
- `worker-progress/sticker-packs-directory-v2-param-get.md`

## Evidence

- `packages/missing-routes/missing.json` contained `GET
  /sticker-packs/directory-v2/{param}` with route name
  `STORE_DIRECTORY_LAYOUT_STICKER_PACKS`.
- The xHyroM catalog lists the same path and route name.
- The Userdoccers catalog covers `/sticker-packs` and
  `/sticker-packs/{sticker_pack_id}` from `resources/sticker.mdx`; no
  Userdoccers directory-v2 route is present.
- Existing local `/sticker-packs/{sticker_pack_id}` behavior already serializes
  `StickerPackResponse`; this integration moves that serializer to
  `src/api/util/utility/StickerPack.ts` so the new route can reuse it without
  importing another route module.

## Behavior

- `401` for missing bearer auth through standard authentication middleware.
- `200` with `{ "sticker_packs": StickerPackResponse[] }` for local sticker
  packs returned by the provider.
- The default provider loads `StickerPack.find({ relations: { stickers: true }
  })`.
- Adjacent `/sticker-packs` and `/sticker-packs/{sticker_pack_id}` route
  behavior is preserved.

## Missing-Route Movement

- Current base: `fef56617c`
- Missing count: `553 -> 552`
- Spacebar implemented count: `627 -> 628`
- Discord implemented count: `1128`
- Removed from missing:
  `GET /sticker-packs/directory-v2/{param}`

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
- `TS_NODE_TRANSPILE_ONLY=1 node -r dotenv/config -r ts-node/register/transpile-only -r module-alias/register --enable-source-maps --test test/routes/sticker-packs-directory-v2-param-get.test.ts test/routes/sticker-pack-get-route.test.ts`
- `npm run build:test-fixtures`
- `node -r dotenv/config -r module-alias/register --enable-source-maps --test dist-test/test/routes/sticker-packs-directory-v2-param-get.test.js dist-test/test/routes/sticker-pack-get-route.test.js`
- `node scripts/testing-manifest/verify.js`
- `node scripts/testing-manifest/generate-contract-tests.js --check`
- `node --test test/generated/http-contracts.test.js test/contracts/*.test.cjs`
- `node scripts/testing-manifest/generate-suite-coverage.js --check`
- `node --test test/generated/suite-coverage.test.js`
- `npm run test:manifest`
- `npm run test:suite-coverage`
- `npm run lint -- 'src/api/routes/sticker-packs/directory-v2/#param/index.ts' src/api/util/utility/StickerPack.ts 'src/api/routes/sticker-packs/#sticker_pack_id/index.ts' src/schemas/api/guilds/Sticker.ts test/routes/sticker-packs-directory-v2-param-get.test.ts`
- `npx prettier --check 'src/api/routes/sticker-packs/directory-v2/#param/index.ts' src/api/util/utility/StickerPack.ts 'src/api/routes/sticker-packs/#sticker_pack_id/index.ts' src/schemas/api/guilds/Sticker.ts test/routes/sticker-packs-directory-v2-param-get.test.ts`
- `git diff --check`
- `git diff --exit-code -- package.json package-lock.json`
- license-header typo scan over the touched source and test files

## Verification Notes

- Focused source route tests passed: `11/11`.
- Focused built route tests passed: `11/11`.
- Testing manifest verification passed: `733` entries.
- Generated HTTP contract static checks passed: `708` contracts and `10/10`
  matrix tests.
- Generated suite coverage checks passed: `4/4` tests.
- OpenAPI regeneration produced `517` paths and `1171` schemas.
- Package and lockfile guard passed; `package.json` and `package-lock.json`
  are unchanged.
- `npm run test:contracts` failed only on the known unrelated runtime contract:
  `api:http:GET:/discovery/search` returned `500` instead of `200`. Existing
  analytics `query.ts` route-registration noise remains unrelated.

## Risks And Boundaries

- Discord's route name suggests a storefront directory layout. Spacebar
  currently has no local directory layout, storefront ranking, price, SKU,
  entitlement, Nitro, collectible, or marketplace catalog backing for sticker
  packs.
- The default response intentionally exposes only local persisted sticker-pack
  data.
- No sticker-pack mutation, store, billing, Nitro, collectibles, entitlement,
  or unrelated directory routes were implemented.
