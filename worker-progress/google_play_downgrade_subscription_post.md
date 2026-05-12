# google_play_downgrade_subscription_post

## Summary

Implemented only `POST /google-play/downgrade-subscription` (`DOWNGRADE_SUBSCRIPTION`) as a bearer-authenticated compatibility route that fails closed with `501` because this Spacebar instance has no Google Play Billing integration or durable Google purchase-token lineage state to downgrade safely.

## Changed Files

- `src/api/routes/google-play/downgrade-subscription.ts`
- `test/routes/google-play-downgrade-subscription-post.test.ts`
- `assets/openapi.json`
- `assets/testing-manifest.json`
- `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`
- `packages/missing-routes/missing.json`
- `test/generated/http-contracts.json`
- `test/generated/suite-coverage.json`
- `testing/suite-coverage-policy.json`
- `worker-progress/google_play_downgrade_subscription_post.md`

## Assigned Route

- Assigned route: `POST /google-play/downgrade-subscription`
- Assigned route name: `DOWNGRADE_SUBSCRIPTION`
- Implemented route catalog name: `POST_GOOGLE_PLAY_DOWNGRADE_SUBSCRIPTION`
- Manifest id: `api:http:POST:/google-play/downgrade-subscription/`
- Behavior: authenticated route, no request body schema declared from available evidence, returns `APIErrorResponse` with status `501` after auth.

## Missing Route Movement

- Before main acceptance regeneration: `missing: 519`, `spacebar: 661`, `discord: 1128`.
- After main acceptance regeneration: `missing: 518`, `spacebar: 662`, `discord: 1128`.
- `POST /google-play/downgrade-subscription` was removed from `packages/missing-routes/missing.json`.

## Evidence Sources

- `packages/missing-routes/missing.json`: assigned missing entry existed with `POST`, route `/google-play/downgrade-subscription`, route name `DOWNGRADE_SUBSCRIPTION`.
- `packages/automatic-reverse-engineering/data/catalogs/routes.xhyrom.catalog.json`: xHyroM listed `OPTIONS` and `POST` for `/google-play/downgrade-subscription`.
- Userdoccers billing/subscription/payment docs provided surrounding Google Play purchase-token context, but no direct page documented this private endpoint.
- Google Play Billing docs describe upgrade/downgrade as a provider flow requiring old/new purchase state and replacement modes.

## Commands Run

- PASS: `npm run build:src:tsgo`
- PASS: `npm run generate:schema`
- PASS: `npm run generate:openapi`
- PASS: `npm run build --workspace @spacebar/automatic-reverse-engineering`
- PASS: `node packages/automatic-reverse-engineering/dist/cli.js import-source-routes --root src/api/routes --out packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`
- PASS: `npm run build --workspace @spacebar/missing-routes`
- PASS: `npm run start --workspace @spacebar/missing-routes`
- PASS: `npm run generate:testing-manifest` - wrote 767 entries.
- PASS: `npm run generate:contract-tests` - wrote 742 contracts.
- PASS: `npm run generate:suite-coverage` - wrote 15 suites after assigning the new Google Play manifest id in `testing/suite-coverage-policy.json`.
- PASS: `npm run build:test-fixtures`
- PASS: focused route test
- PASS: manifest, generated contract, and suite checks
- PASS: targeted ESLint
- PASS: `git diff --check`
- PASS: package/lockfile guard

## Known Unrelated Blocker

- `npm run test:contracts` fails only on known unrelated runtime failure: `api:http:GET:/discovery/search` returned `500 !== 200`; generated contract checks pass before the runtime step.

## Risks And Blockers

- Durable local Google Play Billing provider state is absent. Returning success would fabricate a downgrade and risk incorrect entitlement/payment state, so the route deliberately fails closed.
- No direct Userdoccers body/response documentation was found for this private Google Play endpoint. The implementation avoids inventing a request schema.

## Sibling Routes Intentionally Untouched

- `POST /google-play/verify-purchase-token`
- `POST /google-play/validate-purchase` was already accepted before this main reconciliation and is not modified here.

## Reconciliation Notes

- Worker implementation was limited to `/Users/user/Developer/Developer/spacebarchat/worktrees/current-google-play-downgrade-subscription-post-agent`.
- Main acceptance replayed source/test/report changes onto `/Users/user/Developer/Developer/spacebarchat/server` and regenerated artifacts on the current integration branch.
- OpenAPI and generated HTTP contracts expose only `401` and `501` `APIErrorResponse` outcomes for the assigned route.
- Main acceptance added `api:http:POST:/google-play/downgrade-subscription/` to the explicit Google Play suite manifest ids.
- Main acceptance also updated the focused test to expect the current `api-google-play-commerce` coverage policy for `/google-play/*` routes.
- No package or lockfile changes were made.
