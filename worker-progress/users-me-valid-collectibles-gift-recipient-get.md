# users_me_valid_collectibles_gift_recipient_get

## Summary

Implemented `GET /users/@me/valid-collectibles-gift-recipient`.

The route is bearer-authenticated, validates required `recipient_id` and `sku_id`
query snowflakes with the strict local route pattern `^[1-9]\d{16,19}$`, returns
the documented `{ "valid": boolean }` response shape, and fails closed with
`{ "valid": false }` by default because Spacebar has no durable collectible gift,
purchase ownership, or collectible catalog eligibility backing. Self-gifting is
rejected before provider evaluation.

No adjacent collectibles purchase, shop/search, product, billing, promotion,
gift-code, relationship, user settings, or batch gift-recipient route was
implemented.

## Evidence

- Assigned path: `/users/@me/valid-collectibles-gift-recipient`
- Missing method: `GET_USERS__ME_VALID_COLLECTIBLES_GIFT_RECIPIENT`
- Sources: `userdoccers:resources/collectibles.mdx`,
  `xhyrom:data/client/routes.json`
- Worker-base regeneration removed the assigned route from `missing.json`;
  `/users/@me/valid-collectibles-gift-recipients-batch` remains missing and out
  of scope.
- Acceptance follow-up fixed the original loose snowflake validator so `0`,
  `2`, `3`, and other short IDs are rejected.

## Current-Base Audit

- Ported onto current integration base `e4429a959`.
- Current-base missing-route movement after regeneration: `615 -> 614`
  missing and `565 -> 566` implemented.
- Assigned `/users/@me/valid-collectibles-gift-recipient` entry is removed from
  `packages/missing-routes/missing.json`.
- `/users/@me/valid-collectibles-gift-recipients-batch` remains missing and out
  of scope.
- Source catalog, OpenAPI, schemas, testing manifest, generated HTTP
  contracts, and suite coverage include the new route.
- Current-base verification passed:
  - `npm run build:src:tsgo`
  - `npm run generate:schema`
  - `npm run build --workspace @spacebar/automatic-reverse-engineering`
  - source catalog import
  - `npm run build --workspace @spacebar/missing-routes`
  - `npm run start --workspace @spacebar/missing-routes`
  - `npm run generate:openapi`
  - `npm run generate:testing-manifest`
  - testing manifest verify
  - generated contract and suite coverage regeneration/checks
  - `npm run build:test-fixtures`
  - focused route/schema tests, 10/10
  - generated HTTP contract tests, 10/10
  - generated suite coverage tests, 4/4
  - `npm run test:manifest`, 30/30
  - `npm run test:suite-coverage`
  - `npm run lint`
  - `git diff --check`
  - package/lockfile guard
  - changed-file malformed warranty-token scan
- `npm run test:contracts` passed static/generated contract checks and then
  failed only on the known unrelated runtime contract for
  `api:http:GET:/discovery/search` returning `500` instead of `200`; existing
  analytics `query.ts` route-registration warnings remain unrelated.
