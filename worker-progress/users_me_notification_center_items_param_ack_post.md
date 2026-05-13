# POST /users/@me/notification-center/items/{param}/ack

## Summary

Implemented the assigned `POST /users/@me/notification-center/items/{param}/ack` route only.

The route now:

- validates `notification_center_item_id` as a Discord snowflake;
- updates the current user's durable `ReadStateType.NOTIFICATION_CENTER` read state with `last_acked_id` through the existing non-channel read-state persistence helper;
- emits the documented `NOTIFICATION_CENTER_ITEMS_ACK` gateway event with `{ id }`;
- returns `204` on success and documents `400`/`401` API error responses.

## Changed Files

- `src/api/routes/users/@me/notification-center/items.ts`
- `src/util/interfaces/Event.ts`
- `src/util/interfaces/Event.test.ts`
- `test/routes/notificationCenterItemsRoute.test.ts`
- `assets/openapi.json`
- `assets/testing-manifest.json`
- `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`
- `packages/missing-routes/missing.json`
- `test/generated/http-contracts.json`
- `test/generated/suite-coverage.json`

## Evidence Gathered

- `packages/missing-routes/missing.json` initially contained `POST_USERS__ME_NOTIFICATION_CENTER_ITEMS_NOTIFICATION_CENTER_ITEM_ID_ACK`; after regeneration it is absent.
- `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json` now contains `POST /users/@me/notification-center/items/{notification_center_item_id}/ack` with route name `POST_USERS__ME_NOTIFICATION_CENTER_ITEMS_NOTIFICATION_CENTER_ITEM_ID_ACK`.
- Userdoccers route source: `https://raw.githubusercontent.com/discord-userdoccers/discord-userdoccers/master/pages/resources/notification-center.mdx` documents the ack endpoint as `204` and firing `Notification Center Items Ack`.
- Userdoccers gateway source: `https://raw.githubusercontent.com/discord-userdoccers/discord-userdoccers/master/pages/gateway/gateway-events.mdx` documents `NOTIFICATION_CENTER_ITEMS_ACK` payload field `id`.
- Userdoccers read-state source: `https://raw.githubusercontent.com/discord-userdoccers/discord-userdoccers/master/pages/topics/read-state.mdx` documents `NOTIFICATION_CENTER` read states comparing notification-center item IDs against `last_acked_id`, with the current user ID as the user-feature resource.
- xHyroM evidence: `packages/automatic-reverse-engineering/data/catalogs/routes.xhyrom.catalog.json` has `POST /users/@me/notification-center/items/{param}/ack` as `NOTIF_CENTER_ITEMS_ACK`.

## Missing-Route Movement

- Before: `missing_entries.length = 504`; `spacebar = 676`.
- After regeneration: `missing_entries.length = 503`; `spacebar = 677`.
- Removed assigned missing entry: `POST /users/@me/notification-center/items/{param}/ack`.

## Commands Run

- `npm ci`
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
- `node -r dotenv/config -r module-alias/register --enable-source-maps --test dist-test/test/routes/notificationCenterItemsRoute.test.js dist-test/src/util/interfaces/Event.test.js`
- `npm run test:manifest`
- `npm run test:suite-coverage`
- `./node_modules/.bin/eslint src/api/routes/users/@me/notification-center/items.ts src/util/interfaces/Event.ts src/util/interfaces/Event.test.ts test/routes/notificationCenterItemsRoute.test.ts`
- `npm run test:contracts`
- `git diff --check`
- `git diff --exit-code -- package.json package-lock.json`

## Verification Results

- Source build passed.
- Automatic reverse engineering workspace build passed.
- Missing-routes workspace build and regeneration passed.
- OpenAPI, schema, source catalog, missing-route report, testing manifest, generated HTTP contracts, and suite coverage regenerated.
- Focused route/event tests passed: 18 tests.
- `test:manifest` passed.
- `test:suite-coverage` passed.
- Targeted ESLint passed.
- `git diff --check` passed.
- Package/lockfile guard passed.
- `npm run test:contracts` static/generated checks passed; runtime failed only on known unrelated `api:http:GET:/discovery/search` with `500 !== 200`, matching the worker brief's known failure.

## Risks And Blockers

- Spacebar still has no durable notification-center item table/provider. This implementation does not fabricate item records and does not verify item existence or ownership beyond bearer user scope; it stores the caller's valid snowflake as the current user's notification-center read-state cursor and emits the documented ack event.
- The route intentionally does not implement item delete, item lookup/delete sibling path behavior, or bulk ack.

## Sibling Routes Intentionally Untouched

- `DELETE /users/@me/notification-center/items/{param}`
- `POST /users/@me/notification-center/items/bulk-ack`
- Any generic `/users/@me/{read_state.type}/{entity.id}/ack` read-state route

## Recommended Next Tasks

- Implement `DELETE /users/@me/notification-center/items/{param}` once assigned.
- Implement `POST /users/@me/notification-center/items/bulk-ack` once assigned.
- Add a durable notification-center item provider/table if the project wants to verify item existence/ownership instead of accepting client-managed read-state cursors.
