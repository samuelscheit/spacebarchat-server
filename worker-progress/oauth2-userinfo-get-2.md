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

# Worker Progress: oauth2-userinfo-get-2

## Goal Evidence

- `create_goal`: active goal created for implementing production-ready support for `/oauth2/userinfo` with focused tests, regenerated catalogs/artifacts, verification evidence, and this handoff report.
- `get_goal`: status `active`; objective confirmed as `Implement production-ready support for the missing route path /oauth2/userinfo on the current integration branch, with focused tests, regenerated route catalogs and generated route artifacts, verification evidence, and a complete handoff report.`
- `update_goal`: status `complete`; final tool report said goal achieved, time used `1149` seconds.

## Assignment

- Worker id: `oauth2-userinfo-get-2`
- Assigned path: `/oauth2/userinfo`
- Missing methods found: `GET`
- Methods implemented: `GET`
- Out of scope and not implemented: `/oauth2/keys`, `/oauth2/@me`, `/oauth2/token`, `/oauth2/token/revoke`, `/oauth2/applications/{param}/tokens`, OpenID discovery routes, and other adjacent OAuth2 paths.

## Evidence Gathered

- `packages/missing-routes/missing.json` had exactly one owned missing entry: `GET /oauth2/userinfo`, route name `GET_OAUTH2_USERINFO`, source `userdoccers:topics/oauth2.mdx`, summary `Get OpenID User Information`.
- `routes.source.catalog.json` did not contain `/oauth2/userinfo`; regenerated catalog includes `GET /oauth2/userinfo` from `src/api/routes/oauth2/userinfo.ts` with `APIErrorResponse` and `OAuthUserInfoResponse`.
- `src/api/routes/**` had no existing `/oauth2/userinfo` route before implementation.
- Userdoccers OAuth2 docs list `/oauth2/userinfo` as the UserInfo URL, state that `openid` retrieves basic user information, and document `sub` plus optional `email` and `identify` claims.
- Existing local OAuth2 routes, scoped route helpers, authentication metadata behavior, current-user projections, `User` and `UserSettings` entities, generated route catalog, generated testing manifest, and OpenAPI/schema generation were reviewed.

## Behavior

- Auth mode: bearer-authenticated.
- Route metadata declares `200`, `400`, `401`, and `404`, including explicit `401: { body: "APIErrorResponse" }`.
- Reads the authenticated request user via `req.user_id` and `User.findOneOrFail`.
- If the access token has explicit OAuth scope claims (`scope`, `scopes`, or `scp`), `openid` is required; otherwise the route returns `Missing required OAuth2 scope`.
- If the token has no persisted scope claims, the route conservatively returns only `{ "sub": user.id }`, because Spacebar session tokens do not currently persist durable OAuth grant scopes.
- With `openid identify`, includes locally backed profile claims: `preferred_username`, `nickname: null`, `picture`, and `locale`.
- With `openid email`, includes `email` and `email_verified`.
- Does not fabricate missing scope-specific claims; `nickname` is `null` because Spacebar has no persisted global display-name field on `User`.

## Changed Files

- `src/api/routes/oauth2/userinfo.ts`
- `src/schemas/responses/OAuthUserInfoResponse.ts`
- `src/schemas/responses/index.ts`
- `test/routes/oauth2UserInfoRoute.test.ts`
- `assets/schemas.json`
- `assets/openapi.json`
- `assets/testing-manifest.json`
- `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`
- `packages/missing-routes/missing.json`
- `test/generated/http-contracts.json`
- `test/generated/suite-coverage.json` on the worker base when stale
- `worker-progress/oauth2-userinfo-get-2.md`

## Verification

- Worker-base verification passed: source build, schema generation, test fixture build, focused compiled route tests 11/11, automatic reverse-engineering build and source catalog import, missing-routes build/start, testing manifest generation/verification, generated contract regeneration/check, generated suite coverage regeneration/check, generated contract/suite tests 13/13, OpenAPI generation, `git diff --check`, package manifest/lockfile guard, and malformed warranty-string scan.
- Current-base verification on `cff615aac` passed: `npm run build:src:tsgo`, `npm run generate:schema`, `npm run build --workspace @spacebar/automatic-reverse-engineering`, source catalog import, `npm run build --workspace @spacebar/missing-routes`, `npm run start --workspace @spacebar/missing-routes`, `npm run generate:testing-manifest`, `node scripts/testing-manifest/verify.js`, generated contract regeneration/check, generated suite coverage regeneration/check, `npm run generate:openapi`, `npm run build:test-fixtures`, focused compiled route tests 11/11, generated contract/suite tests 13/13, `git diff --check`, package manifest/lockfile guard, malformed warranty-string scan, and artifact spot-checks for `/oauth2/userinfo/`.

## Missing-Route Movement

- Worker-base movement: `757 -> 756`; implemented count `423 -> 424`.
- Current-base movement after later merges: `742 -> 741`; implemented count `438 -> 439`.

## Risks And Blockers

- Spacebar does not currently persist OAuth2 authorization grants and scopes in a durable grant model, so normal Spacebar session tokens cannot prove `email` or `identify`. The route intentionally returns only `sub` for tokens without explicit OAuth scope claims.
- If a future OAuth2 token implementation persists scopes separately from JWT claims, this route should be wired to that grant store and the conservative fallback can be revisited.
- No blockers remain for orchestrator audit.

## Recommended Next Tasks

- Implement durable OAuth2 access-token/grant persistence so `/oauth2/userinfo` and other OAuth scoped routes can enforce scopes from the authorization store instead of JWT-only claims.
- Continue adjacent missing OAuth2 routes as separate assigned paths, especially `/oauth2/@me` and OpenID discovery if those become assigned.
