# teams-param-payouts-get

## Summary

Implemented `GET /teams/{param}/payouts` (`GET_TEAMS_TEAM_ID_PAYOUTS`) on
current integration base `c6ae62a62e79c5678c90fd10126209b0b8ebd0a9`.

The route uses existing team-style access semantics: the current user must be
the team owner or an accepted team member. It parses the documented `limit`
query parameter range `1-96` with default `96`, validates `after` as a
Discord-style snowflake, and then fails closed with `501 APIErrorResponse`
because Spacebar has no durable payout records or payout provider integration.

## Changed Files

- `src/api/routes/teams/#team_id/payouts.ts`
- `test/routes/teams-param-payouts-get.test.ts`
- `assets/openapi.json`
- `assets/testing-manifest.json`
- `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`
- `packages/missing-routes/missing.json`
- `test/generated/http-contracts.json`
- `worker-progress/teams-param-payouts-get.md`

## Evidence

- Missing entry before implementation: `GET /teams/{param}/payouts` from
  `userdoccers:resources/team.mdx`.
- Existing team access patterns inspected in `teams/#team_id/index.ts`,
  `members.ts`, `applications.ts`, and `identity/verification.ts`.
- Local support limit: Spacebar has `Team` and `TeamMember`, but no team payout
  entity/table/history or payout provider integration.
- The implementation does not fabricate payout records or return a misleading
  empty page.

## Missing-Route Movement

- Current-base before regeneration: `635` missing / `545` implemented /
  `1128` Discord.
- After regeneration: `634` missing / `546` implemented / `1128` Discord.
- `GET /teams/{param}/payouts` was removed from missing entries.
- Adjacent payout onboarding and payout report routes remain missing by scope.

## Verification

- `npm run build:src:tsgo` - passed.
- `npm run build:test-fixtures` - passed.
- Focused compiled test
  `node -r dotenv/config -r module-alias/register --enable-source-maps --test dist-test/test/routes/teams-param-payouts-get.test.js`
  - passed `10/10`.
- Automatic reverse-engineering build/import - passed.
- Missing-routes build/start - passed; wrote `634` missing / `546`
  implemented.
- `npm run generate:testing-manifest` - passed; wrote `651` entries.
- `node scripts/testing-manifest/verify.js` - passed.
- `npm run generate:contract-tests` and contract check - passed; wrote `626`
  contracts.
- Suite coverage check - passed.
- `npm run generate:openapi` - passed; wrote `441` paths and `1030` schemas.
- Generated contract and suite tests - passed `13/13`.
- `npm run test:manifest` - passed `30/30`.
- `npm run test:suite-coverage` - passed `4/4`.
- `npm run lint` - passed.
- `npm run test:contracts` static checks passed; runtime still fails on the
  known unrelated `api:http:GET:/discovery/search` expectation returning `500`
  instead of `200`. Existing analytics `query.ts` route-registration noise is
  unrelated and predates this route.
- `git diff --check` - passed.
- Package/lockfile guard - no diff.
- Changed-file malformed warranty-token scan - no matches.
- `npm run generate:schema` was not run because no schema source changed and
  this route intentionally exposes only `APIErrorResponse` outcomes.

## Risks / Follow-Up

- Real payout history requires durable payout storage plus provider integration.
- `/teams/{param}/payouts/onboarding` and
  `/teams/{param}/payouts/{param}/report` remain separate missing-route work.
