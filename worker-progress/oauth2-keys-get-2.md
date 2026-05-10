<!--
	Spacebar: A FOSS re-implementation and extension of the Discord.com backend.
	Copyright (C) 2026 Spacebar and Spacebar Contributors

	This program is free software: you can redistribute it and/or modify
	it under the terms of the GNU Affero General Public License as published
	by the Free Software Foundation, either version 3 of the License, or
	(at your option) any later version.

	This program is distributed in the hope that it will be useful,
	but WITHOUT ANY WARRANTY; without even the implied warranty of
	MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
	GNU Affero General Public License for more details.

	You should have received a copy of the GNU Affero General Public License
	along with this program.  If not, see <https://www.gnu.org/licenses/>.
-->

# Worker Progress: oauth2-keys-get-2

## Goal Evidence

- Worker `create_goal`: created active goal `019e1354-126a-73d0-a25c-3bfa528d13aa`.
- Worker `get_goal`: status `active`; objective `Implement production-ready support for the missing route path `/oauth2/keys` on the current integration branch, with focused tests, regenerated route catalogs and generated route artifacts, verification evidence, and a complete handoff report.`
- Worker `update_goal`: status `complete`; final tool report `tokensUsed: 224718`, `timeUsedSeconds: 197`.

## Assignment

- Worker id: `oauth2-keys-get-2`
- Branch: `codex/current-missing-route-oauth2-keys-get-2`
- Worker integration base: `06fea2581 Implement emoji guild route`
- Current-base port commit under review: `980ba7f40 Implement guild feed message visibility routes`
- Assigned path: `/oauth2/keys`
- Missing methods found: `GET /oauth2/keys`
- Methods implemented: `GET /oauth2/keys`
- Out of scope and not implemented: `/oauth2/token`, `/oauth2/userinfo`, `/oauth2/@me`, `/oauth2/applications/{param}/tokens`, OpenID discovery routes, Samsung/device/provisional OAuth2 paths.

## Evidence

- Current `packages/missing-routes/missing.json` still had exactly one owned missing entry for `/oauth2/keys`: `GET_OAUTH2_KEYS`, source `userdoccers:topics/oauth2.mdx`, summary `Get OpenID Connect Keys`.
- Pre-implementation absence checks found no `GET_OAUTH2_KEYS` or `/oauth2/keys` entry in `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`, and no `src/api/routes/oauth2/keys.ts` in `src/api/routes/**`.
- Local Userdoccers catalog confirms `GET /oauth2/keys`, source `userdoccers:topics/oauth2.mdx`, summary `Get OpenID Connect Keys`. The xHyroM route catalog has no owned `/oauth2/keys` entry.
- Userdoccers OAuth2 docs list `/oauth2/keys` as the JWKS URI, describe it as returning the JSON Web Key Set used to verify OpenID Connect ID tokens, and state `openid` token exchanges can include an ID token.
- RFC 7517 defines a JWK Set as an object with a required `keys` array and requires non-public key material to remain protected from unauthorized disclosure.
- Current Spacebar OAuth2 routes do not issue OpenID ID tokens. `src/util/util/Token.ts` has an internal ES512 keypair for bearer/session and email-action JWTs, but it is not modeled as an OpenID signing-key store and `loadOrGenerateKeypair()` can create key files as a side effect. The route therefore does not expose or generate those keys.

## Behavior

- `GET /oauth2/keys` is public/no-auth.
- Response: `200` JSON body `OAuth2KeysResponse`.
- Runtime body is conservative and source-backed: `{ "keys": [] }`.
- Cache behavior: `Cache-Control: public, max-age=300`.
- Error semantics: no route-specific errors; no `401` metadata because evidence supports a public JWKS endpoint.
- Schema: `OAuth2KeysResponse` contains required `keys: OAuth2JsonWebKey[]`; `OAuth2JsonWebKey` includes public JWK fields and excludes private key fields.

## Changed Files

- `src/api/routes/oauth2/keys.ts`
- `src/schemas/responses/OAuth2KeysResponse.ts`
- `src/schemas/responses/index.ts`
- `src/api/middlewares/NoAuthorizationRoutes.ts`
- `test/routes/oauth2-keys.test.ts`
- `assets/schemas.json`
- `assets/openapi.json`
- `assets/testing-manifest.json`
- `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`
- `packages/missing-routes/missing.json`
- `test/generated/http-contracts.json`
- `test/generated/suite-coverage.json`
- `worker-progress/oauth2-keys-get-2.md`

The worker's old-base `ChannelMessageCreateRoute.ts` and `message-upload.test.ts` build workaround was not ported because current-base verification does not require it.

## Generated Artifacts

- Source catalog has `GET /oauth2/keys`, `GET_OAUTH2_KEYS`, source `src/api/routes/oauth2/keys.ts`, response schema `OAuth2KeysResponse`.
- Testing manifest has `api:http:GET:/oauth2/keys/`, `authMode: "public"`, response body `OAuth2KeysResponse`, status `[200]`.
- OpenAPI has `/oauth2/keys/` GET with `200` response `#/components/schemas/OAuth2KeysResponse` and no `security` block.
- Missing-route count movement after current-base regeneration: `750 -> 749`; implemented route count `430 -> 431`.

## Verification

- Worker verification on old base passed: source build, schema generation, test fixture build, focused route tests, source catalog import, missing-route regeneration, testing manifest checks, generated contract/suite checks and tests, OpenAPI generation, diff checks, package manifest/lockfile cleanliness, and malformed warranty-string scan.
- Current-base `npm run build:src:tsgo`: passed.
- Current-base `npm run generate:schema`: passed and wrote 831 schemas.
- Current-base `npm run build:test-fixtures`: passed after generated artifact refresh.
- Current-base focused compiled test `dist-test/test/routes/oauth2-keys.test.js`: passed, 5/5.
- Current-base automatic reverse engineering build and source route import: passed.
- Current-base missing-routes build/start: passed, `750 -> 749` missing and `430 -> 431` implemented.
- Current-base testing manifest generation/verification: passed with 536 entries.
- Current-base contract generation/check: passed with 511 contracts.
- Current-base suite coverage generation/check: passed with 15 suites.
- Current-base generated contract/suite tests: passed, 13/13.
- Current-base OpenAPI generation: passed with 341 paths and 831 schemas; existing webhook metadata warnings only.
- Current-base `git diff --check`: passed.
- Current-base package manifest/lockfile cleanliness check: passed.
- Current-base malformed warranty-string scan: passed.

## Risks And Next Tasks

- Conservative empty JWKS is correct for the current source state, but future OpenID ID-token support should add a dedicated signing-key store and then populate this endpoint with public JWKs from that store.
- Do not reuse the existing bearer/session JWT keypair for this endpoint unless the OAuth2 implementation explicitly uses it for OpenID ID tokens and documents that contract.
- Recommended next task: implement `/oauth2/token` and `/oauth2/userinfo` separately if assigned, including full OAuth2/OpenID grant, scope, token, and error behavior.
