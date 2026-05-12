# users-me-survey-get

## Summary

Implemented `GET /users/@me/survey` as an authenticated current-user compatibility route. Spacebar has no persisted Discord survey eligibility, prompt, override, tracking, or seen state, so the route returns a truthful no-active-survey response:

```json
{ "survey": null }
```

The route documents the Userdoccers query parameters for generated OpenAPI metadata but does not fabricate employee-only overrides or survey prompt payloads.

## Changed Files

- `src/api/routes/users/@me/survey.ts`
- `src/schemas/responses/UserSurveyResponse.ts`
- `src/schemas/responses/index.ts`
- `test/routes/users-me-survey-get.test.ts`
- `assets/schemas.json`
- `assets/openapi.json`
- `assets/testing-manifest.json`
- `packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json`
- `packages/missing-routes/missing.json`
- `test/generated/http-contracts.json`
- `test/generated/suite-coverage.json`

## Assigned Path

- Assigned path: `/users/@me/survey`
- Missing methods found: `GET`
- Methods implemented: `GET`
- Missing-route movement on this worker base: `missing` 576 -> 575; `spacebar` 604 -> 605
- Adjacent route intentionally untouched: `POST /users/@me/survey/{param}/seen` remains in `packages/missing-routes/missing.json`

## Evidence Gathered

- `packages/missing-routes/missing.json` contained `GET /users/@me/survey` from `userdoccers:resources/user.mdx` and `xhyrom:data/client/routes.json`.
- `packages/automatic-reverse-engineering/data/catalogs/routes.userdoccers.catalog.json` lists `GET /users/@me/survey` as "Get User Survey" and `POST /users/@me/survey/{survey_id}/seen` as "Acknowledge User Survey".
- `packages/automatic-reverse-engineering/data/catalogs/routes.xhyrom.catalog.json` lists `USER_SURVEY` for `GET`, `HEAD`, and `OPTIONS /users/@me/survey`, plus `USER_SURVEY_SEEN` for `POST/OPTIONS /users/@me/survey/{param}/seen`.
- Userdoccers source `pages/resources/user.mdx` documents the response as an object with nullable `survey`, and the User Survey object fields `id`, `key`, `prompt`, `cta`, `url`, `guild_requirements`, `guild_size`, and `guild_permissions`: https://raw.githubusercontent.com/discord-userdoccers/discord-userdoccers/master/pages/resources/user.mdx
- Local source search found no pre-existing survey entity, persistence model, utility, or route behavior for survey prompts or eligibility. Local runtime captures for this endpoint were background client GETs that returned rate-limit responses, not successful survey payloads.

## Behavior And Risks

- Behavior is intentionally conservative: authenticated users receive `200` with `{ "survey": null }`.
- The implementation does not mark surveys as seen, submit survey answers, create survey prompts, expose experiments, or synthesize analytics/Qualtrics metadata.
- If Spacebar later adds durable survey eligibility or prompt storage, `buildUserSurveyResponse` is the narrow replacement point.
- Reconciliation to current main: not checked beyond assigned base `a5c783970`. Generated artifacts are shared, so reconcile if main advanced.

## Commands Run

- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run build:src:tsgo` initially failed before dependency install: `tsgo: command not found`
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm ci` passed; installed ignored dependencies from the lockfile
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run build:src:tsgo` passed
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run generate:schema` passed
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run generate:openapi` passed
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run build --workspace @spacebar/automatic-reverse-engineering` passed
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" node packages/automatic-reverse-engineering/dist/cli.js import-source-routes --root src/api/routes --out packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json` passed
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run build --workspace @spacebar/missing-routes` passed
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run start --workspace @spacebar/missing-routes` passed; reported `Spacebar is missing 575`
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run generate:testing-manifest` passed; wrote 710 entries
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run generate:contract-tests` passed; wrote 685 contracts
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run generate:suite-coverage` passed
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run test -- test/routes/users-me-survey-get.test.ts` passed
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run build:src:tsgo` passed
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run build:test-fixtures` passed
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" node scripts/testing-manifest/verify.js` passed
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" node scripts/testing-manifest/generate-contract-tests.js --check` passed
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" node scripts/testing-manifest/generate-suite-coverage.js --check` passed
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" node --test test/generated/http-contracts.test.js test/generated/suite-coverage.test.js` passed
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" node -r dotenv/config -r module-alias/register --enable-source-maps --test dist-test/test/routes/users-me-survey-get.test.js` passed
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run test:manifest` passed
- `PATH="/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH" npm run test:contracts` failed only on the known unrelated runtime contract: `api:http:GET:/discovery/search` returned `500 !== 200`; generated contract checks and auth-boundary runtime checks passed before that failure
- `git diff --check` passed
- `git diff -- package.json package-lock.json packages/automatic-reverse-engineering/package.json packages/missing-routes/package.json` produced no diff

## Recommended Next Tasks

- Implement `POST /users/@me/survey/{param}/seen` separately if Spacebar has or adds durable survey-seen state.
- Re-run generated artifact reconciliation after merge with current main because many workers modify shared catalogs and generated contract files.

## Integration Acceptance

- Integrated on main server branch at base `6ebafd60d`.
- Route movement after main-checkout regeneration: missing `574 -> 573`, implemented `606 -> 607`, Discord `1128`.
- Generated counts after regeneration: `1143` schemas, `497` OpenAPI paths, `712` manifest entries, `687` contracts, `15` suites.
- Focused survey route tests passed in source and built fixtures: `5/5` and `5/5`.
- Generated checks passed: testing manifest verify, generated contract check, generated HTTP contracts, generated suite coverage check, generated suite coverage tests, `git diff --check`, and package/lockfile guard.
- `npm run lint` passed.
- Full `npm run test:contracts` failed only on the known unrelated runtime baseline: `api:http:GET:/discovery/search` returned `500 !== 200`.
