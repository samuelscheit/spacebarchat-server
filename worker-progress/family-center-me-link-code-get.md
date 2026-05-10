# Family Center @me Link Code GET

## Summary

Implemented `GET /family-center/@me/link-code` as an authenticated Family Center compatibility route. The route advertises the source-backed `FamilyCenterLinkCodeResponse` shape, includes `401` bearer-auth error metadata, and fails closed with `DiscordApiErrors.FEATURE_TEMPORARILY_DISABLED` because Spacebar has no persisted Family Center link-code, expiry, or eligibility model.

## Changed files

- `src/api/routes/family-center/@me.ts`
- `src/schemas/responses/FamilyCenterResponse.ts`
- `test/routes/familyCenterMeRoute.test.ts`
- `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`
- `packages/missing-routes/missing.json`
- `assets/schemas.json`
- `assets/testing-manifest.json`
- `assets/openapi.json`
- `test/generated/http-contracts.json`
- `worker-progress/family-center-me-link-code-get.md`

## Commands run

- `create_goal` objective: `implement the missing route path GET /family-center/@me/link-code for the Spacebar server API`
- `get_goal` after creation: status `active`, same objective
- `sed -n '1,220p' /Users/user/Developer/Developer/spacebarchat/WORKER_BRIEF.md`
- `rg -n 'family-center/@me/link-code|GET_FAMILY_CENTER__ME_LINK_CODE' packages/missing-routes/missing.json`
- `rg -n 'family-center/@me/link-code|GET_FAMILY_CENTER__ME_LINK_CODE' packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`
- `rg -n 'family-center.*link-code|link-code.*family-center|family-center/@me/link-code' src/api/routes packages test tests assets`
- `sed -n '1880,1935p' packages/missing-routes/missing.json`
- `sed -n '1820,1855p' packages/automatic-reverse-engineering/data/catalogs/routes.userdoccers.catalog.json`
- `sed -n '2828,2864p' packages/automatic-reverse-engineering/data/catalogs/routes.xhyrom.catalog.json`
- `sed -n '1,240p' src/api/routes/family-center/@me.ts`
- `sed -n '1,260p' test/routes/familyCenterMeRoute.test.ts`
- `sed -n '1,220p' src/schemas/responses/FamilyCenterResponse.ts`
- Opened upstream Userdoccers raw source: `https://raw.githubusercontent.com/discord-userdoccers/discord-userdoccers/master/pages/resources/family-center.mdx`
- `if [ -L node_modules ]; then unlink node_modules; fi`
- `if [ ! -d node_modules ]; then npm ci; fi`
- `npm run build:src:tsgo`
- `npm run build:test-fixtures`
- `node -r dotenv/config -r module-alias/register --enable-source-maps --test dist-test/test/routes/familyCenterMeRoute.test.js`
- `npm run build --workspace @spacebar/automatic-reverse-engineering`
- `node packages/automatic-reverse-engineering/dist/cli.js import-source-routes --root src/api/routes --out packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`
- `npm run build --workspace @spacebar/missing-routes`
- `npm run start --workspace @spacebar/missing-routes`
- `npm run generate:schema`
- `npm run generate:testing-manifest`
- `node scripts/testing-manifest/verify.js`
- `node scripts/testing-manifest/generate-contract-tests.js --check` failed once because `test/generated/http-contracts.json` was stale
- `npm run generate:contract-tests`
- `node scripts/testing-manifest/generate-contract-tests.js --check`
- `node scripts/testing-manifest/generate-suite-coverage.js --check`
- `npm run generate:openapi`
- `git diff --check`
- Malformed warranty scan for known corrupted AGPL warranty-line variants

## Evidence gathered

- Assigned missing entry existed before implementation in `packages/missing-routes/missing.json` as `GET_FAMILY_CENTER__ME_LINK_CODE` for `/family-center/@me/link-code`.
- Assigned route was absent from `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json` and `src/api/routes/**` before implementation.
- Local Userdoccers catalog listed `GET /family-center/@me/link-code` from `userdoccers:resources/family-center.mdx` with summary `Get Link Code`.
- Local xHyroM catalog listed `GET`, `HEAD`, and `OPTIONS` for `/family-center/@me/link-code` as `FAMILY_CENTER_LINK_CODE`; only `GET` was assigned by `missing_entries[]`.
- Upstream Userdoccers source documents that the endpoint generates a `link_code` used in `https://discord.com/feature/family-center/my-family/:linked_user_id/:link_code` and that generating a code fails after the linked user ages out of Family Center.
- Existing Spacebar Family Center overview route returns an authenticated empty compatibility payload and includes `401: APIErrorResponse` metadata.
- Spacebar currently has no Family Center link-code persistence, expiry, linked-user eligibility, or age-out model suitable for generating real reusable codes.

## Assigned path and methods

- Assigned path: `/family-center/@me/link-code`
- Missing methods found: `GET`
- Methods implemented: `GET`
- Adjacent Family Center overview, activity, linked-users, link-request, linked-user modification, birthday, account-age, and QR-code UI routes were not implemented.

## What changed

- Added `router.get("/link-code")` under `src/api/routes/family-center/@me.ts`.
- Added response metadata for `200 FamilyCenterLinkCodeResponse`, `400 APIErrorResponse`, and `401 APIErrorResponse`.
- Added `FamilyCenterLinkCodeResponse` with `link_code: string`.
- Added focused route tests proving the route fails closed with `FEATURE_TEMPORARILY_DISABLED` and documents response/auth metadata.
- Regenerated source route catalog, missing-route report, schema, testing manifest, HTTP contract JSON, and OpenAPI.

## Missing-route count movement

- Before regeneration: `missing: 834`, `spacebar: 346`, `discord: 1128`.
- After regeneration: `missing: 833`, `spacebar: 347`, `discord: 1128`.
- The assigned `GET /family-center/@me/link-code` entry disappeared from `missing_entries[]` and the route list.

## Userdoccers and xHyroM references

- Local Userdoccers catalog: `packages/automatic-reverse-engineering/data/catalogs/routes.userdoccers.catalog.json` around the `GET_FAMILY_CENTER__ME_LINK_CODE` entry.
- Local xHyroM catalog: `packages/automatic-reverse-engineering/data/catalogs/routes.xhyrom.catalog.json` around the `FAMILY_CENTER_LINK_CODE` entries.
- Upstream Userdoccers source: `https://raw.githubusercontent.com/discord-userdoccers/discord-userdoccers/master/pages/resources/family-center.mdx`.

## Risks or blockers

- Real link-code generation remains intentionally blocked. Implementing it requires a persisted code model, expiry/rotation semantics, one-time or reusable-code policy, linked-user/requestor eligibility, and age-out behavior.
- The route returns a conservative API error for all authenticated callers until that model exists.

## Recommended next tasks

- Design and implement a Family Center link-code persistence and expiry model before enabling `200` code generation.
- Add eligibility and age-out state to the Family Center domain model before implementing linked-users and link-request routes.
- Once persistence exists, add integration tests covering code generation, expiry, reuse, requester submission, and age-out failure.

## Goal status evidence

- Initial `create_goal` and `get_goal` evidence: status `active`, objective `implement the missing route path GET /family-center/@me/link-code for the Spacebar server API`.
- Final pane evidence: worker reported goal status `complete`; final goal time used `353s`.
