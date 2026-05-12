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

# Worker Progress: users-me-phone-delete

## Summary

- Assigned route: `DELETE /users/@me/phone`.
- Assigned route name: `DELETE_USERS__ME_PHONE`.
- Implemented only the assigned DELETE method.
- Behavior: validates authenticated JSON body with `password` and documented `change_phone_reason`; verifies the current password when one exists; sets a password for passwordless accounts before removal following the documented phone-removal note and existing `PATCH /users/@me` convention; clears only `User.phone`; emits `USER_UPDATE`; returns `204`.
- Preserved email verification, MFA/TOTP/WebAuthn fields, disabled/deleted state, account deletion routes, and adjacent phone verification flows.

## Changed Files

- `src/api/routes/users/@me/phone.ts`
- `src/schemas/uncategorised/UserPhoneRemoveSchema.ts`
- `src/schemas/uncategorised/index.ts`
- `test/routes/usersMePhoneRoute.test.ts`
- `assets/schemas.json`
- `assets/openapi.json`
- `assets/testing-manifest.json`
- `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`
- `packages/missing-routes/missing.json`
- `test/generated/http-contracts.json`
- `test/generated/suite-coverage.json`
- `worker-progress/users-me-phone-delete.md`

## Evidence

- `packages/missing-routes/missing.json` initially had two `/users/@me/phone` entries: assigned `DELETE_USERS__ME_PHONE` and adjacent `POST_USERS__ME_PHONE`.
- `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json` initially had no `/users/@me/phone` source route entry.
- `packages/automatic-reverse-engineering/data/catalogs/routes.userdoccers.catalog.json` documents `DELETE_USERS__ME_PHONE` as "Remove Phone Number".
- `packages/automatic-reverse-engineering/data/catalogs/routes.xhyrom.catalog.json` documents `DELETE`, `OPTIONS`, and `POST` for `/users/@me/phone`; only DELETE was implemented.
- Userdoccers raw source: `https://raw.githubusercontent.com/discord-userdoccers/discord-userdoccers/master/pages/topics/phone-verification.mdx`, "Remove Phone Number" section. It documents `password`, `change_phone_reason`, `204`, and `USER_UPDATE`.
- Existing local current-user behavior source: `src/api/routes/users/@me/index.ts` for current password verification and setting a hash for passwordless accounts when a password is supplied.
- Existing user update event shape source: `src/util/interfaces/Event.ts` and `src/api/util/UserUpdateEvents.ts`; phone removal uses only `USER_UPDATE` because `phone` is private user state and does not alter public guild-member profile data.

## Missing-Route Movement

- Before regeneration on this base: `missing: 542`, `spacebar: 638`, `discord: 1128`.
- After regeneration: `missing: 541`, `spacebar: 639`, `discord: 1128`.
- `DELETE_USERS__ME_PHONE` was removed from `missing_entries`.
- `POST_USERS__ME_PHONE` remains missing and intentionally untouched.

## Verification

- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm ci`: passed; installed local worktree dependencies.
- `npm run build:src:tsgo`: passed.
- `npm run generate:schema`: passed; wrote `1185` schemas.
- `npm run generate:openapi`: passed; wrote `528` paths and `1185` schemas, with pre-existing webhook route metadata warnings.
- `npm run build --workspace @spacebar/automatic-reverse-engineering`: passed.
- `node packages/automatic-reverse-engineering/dist/cli.js import-source-routes --root src/api/routes --out packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`: passed.
- `npm run build --workspace @spacebar/missing-routes`: passed.
- `npm run start --workspace @spacebar/missing-routes`: passed; wrote `missing: 541`, `spacebar: 639`.
- `npm run generate:testing-manifest`: passed; wrote `744` entries.
- `npm run generate:contract-tests`: passed; wrote `719` contracts.
- `npm run generate:suite-coverage`: passed; wrote `15` suites.
- `npm run test:manifest`: passed.
- `npm run test:suite-coverage`: passed.
- `npm run build:test-fixtures`: passed.
- Focused compiled test `node -r dotenv/config -r module-alias/register --enable-source-maps --test dist-test/test/routes/usersMePhoneRoute.test.js`: passed, `9/9`.
- `npm run test:contracts`: static generated contract checks passed; runtime phase failed only on known unrelated `api:http:GET:/discovery/search` public response schema check, `500 !== 200`.
- `git diff --check`: passed.
- Package/lockfile guard `git diff -- package.json package-lock.json packages/*/package.json`: clean.
- Targeted malformed warranty scan for new files passed: `rg -n 'MERMER|MERCHANTIBILITY|MERCHANTMERCHANTABILITY' src/api/routes/users/@me/phone.ts src/schemas/uncategorised/UserPhoneRemoveSchema.ts test/routes/usersMePhoneRoute.test.ts`.

## Risks And Blockers

- Optional `USER_REQUIRED_ACTION_UPDATE` is documented upstream but there is no local required-action update model for phone removal in this codebase, so the route emits the locally supported `USER_UPDATE` only.
- Passwordless accounts set a password hash before phone removal, matching the Userdoccers note and the existing current-user modify route behavior. This intentionally mutates only credential data plus `phone`.
- No local SMS MFA phone model was found, so the route does not alter `mfa_enabled`, TOTP/WebAuthn state, or user flags.
- `npm run test:contracts` remains blocked by the known unrelated `GET /discovery/search` runtime `500 !== 200`.

## Adjacent Routes Untouched

- `POST /users/@me/phone`
- `POST /users/@me/phone/reverify`
- `POST /users/@me/phone/verify`
- `/phone-verifications/*`
- Account delete/disable routes
- MFA/TOTP/WebAuthn routes

## Recommended Next Tasks

- Implement the assigned add/reverify/verify phone flows separately once a safe local phone verification token and SMS/required-action model is available.
- Consider a dedicated required-action event model before implementing phone anti-abuse flows that need `USER_REQUIRED_ACTION_UPDATE`.
