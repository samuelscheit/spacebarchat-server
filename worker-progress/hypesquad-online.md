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

# HypeSquad Online Worker Handoff

## Goal Evidence

- Initial goal status recorded before project file reads: `active`.
- Initial goal objective recorded before project file reads: `Implement production-ready support for the assigned missing route path /hypesquad/online on this worker branch, including all missing methods for that exact path, focused tests, regenerated route catalogs and generated route artifacts, verification evidence, and a complete handoff report.`
- Worker goal was marked complete after the handoff report and worker verification finished.

## Scope

- Assigned path: `/hypesquad/online`.
- Missing methods found in `packages/missing-routes/missing.json` before implementation:
  - `DELETE /hypesquad/online` (`DELETE_HYPESQUAD_ONLINE`, "Leave HypeSquad Online")
  - `POST /hypesquad/online` (`POST_HYPESQUAD_ONLINE`, "Join HypeSquad Online")
- Confirmed absent before implementation:
  - `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`: no `hypesquad` entries.
  - `src/api/routes`: no `hypesquad` route files.
- Scope boundaries honored: no adjacent HypeSquad, profile, premium, relationship, or package-manager files were modified.

## Source References Used

- Userdoccers live docs: `https://docs.discord.food/resources/user#join-hypesquad-online` and `#leave-hypesquad-online`.
  - POST joins a HypeSquad house, applies the relevant user flag, accepts `house_id`, returns `204`, and fires `USER_UPDATE`.
  - DELETE leaves the current user's HypeSquad house, removes the relevant user flag, returns `204`, and fires `USER_UPDATE`.
  - House IDs: `1` Bravery, `2` Brilliance, `3` Balance.
  - User flags: `1 << 6`, `1 << 7`, `1 << 8` are public HypeSquad house flags.
- Local Userdoccers catalog: `packages/automatic-reverse-engineering/data/catalogs/routes.userdoccers.catalog.json` entries for both methods.
- Local xHyroM catalog: `packages/automatic-reverse-engineering/data/catalogs/routes.xhyrom.catalog.json` entries for `DELETE`, `OPTIONS`, and `POST /hypesquad/online`.
- Source refs: `userdoccers_commit=259d8f8cf97ff357c4d1255afdf30e2e05672742`, `xhyrom_routes_commit=0d792408fc6f5f67140fe1b4cad48b386ae1fd44`.
- Spacebar implementation patterns:
  - User mutations and `emitUserUpdateEvents`: `src/api/routes/users/@me/index.ts`, `src/api/util/UserUpdateEvents.ts`.
  - User flag constants: `src/schemas/api/users/User.ts`.

## Behavior Implemented

- Added `src/api/routes/hypesquad/online.ts`.
- `POST /hypesquad/online/`:
  - Bearer-authenticated by default.
  - Validates `HypeSquadOnlineCreateSchema` with non-coercing AJV.
  - Accepts only `house_id` values `1`, `2`, or `3`.
  - Clears all HypeSquad Online house bits, sets the selected house bit, and preserves unrelated flags.
  - Updates both `flags` and `public_flags` so private `/users/@me` and public/gateway user payloads stay consistent.
  - Saves the user, emits via `emitUserUpdateEvents`, and returns `204`.
- `DELETE /hypesquad/online/`:
  - Bearer-authenticated by default.
  - Clears only the three HypeSquad Online house bits from both `flags` and `public_flags`.
  - Saves the user, emits via `emitUserUpdateEvents`, and returns `204`.
- Route metadata explicitly declares `401: { body: "APIErrorResponse" }`.
- Route metadata declares `USER_UPDATE` and `GUILD_MEMBER_UPDATE`; Userdoccers only names `USER_UPDATE`, but Spacebar's established `emitUserUpdateEvents` helper emits member updates for public user changes as well.

## Changed Files

- `src/api/routes/hypesquad/online.ts`
- `src/schemas/uncategorised/HypeSquadOnlineCreateSchema.ts`
- `src/schemas/uncategorised/index.ts`
- `test/routes/hypesquadOnlineRoute.test.ts`
- `assets/schemas.json`
- `assets/openapi.json`
- `assets/testing-manifest.json`
- `test/generated/http-contracts.json`
- `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`
- `packages/missing-routes/missing.json`
- `worker-progress/hypesquad-online.md`

## Generated Evidence

- Source route catalog now includes:
  - `DELETE /hypesquad/online` from `src/api/routes/hypesquad/online.ts`
  - `POST /hypesquad/online` from `src/api/routes/hypesquad/online.ts` with `HypeSquadOnlineCreateSchema`
- Testing manifest now includes:
  - `api:http:DELETE:/hypesquad/online/`
  - `api:http:POST:/hypesquad/online/`
- HTTP contracts now include both methods with bearer auth, 401 responses, event metadata, and POST request-body validation.
- OpenAPI now includes `/hypesquad/online/` with POST and DELETE operations.
- Missing-route count movement:
  - Before on accepted current base: `792` missing / `388` implemented.
  - After on accepted current base: `790` missing / `390` implemented.
  - `/hypesquad/online` no longer appears in `missing.json`.

## Commands Run

- `npm run build:src:tsgo` - passed.
- `npm run generate:schema` - passed; schema output contains 761 schemas.
- `npm run build:test-fixtures` - passed.
- `node -r dotenv/config -r module-alias/register --enable-source-maps --test dist-test/test/routes/hypesquadOnlineRoute.test.js` - passed, 7 tests.
- `npm run build --workspace @spacebar/automatic-reverse-engineering` - passed.
- `node packages/automatic-reverse-engineering/dist/cli.js import-source-routes --root src/api/routes --out packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json` - passed.
- `npm run build --workspace @spacebar/missing-routes` - passed.
- `npm run start --workspace @spacebar/missing-routes` - passed; wrote `missing.json` with `790` missing / `390` implemented.
- `npm run generate:testing-manifest` - passed; 495 entries.
- `node scripts/testing-manifest/verify.js` - passed; 495 entries.
- `npm run generate:contract-tests` - passed; 470 contracts.
- `node scripts/testing-manifest/generate-contract-tests.js --check` - passed; 470 contracts.
- `npm run generate:suite-coverage` - passed; 15 suites.
- `node scripts/testing-manifest/generate-suite-coverage.js --check` - passed.
- `node --test test/generated/http-contracts.test.js test/generated/suite-coverage.test.js` - passed, 13 tests.
- `npm run generate:openapi` - passed and wrote 309 paths / 761 schemas; existing webhook route() warnings remain unrelated.
- `node scripts/testing-manifest/generate-contract-tests.js --check` - passed after OpenAPI generation.
- `node scripts/testing-manifest/generate-suite-coverage.js --check` - passed after OpenAPI generation.
- `git diff --check` - passed.
- `git diff -- package.json package-lock.json npm-shrinkwrap.json pnpm-lock.yaml yarn.lock --exit-code` - passed.
- Changed-file malformed warranty scan - passed.

## Risks And Blockers

- No blocker remains.
- The implementation uses focused mocked route tests rather than a live database integration scenario. The route behavior is small and follows existing current-user mutation patterns.
- Event metadata includes `GUILD_MEMBER_UPDATE` because the shared Spacebar helper emits it for public user data changes. This is intentionally broader than the Userdoccers sentence that only calls out `USER_UPDATE`.

## Recommended Next Tasks

- Orchestrator merge review for this isolated branch.
- Continue with unrelated missing-route assignments after merge; no adjacent HypeSquad route was taken here.
