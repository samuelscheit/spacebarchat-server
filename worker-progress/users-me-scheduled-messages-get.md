# GET /users/@me/scheduled-messages

## Summary

Implemented `GET /users/@me/scheduled-messages` only. The route is
authenticated, advertises `ScheduledMessagesResponse`, and returns Spacebar's
locally truthful empty scheduled-message list because no durable user
scheduled-message state exists in the local source.

## Changed Files

- `src/api/routes/users/@me/scheduled-messages.ts`
- `src/api/routes/users/@me/scheduled-messages.test.ts`
- `src/schemas/responses/ScheduledMessagesResponse.ts`
- `src/schemas/responses/index.ts`
- `tsconfig.test.json`
- `assets/schemas.json`
- `assets/openapi.json`
- `assets/testing-manifest.json`
- `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`
- `packages/missing-routes/missing.json`
- `test/generated/http-contracts.json`
- `test/generated/suite-coverage.json`

## Evidence Gathered

- `packages/missing-routes/missing.json` initially listed `GET /users/@me/scheduled-messages` and `POST /users/@me/scheduled-messages`; assignment scope was the `GET` route only, so POST was intentionally left missing.
- `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json` initially had no source implementation for `/users/@me/scheduled-messages`.
- `packages/automatic-reverse-engineering/data/catalogs/routes.xhyrom.catalog.json` lists `GET`, `HEAD`, `OPTIONS`, and `POST` for `/users/@me/scheduled-messages` with route name `SCHEDULED_MESSAGES`, plus param `DELETE`, `OPTIONS`, and `PATCH` entries for `/users/@me/scheduled-messages/{param}`.
- Local source search found no `ScheduledMessage` entity, durable queue, persistence table, message scheduling service, response schema, or captured response body shape for user scheduled messages.
- Local xHyroM experiment catalog has `2024-11_scheduled_messages`, but no response contract.
- Existing accepted precedent: `src/api/routes/users/@me/scheduled-events.ts` returns an authenticated empty representation for unsupported private current-user scheduled state.
- Existing schema precedent: `unknown[]` response aliases such as `ContentInventoryOutboxResponse` and `GuildJoinRequestsResponse` are used when only an empty supported representation is locally defensible.

## Behavior

- Adds `GET /users/@me/scheduled-messages/` with responses `200 ScheduledMessagesResponse` and `401 APIErrorResponse`.
- Adds `ScheduledMessagesResponse = unknown[]`, generated into `assets/schemas.json` as an array with unconstrained items.
- Returns `[]` for authenticated users until Spacebar has durable scheduled-message storage and a defensible response object shape.
- Focused tests assert the route stays out of `NO_AUTHORIZATION_ROUTES` for both raw and `/api/v9` paths.
- Does not fabricate message content, channel IDs, guild IDs, send times, recurrence, recipients, notification state, or message objects.
- Does not implement create, update, delete, send, channel message routes, notification-center routes, billing routes, or unrelated current-user routes.

## Current-Base Movement

- Assigned integration base: `2e23cbb08 Implement guild members supplemental route`.
- Before regeneration: `Spacebar is missing 569`; assigned `GET /users/@me/scheduled-messages` present.
- After regeneration: `Spacebar is missing 568`; `GET /users/@me/scheduled-messages` removed.
- Implemented routes: `611 -> 612`.
- Discord routes: `1128` unchanged.
- Adjacent scheduled-message routes intentionally still missing: `POST /users/@me/scheduled-messages`, `PATCH /users/@me/scheduled-messages/{param}`, and `DELETE /users/@me/scheduled-messages/{param}`.

## Commands Run

Using `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH"` unless noted:

- `npm run build:src:tsgo` initially failed before dependency install with `tsgo: command not found`.
- `npm ci`
- `npm run build:src:tsgo` passed, then was rerun after the license-header and focused auth-boundary test updates and passed again.
- `npm run generate:schema`
- `npm run generate:openapi`
- `npm run build --workspace @spacebar/automatic-reverse-engineering`
- `node packages/automatic-reverse-engineering/dist/cli.js import-source-routes --root src/api/routes --out packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`
- `npm run build --workspace @spacebar/missing-routes`
- `npm run start --workspace @spacebar/missing-routes`
- `npm run generate:testing-manifest`
- `npm run generate:contract-tests`
- `npm run generate:suite-coverage`
- `npm run build:test-fixtures`, then rerun after the license-header and focused auth-boundary test updates and passed again.
- `node -r dotenv/config -r module-alias/register --enable-source-maps --test dist-test/src/api/routes/users/@me/scheduled-messages.test.js` passed 4/4.
- `node scripts/testing-manifest/verify.js`
- `node scripts/testing-manifest/generate-contract-tests.js --check`
- `node scripts/testing-manifest/generate-suite-coverage.js --check`
- `node --test test/generated/http-contracts.test.js test/generated/suite-coverage.test.js` passed 13/13.
- `git diff --check`
- `git diff --exit-code -- package.json package-lock.json bun.lock`
- License-header malformed-pattern check against the new source files passed.

## Risks Or Blockers

- This is a compatibility route with empty local state. Returning real scheduled messages requires future durable scheduled-message storage and a verified response shape.
- `ScheduledMessagesResponse` is intentionally `unknown[]` to avoid claiming scheduled messages are ordinary public messages without source evidence.
- Full `npm run test:contracts` runtime coverage was not run; generated contract checks and focused route tests passed.
- No package or lockfile drift from `npm ci`.

## Reconciliation

No known reconciliation blocker on the assigned base. If main advanced after
`2e23cbb08`, this branch should be merged through the orchestrator's normal
current-main reconciliation pass.

## Current-Main Integration Verification

The orchestrator reconciled the scoped source, test, schema, `tsconfig`, and
report changes onto current main `05871bf37`, regenerated all route artifacts on
that base, and did not copy old generated artifacts from the worker worktree.

- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run build:src:tsgo` passed.
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run generate:schema` passed and wrote 1152 schemas.
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run generate:openapi` passed and wrote 504 paths / 1152 schemas; pre-existing webhook route-metadata warnings remain.
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run build --workspace @spacebar/automatic-reverse-engineering` passed.
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" node packages/automatic-reverse-engineering/dist/cli.js import-source-routes --root src/api/routes --out packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json` passed.
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run build --workspace @spacebar/missing-routes` passed.
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run start --workspace @spacebar/missing-routes` passed: `Spacebar is missing 566`, `Spacebar implements 614`, `Discord implements 1128`.
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run generate:testing-manifest` passed: 719 entries.
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" node scripts/testing-manifest/verify.js` passed.
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run generate:contract-tests` passed: 694 contracts.
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" node scripts/testing-manifest/generate-contract-tests.js --check` passed.
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run generate:suite-coverage` passed: 15 suites.
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" node scripts/testing-manifest/generate-suite-coverage.js --check` passed.
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run build:test-fixtures` passed.
- Focused source test passed 4/4: `npm run test -- src/api/routes/users/@me/scheduled-messages.test.ts`.
- Focused built test passed 4/4: `node -r dotenv/config -r module-alias/register --enable-source-maps --test dist-test/src/api/routes/users/@me/scheduled-messages.test.js`.
- Generated contract and suite tests passed 13/13: `node --test test/generated/http-contracts.test.js test/generated/suite-coverage.test.js`.
- Targeted ESLint passed for the changed route, test, and schema files.
- Targeted Prettier check passed for the changed route, test, schema, export, `tsconfig`, and report files.
- `git diff --check` passed.
- `git diff -- package.json package-lock.json npm-shrinkwrap.json pnpm-lock.yaml yarn.lock bun.lock --exit-code` passed.
- Changed-file malformed warranty-token scan passed.
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run test:contracts` failed only on the known unrelated runtime contract `api:http:GET:/discovery/search` returning `500 !== 200`; the generated static contract checks and other runtime contracts passed or were skipped as before.
