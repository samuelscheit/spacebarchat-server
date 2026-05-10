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

# users-me-consumable-confetti-get

## Summary

Implemented the assigned `/users/@me/consumable/confetti` path and repaired the authenticated-route metadata audit finding.

The original route implementation added bearer-authenticated `GET` and `POST` handlers. The audit repair adds explicit `401: { body: "APIErrorResponse" }` metadata to both handlers and strengthens focused tests so generated OpenAPI must expose bearer security and the expected `200`/`204`/`400`/`401` response metadata.

Spacebar still has no durable consumable inventory or confetti application state. The route therefore keeps the conservative compatibility read response and rejects applies with Discord's existing `UNKNOWN_ENTITLEMENT` error instead of fabricating message mutation, inventory decrement, or gateway side effects.

## Changed Files

- `assets/openapi.json`
- `assets/schemas.json`
- `assets/testing-manifest.json`
- `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`
- `packages/missing-routes/missing.json`
- `src/api/routes/users/@me/consumable/confetti.ts`
- `src/api/util/index.ts`
- `src/api/util/utility/ConfettiConsumable.test.ts`
- `src/api/util/utility/ConfettiConsumable.ts`
- `src/schemas/responses/ConfettiConsumableResponse.ts`
- `src/schemas/responses/index.ts`
- `src/schemas/uncategorised/ConfettiConsumableApplySchema.ts`
- `src/schemas/uncategorised/index.ts`
- `test/generated/http-contracts.json`
- `test/generated/suite-coverage.json`
- `tsconfig.test.json`
- `worker-progress/users-me-consumable-confetti-get.md`

## Assigned Path

- Assigned path: `/users/@me/consumable/confetti`
- Missing methods found: `GET_USERS__ME_CONSUMABLE_CONFETTI`, `POST_USERS__ME_CONSUMABLE_CONFETTI`
- Methods implemented: `GET`, `POST`

## Audit Repair

- Added explicit `401: { body: "APIErrorResponse" }` route metadata to `GET /users/@me/consumable/confetti/`.
- Added explicit `401: { body: "APIErrorResponse" }` route metadata to `POST /users/@me/consumable/confetti/`.
- Added a focused compiled assertion that generated OpenAPI exposes:
  - `GET` bearer security, `200 ConfettiConsumableResponse`, and `401 APIErrorResponse`.
  - `POST` bearer security, `ConfettiConsumableApplySchema` request body, `204`, `400 APIErrorResponse`, and `401 APIErrorResponse`.
- Auth metadata decision: both handlers remain normal bearer-authenticated API routes. The repair documents the unauthenticated failure shape in route metadata only; it does not change runtime authentication behavior.

## Missing Route Count Movement

- Before branch regeneration: `missing = 847`, `spacebar = 333`
- After regeneration: `missing = 845`, `spacebar = 335`
- Current regenerated `packages/missing-routes/missing.json` has `0` entries whose `route` is `/users/@me/consumable/confetti`.

## Evidence Gathered

- `packages/missing-routes/missing.json` originally contained:
  - `GET /users/@me/consumable/confetti`
  - `POST /users/@me/consumable/confetti`
- `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json` originally had no `consumable/confetti` entries.
- `src/api/routes/**` originally had no `consumable/confetti` route.
- Regenerated source route catalog now contains both assigned methods from `src/api/routes/users/@me/consumable/confetti.ts`.
- Regenerated source route catalog now records `APIErrorResponse` for both confetti methods.
- Regenerated testing manifest now records both confetti routes with `authMode: "bearer"`.
- Regenerated testing manifest now records `GET` response statuses `[200, 401]` with `APIErrorResponse` and `ConfettiConsumableResponse`.
- Regenerated testing manifest now records `POST` response statuses `[204, 400, 401]` with `APIErrorResponse`.
- Regenerated OpenAPI now exposes `/users/@me/consumable/confetti/` with bearer security on both methods and `401 APIErrorResponse` on both methods.
- Regenerated generated HTTP contracts now include route metadata statuses `[200, 401]` for `GET` and `[204, 400, 401]` for `POST`.

## Userdoccers And xHyroM References

- Userdoccers `pages/resources/store.mdx` from `https://raw.githubusercontent.com/discord-userdoccers/discord-userdoccers/master/pages/resources/store.mdx`
  - `GET /users/@me/consumable/confetti`: returns active confetti potion entitlement and `num_potions`.
  - `POST /users/@me/consumable/confetti`: applies a confetti potion to a message, returns `204`, and fires `Message Update` on success.
- Local Userdoccers route catalog: `packages/automatic-reverse-engineering/data/catalogs/routes.userdoccers.catalog.json`
  - `GET_USERS__ME_CONSUMABLE_CONFETTI`
  - `POST_USERS__ME_CONSUMABLE_CONFETTI`
- Local xHyroM route catalog: `packages/automatic-reverse-engineering/data/catalogs/routes.xhyrom.catalog.json`
  - No matching `consumable/confetti` route entry.
- Local xHyroM experiments catalog: `packages/automatic-reverse-engineering/data/catalogs/experiments.xhyrom.catalog.json`
  - `2024-12_confetti_potion` confirms confetti potion is experiment-gated client behavior.

## Commands Run

- `create_goal` with objective `address authenticated-route metadata audit findings for /users/@me/consumable/confetti`: succeeded.
- `get_goal`: succeeded; status `active`, same objective.
- `npm run build:src:tsgo`: passed.
- `npm run build --workspace @spacebar/automatic-reverse-engineering`: passed.
- `node packages/automatic-reverse-engineering/dist/cli.js import-source-routes --root src/api/routes --out packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`: passed.
- `npm run build --workspace @spacebar/missing-routes`: passed.
- `npm run start --workspace @spacebar/missing-routes`: passed; wrote `missing = 845`, `spacebar = 335`.
- `npm run generate:testing-manifest`: passed; wrote 440 entries.
- `node scripts/testing-manifest/verify.js`: passed; verified 440 entries.
- `node scripts/testing-manifest/generate-contract-tests.js --check`: first reported stale generated contracts after the metadata repair.
- `npm run generate:contract-tests`: passed; wrote 415 contracts.
- `node scripts/testing-manifest/generate-contract-tests.js --check`: passed; verified 415 contracts.
- `node scripts/testing-manifest/generate-suite-coverage.js --check`: passed.
- `npm run generate:schema`: passed; wrote 673 schemas.
- `npm run generate:openapi`: passed; wrote 259 paths and 673 schemas. The generator still reports 3 unrelated existing webhook routes missing route metadata.
- `npm run build:test-fixtures`: passed.
- `node -r dotenv/config -r module-alias/register --enable-source-maps --test dist-test/src/api/util/utility/ConfettiConsumable.test.js`: passed; 7 tests.
- `git diff --check`: passed.
- `git status --short package.json package-lock.json`: passed with no output.
- Changed-file warranty text scan: passed for 17 text files. Scan details intentionally omit the literal typo pattern.

## Verification Result

- `GET /users/@me/consumable/confetti/` route metadata includes `200 ConfettiConsumableResponse` and `401 APIErrorResponse`.
- `POST /users/@me/consumable/confetti/` route metadata includes `204`, `400 APIErrorResponse`, and `401 APIErrorResponse`.
- OpenAPI exposes bearer security for both confetti methods.
- OpenAPI exposes `401 APIErrorResponse` for both confetti methods.
- Focused compiled test suite passes: 7 tests.
- Testing manifest verify passes.
- Generated contract matrix check passes.
- Generated suite coverage check passes.
- Package manifest and lockfile are clean.
- Changed-file warranty text scan passes.

## Orchestrator Current-Base Acceptance

- Ported only source, schema, focused test, config, and report changes onto `9f0385356`.
- Regenerated generated artifacts on the current main checkout rather than copying stale worker artifacts.
- Resolved current-base conflicts in `src/schemas/responses/index.ts` and `tsconfig.test.json` by preserving existing entries and adding the confetti export/test entry.
- Current-base missing-route movement: `757 -> 755` missing and `423 -> 425` implemented.
- Current-base generated artifacts: testing manifest `530` entries, generated HTTP contracts `505` contracts, OpenAPI `338` paths and `826` schemas.
- Current-base verification passed:
  - `npm run build:src:tsgo`
  - `npm run generate:schema`
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
  - `npm run build:test-fixtures`
  - `npm run generate:openapi`
  - `node -r dotenv/config -r module-alias/register --enable-source-maps --test dist-test/src/api/util/utility/ConfettiConsumable.test.js`
  - `node --test test/generated/http-contracts.test.js test/generated/suite-coverage.test.js`

## Risks And Blockers

- Spacebar still lacks durable confetti consumable inventory and no model exists to decrement potions.
- The `POST` route intentionally does not mutate messages or emit `Message Update` until inventory and side-effect semantics exist.
- `GET` returns `{ entitlement: null, num_potions: 0 }`, which is conservative and safe but does not represent purchased consumables.

## Recommended Next Tasks

- Add a durable consumable entitlement/inventory model before implementing successful `POST` application behavior.
- Once inventory exists, wire confetti application to message state and `Message Update` gateway emission.
- Keep `/users/@me/consumable/hd-streaming` as a separate route assignment because it has channel-specific side effects.

## Goal Status Evidence

- `create_goal` objective: `address authenticated-route metadata audit findings for /users/@me/consumable/confetti`.
- Initial `get_goal`: status `active`, same objective, thread `019e1184-b48c-7c82-b586-b8b89ec336a7`.
- Latest pre-report `get_goal`: status `active`, same objective, thread `019e1184-b48c-7c82-b586-b8b89ec336a7`.
- Final `update_goal(status: "complete")`: status `complete`, time used `351` seconds, thread `019e1184-b48c-7c82-b586-b8b89ec336a7`.

## Tmux

- Worker tmux session left open for orchestrator audit.
