# GET /users/@me/saved-messages

## Summary

- Integrated `GET /users/@me/saved-messages` on current main base
  `2abe93af9`.
- The route is bearer-authenticated and returns the documented local envelope
  `{ "results": [] }`.
- Spacebar has no saved-message persistence yet, so no saved messages are
  fabricated.
- Adjacent `PUT` and `DELETE /users/@me/saved-messages/{channel_id}/{message_id}`
  remain missing and untouched.

## Changed Files

- `src/api/routes/users/@me/saved-messages.ts`
- `src/api/routes/users/@me/saved-messages.test.ts`
- `src/schemas/responses/SavedMessagesResponse.ts`
- `src/schemas/responses/index.ts`
- `tsconfig.test.json`
- `assets/schemas.json`
- `assets/openapi.json`
- `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`
- `packages/missing-routes/missing.json`
- `assets/testing-manifest.json`
- `test/generated/http-contracts.json`
- `test/generated/suite-coverage.json`

## Missing-Route Movement

- Before current-base regeneration: `550` missing / `630` implemented /
  `1128` Discord.
- After current-base regeneration: `549` missing / `631` implemented /
  `1128` Discord.
- Removed `GET /users/@me/saved-messages` /
  `GET_USERS__ME_SAVED_MESSAGES` from `missing_entries`.
- Verified adjacent `PUT` and `DELETE` saved-message mutation entries remain
  missing.

## Evidence Sources

- Worker handoff:
  `/Users/user/Developer/Developer/spacebarchat/worktrees/current-users-me-saved-messages-get-agent/worker-progress/users-me-saved-messages-get.md`.
- Userdoccers user docs document the saved-message response envelope and saved
  message fields.
- Local source inspection found no saved-message persistence model, matching
  the conservative empty response.
- Nearby route pattern:
  `src/api/routes/users/@me/scheduled-messages.ts`.

## Verification

- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run build:src:tsgo`
  passed.
- `npm run generate:schema` passed.
- `npm run generate:openapi` passed; OpenAPI now has `520` paths and `1176`
  schemas.
- `npm run build --workspace @spacebar/automatic-reverse-engineering` passed.
- `node packages/automatic-reverse-engineering/dist/cli.js import-source-routes --root src/api/routes --out packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`
  passed.
- `npm run build --workspace @spacebar/missing-routes` passed.
- `npm run start --workspace @spacebar/missing-routes` passed.
- `npm run generate:testing-manifest` passed; manifest now has `736` entries.
- `npm run generate:contract-tests` passed; generated contracts now have `711`
  contracts.
- `npm run generate:suite-coverage` passed.
- `npm run build:test-fixtures` passed.
- Focused built route test passed:
  `node -r dotenv/config -r module-alias/register --enable-source-maps --test dist-test/src/api/routes/users/@me/saved-messages.test.js`.
- `npm run test:manifest` passed.
- `node scripts/testing-manifest/generate-contract-tests.js --check` passed.
- `npm run test:suite-coverage` passed.
- `git diff --check` passed.
- Targeted ESLint passed:
  `npx eslint src/api/routes/users/@me/saved-messages.ts src/api/routes/users/@me/saved-messages.test.ts src/schemas/responses/SavedMessagesResponse.ts`.
- Targeted Prettier check passed after formatting the new files:
  `npx prettier --check src/api/routes/users/@me/saved-messages.ts src/api/routes/users/@me/saved-messages.test.ts src/schemas/responses/SavedMessagesResponse.ts worker-progress/users-me-saved-messages-get.md`.
- Package/lockfile guard passed:
  `git diff --exit-code -- package.json package-lock.json packages/automatic-reverse-engineering/package.json packages/missing-routes/package.json`.
- Typo/conflict scan passed:
  `! rg -n "MERCHANTIBILITY|MERMER|<<<<<<<|>>>>>>>" src/api/routes/users/@me/saved-messages.ts src/api/routes/users/@me/saved-messages.test.ts src/schemas/responses/SavedMessagesResponse.ts`.
- `npm run test:contracts` passed generated contract checks and failed only on
  the known unrelated runtime baseline after formatting:
  `api:http:GET:/discovery/search` returned `500 !== 200`.

## Risks

- Saved-message persistence is not present locally. Real saved-message history
  requires a future storage model and the adjacent mutation routes.
- No saved-message create/delete gateway events are emitted because mutation
  routes are out of scope.
