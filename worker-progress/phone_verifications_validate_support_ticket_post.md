# phone_verifications_validate_support_ticket_post

## Summary

Implemented only `POST /phone-verifications/validate-support-ticket` for route name `VERIFY_PHONE_FOR_TICKET`.

The route is authenticated, validates Discord client's `{ token }` body, and fails closed with `501` by default because this Spacebar instance has no durable phone-verification token store or support-ticket validation backend. Instances can inject a real `validatePhoneSupportTicket` dependency to return `204`.

## Changed Files

- `src/api/routes/phone-verifications/validate-support-ticket.ts`
- `src/api/routes/phone-verifications/validate-support-ticket.test.ts`
- `src/schemas/uncategorised/PhoneVerificationSupportTicketValidateSchema.ts`
- `src/schemas/uncategorised/index.ts`
- `tsconfig.test.json`
- `assets/schemas.json`
- `assets/openapi.json`
- `assets/testing-manifest.json`
- `test/generated/http-contracts.json`
- `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`
- `packages/missing-routes/missing.json`

## Evidence Sources

- `packages/missing-routes/missing.json`: assigned `POST /phone-verifications/validate-support-ticket` existed with route name `VERIFY_PHONE_FOR_TICKET`.
- `packages/automatic-reverse-engineering/data/catalogs/routes.xhyrom.catalog.json`: xHyroM catalog includes `OPTIONS` and `POST` for `/phone-verifications/validate-support-ticket`.
- `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`: assigned route was absent before implementation and present after regeneration.
- Discord web client asset `https://discord.com/assets/web.2e7b7bf726e7ba59.js`: current client defines `VERIFY_PHONE_FOR_TICKET` as `/phone-verifications/validate-support-ticket` and calls it with body `{ token }`.
- Userdoccers `https://raw.githubusercontent.com/discord-userdoccers/discord-userdoccers/master/pages/topics/phone-verification.mdx`: sibling phone verification flow documents the local absence of durable phone verification token support needed by this route.

## Missing-Route Movement

- Before: `missing = 513`, `spacebar = 667`.
- After regeneration: `missing = 512`, `spacebar = 668`.
- Removed missing entry: `POST /phone-verifications/validate-support-ticket` / `VERIFY_PHONE_FOR_TICKET`.
- Sibling routes intentionally untouched and still missing: `POST /phone-verifications/resend`, `POST /phone-verifications/verify`.

## Commands Run

- `npm ci` - passed; installed dependencies from `package-lock.json`.
- `npm run build:src:tsgo` - initially failed before install because `tsgo` was missing; passed after `npm ci`.
- `npm run generate:schema` - passed.
- `npm run generate:openapi` - passed; existing warnings about routes without `route()` metadata remained.
- `npm run build --workspace @spacebar/automatic-reverse-engineering` - passed.
- `node packages/automatic-reverse-engineering/dist/cli.js import-source-routes --root src/api/routes --out packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json` - passed.
- `npm run build --workspace @spacebar/missing-routes` - passed.
- `npm run start --workspace @spacebar/missing-routes` - passed; wrote `missing = 512`.
- `npm run generate:testing-manifest` - passed.
- `npm run generate:contract-tests` - passed.
- `npm run generate:suite-coverage` - passed.
- `TS_NODE_TRANSPILE_ONLY=1 node -r dotenv/config -r ts-node/register/transpile-only -r module-alias/register --enable-source-maps --test src/api/routes/phone-verifications/validate-support-ticket.test.ts` - passed.
- `npm run test:manifest` - passed.
- `npm run test:contracts` - failed only at known unrelated `api:http:GET:/discovery/search` runtime `500 !== 200`; pre-runtime generated contract checks passed.
- `npm run build:test-fixtures` - passed after adding the focused test to `tsconfig.test.json`.
- `node -r dotenv/config -r module-alias/register --enable-source-maps --test dist-test/src/api/routes/phone-verifications/validate-support-ticket.test.js` - passed.
- `npx eslint src/api/routes/phone-verifications/validate-support-ticket.ts src/api/routes/phone-verifications/validate-support-ticket.test.ts src/schemas/uncategorised/PhoneVerificationSupportTicketValidateSchema.ts src/schemas/uncategorised/index.ts` - passed.
- `npm run test:suite-coverage` - passed.
- `git diff --check` - passed.
- `git diff -- package.json package-lock.json --exit-code` - passed; no package or lockfile changes.

## Risks And Blockers

- Default behavior is intentionally `501` because no local durable phone-verification token store or support-ticket backend exists. Accepting opaque support-ticket tokens without that backing state would fabricate success.
- The route exposes an injectable dependency for a deployment with a real provider/backend.
- `npm run test:contracts` still has the known unrelated discovery-search runtime failure: `api:http:GET:/discovery/search` returned `500 !== 200`.

## Reconciliation Notes

- Implemented only the assigned POST method.
- Did not implement `OPTIONS`, `resend`, `verify`, `/users/@me/phone/verify`, or any adjacent phone-verification route.
- Auth boundary is bearer-authenticated; no `NoAuthorizationRoutes` entry was added.
