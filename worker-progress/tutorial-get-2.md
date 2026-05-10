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

# Worker Progress: tutorial-get-2

## Goal Evidence

- `create_goal`: success.
- `get_goal`: status `active`; objective matched implementing production-ready support for `/tutorial`.
- Final `update_goal(status: "complete")`: status `complete`; final tokens used `1233096`; final time used `1099` seconds.

## Scope And Evidence

- Worker id: `tutorial-get-2`.
- Assigned path: `/tutorial`.
- Missing methods found for exact path: `GET`.
- Expected missing entry confirmed: `GET_TUTORIAL`.
- Source reference confirmed: `userdoccers:resources/user.mdx`.
- Out-of-scope adjacent paths: `/tutorial/indicators/{param}`, `/tutorial/indicators/{indicator}`, `/tutorial/indicators/suppress`.
- Absence confirmation before implementation: no exact `/tutorial` entry in `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`; no `src/api/routes` tutorial file existed.

## Source Evidence

- `packages/missing-routes/missing.json` listed `GET /tutorial`, route name `GET_TUTORIAL`, source `userdoccers:resources/user.mdx`, summary `Get Tutorial`.
- `routes.userdoccers.catalog.json` listed `GET /tutorial`; `routes.xhyrom.catalog.json` listed only adjacent tutorial indicator routes.
- Userdoccers `pages/resources/user.mdx` says `GET /tutorial` returns the current user's tutorial object and returns 204 empty when no tutorial is available.
- Userdoccers gateway event docs define tutorial fields as `indicators_suppressed: boolean` and `indicators_confirmed: array[string]`.
- Local gateway READY currently emits `tutorial: null`, and no persisted tutorial model/fields were found.

## Behavior

- Auth mode: bearer-authenticated. `/tutorial` was not added to no-authorization routes.
- Request body/query: none.
- Success semantics: `200` with `TutorialResponse` when real persisted tutorial progress exists; `204` with no body when no tutorial state is available locally.
- Error semantics: authenticated route metadata includes `401: APIErrorResponse`; global API authentication middleware handles missing/invalid bearer auth.
- Response schema: `TutorialResponse` requires `indicators_suppressed: boolean` and `indicators_confirmed: string[]`.
- Data source: no persisted Spacebar tutorial model or field exists today; current local gateway READY state is `tutorial: null`.

## Changed Files

- `src/api/routes/tutorial.ts`
- `src/schemas/responses/TutorialResponse.ts`
- `src/schemas/responses/index.ts`
- `test/routes/tutorial.test.ts`
- `assets/schemas.json`
- `assets/openapi.json`
- `assets/testing-manifest.json`
- `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`
- `packages/missing-routes/missing.json`
- `test/generated/http-contracts.json`
- `worker-progress/tutorial-get-2.md`

## Verification

- Worker-base verification passed after replacing a temporary symlinked dependency setup with local ignored dependencies: source build, schema generation, automatic reverse-engineering build, source catalog import, missing-routes build/start, testing manifest generation/verification, generated contract regeneration/check, generated suite coverage check, OpenAPI generation, test fixture build, focused compiled route tests 5/5, generated contract/suite tests 13/13, `git diff --check`, package manifest/lockfile guard, and malformed warranty-string scan.
- Current-base verification passed on 2026-05-10 after porting onto `6e4737dbc`: `npm run build:src:tsgo`, `npm run generate:schema`, automatic reverse-engineering build, source catalog import, missing-routes build/start, testing manifest generation/verification, generated contract regeneration/check, generated suite coverage check, OpenAPI generation, test fixture build, focused compiled route tests 5/5, generated contract/suite tests 13/13, `git diff --check`, package manifest/lockfile guard, and malformed warranty-string scan.
- Current-base generated artifact counts: testing manifest `543` entries, generated HTTP contracts `518`, OpenAPI `347` paths / `861` schemas.

## Generated Artifact Evidence

- Source catalog has `GET /tutorial`, route name `GET_TUTORIAL`, source `src/api/routes/tutorial.ts`, response schemas `APIErrorResponse` and `TutorialResponse`.
- `packages/missing-routes/missing.json` no longer has a missing exact-path `GET /tutorial` entry on the worker base.
- OpenAPI `/tutorial/` `GET` has bearer security and responses `200`, `204`, `401`.
- Testing manifest has `api:http:GET:/tutorial/`, auth mode `bearer`, response statuses `200`, `204`, `401`.

## Missing-Route Movement

- Worker-base movement: `755 -> 754`; implemented count `425 -> 426`.
- Current-base movement after later merges: `743 -> 742`; implemented count `437 -> 438`.

## Risks And Blockers

- Spacebar still has no persisted per-user tutorial progress. This implementation intentionally returns `204` rather than inventing progress.
- Adjacent tutorial indicator mutation routes remain out of scope and still missing.
- The gateway READY interface still types `tutorial` narrowly while runtime currently emits `null`; changing gateway tutorial typing/persistence should be handled with a dedicated persistence task.

## Recommended Next Tasks

- Implement persisted tutorial progress storage before returning `200 TutorialResponse` from `GET /tutorial`.
- Add tutorial indicator mutation and suppress routes in separate assigned workers.
- Revisit gateway READY tutorial typing and serialization once persistence exists.
