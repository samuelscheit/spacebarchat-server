# reporting-menu-param-get

## Summary

Implemented the assigned `GET /reporting/menu/{param}` route as
`GET /reporting/menu/:type` in `src/api/routes/reporting/index.ts`.

The route serves the same static report menu fixtures through the parameterized
Userdoccers/xHyroM path, keeps bearer auth by remaining outside
`NO_AUTHORIZATION_ROUTES`, validates the report menu type before building a file
path, parses the optional `variant` query, returns `204` for unavailable
variants, and returns `400` field errors for invalid query shape.

Scope was limited to the assigned route. `/reporting/unauthenticated/menu/{param}`,
report submit routes, `/report`, `/report/options`, and unrelated reporting
infrastructure were not implemented.

## Changed Files

- `src/api/routes/reporting/index.ts`
- `src/api/tests/reporting/createReport.test.ts`
- Regenerated source catalog, missing report, testing manifest, HTTP contracts,
  suite coverage, and OpenAPI on the current integration base.

## Evidence

- Missing entry confirmed in `packages/missing-routes/missing.json` before
  regeneration:
    - method `GET`
    - route `/reporting/menu/{param}`
    - route name `GET_REPORTING_MENU_TYPE`
    - sources `userdoccers:topics/reports.mdx`,
      `xhyrom:data/client/routes.json`
- Source catalog absence confirmed before implementation: no
  `GET /reporting/menu/{type}` entry in
  `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`.
- Existing implementation only registered concrete menu routes with
  template-string loop paths, so the source importer did not see a
  parameterized route.
- Userdoccers reference used: `https://docs.discord.food/topics/reports`.
- xHyroM local catalog used:
  `packages/automatic-reverse-engineering/data/catalogs/routes.xhyrom.catalog.json`
  contains `/reporting/menu/{param}`.
- Menu fixtures inspected under `assets/temp_report_menu_responses`; all known
  menu types have `variant=1` and `version=1.0`.

## Missing Count Movement

- Current base before regeneration: `missing = 670`, `spacebar = 510`.
- After regeneration: `missing = 669`, `spacebar = 511`.
- Assigned route is absent from `missing_entries`.

## Verification

Current-base verification was rerun by the orchestrator after porting:

- `npm run build:src:tsgo`
- `npm run build --workspace @spacebar/automatic-reverse-engineering`
- `node packages/automatic-reverse-engineering/dist/cli.js import-source-routes --root src/api/routes --out packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`
- `npm run build --workspace @spacebar/missing-routes`
- `npm run start --workspace @spacebar/missing-routes`
- `npm run generate:testing-manifest`
- `node scripts/testing-manifest/verify.js`
- `npm run generate:contract-tests`
- `node scripts/testing-manifest/generate-contract-tests.js --check`
- `npm run generate:suite-coverage`
- `node scripts/testing-manifest/generate-suite-coverage.js --check`
- `npm run generate:openapi`
- `npm run build:test-fixtures`
- Focused reporting menu and response tests
- Generated contract and suite coverage tests
- Focused ESLint and Prettier
- `git diff --check`
- package/lockfile guard
- conflict-marker and changed-file warranty-token scans

## Risks And Blockers

- Full `npm run test:contracts` is still expected to fail on the unrelated
  `GET /discovery/search` runtime response-schema validation issue.
- Repository-wide malformed warranty-token scans report unrelated pre-existing
  malformed headers. Changed files are clean.
