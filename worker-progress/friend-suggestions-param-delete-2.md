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

# Worker Progress: friend-suggestions-param-delete-2

## Goal

- Status at setup: active.
- Objective: Implement production-ready DELETE support for `/friend-suggestions/{param}` on the current integration branch, with focused tests, regenerated route catalogs and generated route artifacts, verification evidence, and a complete handoff report.
- Goal evidence: `create_goal` was called before file reads or commands. `get_goal` immediately after setup showed status `active`, objective unchanged. Latest pre-completion `get_goal` showed status `active`, objective unchanged, tokens used `234168`, time used `457s`.

## Scope

- Assigned path: `/friend-suggestions/{param}`.
- Owned method: `DELETE`.
- Missing entry found at start: `DELETE /friend-suggestions/{param}` (`DELETE_FRIEND_SUGGESTIONS_USER_ID`) from `userdoccers:resources/relationships.mdx` and `xhyrom:data/client/routes.json`.
- Existing sibling preserved: `GET /friend-suggestions` in `src/api/routes/friend-suggestions.ts`.

## Evidence Gathered

- `packages/missing-routes/missing.json` initially contained the owned `DELETE_FRIEND_SUGGESTIONS_USER_ID` entry for `/friend-suggestions/{param}`.
- `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json` initially contained only `GET /friend-suggestions` for this route family.
- `packages/automatic-reverse-engineering/data/catalogs/routes.userdoccers.catalog.json` lists `DELETE /friend-suggestions/{user_id}` as "Remove Friend Suggestion".
- `packages/automatic-reverse-engineering/data/catalogs/routes.xhyrom.catalog.json` lists `DELETE /friend-suggestions/{param}` as `FRIEND_SUGGESTION`.
- Userdoccers raw source used: `https://raw.githubusercontent.com/discord-userdoccers/discord-userdoccers/master/pages/resources/relationships.mdx`; it documents a 204 empty success for removing a friend suggestion and says success fires Friend Suggestion Delete.
- Userdoccers gateway source used: `https://raw.githubusercontent.com/discord-userdoccers/discord-userdoccers/master/pages/gateway/gateway-events.mdx`; it defines `FRIEND_SUGGESTION_DELETE` with `suggested_user_id`.
- Backing gap: Spacebar still has no durable friend-suggestion/contact-social-graph persistence. The route therefore acknowledges deletion and emits the documented client invalidation without pretending a local suggestion row exists.

## Implementation Summary

- Extended `src/api/routes/friend-suggestions.ts` with authenticated `DELETE /:user_id`.
- Added explicit route metadata: summary, `204`, and `401: APIErrorResponse`.
- Added `deleteFriendSuggestion(userId, suggestedUserId, emit)` to send `FRIEND_SUGGESTION_DELETE` for the current user with the documented `suggested_user_id` payload.
- Added `FriendSuggestionDeleteEvent` to gateway event typings, `EVENTEnum`, and `EVENT_NAMES`.
- Extended focused route tests for metadata, auth classification, 204 behavior, and event emission.
- Extended gateway event declaration tests for the new event name and payload shape.

## Changed Files

- `src/api/routes/friend-suggestions.ts`
- `src/api/routes/friend-suggestions.test.ts`
- `src/util/interfaces/Event.ts`
- `src/util/interfaces/Event.test.ts`
- `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`
- `packages/missing-routes/missing.json`
- `assets/testing-manifest.json`
- `test/generated/http-contracts.json`
- `assets/openapi.json`
- `worker-progress/friend-suggestions-param-delete-2.md`

## Regeneration Results

- Source route catalog: regenerated; now includes `DELETE /friend-suggestions/{user_id}` with `DELETE_FRIEND_SUGGESTIONS_USER_ID`.
- Missing-route report: worker-base regeneration moved `779 -> 778`; orchestrator current-base regeneration moved `778 -> 777`, Spacebar implemented count moved `402 -> 403`, Discord count stayed `1128`.
- Testing manifest: regenerated and verified; includes `api:http:DELETE:/friend-suggestions/:user_id` with `FRIEND_SUGGESTION_DELETE`.
- HTTP contracts: stale on first check, regenerated and verified; includes event-emission coverage for the new route.
- Suite coverage: checked and already current.
- OpenAPI: regenerated; includes `/friend-suggestions/{user_id}` with `204` and `401` responses.
- Schema generation: not run because no schema files or schema assets were changed.

## Commands And Results

- `npm run build:src:tsgo` - passed on the orchestrator current checkout after port.
- `npm run build:test-fixtures` - passed.
- `TS_NODE_TRANSPILE_ONLY=1 node -r dotenv/config -r ts-node/register/transpile-only -r module-alias/register --enable-source-maps --test src/api/routes/friend-suggestions.test.ts src/schemas/responses/FriendSuggestionsResponse.test.ts src/util/interfaces/Event.test.ts` - passed.
- `npm run build --workspace @spacebar/automatic-reverse-engineering` - passed.
- `node packages/automatic-reverse-engineering/dist/cli.js import-source-routes --root src/api/routes --out packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json` - passed.
- `npm run build --workspace @spacebar/missing-routes` - passed.
- `npm run start --workspace @spacebar/missing-routes` - passed.
- `npm run generate:testing-manifest` - passed.
- `node scripts/testing-manifest/verify.js` - passed.
- `node scripts/testing-manifest/generate-contract-tests.js --check` - first reported stale `test/generated/http-contracts.json`.
- `npm run generate:contract-tests` - passed.
- `node scripts/testing-manifest/generate-contract-tests.js --check` - passed after regeneration.
- `node scripts/testing-manifest/generate-suite-coverage.js --check` - passed.
- `node --test test/generated/http-contracts.test.js test/generated/suite-coverage.test.js` - passed.
- `npm run generate:openapi` - passed with pre-existing webhook route-metadata warnings.
- `git diff --check` - passed.
- Package/lockfile guard - passed; no package manager metadata changed.
- Malformed warranty-token scan over changed scoped files - passed.

## Risks And Blockers

- Friend suggestions are not persisted in this Spacebar tree. The route is intentionally an idempotent compatibility acknowledgement plus gateway invalidation, not a durable data mutation.
- If Spacebar later adds contact-sync or suggestion persistence, `deleteFriendSuggestion` should remove the persisted suggestion and emit only for an actual state change if that matches observed Discord behavior.

## Recommended Next Tasks

- Add a real friend-suggestion persistence/source model when Spacebar supports contact sync or social graph suggestions.
- Revisit `GET /friend-suggestions` and this `DELETE` route together once that persistence exists.

## Prompt-To-Artifact Completion Audit

- Confirmed all current missing entries for `/friend-suggestions/{param}`: complete.
- Confirmed the assigned method was absent from source catalog and source routes before editing: complete.
- Compared Userdoccers, gateway event, and xHyroM evidence for the assigned route: complete.
- Implemented only `DELETE /friend-suggestions/{param}` route family support: complete.
- Preserved existing `GET /friend-suggestions`: complete.
- Added explicit authenticated `401` metadata: complete.
- Added focused route and event declaration tests: complete and passing.
- Regenerated source catalog, missing-route report, testing manifest, HTTP contracts, and OpenAPI: complete.
- Verified generated contract and suite coverage checks: complete.
- Left the worktree with only scoped intentional changes and did not commit or push: complete.
