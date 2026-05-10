# referrals-param-get

## Goal Evidence

- `create_goal`: status `active`; objective `Implement production-ready support for the missing route path `/referrals/{param}` on the current integration branch, with focused tests, regenerated route catalogs and generated route artifacts, verification evidence, and a complete handoff report.`
- `get_goal`: status `active`; objective `Implement production-ready support for the missing route path `/referrals/{param}` on the current integration branch, with focused tests, regenerated route catalogs and generated route artifacts, verification evidence, and a complete handoff report.`
- Resumed verification `create_goal`/`get_goal`: status `active`; objective `Implement production-ready support for the missing route path `/referrals/{param}` on the current integration branch, with focused tests, regenerated route catalogs and generated route artifacts, verification evidence, and a complete handoff report.`
- Final `update_goal(status: "complete")`: complete; time used 188 seconds, tokens used 104,123.

## Assignment

- Worker id: `referrals-param-get`
- Assigned path: `/referrals/{param}`
- Owned missing methods found at base `d9da0f922`: `GET_REFERRALS_REFERRAL_ID` only.
- Methods implemented: `GET /referrals/:referral_id/`
- Out of scope and untouched: `/users/@me/referrals/**`, `/outbound-promotions/**`, promotion codes, entitlements, gifts, subscriptions, and billing routes.

## Evidence Gathered

- Base `packages/missing-routes/missing.json` contained one owned entry: `GET /referrals/{param}`, route name `GET_REFERRALS_REFERRAL_ID`, sources `userdoccers:resources/premium-referral.mdx` and `xhyrom:data/client/routes.json`, source route `/referrals/{referral_id}`.
- Current regenerated `packages/missing-routes/missing.json` no longer contains the owned entry.
- Base source catalog and `src/api/routes/**` had no referrals route before implementation.
- Local xHyroM catalog lists `GET /referrals/{param}` as `REFERRAL_OFFER_ID_RESOLVE`; local Userdoccers catalog lists `GET /referrals/{referral_id}` as `GET_REFERRALS_REFERRAL_ID`.
- Userdoccers `resources/premium-referral.mdx` documents "Get Premium Referral", `GET /referrals/{referral.id}`, bearer-only access for the referrer or referred user, and a premium referral object with `id`, `user_id`, `trial_id`, `subscription_trial`, `expires_at`, `referrer_id`, `referrer`, and optional `redeemed_at`.
- Existing captured adjacent referral behavior returns generic `404: Not Found` with code `0` when referral data is unavailable.

## Behavior

- Added authenticated `GET /referrals/:referral_id/` metadata with `200 PremiumReferralResponse`, explicit `401 APIErrorResponse`, and `404 APIErrorResponse`.
- Added `PremiumReferralResponse` and nested `PremiumReferralSubscriptionTrial` schemas matching documented fields.
- Spacebar has no durable premium-referral storage, so the resolver does not fabricate campaign, reward, subscription, entitlement, or user data. Unresolved lookups return conservative generic `404: Not Found` / code `0`.
- Path parameter semantics use source-backed `referral_id`; OpenAPI emits `/referrals/{referral_id}/` with bearer security.

## Changed Files

- `src/api/routes/referrals/#referral_id.ts`
- `src/schemas/responses/PremiumReferralResponse.ts`
- `src/schemas/responses/index.ts`
- `test/routes/referrals-param-route.test.ts`
- `assets/schemas.json`
- `assets/openapi.json`
- `assets/testing-manifest.json`
- `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`
- `packages/missing-routes/missing.json`
- `test/generated/http-contracts.json`
- `worker-progress/referrals-param-get.md`

## Verification

- Current-base `npm run build:src:tsgo`: passed without porting the worker's incidental `ChannelMessageCreateRoute.ts` annotation.
- `npm run generate:schema`: passed; wrote 890 schemas including `PremiumReferralSubscriptionTrial`.
- `npm run build:test-fixtures`: passed.
- Focused test `NODE_OPTIONS=--preserve-symlinks node -r dotenv/config -r module-alias/register --enable-source-maps --test dist-test/test/routes/referrals-param-route.test.js`: passed, 5/5.
- `npm run build --workspace @spacebar/automatic-reverse-engineering`: passed.
- `node packages/automatic-reverse-engineering/dist/cli.js import-source-routes --root src/api/routes --out packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`: passed.
- `npm run build --workspace @spacebar/missing-routes`: passed.
- `npm run start --workspace @spacebar/missing-routes`: passed; Spacebar missing count is now 722, implements 458, Discord implements 1128.
- `npm run generate:testing-manifest`: passed; wrote 563 entries.
- `node scripts/testing-manifest/verify.js`: passed.
- `npm run generate:contract-tests`: passed; wrote 538 contracts.
- `node scripts/testing-manifest/generate-contract-tests.js --check`: passed; verified 538 contracts.
- `node scripts/testing-manifest/generate-suite-coverage.js --check`: passed.
- `node --test test/generated/http-contracts.test.js test/generated/suite-coverage.test.js`: passed, 13/13.
- `npm run generate:openapi`: passed; wrote 366 paths and 890 schemas. Existing unrelated warning remains for 3 routes missing `route()` middleware.
- `npx eslint src/api/routes/referrals/#referral_id.ts src/schemas/responses/PremiumReferralResponse.ts src/schemas/responses/index.ts test/routes/referrals-param-route.test.ts`: passed.
- `npx prettier --check src/api/routes/referrals/#referral_id.ts src/schemas/responses/PremiumReferralResponse.ts test/routes/referrals-param-route.test.ts worker-progress/referrals-param-get.md`: passed.
- `git diff --check`: passed.
- Package manifest/lockfile cleanliness check: passed; no dependency manifest changes.
- Changed-file malformed warranty-string scan: passed.

## Missing-Route Count Movement

- Before current-base regeneration: missing 723, Spacebar implements 457, Discord implements 1128.
- After current-base regeneration: missing 722, Spacebar implements 458, Discord implements 1128.

## Risks And Next Tasks

- The route currently has no successful `200` data path because Spacebar does not persist premium referrals. The safe production behavior is a documented schema plus authenticated generic 404 until a real referral store exists.
- A future referral-storage task can replace `resolvePremiumReferral()` with persistence-backed lookup and enforce the documented referrer-or-referred visibility check.
- Adjacent referral creation, eligibility, incentive, promotion, entitlement, gift, subscription, and billing routes remain missing and were intentionally left for separately assigned workers.
