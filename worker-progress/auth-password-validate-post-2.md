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

# Worker Progress: auth-password-validate-post-2

## Goal

- Status: active
- Objective: Implement production-ready `POST` support for `/auth/password/validate` on the current integration branch, with focused tests, regenerated route catalogs and generated route artifacts, verification evidence, and a complete handoff report.
- Goal evidence: `get_goal` returned active status for this objective after setup and again before handoff report update.

## Assignment

- Route id: `auth-password-validate-post-2`
- Assigned path: `/auth/password/validate`
- Owned method: `POST`
- Missing entry found before implementation: `POST /auth/password/validate`, route name `POST_AUTH_PASSWORD_VALIDATE`, source `userdoccers:authentication.mdx`, summary `Get Password Strength`
- Initial missing count: `786`
- Regenerated missing count: `785`
- Missing-count movement: `-1`
- Orchestrator current-base regeneration after port: `missing = 781 -> 780`, `spacebar = 399 -> 400`.

## References Used

- Userdoccers docs page: `https://docs.discord.food/authentication#get-password-strength`
- Userdoccers source file: `discord-userdoccers/pages/authentication.mdx`
- Local Userdoccers catalog: `packages/automatic-reverse-engineering/data/catalogs/routes.userdoccers.catalog.json`
- Existing auth/no-auth patterns: `src/api/routes/auth/register.ts`, `src/api/middlewares/NoAuthorizationRoutes.ts`, `src/api/middlewares/Authentication.test.ts`
- Existing password policy helper: `src/api/util/utility/passwordStrength.ts`

## Summary

Implemented `POST /auth/password/validate` as an unauthenticated auth compatibility endpoint. The route validates a JSON body with `password`, uses the existing registration password policy helper to compute `valid`, maps the existing bounded strength calculation to Discord-style integer `password_strength` in `[0, 4]`, and returns `200` with `PasswordValidateResponse`.

The route is registered as public in `NO_AUTHORIZATION_ROUTES`, has strict non-coercing request validation, and does not touch registration, login, reset, MFA, or persistence flows.

## Changed Files

- Added `src/api/routes/auth/password/validate.ts`
- Added `src/schemas/uncategorised/PasswordValidateSchema.ts`
- Added `src/schemas/responses/PasswordValidateResponse.ts`
- Updated `src/api/middlewares/NoAuthorizationRoutes.ts`
- Updated `src/api/middlewares/Authentication.test.ts`
- Updated schema export indices under `src/schemas/**/index.ts`
- Added focused tests in `test/routes/authPasswordValidateRoute.test.ts`
- Regenerated `assets/schemas.json`
- Regenerated `assets/openapi.json`
- Regenerated `assets/testing-manifest.json`
- Regenerated `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`
- Regenerated `packages/missing-routes/missing.json`
- Regenerated `test/generated/http-contracts.json`
- Regenerated `test/generated/suite-coverage.json`

## Artifact Status

- Source route catalog now contains `POST_AUTH_PASSWORD_VALIDATE` with request schema `PasswordValidateSchema` and response schemas `APIErrorResponse`, `PasswordValidateResponse`.
- Missing-route report removed `/auth/password/validate` from `routes[]` and `missing_entries[]`.
- Testing manifest now has `api:http:POST:/auth/password/validate/` with `authMode: public`.
- Generated HTTP contracts include the new public route and invalid-body case.
- Suite coverage includes the new auth-scenario route.
- OpenAPI includes `/auth/password/validate/` without bearer security and with the new request/response schema refs.
- `assets/schemas.json` includes `PasswordValidateSchema` and `PasswordValidateResponse`.

## Commands And Evidence

- `npm run build:src:tsgo` failed before route-specific compilation completed with existing out-of-scope error:
  `src/api/util/handlers/ChannelMessageCreateRoute.ts(56,14): error TS2883: The inferred type of 'createMessageUploadHandler' cannot be named without a reference to 'ParsedQs' from '../../../../../../server/node_modules/@types/qs'.`
- `npm run generate:schema` passed.
- `TS_NODE_TRANSPILE_ONLY=1 node --preserve-symlinks -r dotenv/config -r ts-node/register/transpile-only -r module-alias/register --enable-source-maps --test test/routes/authPasswordValidateRoute.test.ts src/api/middlewares/Authentication.test.ts src/api/util/utility/passwordStrength.test.ts` passed: 39 tests.
- `npm run build --workspace @spacebar/automatic-reverse-engineering` passed.
- `node packages/automatic-reverse-engineering/dist/cli.js import-source-routes --root src/api/routes --out packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json` passed.
- `npm run build --workspace @spacebar/missing-routes` passed.
- `npm run start --workspace @spacebar/missing-routes` passed: `Spacebar is missing 785`, `Spacebar implements 395`.
- `npm run generate:testing-manifest` passed: 500 entries.
- `node scripts/testing-manifest/verify.js` passed.
- `node scripts/testing-manifest/generate-contract-tests.js --check` initially reported stale contracts.
- `npm run generate:contract-tests` passed: 475 contracts.
- `node scripts/testing-manifest/generate-contract-tests.js --check` passed.
- `node scripts/testing-manifest/generate-suite-coverage.js --check` initially reported stale suite coverage.
- `npm run generate:suite-coverage` passed: 15 suites.
- `node scripts/testing-manifest/generate-suite-coverage.js --check` passed.
- `NODE_OPTIONS=--preserve-symlinks npm run generate:openapi` passed: 314 paths and 790 schemas.
- Completion audit script passed all route/artifact checks.
- `git diff --check` passed.

Orchestrator current-base verification after port:

- `npm run build:src:tsgo`: passed.
- `npm run generate:schema`: passed, wrote `794` schemas including `PasswordValidateSchema` and `PasswordValidateResponse`.
- `npm run build:test-fixtures`: passed.
- Focused compiled auth/password tests: passed, `39/39` tests.
- `npm run build --workspace @spacebar/automatic-reverse-engineering`: passed.
- Source route catalog import: passed.
- `npm run build --workspace @spacebar/missing-routes`: passed.
- `npm run start --workspace @spacebar/missing-routes`: passed, wrote `missing = 780` and `spacebar = 400`.
- `npm run generate:testing-manifest`: passed, wrote `505` entries.
- `node scripts/testing-manifest/verify.js`: passed.
- Generated HTTP contracts were stale, then regenerated and verified with `480` contracts.
- Generated suite coverage was stale, then regenerated and verified with `15` suites.
- `npm run generate:openapi`: passed, wrote `317` paths and `794` schemas; only pre-existing webhook route-metadata warnings appeared.
- Generated static tests: passed, `13/13`.
- Package manifest/lockfile guard: passed.
- `git diff --check`: passed.
- Malformed warranty-token scan over changed/untracked scoped files: no findings.

## Notes

- A local `node_modules` symlink to `/Users/user/Developer/Developer/spacebarchat/server/node_modules` was created for verification only. It is ignored and not part of the scoped diff.
- Because the symlink points at another checkout, direct `module-alias/register` resolves `@spacebar/*` to the shared server checkout unless Node is run with `--preserve-symlinks`. Focused route tests and OpenAPI generation used `--preserve-symlinks` to verify this worktree's artifacts.

## Risks Or Blockers

- `npm run build:src:tsgo` remains blocked by an existing project-wide portable inferred type error in `ChannelMessageCreateRoute.ts`, unrelated to this route.
- The route intentionally uses the current local password-strength helper; the exact scoring algorithm is Spacebar's existing bounded entropy/policy implementation, not a new zxcvbn dependency.

## Recommended Next Tasks

- Fix or annotate `createMessageUploadHandler` in `src/api/util/handlers/ChannelMessageCreateRoute.ts` so `npm run build:src:tsgo` can pass in symlinked worktrees.
- Consider a broader product decision on whether password strength scoring should be zxcvbn-compatible in a separate, non-route-scoped task.

## Completion Audit

- Assigned missing entry derived: yes.
- Source catalog and route tree absence confirmed before implementation: yes.
- Correct auth mode determined from Userdoccers and local no-auth auth route patterns: unauthenticated/public.
- Production behavior implemented: yes.
- Focused route/schema/auth tests added and passing: yes.
- Required generated artifacts regenerated: yes.
- Missing-route count movement verified: `786 -> 785`.
- Diff hygiene checked: yes.
