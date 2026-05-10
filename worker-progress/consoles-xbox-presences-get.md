# GET /consoles/xbox/presences

## Summary

Implemented the assigned `GET /consoles/xbox/presences` route and removed `GET_CONSOLES_XBOX_PRESENCES` from the missing-route report.

The route is authenticated, enforces the source-backed Xbox integration constraints (`activities.read` OAuth scope and Xbox application ID `622174530214821906`), and returns a conservative compatibility response backed by local Spacebar relationship/session/connected-account data. Spacebar does not currently persist Discord's Xbox-specific voice guild/application discovery payloads, so those arrays are returned empty instead of fabricated.

Goal evidence from `get_goal`: status `active`; objective `implement the missing route path GET /consoles/xbox/presences for the Spacebar server API`. Final pane evidence: worker reported goal status `complete`; final goal time used was `986` seconds.

## Changed Files

- `src/api/routes/consoles/xbox/presences.ts`
- `src/schemas/responses/XboxPresencesResponse.ts`
- `src/schemas/responses/index.ts`
- `test/routes/consolesXboxPresencesRoute.test.ts`
- `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`
- `packages/missing-routes/missing.json`
- `assets/schemas.json`
- `assets/testing-manifest.json`
- `assets/openapi.json`
- `test/generated/http-contracts.json`
- `worker-progress/consoles-xbox-presences-get.md`

## Commands Run

- `test -L node_modules && printf 'symlink\n' || printf 'not-symlink-or-missing\n'`
- `test -d node_modules && printf 'present\n' || printf 'missing\n'`
- `npm ci`
- `npm run build:src:tsgo`
- `npm run build:test-fixtures`
- `node -r dotenv/config -r module-alias/register --enable-source-maps --test dist-test/test/routes/consolesXboxPresencesRoute.test.js`
- `npm run build --workspace @spacebar/automatic-reverse-engineering`
- `node packages/automatic-reverse-engineering/dist/cli.js import-source-routes --root src/api/routes --out packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`
- `npm run build --workspace @spacebar/missing-routes`
- `npm run start --workspace @spacebar/missing-routes`
- `npm run generate:schema`
- `npm run generate:testing-manifest`
- `node scripts/testing-manifest/verify.js`
- `node scripts/testing-manifest/generate-contract-tests.js --check` (initially reported stale contracts)
- `npm run generate:contract-tests`
- `node scripts/testing-manifest/generate-contract-tests.js --check`
- `node scripts/testing-manifest/generate-suite-coverage.js --check`
- `npm run generate:openapi`
- `git diff --check`
- Ran the assigned malformed AGPL warranty-token scan across changed `src`, `test`, `packages`, `assets`, `scripts`, `testing`, `tsconfig.test.json`, and `worker-progress` files.

## Evidence Gathered

- Assignment confirmed in `packages/missing-routes/missing.json`: `GET /consoles/xbox/presences`, route name `GET_CONSOLES_XBOX_PRESENCES`.
- Before implementation, the assigned route was absent from `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json` and `src/api/routes/**`.
- Local Userdoccers catalog listed the route from `userdoccers:resources/presence.mdx` with summary `Get Presences for Xbox`.
- Upstream Userdoccers `pages/resources/presence.mdx` documents:
  - the response fields `guilds`, `presences`, `applications`, and `connected_account_ids`;
  - inclusion only for users with activity or returned guilds;
  - Xbox-only use with OAuth2 `activities.read`;
  - Xbox application ID `622174530214821906`.
- Local xHyroM route catalog was checked; it does not provide this exact route, only adjacent Xbox handoff entries.
- Nearby Spacebar patterns used:
  - OAuth scope parsing and error behavior from `src/api/routes/channels/#channel_id/linked-accounts.ts`;
  - connected account visibility filtering from linked-account and connection routes;
  - presence/session privacy handling from gateway presence/session code.

## Assigned Path

- Assigned path: `/consoles/xbox/presences`
- Missing methods found: `GET`
- Methods implemented: `GET`

## What Changed

- Added `GET /consoles/xbox/presences` route metadata with `200` `XboxPresencesResponse`, `400` `APIErrorResponse`, and `401` `APIErrorResponse`.
- Added OAuth checks for `activities.read` and Xbox application ID before any database lookup.
- Returns locally backed presences for non-offline friends that have activities.
- Returns visible, non-revoked Xbox connected account provider IDs only for included presence users.
- Returns empty `guilds` and `applications` arrays because Spacebar lacks exact Xbox-specific voice guild/application backing.
- Added `XboxPresencesResponse` schema and regenerated schema/OpenAPI/testing artifacts.
- Added focused compiled route tests for OAuth rejection, response shape, account visibility scoping, and route metadata.

## Missing-Route Movement

- Before regeneration: `missing: 832`, `spacebar: 348`
- After regeneration: `missing: 831`, `spacebar: 349`
- `GET_CONSOLES_XBOX_PRESENCES` is now present in `routes.source.catalog.json` and absent from `missing_entries[]`.

## Userdoccers / xHyroM References

- Userdoccers local catalog: `packages/automatic-reverse-engineering/data/catalogs/routes.userdoccers.catalog.json`
- Userdoccers upstream source: `https://raw.githubusercontent.com/discord-userdoccers/discord-userdoccers/master/pages/resources/presence.mdx`
- xHyroM local catalog: `packages/automatic-reverse-engineering/data/catalogs/routes.xhyrom.catalog.json`; no exact `/consoles/xbox/presences` entry found.

## Risks / Blockers

- Spacebar does not currently persist Discord's Xbox-specific voice guild stream payload or application discovery payload for this route, so `guilds` and `applications` are intentionally empty.
- Spacebar's own user-token issuer does not model full Discord OAuth2 app-scoped access tokens; this route enforces the documented claims when present and rejects ordinary/non-scoped tokens with Discord OAuth errors.
- No adjacent console device, handoff, generic presence, or Xbox account-linking routes were implemented.

## Recommended Next Tasks

- Implement Xbox-specific console/voice backing only if the adjacent console-device and handoff routes are assigned.
- Add application detail hydration to `applications` if Spacebar introduces a source-backed game application cache for presence activities.
- Implement generic `/presences` separately; this worker intentionally scoped only `/consoles/xbox/presences`.
