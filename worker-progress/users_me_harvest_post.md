# users_me_harvest_post

## Scope

- Assigned route: `POST /users/@me/harvest`
- Assigned route name: `POST_USERS__ME_HARVEST`
- Implemented only the assigned method-scoped route.
- Existing `GET /users/@me/harvest` behavior was preserved.
- `HEAD`, `OPTIONS`, and adjacent current-user routes were intentionally untouched.

## Summary

- Added bearer-authenticated `POST /users/@me/harvest`.
- Added `UserHarvestCreateSchema` with optional `backends` and `email` fields.
- The route validates the documented request body and fails closed with `501 APIErrorResponse` because Spacebar has no durable data-export harvest queue or delivery pipeline.
- The existing `GET` route still returns `204` when no durable harvest request exists.

## Evidence

- Userdoccers `resources/user.mdx` documents create harvest with optional `backends` and OAuth2-context `email`, returning a harvest object on success.
- Local Userdoccers catalog lists `GET_USERS__ME_HARVEST` and `POST_USERS__ME_HARVEST`.
- Local xHyroM catalog lists `GET`, `HEAD`, `OPTIONS`, and `POST` for `/users/@me/harvest`; this assignment covered only `POST`.

## Changes

- `src/api/routes/users/@me/harvest.ts`
- `src/schemas/uncategorised/UserHarvestCreateSchema.ts`
- `src/schemas/uncategorised/index.ts`
- `test/routes/users-me-harvest-get.test.ts`
- Regenerated artifacts after reconciliation:
  - `assets/schemas.json`
  - `assets/openapi.json`
  - `assets/testing-manifest.json`
  - `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`
  - `packages/missing-routes/missing.json`
  - `test/generated/http-contracts.json`
  - `test/generated/suite-coverage.json`

## Verification

- Worker verification passed build, focused route tests, manifest verification, suite coverage, targeted ESLint, `git diff --check`, package/lockfile guard, and artifact audits.
- Main-checkout reconciliation regenerated artifacts on top of `a309a2405`.
- Main-checkout missing-route movement: `509 -> 508`; implemented routes `671 -> 672`; Discord routes `1128`.
- `npm run test:contracts` is expected to fail only on the known unrelated runtime check: `api:http:GET:/discovery/search` returns `500 !== 200`.

## Risks / Blockers

- This is intentionally not a synthetic successful harvest. A real implementation needs durable harvest request state, export workers, delivery semantics, cooldown/error policy, and ownership boundaries around `req.user_id`.
- The request schema validates documented wire types but does not model valid backend names as an enum because Userdoccers says invalid backend options are ignored by Discord.
