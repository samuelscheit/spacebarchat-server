# Worker Progress: PUT /users/@me/connections/contacts/@me/external-friend-list-entries

## Summary

Implemented the assigned concrete `PUT /users/@me/connections/contacts/@me/external-friend-list-entries` route only. The route is authenticated, uses strict request-body validation, documents the response and error contracts, and fails closed by default because Spacebar does not currently persist device contact lists, generate contact-backed friend suggestions, or mint contact-sync bulk-add tokens.

## Assigned Scope

- Assigned route: `PUT /users/@me/connections/contacts/@me/external-friend-list-entries`
- Assigned route name: `CONNECTION_SYNC_CONTACTS`
- Implemented method: `PUT`
- Sibling methods/routes intentionally untouched:
    - `PUT /users/@me/connections/contacts/{param}`
    - `PUT /users/@me/connections/contacts/{param}/external-friend-list-entries`
    - `GET /users/@me/connections/contacts/{param}/external-friend-list-entries/settings`

## Missing-Route Movement

- Before regeneration on the accepted integration base: `481` missing entries, assigned entry present.
- After regeneration on the accepted integration base: `480` missing entries, assigned entry absent.
- `packages/missing-routes/missing.json` now has no `PUT /users/@me/connections/contacts/@me/external-friend-list-entries` entry.
- The three Userdoccers-backed sibling contact routes remain missing, as expected for this method-scoped assignment.

## Changed Files

- `src/api/routes/users/@me/connections/contacts/@me/external-friend-list-entries.ts`
- `src/api/routes/users/@me/connections/contacts/@me/external-friend-list-entries.test.ts`
- `src/schemas/uncategorised/ConnectionSyncExternalFriendListEntriesPutSchema.ts`
- `src/schemas/responses/ConnectionSyncExternalFriendListEntriesResponse.ts`
- `src/schemas/uncategorised/index.ts`
- `src/schemas/responses/index.ts`
- `tsconfig.test.json`
- `assets/schemas.json`
- `assets/openapi.json`
- `assets/testing-manifest.json`
- `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`
- `packages/missing-routes/missing.json`
- `test/generated/http-contracts.json`
- `test/generated/suite-coverage.json`
- `worker-progress/put_users_me_connections_contacts_me_external_friend_list_entries.md`

## Evidence Gathered

- `packages/missing-routes/missing.json` had one assigned missing entry:
    - `PUT /users/@me/connections/contacts/@me/external-friend-list-entries`
    - `route_name: CONNECTION_SYNC_CONTACTS`
    - `source: xhyrom:data/client/routes.json`
- `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json` had no matching route before implementation.
- `packages/automatic-reverse-engineering/data/catalogs/routes.xhyrom.catalog.json` had `OPTIONS` and `PUT` for `/users/@me/connections/contacts/@me/external-friend-list-entries`, both named `CONNECTION_SYNC_CONTACTS`.
- `packages/automatic-reverse-engineering/data/catalogs/routes.userdoccers.catalog.json` documents adjacent contact-sync routes from `userdoccers:resources/connected-accounts.mdx`.
- Userdoccers raw source checked: `https://raw.githubusercontent.com/discord-userdoccers/discord-userdoccers/master/pages/resources/connected-accounts.mdx`
    - Contact sync connection is documented as nominally using ID `@me`.
    - External friend-list sync accepts `friend_list_entries`, `background`, `allowed_in_suggestions`, `include_mutual_friends_count`, and optional `add_reverse_friend_suggestions`.
    - Response contains `bulk_add_token` and `friend_suggestions`.
    - The endpoint may fire friend-suggestion create gateway events, which Spacebar cannot truthfully produce without contact-sync state and matching support.

## Behavior Notes

- Default behavior returns `501` with `CONTACT_SYNC_EXTERNAL_FRIEND_LIST_ENTRIES_UNSUPPORTED_MESSAGE`.
- The router accepts injectable dependencies for a future real contact-matching backend and returns `200` with `ConnectionSyncExternalFriendListEntriesResponse` when configured.
- Request validation is strict (`coerceRequestBody: false`) and validates E.164-style `friend_id` values plus the documented `allowed_in_suggestions` enum.
- No contact rows, relationships, friend suggestions, gateway events, or bulk-add tokens are fabricated.

## Commands Run

- `sed -n '1,240p' WORKER_BRIEF.md`
- `git status --short --branch`
- `rg -n "external-friend-list-entries|CONNECTION_SYNC_CONTACTS|connections/contacts" packages/missing-routes packages/automatic-reverse-engineering src/api/routes`
- `jq '.missing_entries[] | select(.route == "/users/@me/connections/contacts/@me/external-friend-list-entries")' packages/missing-routes/missing.json`
- `rg -n "external-friend-list-entries|CONNECTION_SYNC_CONTACTS|connections/contacts" packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`
- `jq '.[] | select(.route == "/users/@me/connections/contacts/@me/external-friend-list-entries")' packages/automatic-reverse-engineering/data/catalogs/routes.xhyrom.catalog.json`
- `jq '.[] | select(.route | contains("/users/@me/connections/contacts"))' packages/automatic-reverse-engineering/data/catalogs/routes.userdoccers.catalog.json`
- `npm ci`
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
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" node -r dotenv/config -r module-alias/register --enable-source-maps --test dist-test/src/api/routes/users/@me/connections/contacts/@me/external-friend-list-entries.test.js`
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run test:manifest`
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run test:suite-coverage`
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run test:contracts`
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npx eslint src/api/routes/users/@me/connections/contacts/@me/external-friend-list-entries.ts src/api/routes/users/@me/connections/contacts/@me/external-friend-list-entries.test.ts src/schemas/uncategorised/ConnectionSyncExternalFriendListEntriesPutSchema.ts src/schemas/responses/ConnectionSyncExternalFriendListEntriesResponse.ts src/schemas/uncategorised/index.ts src/schemas/responses/index.ts`
- `git diff --check`
- `git status --short package.json package-lock.json`
- `git diff -- package.json package-lock.json`

## Verification Results

- `npm ci`: passed; no package or lockfile changes.
- `npm run build:src:tsgo`: passed.
- `npm run generate:schema`: passed; new `ConnectionSync*` schemas emitted.
- `npm run generate:openapi`: passed; only pre-existing warnings about webhook route middleware remain.
- `npm run build --workspace @spacebar/automatic-reverse-engineering`: passed.
- `import-source-routes`: passed.
- `npm run build --workspace @spacebar/missing-routes`: passed.
- `npm run start --workspace @spacebar/missing-routes`: passed; missing count is now `480`; implemented count is now `700` of `1128` Discord routes.
- `npm run build:test-fixtures`: passed.
- Focused route test: passed (`6` tests).
- `npm run test:manifest`: passed (`805` entries).
- `npm run test:suite-coverage`: passed.
- Targeted ESLint: passed.
- `git diff --check`: passed.
- Package/lockfile guard: passed; `package.json` and `package-lock.json` unchanged.
- `npm run test:contracts`: generated/static contract checks passed, runtime failed only on the known unrelated `api:http:GET:/discovery/search` response-schema assertion (`500 !== 200`), matching the orchestrator note.

## Completion Audit

- Concrete assigned method implemented: `src/api/routes/users/@me/connections/contacts/@me/external-friend-list-entries.ts` registers only `router.put("/")`.
- Assigned route still source-backed: `routes.source.catalog.json` contains `PUT /users/@me/connections/contacts/@me/external-friend-list-entries` from the new route file with request schema `ConnectionSyncExternalFriendListEntriesPutSchema`.
- Assigned route removed from missing backlog: `packages/missing-routes/missing.json` has no assigned route entry and reports `480` missing entries.
- Scope preserved: contact-sync sibling routes remain present in `missing.json` and were not implemented.
- Auth preserved: focused test asserts the route is not in no-auth routes and unauthenticated PUT returns `401`.
- Validation preserved: route uses `coerceRequestBody: false`; focused test rejects non-E.164 `friend_id` with invalid form body before dependency execution.
- Locally truthful behavior preserved: default dependency throws `501`; focused test verifies no fabricated contact matches are returned.
- Future success path documented: dependency injection test verifies a configured backend can return the documented `{ bulk_add_token, friend_suggestions }` response.
- Schemas generated: `assets/schemas.json` includes `ConnectionSyncExternalFriendListEntriesPutSchema`, `ConnectionSyncExternalFriendListEntry`, `ConnectionSyncSuggestionsSetting`, and `ConnectionSyncExternalFriendListEntriesResponse`.
- OpenAPI generated: `assets/openapi.json` includes bearer-auth PUT operation with `200`, `400`, `401`, and `501` response schemas.
- Manifest and contracts generated: `assets/testing-manifest.json` and `test/generated/http-contracts.json` include `api:http:PUT:/users/@me/connections/contacts/@me/external-friend-list-entries/`.
- Suite coverage generated: `test/generated/suite-coverage.json` assigns the new manifest ID through the users suite.
- Quality gates complete: build, test fixtures, focused tests, manifest check, suite check, targeted ESLint, `git diff --check`, and package/lockfile guard passed in this worktree.
- Residual test failure triaged: `npm run test:contracts` fails only on the known unrelated `api:http:GET:/discovery/search` runtime `500 !== 200` assertion.

## Risks / Blockers

- Real contact sync remains unsupported until Spacebar has durable contact-list storage, phone/contact matching privacy rules, friend-suggestion persistence, gateway `FRIEND_SUGGESTION_CREATE` emission, and bulk-add token semantics.
- The default implementation intentionally returns `501`; this is safer than accepting uploaded contacts and returning fabricated suggestions or tokens.

## Recommended Next Tasks

- Implement the sibling Userdoccers-backed contact sync connection creation route in a separate scoped task.
- Design durable contact-sync storage and matching semantics before enabling success behavior for external friend-list entry uploads.
