# messages-explicit-media-patch

## Summary

Implemented the assigned global `PATCH /messages/explicit-media` route (`PATCH_MESSAGES_EXPLICIT_MEDIA`) only.

The route validates the bulk scan body with a new non-coercing schema, resolves existing local message targets, checks visibility with `VIEW_CHANNEL` and `READ_MESSAGE_HISTORY` where needed, ignores missing or inaccessible targets, and returns Discord-compatible `204` without mutating message state. Spacebar has no durable explicit-media scanner or persisted scan-version fields for this path, so the handler does not fabricate scan results or emit `MESSAGE_UPDATE`.

## Changed Files

- `src/api/routes/messages/explicit-media.ts`
- `src/api/routes/messages/explicit-media.test.ts`
- `src/schemas/uncategorised/MessageExplicitMediaScanSchema.ts`
- `src/schemas/uncategorised/index.ts`
- `tsconfig.test.json`
- `assets/schemas.json`
- `assets/openapi.json`
- `assets/testing-manifest.json`
- `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`
- `packages/missing-routes/missing.json`
- `test/generated/http-contracts.json`

Generated suite coverage files were checked and unchanged.

## Evidence Sources

- `packages/missing-routes/missing.json`: assigned missing entry was `PATCH /messages/explicit-media`, route name `PATCH_MESSAGES_EXPLICIT_MEDIA`, summary `Bulk Scan Explicit Media`.
- `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`: confirmed the assigned route was absent before implementation and present after regeneration.
- Userdoccers `pages/resources/message.mdx` / `https://docs.discord.food/resources/message`: bulk scan endpoint takes `messages` array of `{ channel_id, message_id }`, returns `204`, and invalid channel/message IDs are ignored.
- `packages/automatic-reverse-engineering/data/catalogs/routes.xhyrom.catalog.json`: xHyrom source lists `PATCH /messages/explicit-media` as `EXPLICIT_MEDIA_SCAN_MULTI_CHANNEL_MESSAGES`.
- Nearby local routes reviewed: `src/api/routes/attachments/report-false-positive.ts`, `src/api/routes/attachments/sender-report-false-positive.ts`, `src/api/routes/attachments/refresh-urls.ts`, and `src/api/routes/channels/#channel_id/messages/#message_id/index.ts`.

## Missing-Route Movement

- Before regeneration on this base: `missing = 538`, `spacebar = 642`.
- After regeneration: `missing = 537`, `spacebar = 643`.
- The assigned `/messages/explicit-media` entry is gone from `missing_entries`.
- Adjacent `/channels/{param}/explicit-media` remains missing and untouched.

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
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" node -r dotenv/config -r module-alias/register --enable-source-maps --test dist-test/src/api/routes/messages/explicit-media.test.js`
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run test:manifest`
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run test:suite-coverage`
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run test:contracts`
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npx eslint src/api/routes/messages/explicit-media.ts src/api/routes/messages/explicit-media.test.ts src/schemas/uncategorised/MessageExplicitMediaScanSchema.ts src/schemas/uncategorised/index.ts`
- `git diff --check`
- `git diff -- package.json package-lock.json && git status --short package.json package-lock.json`

## Verification Results

- Focused route test passed: 7 tests.
- `npm run build:src:tsgo` passed.
- `npm run build:test-fixtures` passed.
- `npm run test:manifest` passed.
- `npm run test:suite-coverage` passed.
- Targeted ESLint passed.
- `git diff --check` passed.
- Package/lockfile guard passed with no `package.json` or `package-lock.json` changes.
- `npm run test:contracts` passed generated/static contract checks, then failed only in runtime on known unrelated `api:http:GET:/discovery/search` with `500 !== 200`.

## Adjacent Routes Untouched

- Did not implement `PATCH /channels/{param}/explicit-media`.
- Did not change attachment false-positive report routes.
- Did not change sender false-positive report routes.
- Did not change channel attachment routes, message edit/update routes, report routes, or attachment refresh behavior.

## Reconciliation Notes

- The implemented source catalog key is exactly `PATCH /messages/explicit-media` with route name `PATCH_MESSAGES_EXPLICIT_MEDIA`.
- The missing-route report no longer contains the assigned global route, while the separately assigned channel-scoped explicit-media route is still present.
- Generated schema, OpenAPI, manifest, and contract artifacts all reference `MessageExplicitMediaScanSchema` for the new global PATCH route.
- `test/generated/suite-coverage.json` and `test/generated/suite-coverage.test.js` were regenerated with `--check` coverage verification and remained unchanged because the new manifest entry is contract-tier, not part of the required suite-coverage groups.

## Risks / Blockers

- Spacebar still lacks local explicit-media scanner persistence and scan-result fields such as attachment/embed scan versions. This implementation intentionally accepts valid scan requests as a no-op after local visibility checks.
- No gateway `MESSAGE_UPDATE` events are emitted because there is no durable scan-state mutation to report.
- Full contract runtime remains blocked by the existing unrelated discovery search `500 !== 200`.

## Recommended Next Tasks

- Implement the separate channel-scoped `PATCH /channels/{channel_id}/explicit-media` route in its own assigned worker.
- If Spacebar later adds explicit-media scan persistence, wire both scan routes to update durable scan metadata and emit `MESSAGE_UPDATE` events from shared scanner logic.
