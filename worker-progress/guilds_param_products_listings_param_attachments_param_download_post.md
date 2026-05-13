# POST /guilds/{param}/products/listings/{param}/attachments/{param}/download

## Status

Implemented and verified, with one unrelated existing contract runtime failure documented below.

## Scope

- Assigned method: `POST`
- Assigned route: `/guilds/{param}/products/listings/{param}/attachments/{param}/download`
- Assigned upstream route name: `GUILD_PRODUCT_ATTACHMENT_DOWNLOAD`
- Sibling methods/routes intentionally untouched.

## Evidence So Far

- Worker brief read from `/Users/user/Developer/Developer/spacebarchat/WORKER_BRIEF.md`; all repo reads/edits/verification after that used this assigned worktree.
- `packages/missing-routes/missing.json` initially contained one owned missing entry for the assigned route and method; regenerated output removes it.
- `packages/automatic-reverse-engineering/data/catalogs/routes.xhyrom.catalog.json` contains `POST /guilds/{guild_id}/products/listings/{param}/attachments/{attachment_id}/download` as `GUILD_PRODUCT_ATTACHMENT_DOWNLOAD`.
- `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json` had no matching source route before implementation.
- Userdoccers `pages/resources/store.mdx` documents store/SKU/listing concepts but does not document this guild product attachment download endpoint.

## Implementation Notes

- Added a bearer-authenticated POST route only.
- Default provider fails closed because Spacebar does not currently persist Discord guild product attachment entitlement data or signed download URL state.
- Provider-backed behavior validates guild/listing/attachment snowflakes, verifies returned provider data matches the requested tuple, and returns only a signed URL.
- Response schema is `GuildProductAttachmentDownloadResponse` with only `{ url: string }`.
- Provider-backed access denial can surface `MISSING_ACCESS` as a 403 without leaking a URL.

## Changed Files

- `src/api/routes/guilds/#guild_id/products/listings/#listing_id/attachments/#attachment_id/download.ts`
- `src/schemas/responses/GuildProductAttachmentDownloadResponse.ts`
- `src/schemas/responses/index.ts`
- `test/routes/guilds-param-products-listings-param-attachments-param-download-post.test.ts`
- `assets/schemas.json`
- `assets/openapi.json`
- `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`
- `packages/missing-routes/missing.json`
- `assets/testing-manifest.json`
- `test/generated/http-contracts.json`
- `test/generated/suite-coverage.json`
- `worker-progress/guilds_param_products_listings_param_attachments_param_download_post.md`

## Generated Artifact Movement

- Missing routes: `507 -> 506`
- Spacebar implemented routes: `673 -> 674`
- Testing manifest entries: `778 -> 779`
- HTTP contracts: `753 -> 754`

## Main-Branch Reconciliation

- Replayed the source/schema/test/progress changes onto `1afa51d72`.
- Regenerated current-base artifacts after the guild product, attachment upload,
  and MFA route merges.
- Current-base movement: missing routes `504 -> 503`, Spacebar implemented
  routes `676 -> 677`, Discord routes `1128`.
- Current-base generated artifacts: testing manifest `782` entries, HTTP
  contracts `757`.
- Fixed license-header indentation in the three new source/test files before
  verification.

## Completion Audit

- Objective: implement only `POST /guilds/{param}/products/listings/{param}/attachments/{param}/download` for upstream route name `GUILD_PRODUCT_ATTACHMENT_DOWNLOAD`, regenerate route/schema/testing artifacts, run focused verification, and document blockers.
- Assigned worktree/branch verified: `/Users/user/Developer/Developer/spacebarchat/worktrees/current-guilds-param-products-listings-param-attachments-param-download-post-agent`, branch `codex/current-missing-route-guilds-param-products-listings-param-attachments-param-download-post-agent-20260513d`, base commit `e30bc9bef` with uncommitted worker changes only.
- Missing-route ownership verified: xHyroM catalog has `POST` and `OPTIONS` records for route name `GUILD_PRODUCT_ATTACHMENT_DOWNLOAD`; assignment is method-scoped to `POST`, so `OPTIONS` was intentionally not implemented.
- Source implementation verified: only `src/api/routes/guilds/#guild_id/products/listings/#listing_id/attachments/#attachment_id/download.ts` exists under the new `guilds/#guild_id/products` subtree, and it registers only `router.post("/")`.
- Route metadata verified: generated source catalog has one `POST /guilds/{guild_id}/products/listings/{listing_id}/attachments/{attachment_id}/download` entry pointing at the new route file with `APIErrorResponse` and `GuildProductAttachmentDownloadResponse`.
- Missing report verified: regenerated `packages/missing-routes/missing.json` no longer contains the assigned `POST` missing entry or assigned route path.
- Auth verified: testing manifest and generated contract both mark the route `authMode: bearer`; focused test verifies missing authorization returns 401 and the route is not a no-authorization route.
- Response/schema verified: `GuildProductAttachmentDownloadResponse` is generated into `assets/schemas.json` and `assets/openapi.json` as an object requiring `url`.
- Fail-closed behavior verified: default provider returns `undefined`; focused tests cover malformed snowflakes, unbacked attachment state, mismatched provider data, invalid URL schemes, and provider-thrown 403 missing access.
- Sibling routes verified untouched: no `get`, `put`, `patch`, `delete`, `options`, or `head` handler exists in the route source for this path.
- Generated testing coverage verified: manifest has 779 entries, HTTP contract generation verifies 754 contracts, and suite coverage includes the assigned manifest id.
- License headers verified: new files use `MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the` and do not contain malformed `MERMER` or `MERCHANTIBILITY` variants.
- Package/lock guard verified: `git diff -- package.json package-lock.json` is empty.
- Final cleanliness verified: `git diff --check` passes.

## Commands Run

- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm ci` - passed, package and lockfile unchanged.
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run build:src:tsgo` - passed.
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run generate:schema` - passed.
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run generate:openapi` - passed with pre-existing warnings for three webhook routes without route middleware.
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run build --workspace @spacebar/automatic-reverse-engineering` - passed.
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" node packages/automatic-reverse-engineering/dist/cli.js import-source-routes --root src/api/routes --out packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json` - passed.
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run build --workspace @spacebar/missing-routes` - passed.
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run start --workspace @spacebar/missing-routes` - passed, reported `Spacebar is missing 506`.
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run generate:testing-manifest` - passed, wrote 779 entries.
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run generate:contract-tests` - passed, wrote 754 contracts.
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run generate:suite-coverage` - passed, wrote 15 suites.
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run build:test-fixtures` - passed.
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" node -r dotenv/config -r module-alias/register --enable-source-maps --test dist-test/test/routes/guilds-param-products-listings-param-attachments-param-download-post.test.js` - passed, 6 tests.
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run test:manifest` - passed, 30 tests and manifest verification.
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run test:contracts` - static contract checks passed; runtime phase failed on unrelated existing `api:http:GET:/discovery/search` public response schema contract (`500 !== 200`).
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" node scripts/testing-manifest/generate-contract-tests.js --check` - passed, 754 contracts.
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run test:suite-coverage` - passed, 4 tests.
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npx eslint 'src/api/routes/guilds/#guild_id/products/listings/#listing_id/attachments/#attachment_id/download.ts' src/schemas/responses/GuildProductAttachmentDownloadResponse.ts src/schemas/responses/index.ts test/routes/guilds-param-products-listings-param-attachments-param-download-post.test.ts` - passed.
- `git diff --check` - passed.
- `git diff -- package.json package-lock.json` - empty.

## References

- xHyroM: `packages/automatic-reverse-engineering/data/catalogs/routes.xhyrom.catalog.json`, route name `GUILD_PRODUCT_ATTACHMENT_DOWNLOAD`.
- Source catalog: `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`.
- Userdoccers: `https://github.com/discord-userdoccers/discord-userdoccers/blob/master/pages/resources/store.mdx` was checked for store/SKU/listing context; no exact guild product attachment download endpoint contract was present.

## Risks / Blockers

- Exact Discord response shape is not available in Userdoccers; implementation uses the conservative signed-url response shape inferred from the route purpose and common download URL patterns.
- `npm run test:contracts` is blocked by unrelated `GET /discovery/search` returning 500 in the generated public response-schema runtime contract. The assigned route is bearer-only and the focused route test plus generated manifest/static contract checks pass.

## Recommended Next Tasks

- Investigate the unrelated `GET /discovery/search` runtime `500 !== 200` contract failure outside this method-scoped route assignment.
- If Spacebar later gains durable guild product attachment entitlement/storage state, wire a real `GuildProductAttachmentDownloadProvider` behind this route.
