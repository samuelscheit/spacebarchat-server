# guilds_param_products_attachments_post

## Summary

Implemented only `POST /guilds/{param}/products/attachments` for route name `GUILD_PRODUCT_CREATE_ATTACHMENT_UPLOAD`.

The new route is mounted at `src/api/routes/guilds/#guild_id/products/attachments.ts` and creates local CDN upload reservations for guild product assets. It requires bearer auth and `MANAGE_GUILD`, verifies the guild exists, validates the existing `UploadAttachmentRequestSchema`, rejects duplicate attachment IDs with a 400 response, persists `CloudAttachment` reservation rows owned by the authenticated user, and returns `UploadAttachmentResponseSchema` upload URLs.

No adjacent product, listing, download, or sibling methods were implemented.

## Changed Files

- `src/api/routes/guilds/#guild_id/products/attachments.ts`
- `test/routes/guilds-param-products-attachments-post.test.ts`
- `assets/openapi.json`
- `assets/testing-manifest.json`
- `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`
- `packages/missing-routes/missing.json`
- `test/generated/http-contracts.json`
- `test/generated/suite-coverage.json`
- `worker-progress/guilds_param_products_attachments_post.md`

## Missing Route Movement

- Before regeneration: `missing` was 508, `spacebar` was 672.
- After regeneration: `missing` is 507, `spacebar` is 673.
- Removed assigned missing entry: `POST /guilds/{param}/products/attachments`, `GUILD_PRODUCT_CREATE_ATTACHMENT_UPLOAD`.
- New source catalog entry: `POST /guilds/{guild_id}/products/attachments`, source `src/api/routes/guilds/#guild_id/products/attachments.ts`, request `UploadAttachmentRequestSchema`, responses `APIErrorResponse` and `UploadAttachmentResponseSchema`.
- Sibling entries intentionally still missing:
  - `POST /guilds/{param}/products` (`GUILD_PRODUCTS`)
  - `POST /guilds/{param}/products/listings/{param}/attachments/{param}/download` (`GUILD_PRODUCT_ATTACHMENT_DOWNLOAD`)

## Evidence Sources

- `packages/missing-routes/missing.json`: assigned POST entry existed before regeneration and is removed after regeneration.
- `packages/automatic-reverse-engineering/data/catalogs/routes.xhyrom.catalog.json`: xHyroM lists `OPTIONS` and `POST /guilds/{guild_id}/products/attachments` with route name `GUILD_PRODUCT_CREATE_ATTACHMENT_UPLOAD`.
- `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`: no assigned POST implementation before; new POST implementation after import-source-routes.
- Existing upload reservation pattern: `src/api/routes/channels/#channel_id/attachments.ts`.
- Existing auth/permission route patterns: guild `MANAGE_GUILD` routes such as `src/api/routes/guilds/#guild_id/top-games.ts`, `src/api/routes/guilds/#guild_id/new-member-welcome.ts`, and `src/api/routes/guilds/#guild_id/role-subscriptions/templates.ts`.
- Userdoccers: no matching route found in the local userdoccers catalog for this product attachment upload route; the missing entry is xHyroM-only.
- External confirmation checked: hackermondev Discord endpoint gist lists `GUILD_PRODUCT_CREATE_ATTACHMENT_UPLOAD | /guilds/[arg]/products/attachments`.

## Commands Run

- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run build:src:tsgo`
  - Initial attempt failed before dependency install: `tsgo: command not found`.
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm ci`
  - Passed; installed lockfile dependencies in the assigned worktree.
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run build:src:tsgo`
  - Passed.
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run generate:schema`
  - Passed.
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run generate:openapi`
  - Passed.
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run build --workspace @spacebar/automatic-reverse-engineering`
  - Passed.
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" node packages/automatic-reverse-engineering/dist/cli.js import-source-routes --root src/api/routes --out packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`
  - Passed.
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run build --workspace @spacebar/missing-routes`
  - Passed.
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run start --workspace @spacebar/missing-routes`
  - Passed; wrote `packages/missing-routes/missing.json`.
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run generate:testing-manifest`
  - Passed.
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run generate:contract-tests`
  - Passed.
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run generate:suite-coverage`
  - Passed.
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run build:src:tsgo && PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run build:test-fixtures`
  - Passed.
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" node -r dotenv/config -r module-alias/register --enable-source-maps --test dist-test/test/routes/guilds-param-products-attachments-post.test.js`
  - Passed: 8 tests.
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run test:manifest`
  - Passed.
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run test:suite-coverage`
  - Passed.
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run test:contracts`
  - Failed only on known unrelated runtime contract: `api:http:GET:/discovery/search` returned `500 !== 200`. Generated contract checks before runtime passed.
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run test:contracts:runtime -- --help`
  - Extra accidental runtime invocation; failed on the same known unrelated `api:http:GET:/discovery/search` `500 !== 200`.
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" node scripts/testing-manifest/generate-contract-tests.js --check && PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" node --test test/generated/http-contracts.test.js test/contracts/*.test.cjs`
  - Passed.
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npx eslint 'src/api/routes/guilds/#guild_id/products/attachments.ts' 'test/routes/guilds-param-products-attachments-post.test.ts'`
  - Passed.
- `git diff --check`
  - Passed.
- `git diff -- package.json package-lock.json`
  - Passed with no output; no package or lockfile changes.
- Completion audit reruns:
  - `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npx eslint 'src/api/routes/guilds/#guild_id/products/attachments.ts' 'test/routes/guilds-param-products-attachments-post.test.ts'`
    - Passed.
  - `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" node -r dotenv/config -r module-alias/register --enable-source-maps --test dist-test/test/routes/guilds-param-products-attachments-post.test.js`
    - Passed: 8 tests.
  - `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" node scripts/testing-manifest/generate-contract-tests.js --check && PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" node scripts/testing-manifest/generate-suite-coverage.js --check && git diff --check && git diff -- package.json package-lock.json`
    - Passed; no package or lockfile diff.

## Completion Audit

- Assigned route: current `packages/missing-routes/missing.json` has no `POST /guilds/{param}/products/attachments` entry and still has adjacent product entries.
- Implementation scope: `src/api/routes/guilds/#guild_id/products/attachments.ts` contains only `router.post("/")`; no sibling methods are implemented.
- Auth and permission: route metadata and generated manifest require bearer auth and `MANAGE_GUILD`.
- Schema and response contract: route metadata, OpenAPI, source catalog, manifest, and generated HTTP contracts reference `UploadAttachmentRequestSchema`, `UploadAttachmentResponseSchema`, and `APIErrorResponse`.
- Persistence boundary: route saves local `CloudAttachment` reservation rows and records the durable state limitation in Risks And Blockers.
- Tests: focused route test covers auth boundary, permission denial, guild 404, duplicate ID 400, reservation persistence, generated artifacts, and sibling routes untouched.
- Generated artifacts: OpenAPI, testing manifest, HTTP contracts, source route catalog, missing-route report, and suite coverage all include the new route or expected missing-route removal.
- Guards: focused tests, targeted ESLint, manifest/contract/suite checks, `git diff --check`, and package/lockfile guard passed; full contract runtime failure is the documented unrelated discovery/search issue.

## Risks And Blockers

- `CloudAttachment` has no durable `guild_id` relation. The route scopes product upload reservations in `uploadFilename` under `${guild_id}/products/...` and persists owner/file metadata. Future product listing/download routes should reconcile that path convention or add durable product/guild attachment state if needed.
- Product creation/listing persistence is outside this assignment and remains missing; this route only creates upload reservations.
- No gateway or audit-log event is emitted because this is an upload reservation endpoint and does not mutate guild/product listing state.
- Full `npm run test:contracts` is blocked by the known unrelated `api:http:GET:/discovery/search` runtime `500 !== 200` failure. The generated contract matrix checks pass separately.

## Reconciliation Notes

- Final changed files for handoff are only in `/Users/user/Developer/Developer/spacebarchat/worktrees/current-guilds-param-products-attachments-post-agent`.
- During main-branch reconciliation, sibling `POST /guilds/{param}/products`
  was already accepted in `fc1c35e9d`; current-base artifact assertions should
  treat that sibling as implemented while leaving product listing and download
  routes missing.
- No commits, pushes, merges, rebases, resets, stashes, remotes, tmux, `.codex.log`, or `.exitcode` were used.
- `node_modules/` was installed in the assigned worktree to run the required build and verification commands; it is ignored and not part of the handoff.
