# ai_fix_grammar_post

## Summary

Implemented only `POST /ai/fix-grammar` (`POST_AI_FIX_GRAMMAR`) in the assigned worktree. The route is registered at `src/api/routes/ai/fix-grammar.ts`, remains behind bearer authentication, requires local `OPERATOR` rights as the Spacebar analogue for the Userdoccers staff-only endpoint, validates a non-coerced `content` string body, and fails closed with a 501 `APIErrorResponse` because Spacebar has no configured AI text-correction provider.

## Changed Files

- `src/api/routes/ai/fix-grammar.ts`
- `src/schemas/uncategorised/AIFixGrammarSchema.ts`
- `src/schemas/uncategorised/index.ts`
- `test/routes/ai-fix-grammar-route.test.ts`
- `assets/schemas.json`
- `assets/openapi.json`
- `assets/testing-manifest.json`
- `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`
- `packages/missing-routes/missing.json`
- `test/generated/http-contracts.json`

## Missing-Route Movement

- Before regeneration: `missing = 533`, `spacebar = 647`
- After regeneration: `missing = 532`, `spacebar = 648`
- Removed missing entry: `POST /ai/fix-grammar` / `POST_AI_FIX_GRAMMAR`
- Still missing and intentionally untouched: `POST /ai/title`, `POST /ai/translate`, `POST /ai/summarize-thread/{param}`

## Evidence Sources

- `packages/missing-routes/missing.json` had exactly one assigned entry for `POST /ai/fix-grammar`.
- `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json` had no `/ai/fix-grammar` entry before implementation and now has one with `request_schema_ref: AIFixGrammarSchema`.
- `packages/automatic-reverse-engineering/data/catalogs/routes.userdoccers.catalog.json` lists `POST /ai/fix-grammar` from `userdoccers:resources/ai.mdx`; `routes.xhyrom.catalog.json` has no `/ai/*` entries.
- Userdoccers `pages/resources/ai.mdx` documents AI endpoints as staff-only and `Fix Grammar` as taking `content` string input from 1 to 2000 characters and returning corrected `content`.

## Commands Run

- `npm ci` (needed because the assigned worktree had no installed dependencies; package/lockfile guard remained clean)
- `npm run build:src:tsgo` (initially failed before `npm ci` because `tsgo` was unavailable; passed after install; also passed inside `npm run test:contracts`)
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
- `node -r dotenv/config -r module-alias/register --enable-source-maps --test dist-test/test/routes/ai-fix-grammar-route.test.js`
- `npm run test:manifest`
- `npm run test:suite-coverage`
- `npm run test:contracts` (failed only on known unrelated `api:http:GET:/discovery/search` runtime `500 !== 200`)
- `npx eslint src/api/routes/ai/fix-grammar.ts src/schemas/uncategorised/AIFixGrammarSchema.ts src/schemas/uncategorised/index.ts test/routes/ai-fix-grammar-route.test.ts`
- `git diff --check`
- `git diff --exit-code -- package.json package-lock.json`
- `npm run build --workspace @spacebar/automatic-reverse-engineering -- --pretty false`
- `npm run build --workspace @spacebar/missing-routes -- --pretty false`
- Completion audit script validating route source, schema export, `assets/schemas.json`, source catalog, missing-route report, OpenAPI, testing manifest, generated HTTP contracts, and suite coverage metadata for `POST /ai/fix-grammar`

## Verification Notes

- Focused route test passed: 8 tests for auth boundary, operator-right denial, non-coerced schema validation, fail-closed 501 behavior, route metadata, and generated artifact metadata.
- `test:manifest` passed and verified 753 entries.
- `test:suite-coverage` passed.
- `test:contracts` static checks passed and runtime checks failed only on the known unrelated `api:http:GET:/discovery/search` `500 !== 200` assertion from the worker brief.
- Targeted ESLint passed.
- `git diff --check` passed.
- Package and lockfile guard passed with no `package.json` or `package-lock.json` changes.
- Completion audit passed: current artifacts agree on `POST /ai/fix-grammar`, `POST_AI_FIX_GRAMMAR`, `AIFixGrammarSchema`, `OPERATOR`, `400/401/403/501` API error responses, no `200` fabricated success response, and sibling AI routes still missing.

## Risks Or Blockers

- Spacebar currently has no AI grammar-correction provider, durable job state, or configured upstream model integration. The route therefore validates access and request shape, then returns an explicit 501 instead of returning fabricated corrected text.
- The endpoint is mapped to `OPERATOR` because the only upstream evidence describes the AI endpoints as staff-only.

## Reconciliation Notes

- Replayed into main at `4525805cf` after the content-inventory application PATCH merge. Regeneration on the current base moved missing routes `528 -> 527` and Spacebar implemented routes `652 -> 653`; OpenAPI now has `537` paths and `1191` schemas, the testing manifest has `758` entries, and generated HTTP contracts have `733` contracts.
- No sibling AI methods or adjacent routes were implemented.
- No persistence, gateway events, audit-log records, or message mutations are performed.
- Generated artifacts reflect only the new `POST /ai/fix-grammar` route and schema.
