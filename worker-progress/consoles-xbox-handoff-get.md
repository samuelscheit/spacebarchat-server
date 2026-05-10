# GET /consoles/xbox-handoff

## Summary

Implemented the assigned authenticated `GET /consoles/xbox-handoff` route and removed the `XBOX_HANDOFF` missing-route entry.

The route is intentionally conservative: it validates the caller has at least one non-revoked local Xbox connected account, returns existing Discord-compatible connection errors for missing or revoked accounts, then returns a typed `501` `APIErrorResponse` because Spacebar has no source-backed state for minting Discord/Xbox voice handoff tokens, URLs, identity payloads, or OAuth state.

Goal evidence from initial `get_goal`: status `active`; objective `implement the missing route path \`GET /consoles/xbox-handoff\` for the Spacebar server API.`

Current-master integration note: accepted onto base `0ceb240b8` after regenerating source catalog, missing-route report, testing manifest, generated HTTP contracts, suite coverage, and OpenAPI from the integrated tree. The assigned route now moves the current master report from `missing: 824`, `spacebar: 356` to `missing: 823`, `spacebar: 357`.

## Changed Files

- `src/api/routes/consoles/xbox-handoff.ts`
- `test/routes/consolesXboxHandoffRoute.test.ts`
- `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`
- `packages/missing-routes/missing.json`
- `assets/testing-manifest.json`
- `test/generated/http-contracts.json`
- `assets/openapi.json`
- `worker-progress/consoles-xbox-handoff-get.md`

## Commands Run

- `if [ -L node_modules ]; then unlink node_modules; fi; if [ ! -d node_modules ]; then npm ci; fi`
- `npm run build:src:tsgo`
- `npm run build:test-fixtures`
- `node -r dotenv/config -r module-alias/register --enable-source-maps --test dist-test/test/routes/consolesXboxHandoffRoute.test.js`
- `npm run build --workspace @spacebar/automatic-reverse-engineering`
- `node packages/automatic-reverse-engineering/dist/cli.js import-source-routes --root src/api/routes --out packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`
- `npm run build --workspace @spacebar/missing-routes`
- `npm run start --workspace @spacebar/missing-routes`
- `npm run generate:schema`
- `npm run generate:testing-manifest`
- `node scripts/testing-manifest/verify.js`
- `node scripts/testing-manifest/generate-contract-tests.js --check` (first run reported stale contracts)
- `npm run generate:contract-tests`
- `node scripts/testing-manifest/generate-contract-tests.js --check`
- `node scripts/testing-manifest/generate-suite-coverage.js --check`
- `npm run generate:openapi`
- `git diff --check`
- Changed-file malformed AGPL warranty-token scan over in-scope changed/untracked files.

## Evidence Gathered

- Assignment confirmed in `packages/missing-routes/missing.json`: `GET /consoles/xbox-handoff`, route name `XBOX_HANDOFF`, source `xhyrom:data/client/routes.json`.
- Before implementation, `/consoles/xbox-handoff` was absent from `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json` and `src/api/routes/**`.
- Local xHyroM catalog lists `GET`, `HEAD`, and `OPTIONS` for `/consoles/xbox-handoff`; only `GET` was assigned and present in `missing_entries[]`.
- Local Userdoccers route catalog has no exact `/consoles/xbox-handoff` entry. It only has adjacent console device/connect-request routes and `/consoles/xbox/presences`.
- Nearby Spacebar evidence:
    - `src/connections/Xbox/index.ts` can link Xbox accounts through Microsoft OAuth/XSTS, but it does not create a Discord console voice handoff payload.
    - `src/util/entities/ConnectedAccount.ts` provides local account type/revocation state.
    - `src/api/routes/users/@me/connections/#connection_name/#connection_id/access-token.ts` uses existing `UNKNOWN_CONNECTION` and `CONNECTION_REVOKED` semantics for connected accounts.
    - `src/api/middlewares/NoAuthorizationRoutes.ts` does not exempt this route, so normal bearer auth applies.

## Assigned Path

- Assigned path: `/consoles/xbox-handoff`
- Missing methods found: `GET`
- Methods implemented: `GET`
- Adjacent routes intentionally not implemented: Xbox presences, console devices/commands, connect-request, connection callback/session-handoff, account linking, and generic console routes.

## What Changed

- Added `src/api/routes/consoles/xbox-handoff.ts`.
- Added route metadata:
    - `400: APIErrorResponse`
    - `401: APIErrorResponse`
    - `501: APIErrorResponse`
- Kept the route authenticated through normal bearer auth.
- Added local Xbox account lookup constrained to `user_id` and `type: "xbox"`.
- Returns `UNKNOWN_CONNECTION` when the caller has no local Xbox connected account.
- Returns `CONNECTION_REVOKED` when every local Xbox connected account is revoked.
- Returns `501` with code `0` and message `Xbox voice handoff is not supported on this Spacebar instance.` for active local Xbox accounts.
- Added focused compiled route tests for account lookup scope, missing/revoked account errors, unsupported active-account behavior, and metadata.
- Regenerated route source catalog, missing-route report, testing manifest, generated HTTP contracts, and OpenAPI.

## Missing-Route Movement

- Worker-branch before regeneration: `missing: 826`, `spacebar: 354`, `discord: 1128`.
- Worker-branch after regeneration: `missing: 825`, `spacebar: 355`, `discord: 1128`.
- Current-master integration after regeneration: `missing: 823`, `spacebar: 357`, `discord: 1128`.
- `GET /consoles/xbox-handoff` is now present in `routes.source.catalog.json` as `GET_CONSOLES_XBOX_HANDOFF`.
- The assigned `XBOX_HANDOFF` entry is absent from `packages/missing-routes/missing.json`.

## Userdoccers / xHyroM References

- xHyroM local catalog: `packages/automatic-reverse-engineering/data/catalogs/routes.xhyrom.catalog.json`
    - Exact entries: `GET`, `HEAD`, and `OPTIONS` `/consoles/xbox-handoff`, route name `XBOX_HANDOFF`.
- Userdoccers local catalog: `packages/automatic-reverse-engineering/data/catalogs/routes.userdoccers.catalog.json`
    - No exact `/consoles/xbox-handoff` evidence.
    - Adjacent evidence only: console devices/connect-request from `userdoccers:resources/connected-accounts.mdx` and Xbox presences from `userdoccers:resources/presence.mdx`.

## Verification Notes

- Focused compiled route test passed: 7 tests, 0 failures.
- Current-master focused compiled route test passed: 7 tests, 0 failures.
- Current-master testing manifest verified: 462 entries.
- Current-master generated HTTP contracts verified: 437 contracts.
- Generated suite coverage verified.
- Current-master generated HTTP contract and suite coverage static tests passed: 13 tests, 0 failures.
- Current-master OpenAPI regenerated with 282 paths and 716 schemas.
- `git diff --check` passed.
- Malformed AGPL warranty grep returned no matches in changed/untracked in-scope files.
- `npm ci` completed with existing dependency advisories; dependency files were not changed.
- `npm run generate:openapi` still reports existing webhook routes missing route metadata; this is pre-existing and unrelated.

## Risks / Blockers

- Spacebar still lacks the backing model and service integration needed to create real Discord/Xbox voice handoff data. The route therefore returns `501` for otherwise valid local Xbox accounts.
- Clients expecting a real console voice transfer will not complete the flow until a source-backed handoff design exists.
- The route deliberately does not expose connected account tokens and does not call Microsoft/Xbox services.

## Recommended Next Tasks

- Design a real Xbox voice handoff backing model only when source evidence provides request fields, response shape, and token/URL semantics.
- Implement `/connections/{param}/callback/session-handoff` separately if assigned; this worker intentionally did not touch that adjacent route.
- Implement console connect-request and console command routes separately if assigned.
