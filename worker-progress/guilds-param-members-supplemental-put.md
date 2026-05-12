# PUT /guilds/{param}/members/supplemental

## Summary

Implemented the assigned `PUT /guilds/{guild_id}/members/supplemental` route only. The endpoint stays bearer-authenticated, requires `MANAGE_GUILD`, verifies the target guild through the existing supplemental route repository seam, and fails closed with an explicit `501` API error because Spacebar does not persist Discord's private member-safety supplemental state.

The existing `GET` behavior is unchanged: it returns only locally backed `Member.joined_by` provenance. The new `PUT` route does not read or mutate member provenance and does not fabricate safety state.

## Changed Files

- `src/api/routes/guilds/#guild_id/members/supplemental.ts`
- `test/routes/guilds-members-supplemental-route.test.ts`
- `assets/openapi.json`
- `assets/testing-manifest.json`
- `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`
- `packages/missing-routes/missing.json`
- `test/generated/http-contracts.json`
- `test/generated/suite-coverage.json`
- `worker-progress/guilds-param-members-supplemental-put.md`

## Evidence

- `packages/missing-routes/missing.json` initially listed `DELETE`, `PATCH`, `POST`, and assigned `PUT` for `/guilds/{param}/members/supplemental`.
- `packages/automatic-reverse-engineering/data/catalogs/routes.xhyrom.catalog.json` lists `PUT /guilds/{guild_id}/members/supplemental` as `MEMBER_SAFETY_SUPPLEMENTAL`.
- `packages/automatic-reverse-engineering/data/catalogs/routes.userdoccers.catalog.json` only documents `POST /guilds/{guild_id}/members/supplemental` as "Get Guild Members Supplemental"; no Userdoccers request/response contract exists for assigned `PUT`.
- Existing `src/api/routes/guilds/#guild_id/members/supplemental.ts` requires `MANAGE_GUILD` for local supplemental reads and only exposes `joined_by` provenance.
- Nearby safety routes show conservative behavior for unsupported safety state, including `src/api/routes/guilds/#guild_id/members/unusual-dm-activity.ts`.
- `src/api/routes/applications/games-supplemental.ts` provided the local pattern for source-backed supplemental reads plus fail-closed unsupported mutations.

## Missing-Route Movement

- Before regeneration: overall missing count `534`; this path missing methods `DELETE`, `PATCH`, `POST`, `PUT`.
- After regeneration: overall missing count `533`; this path missing methods `DELETE`, `PATCH`, `POST`.
- Source catalog now contains:
  - `GET /guilds/{guild_id}/members/supplemental`
  - `PUT /guilds/{guild_id}/members/supplemental`

## Sibling Methods Intentionally Untouched

Did not implement `DELETE`, `PATCH`, or `POST` for `/guilds/{param}/members/supplemental`. They remain in `packages/missing-routes/missing.json` for their assigned workers or future review.

## Commands Run

- `npm run build:src:tsgo` failed before dependency install because `tsgo` was not installed in this worktree.
- `npm ci` passed.
- `npm run build:src:tsgo` passed.
- `npm run generate:schema` passed.
- `npm run generate:openapi` passed.
- `npm run build --workspace @spacebar/automatic-reverse-engineering` passed.
- `node packages/automatic-reverse-engineering/dist/cli.js import-source-routes --root src/api/routes --out packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json` passed.
- `npm run build --workspace @spacebar/missing-routes` passed.
- `npm run start --workspace @spacebar/missing-routes` passed, writing `Spacebar is missing 533`.
- `npm run generate:testing-manifest` passed.
- `npm run generate:contract-tests` passed.
- `npm run generate:suite-coverage` passed.
- `npm run build:test-fixtures` passed.
- `node -r dotenv/config -r module-alias/register --enable-source-maps --test dist-test/test/routes/guilds-members-supplemental-route.test.js` passed.
- `npm run test:manifest` passed.
- `npm run test:suite-coverage` passed.
- `npm run test:contracts` failed only on known unrelated `api:http:GET:/discovery/search` runtime response `500 !== 200`; earlier generated contract checks passed.
- `npm exec eslint -- 'src/api/routes/guilds/#guild_id/members/supplemental.ts' test/routes/guilds-members-supplemental-route.test.ts` passed.
- `git diff --check` passed.
- `git diff -- package.json package-lock.json --exit-code` passed.

## Risks And Blockers

- The assigned `PUT` has no source-backed request schema or durable local safety-state model. Returning `501` after auth, permission, and guild checks is intentionally conservative.
- `npm run test:contracts` remains blocked by the known unrelated `GET /discovery/search` public runtime contract failure.

## Reconciliation Notes

- No package or lockfile changes.
- `npm ci` created local ignored dependency artifacts in this worktree only.
- `assets/schemas.json` was regenerated but unchanged, so it is not in the final tracked diff.

## Orchestrator Replay Notes

- Replayed onto current main after `6c3728804`.
- Current-base regeneration moved missing routes from `532` to `531`, implemented routes from `648` to `649`, with `1128` Discord routes.
- Current-base generated artifacts now contain `754` testing manifest entries and `729` generated HTTP contracts.
- Current-base focused supplemental route tests passed `13/13`; manifest tests passed `30/30`; generated contract matrix tests passed `10/10`; generated suite tests passed `4/4`.
- Current-base source build, OpenAPI generation, automatic reverse-engineering build/import, missing-route regeneration, test-fixture build, targeted ESLint, `git diff --check`, and package/lockfile guard passed.
- Full `npm run test:contracts` still fails only on the known unrelated runtime contract `api:http:GET:/discovery/search` returning `500 !== 200`; generated contract checks passed before runtime.
