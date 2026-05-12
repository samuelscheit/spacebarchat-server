# GET /users/@me/connections/reddit/{param}/subreddits

## Summary

Implemented the assigned `GET /users/@me/connections/reddit/{param}/subreddits` route only.

Behavior is deliberately local and fail-closed:

- Looks up a connected account owned by `req.user_id` with `type: "reddit"` and `external_id: connection_id`.
- Returns Discord's shared `UNKNOWN_CONNECTION` error when no local Reddit connection exists.
- Returns Discord's shared `CONNECTION_REVOKED` error when the local Reddit connection is revoked.
- Returns `[]` for valid active Reddit connections because Spacebar persists Reddit identity metadata but does not persist moderated subreddit membership. The route does not call Reddit or fabricate subreddit data.

## Changed Files

- `src/api/routes/users/@me/connections/reddit/#connection_id/subreddits.ts`
- `src/schemas/responses/ConnectedAccountSubredditsResponse.ts`
- `src/schemas/responses/index.ts`
- `test/routes/users-me-connections-reddit-param-subreddits-get.test.ts`
- `assets/schemas.json`
- `assets/openapi.json`
- `assets/testing-manifest.json`
- `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`
- `packages/missing-routes/missing.json`
- `test/generated/http-contracts.json`
- `test/generated/suite-coverage.json`

No `package.json`, `package-lock.json`, or workspace package files changed.

## Evidence Gathered

- `packages/missing-routes/missing.json` contained exactly one assigned entry:
  `GET /users/@me/connections/reddit/{param}/subreddits`, sourced from `userdoccers:resources/connected-accounts.mdx`.
- `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json` did not contain the route before implementation.
- Userdoccers source:
  `https://raw.githubusercontent.com/discord-userdoccers/discord-userdoccers/master/pages/resources/connected-accounts.mdx`
  says the endpoint returns a list of subreddit objects the connected account moderates, only for Reddit connections, with fields `id`, `subscribers`, and `url`.
- `packages/automatic-reverse-engineering/data/catalogs/routes.userdoccers.catalog.json` has the exact source route:
  `/users/@me/connections/reddit/{connection_id}/subreddits`.
- `packages/automatic-reverse-engineering/data/catalogs/routes.xhyrom.catalog.json` has connection, access-token, refresh, and contact-sync entries, but no Reddit subreddit route.
- `src/connections/Reddit/index.ts` only requests Reddit `identity`, maps user metadata (`gold`, `mod`, `total_karma`, `created_at`), and does not fetch or store moderated subreddit membership.
- `src/util/entities/ConnectedAccount.ts` has no durable subreddit membership field.
- Existing local compatibility patterns return empty documented collections when Spacebar has no source-backed persistence, while connection routes use `UNKNOWN_CONNECTION` and `CONNECTION_REVOKED` for linked-account access boundaries.

## Assigned Path Movement

- Assigned path: `/users/@me/connections/reddit/{param}/subreddits`
- Missing methods found: `GET`
- Methods implemented: `GET`
- Current-base report movement after regeneration:
  - Base before integration: `4e9bfeb88 Implement user activity metadata route`
  - `missing`: `601 -> 600`
  - `spacebar`: `579 -> 580`
  - `discord`: `1128`
- The assigned missing entry is no longer present in `packages/missing-routes/missing.json`.
- Source route catalog now contains:
  `GET /users/@me/connections/reddit/{connection_id}/subreddits`
  from `src/api/routes/users/@me/connections/reddit/#connection_id/subreddits.ts`.

## Commands Run

Current-base acceptance commands, using `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH"`:

- `npm run build:src:tsgo`
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
- `node -r dotenv/config -r module-alias/register --enable-source-maps --test dist-test/test/routes/users-me-connections-reddit-param-subreddits-get.test.js` passed 7/7.
- `node scripts/testing-manifest/verify.js`
- `node scripts/testing-manifest/generate-contract-tests.js --check`
- `node scripts/testing-manifest/generate-suite-coverage.js --check`
- `node --test test/generated/http-contracts.test.js test/generated/suite-coverage.test.js` passed 13/13.
- `npm run test:suite-coverage`
- `npm run lint`
- `git diff --check`
- `git diff --exit-code -- package.json package-lock.json bun.lock`
- `npm run test:contracts` failed only on the known unrelated runtime
  contract: `api:http:GET:/discovery/search` returned `500` instead of `200`.

## Risks Or Blockers

- The route does not return real moderated subreddits because Spacebar has no durable local source for that data and the Reddit connection only persists identity metadata. Returning `[]` is a compatibility representation for locally known state, not a Reddit API proxy.
- If Spacebar later stores Reddit moderator memberships, `listStoredRedditConnectionSubreddits` is the narrow point to wire that durable backing.
- `npm run test:contracts` remains blocked by the known unrelated `/discovery/search` runtime `500 !== 200` failure.

## Adjacent Routes Intentionally Untouched

- Generic connection mutation routes.
- Connection refresh routes.
- Contact-sync routes.
- Domain connection routes.
- OAuth callback/session handoff flows.
- External Reddit API flows.

## Completion Audit Rerun

Reran and rechecked the objective-critical current-state evidence on current main after porting:

- `git status --short` shows only this route implementation, generated artifacts, the focused test, schema response type, and this progress file changed.
- `packages/missing-routes/missing.json` reports `missing: 600`, `spacebar: 580`, `discord: 1128`; the assigned missing entry query returns no rows.
- `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json` contains `GET /users/@me/connections/reddit/{connection_id}/subreddits` from the new route file.
- Userdoccers catalog contains the Reddit subreddit route; xHyroM still has no matching Reddit subreddit route.
- `rg` found no external Reddit/network client usage in the new route.
