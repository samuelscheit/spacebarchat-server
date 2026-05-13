# POST /partner-sdk/application/{param}/skus

Worker: `post_partner_sdk_application_param_skus`
Branch: `codex/current-missing-route-post-partner-sdk-application-param-skus-agent-20260513p`
Worktree: `/Users/user/Developer/Developer/spacebarchat/worktrees/current-post-partner-sdk-application-param-skus-agent`

## Summary

Implemented only the assigned `POST /partner-sdk/application/{param}/skus` method in the existing partner SDK application SKU route module. The route is bearer-authenticated, validates the request body with `PartnerSdkApplicationSkuCreateSchema`, checks application store access through the existing application authorization helper, and supports an injected Social Layer SKU create provider.

Spacebar does not currently persist a durable Social Layer SKU catalog, so the default route fails closed with a typed `501` after application access checks instead of fabricating store/SKU state.

## Changed Files

- `src/api/routes/partner-sdk/application/#application_id/skus.ts`
    - Added `router.post("/")` for `Create Social Layer SKU`.
    - Added `createPartnerSdkApplicationSku`, provider types, and a typed unsupported error.
    - Preserved existing GET behavior and route filtering.
- `src/schemas/uncategorised/PartnerSdkApplicationSkuCreateSchema.ts`
    - Added request schema for `name` and `price_tier`.
- `src/schemas/uncategorised/index.ts`
    - Exported the new request schema.
- `test/routes/partner-sdk-application-param-skus-post.test.ts`
    - Added focused route, provider, auth, fail-closed, generated artifact, and missing-route tests.
- Generated artifacts:
    - `assets/schemas.json`
    - `assets/openapi.json`
    - `assets/testing-manifest.json`
    - `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`
    - `packages/missing-routes/missing.json`
    - `test/generated/http-contracts.json`

## Evidence Gathered

- `packages/missing-routes/missing.json` initially contained the assigned entry:
    - `POST /partner-sdk/application/{param}/skus`
    - route name `POST_PARTNER_SDK_APPLICATION_APPLICATION_ID_SKUS`
    - source `userdoccers:resources/store.mdx`
    - summary `Create Social Layer SKU`
- `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json` initially had only:
    - `GET /partner-sdk/application/{application_id}/skus`
    - source `src/api/routes/partner-sdk/application/#application_id/skus.ts`
- `src/api/routes/partner-sdk/application/#application_id/skus.ts` initially implemented only `router.get("/")`.
- `packages/automatic-reverse-engineering/data/catalogs/routes.userdoccers.catalog.json` lists both GET and the assigned POST for `/partner-sdk/application/{application_id}/skus`.
- `packages/automatic-reverse-engineering/data/catalogs/routes.xhyrom.catalog.json` has no matching route for this path.
- Userdoccers source: `https://raw.githubusercontent.com/discord-userdoccers/discord-userdoccers/master/pages/resources/store.mdx`
    - Documents `Create Social Layer SKU`, response as created SKU object, owner/team-member access, and JSON params `name` and `price_tier`.

## Missing-Route Movement

- Base: `missing = 489`, `spacebar = 691`, `discord = 1128`.
- After regeneration: `missing = 488`, `spacebar = 692`, `discord = 1128`.
- Current-base acceptance: `missing = 487 -> 486`, `spacebar = 693 -> 694`,
  `discord = 1128` after regenerating on top of `42a2c1b37`.
- Removed only:
    - `POST /partner-sdk/application/{param}/skus`
    - route name `POST_PARTNER_SDK_APPLICATION_APPLICATION_ID_SKUS`
- Current source catalog now includes:

```json
{
    "method": "POST",
    "request_schema_ref": "PartnerSdkApplicationSkuCreateSchema",
    "response_schema_refs": ["APIErrorResponse", "StoreSkuResponse"],
    "route": "/partner-sdk/application/{application_id}/skus",
    "route_name": "POST_PARTNER_SDK_APPLICATION_APPLICATION_ID_SKUS",
    "source": "src/api/routes/partner-sdk/application/#application_id/skus.ts"
}
```

## Commands Run

- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run build:src:tsgo`
    - Initially failed because `tsgo` was not installed in this worktree.
    - Passed after `npm ci`.
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm ci`
    - Passed; installed dependencies in the assigned worktree. Package/lockfile guard remained clean.
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run generate:schema`
    - Passed; wrote `1219` schemas.
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run generate:openapi`
    - Passed; wrote `560` paths and `1219` schemas. Existing webhook route middleware warnings were unchanged.
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run build --workspace @spacebar/automatic-reverse-engineering`
    - Passed.
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" node packages/automatic-reverse-engineering/dist/cli.js import-source-routes --root src/api/routes --out packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`
    - Passed.
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run build --workspace @spacebar/missing-routes`
    - Passed.
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run start --workspace @spacebar/missing-routes`
    - Passed; wrote `missing = 488`.
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run generate:testing-manifest`
    - Passed; wrote `797` entries.
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run generate:contract-tests`
    - Passed; wrote `772` contracts.
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run generate:suite-coverage`
    - Passed; wrote `15` suites.
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run test -- test/routes/partner-sdk-application-param-skus-post.test.ts`
    - Initially exposed a generated source catalog assertion that omitted `request_schema_ref`; test corrected to match generated catalog shape.
    - Final run passed: `4/4`.
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run build:test-fixtures`
    - Initially exposed a test-only TypeScript type issue for captured provider options; fixed.
    - Final run passed.
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" node -r dotenv/config -r module-alias/register --enable-source-maps --test dist-test/test/routes/partner-sdk-application-param-skus-post.test.js`
    - Passed: `4/4`.
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run test:manifest`
    - Passed: `30/30`; manifest verified with `797` entries.
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" node scripts/testing-manifest/generate-contract-tests.js --check`
    - Passed; verified `772` contracts.
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" node --test test/generated/http-contracts.test.js test/contracts/*.test.cjs`
    - Passed: `10/10`.
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run test:suite-coverage`
    - Passed: `4/4`.
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run test:contracts`
    - Static generated contract checks passed.
    - Runtime phase failed only on known unrelated `api:http:GET:/discovery/search` public response-schema check: `500 !== 200`.
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npx eslint 'src/api/routes/partner-sdk/application/#application_id/skus.ts' src/schemas/uncategorised/PartnerSdkApplicationSkuCreateSchema.ts src/schemas/uncategorised/index.ts test/routes/partner-sdk-application-param-skus-post.test.ts`
    - Passed.
- `git diff --check`
    - Passed.
- `git diff -- package.json package-lock.json`
    - No output; package files unchanged.
- Malformed warranty-token scan for touched source/test files
    - No malformed warranty tokens found.

Current-base acceptance verification:

- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run build:src:tsgo`
    - Passed.
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run generate:schema`
    - Passed; wrote `1219` schemas.
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run generate:openapi`
    - Passed; wrote `561` paths and `1219` schemas.
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run build --workspace @spacebar/automatic-reverse-engineering`
    - Passed.
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" node packages/automatic-reverse-engineering/dist/cli.js import-source-routes --root src/api/routes --out packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`
    - Passed.
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run build --workspace @spacebar/missing-routes`
    - Passed.
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run start --workspace @spacebar/missing-routes`
    - Passed; wrote `missing = 486`, `spacebar = 694`, `discord = 1128`.
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run generate:testing-manifest`
    - Passed; wrote `799` entries.
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run generate:contract-tests`
    - Passed; wrote `774` contracts.
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run generate:suite-coverage`
    - Passed; wrote `15` suites.
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run build:test-fixtures`
    - Passed.
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" node -r dotenv/config -r module-alias/register --enable-source-maps --test dist-test/test/routes/partner-sdk-application-param-skus-post.test.js`
    - Passed: `4/4`.
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run test:manifest`
    - Passed; manifest verified with `799` entries.
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" node scripts/testing-manifest/generate-contract-tests.js --check`
    - Passed; verified `774` contracts.
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run test:suite-coverage`
    - Passed.
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" node scripts/testing-manifest/generate-suite-coverage.js --check`
    - Passed.
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npx eslint 'src/api/routes/partner-sdk/application/#application_id/skus.ts' src/schemas/uncategorised/PartnerSdkApplicationSkuCreateSchema.ts src/schemas/uncategorised/index.ts test/routes/partner-sdk-application-param-skus-post.test.ts`
    - Passed.
- `git diff --check`
    - Passed.
- `git diff --exit-code -- package.json package-lock.json npm-shrinkwrap.json 'packages/*/package.json' 'packages/*/package-lock.json'`
    - Passed.
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npx prettier --check 'src/api/routes/partner-sdk/application/#application_id/skus.ts' src/schemas/uncategorised/PartnerSdkApplicationSkuCreateSchema.ts src/schemas/uncategorised/index.ts test/routes/partner-sdk-application-param-skus-post.test.ts worker-progress/post_partner_sdk_application_param_skus.md`
    - Passed after formatting the copied TypeScript files and this report.
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run test:contracts`
    - Generated/static checks passed; runtime failed only on known unrelated
      `api:http:GET:/discovery/search` public response-schema check with
      `500 !== 200`.

## Risks And Blockers

- Spacebar has no durable Social Layer SKU persistence/provider in this worktree. Default create behavior is intentionally `501` after access checks.
- Provider-backed success requires an injected `createSkuProvider` that returns a SKU for the requested application with `product_line = 14`.
- Full `npm run test:contracts` remains blocked by the known unrelated `/discovery/search` runtime `500 !== 200` failure.

## Sibling Routes Intentionally Untouched

- `GET /partner-sdk/application/{param}/skus` was pre-existing and preserved.
- `GET /partner-sdk/applications/{param}/skus/recommendations`
- `GET /partner-sdk/applications/{param}/storefront`
- `PATCH /partner-sdk/applications/{param}/storefront`
- `DELETE /partner-sdk/applications/{param}/storefront`
- Other missing partner-sdk guild/storefront SKU purchase and eligibility routes.

## Reconciliation Notes

- The assigned route is no longer present in `packages/missing-routes/missing.json`.
- The generated OpenAPI, source catalog, testing manifest, and generated HTTP contracts include the exact assigned POST route.
- The route source adds only the assigned POST method to the existing file; no adjacent partner-sdk routes were implemented.
- `package.json` and `package-lock.json` are unchanged.

## Recommended Next Tasks

- Design durable local Social Layer SKU storage/provider wiring if Spacebar wants the default route to create persistent SKUs.
- Implement adjacent partner-sdk storefront and guild SKU routes only when separately assigned.
- Triage the unrelated `/discovery/search` runtime contract failure outside this route task.
