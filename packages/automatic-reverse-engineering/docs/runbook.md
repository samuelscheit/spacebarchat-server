# Discord Datamining Automation Runbook

This package implements the repeatable capture pipeline described in `DISCORD_DATAMINING_AUTOMATION_PLAN.md`.

## Boundaries

- Use dedicated test accounts, test guilds, test channels, and normal browser login sessions only.
- Keep browser storage state outside committed artifacts.
- Do not commit raw cookies, authorization headers, session secrets, fixture IDs, private message text, CDN signatures, or production user data.

## Static Context

Collect the Discord build context for a run:

```bash
npm run build --workspace @spacebar/automatic-reverse-engineering
node packages/automatic-reverse-engineering/dist/cli.js resolve-source-refs \
  --out packages/automatic-reverse-engineering/data/catalogs/source-refs.json

node packages/automatic-reverse-engineering/dist/cli.js collect-static \
  --run-id 2026-05-07T12-00-00Z-canary \
  --channel canary \
  --out packages/automatic-reverse-engineering/data/runs/2026-05-07T12-00-00Z-canary \
  --download-assets \
  --source-refs-file packages/automatic-reverse-engineering/data/catalogs/source-refs.json
```

When `--download-assets` is set, fetched scripts and stylesheets are written under `static/assets/` with hash-prefixed filenames. The collector also scans downloaded scripts for quoted `.js` and `.css` references so chunk assets can be fetched and reanalyzed without rerunning browser scenarios. Use `--discover-chunks false` to disable reference discovery and `--max-assets <n>` to cap traversal.

Import a route catalog from checked-in OpenAPI:

```bash
node packages/automatic-reverse-engineering/dist/cli.js import-openapi \
  --input assets/openapi.json \
  --out packages/automatic-reverse-engineering/data/catalogs/routes.catalog.json
```

Recover route catalog entries directly from the Spacebar Express route tree when OpenAPI misses middleware-wrapped routes:

```bash
node packages/automatic-reverse-engineering/dist/cli.js import-source-routes \
  --root src/api/routes \
  --out packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json
```

Import a Gateway catalog from Spacebar source:

```bash
node packages/automatic-reverse-engineering/dist/cli.js import-gateway-source \
  --constants src/gateway/util/Constants.ts \
  --handlers src/gateway/opcodes/index.ts \
  --events src/util/interfaces/Event.ts \
  --schemas src/schemas/gateway/index.ts \
  --out packages/automatic-reverse-engineering/data/catalogs/gateway.catalog.json
```

Import public third-party snapshots for cross-reference provenance. These commands expect a local checkout or sparse checkout of the public repositories at the commits recorded in `source-refs.json`:

```bash
node packages/automatic-reverse-engineering/dist/cli.js import-xhyrom-routes \
  --input /tmp/discord-third-party/xhyrom/data/client/routes.json \
  --out packages/automatic-reverse-engineering/data/catalogs/routes.xhyrom.catalog.json

node packages/automatic-reverse-engineering/dist/cli.js import-xhyrom-experiments \
  --input /tmp/discord-third-party/xhyrom/data/client/experiments/experiments.json \
  --out packages/automatic-reverse-engineering/data/catalogs/experiments.xhyrom.catalog.json

node packages/automatic-reverse-engineering/dist/cli.js import-userdoccers-routes \
  --root /tmp/discord-third-party/userdoccers/pages \
  --out packages/automatic-reverse-engineering/data/catalogs/routes.userdoccers.catalog.json

node packages/automatic-reverse-engineering/dist/cli.js import-userdoccers-gateway \
  --events /tmp/discord-third-party/userdoccers/pages/gateway/gateway-events.mdx \
  --opcodes /tmp/discord-third-party/userdoccers/pages/gateway/opcodes-and-close-codes.mdx \
  --out packages/automatic-reverse-engineering/data/catalogs/gateway.userdoccers.catalog.json
```

xHyroM experiment rollout overrides are summarized by count only; raw override ID lists are intentionally not copied into durable artifacts.

Bundle the catalogs used for a run into that run's static context after import and experiment extraction:

```bash
node packages/automatic-reverse-engineering/dist/cli.js bundle-static-context \
  --run-dir packages/automatic-reverse-engineering/data/runs/<run_id> \
  --routes packages/automatic-reverse-engineering/data/catalogs/routes.catalog.json \
  --source-routes packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json \
  --gateway packages/automatic-reverse-engineering/data/catalogs/gateway.catalog.json \
  --experiments packages/automatic-reverse-engineering/data/runs/<run_id>/static/experiments.catalog.json \
  --docs packages/automatic-reverse-engineering/data/catalogs/docs.index.json \
  --xhyrom-routes packages/automatic-reverse-engineering/data/catalogs/routes.xhyrom.catalog.json \
  --xhyrom-experiments packages/automatic-reverse-engineering/data/catalogs/experiments.xhyrom.catalog.json \
  --userdoccers-routes packages/automatic-reverse-engineering/data/catalogs/routes.userdoccers.catalog.json \
  --userdoccers-gateway packages/automatic-reverse-engineering/data/catalogs/gateway.userdoccers.catalog.json \
  --source-refs-file packages/automatic-reverse-engineering/data/catalogs/source-refs.json
```

This writes `static/context.manifest.json`, copies selected catalogs into `static/`, and merges source refs into `static/build.json` when that file exists. Manifest paths are written as portable repo-relative or file-name-only paths rather than local absolute paths.
If you intentionally need to build a catalog manifest without a collected `build.json`, pass `--update-build false`; otherwise a missing build snapshot is treated as a broken run.

## Runtime Capture

Use `CdpNetworkRecorder` with a Playwright-created CDP session. The package accepts a small `CdpSessionLike` interface and does not import Playwright directly.

Use `runPlaywrightCapturedFeature` when driving scenarios through Playwright. It accepts a Playwright-shaped page and browser context, starts CDP capture, wraps each scenario step, and writes:

- `events.ndjson`
- `playwright-events.ndjson`
- `summary.json`
- `report.md`
- `trace.zip` when tracing is available
- `screenshots/*.png` at step boundaries
- `video.webm` when a scenario fails by default, or on any run when `saveVideo` is enabled and the page has a video handle
- `failure.json` when preflight or runtime execution fails
- `run-artifacts.json` with the success, failed, or quarantined artifact status

`events.ndjson` includes `ui.action` entries emitted by runner navigation/expectation wrappers and shared scenario action helpers. These entries intentionally keep only redacted action labels such as `fill / role:textbox / value redacted` or `context-click / text / value redacted`, not typed text, selected text, local file paths, raw selectors, or fixture IDs.

Playwright HAR recording must be configured when the browser context is created. Pass that known HAR path through `harPath` so reports can reference it; the wrapper cannot turn HAR recording on after context creation.

Failure videos are retained for local debugging only. They are binary visual artifacts and are not covered by `validate-redaction`; review them manually before promoting or sharing a failed run bundle.

`playwright-events.ndjson` is the secondary Playwright convenience channel. It records page-level request/response events and Playwright WebSocket lifecycle/frame events with the same redaction gate used for CDP output. CDP remains the source of truth for correlation because it includes bodies and lower-level WebSocket metadata more consistently. Audited CDP and mitmproxy `http.request`/`http.response` events, plus CDP `http.failure` events, must carry `cdp_request_id` values, and Playwright page-level HTTP request/response events must carry `playwright_request_id` values. Expected HTTP evidence is accepted only when the request and response IDs match; same method/route/timing is not enough. Correlated summaries use those IDs to keep repeated same-route request/response samples paired, and keep both shape hashes and compact redacted samples for HTTP request bodies, HTTP response bodies, and Gateway payloads so human review can inspect safe examples without returning to raw event streams.

`mitmproxy.redacted.ndjson` is an optional secondary validation channel. Use `import-mitmproxy` only on locally exported mitmproxy JSON flow data, then discard the raw dump; the importer writes redacted HTTP request/response and WebSocket frame events through the same NDJSON secret gate. It is supporting evidence, not a replacement for CDP step-scoped capture.

`runCapturedFeature` provides default `expectNetwork` and `expectGateway` waiters backed by the captured event stream. `expectNetwork` waits for a completed CDP HTTP response with status evidence, not just request dispatch, so expectation failures do not pass on request-only traffic. Feature contexts still need app-specific navigation helpers such as `gotoChannel` and `expectReady`.

Durable runtime output belongs under:

```text
packages/automatic-reverse-engineering/data/runs/<run_id>/features/<feature_id>/
  events.ndjson
  playwright-events.ndjson
  mitmproxy.redacted.ndjson
  mitmproxy.summary.json
  trace.zip
  network.redacted.har
  screenshots/
  video.webm
  summary.json
  report.md
  failure.json
  run-artifacts.json
```

Raw `network.har` files are short-lived local inputs to `sanitize-har`; `run-playwright-feature` records its raw HAR in an OS temp directory before writing only `network.redacted.har` under the feature directory. Raw mitmproxy flow dumps are short-lived local inputs to `import-mitmproxy`. Do not keep either raw artifact in durable run output.

`NdjsonEventWriter` refuses to write events that still look like tokens or cookies.

Enable `enforceFixtureScope` on captured feature runs to fail fast when HTTP route paths touch non-fixture guild, channel, user, or role IDs. Message IDs are intentionally not guarded because scenarios often create disposable messages during a run.

Runtime safety gates emit `runtime.abort` and throw `CaptureAbortError` when capture observes excessive HTTP 429s, CAPTCHA challenge fields, or account checkpoint fields. The default threshold aborts on the first 429; pass `safetyGates.maxRateLimitResponses` when a scenario intentionally tolerates a small number of rate-limit responses. Treat any aborting run as quarantined until manually reviewed.

Preflight failures, runtime expectation failures, Playwright errors, and recorder safety aborts write a redacted `failure.json` before rethrowing. The failure artifact stores the stage, redacted error name/message, abort reason when available, `quarantine: true`, and closed-shape feature-local slash-relative artifact paths such as `events.ndjson` or `failure.json`. Writer normalization collapses absolute, traversal, Windows, and backslash-only inputs to safe local basenames and drops unknown artifact path keys. It never stores raw stacks, cookies, tokens, storage-state values, absolute local paths, or unredacted fixture IDs. Failed runtime commands also write `run-artifacts.json` with `status: "failed"` or `status: "quarantined"` so local automation can find the partial evidence bundle.

Validate required scenario fixtures and produce a redacted fixture manifest for reports:

```bash
node packages/automatic-reverse-engineering/dist/cli.js fixture-template \
  --all-built-ins true \
  --out packages/automatic-reverse-engineering/data/runs/<run_id>/fixtures.template.json
```

Generate a setup plan for those fixtures before creating the local manifest:

```bash
node packages/automatic-reverse-engineering/dist/cli.js fixture-seed-plan \
  --all-built-ins true \
  --out packages/automatic-reverse-engineering/data/runs/<run_id>/fixture-seed-plan.json
```

The seed plan contains placeholders only. It classifies each fixture as `manual`, `official_api`, `browser_session`, or `local_file`, lists setup dependencies, identifies destructive/disposable targets, and uses public route templates such as `/guilds/{guild_id}/channels` for resources that can be prepared through the dedicated bot/application account. It does not accept, print, or store bot tokens, storage state, cookies, raw IDs, or message content.

The template also contains placeholders only. Replace those placeholders in a local, uncommitted `fixtures.local.json` with IDs from the dedicated test guild/account. Typed fixture roots include `guild`, `guilds`, `channels`, `roles`, `users`, `messages`, `applications`, `emojis`, `stickers`, and `files`; emoji and sticker IDs redact as `{emoji_id}` and `{sticker_id}` in normalized payloads. File fixtures such as `files.small_attachment` should point to local throwaway files outside committed artifacts, and scenarios resolve them through `ctx.fixture(...)` without writing the path to reports. For destructive built-in scenarios, keep the generated `disposable` list as fixture paths such as `messages.delete_target` or `roles.feature_test_role`; do not put raw IDs in `disposable`.

```bash
node packages/automatic-reverse-engineering/dist/cli.js validate-fixtures \
  --fixtures fixtures.local.json \
  --feature-id message.send.basic \
  --out packages/automatic-reverse-engineering/data/runs/<run_id>/fixtures.redacted.json
```

Preflight the local browser storage state and fixture requirements before opening Discord. The storage-state file should live outside committed artifacts:

```bash
node packages/automatic-reverse-engineering/dist/cli.js preflight-runtime \
  --storage-state ~/.config/spacebar-discord-storage/canary.storage-state.json \
  --fixtures fixtures.local.json \
  --feature-id message.send.basic \
  --storage-state-created-at 2026-05-07T12:00:00Z \
  --max-storage-state-age-ms 604800000 \
  --out packages/automatic-reverse-engineering/data/runs/<run_id>/preflight.json
```

The preflight report summarizes cookie/origin counts, auth-looking Discord cookie/storage key counts, expired auth-cookie counts, and storage-state freshness. Pass `--storage-state-created-at` with the timestamp when the browser storage state was captured; this is required in CI because decoding a secret creates a fresh temp-file mtime that does not prove the session is recent. If the timestamp is omitted, preflight falls back to local file mtime for developer runs. By default, storage state must have been generated within the last seven days; pass `--max-storage-state-age-ms` to use a stricter local threshold for short-lived smoke runs. Preflight validates required fixture paths, validates disposable markers for destructive scenarios, redacts fixture IDs, rejects expired Discord auth cookies even when auth-looking localStorage is present, and refuses storage-state paths under `packages/automatic-reverse-engineering/data` unless `--allow-artifact-storage-state true` is provided. Durable preflight reports replace the storage-state path and forbidden artifact root with placeholders, and record only relative storage-state age plus whether the age came from `provided_created_at` or `file_mtime`. The report does not copy or print cookie values, localStorage values, tokens, or session material. `audit-run` verifies the durable preflight report shape, empty violations, redacted storage-state placeholder, active and fresh Discord session evidence, fixture validation results, and absence of parse/forbidden-root errors before accepting runtime artifacts. The redaction audit also rejects any raw Playwright storage-state shaped JSON that accidentally lands in a run directory.

Run a full-suite readiness preflight before preparing a credentialed smoke or daily runtime run:

```bash
node packages/automatic-reverse-engineering/dist/cli.js preflight-runtime \
  --storage-state ~/.config/spacebar-discord-storage/canary.storage-state.json \
  --fixtures fixtures.local.json \
  --all-built-ins true \
  --storage-state-created-at 2026-05-07T12:00:00Z \
  --max-storage-state-age-ms 604800000 \
  --out packages/automatic-reverse-engineering/data/runs/<run_id>/runtime-readiness.json
```

The all-built-ins report includes the feature IDs, aggregate required fixture paths, required disposable fixture paths, and a placeholder-only fixture template. If a scenario declares fixtures and `--fixtures` is omitted, preflight now fails with `missing_fixture:*` violations instead of skipping fixture validation.

Run a built-in browser scenario after preflight. Playwright is intentionally optional; install it in your local environment when you are ready to run credentialed scenarios, but do not commit storage state or raw runtime artifacts:

```bash
node packages/automatic-reverse-engineering/dist/cli.js run-playwright-feature \
  --run-id <run_id> \
  --out packages/automatic-reverse-engineering/data/runs/<run_id> \
  --feature-id bootstrap.idle.session \
  --storage-state ~/.config/spacebar-discord-storage/canary.storage-state.json \
  --fixtures fixtures.local.json \
  --routes packages/automatic-reverse-engineering/data/catalogs/routes.xhyrom.catalog.json \
  --storage-state-created-at 2026-05-07T12:00:00Z \
  --max-storage-state-age-ms 604800000
```

`run-playwright-feature` dynamically imports Playwright only inside the command, runs `preflight-runtime` checks before launch, executes only built-in runnable scenarios, navigates channels from fixture IDs, enables fixture-scope enforcement by default, records CDP and Playwright convenience events, sanitizes HAR output to `network.redacted.har`, and removes the temporary raw HAR. When `static/assets.json` is present under the run directory, it also annotates the generated summary/report with static script and experiment candidates from the run's static context. Video recording is enabled for failure retention by default; pass `--save-video-on-failure false` to disable that, or `--save-video true` to retain video for successful runs too. On failure, inspect `failure.json` and `run-artifacts.json` first, then manually review screenshots/videos before moving anything out of quarantine.

Optionally import a local mitmproxy JSON flow export for secondary validation after the browser run:

```bash
node packages/automatic-reverse-engineering/dist/cli.js import-mitmproxy \
  --input /tmp/mitmproxy.flows.json \
  --out packages/automatic-reverse-engineering/data/runs/<run_id>/features/message.send.basic/mitmproxy.redacted.ndjson \
  --summary-out packages/automatic-reverse-engineering/data/runs/<run_id>/features/message.send.basic/mitmproxy.summary.json \
  --run-id <run_id> \
  --feature-id message.send.basic \
  --fixtures fixtures.local.json \
  --routes packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json
```

Keep the raw mitmproxy export outside `data/runs/`. The redacted NDJSON can be included in the normal `validate-redaction` and `audit-run` flow; when present, `audit-run` checks it for non-empty HTTP/WebSocket evidence and matching expected routes/events without allowing it to mask missing CDP evidence.

## Feature Reports

Generate a per-feature report from redacted events:

```bash
node packages/automatic-reverse-engineering/dist/cli.js report-feature \
  --events packages/automatic-reverse-engineering/data/runs/<run_id>/features/message.send.basic/events.ndjson \
  --build packages/automatic-reverse-engineering/data/runs/<run_id>/static/build.json \
  --docs packages/automatic-reverse-engineering/data/runs/<run_id>/static/docs.index.json \
  --fixtures fixtures.local.json \
  --out packages/automatic-reverse-engineering/data/runs/<run_id>/features/message.send.basic
```

Reports include the scenario/run identifiers, step titles/action labels from the captured scenario, traffic shape hashes with compact redacted request/response/payload samples, static build context when a build file is provided or available during `run-playwright-feature`, docs links when `docs.index.json` is provided or available under the run's `static/` directory, and a redacted fixture manifest. Raw fixture IDs and storage-state values must not appear in report output.

Attach static script candidates to an existing feature summary after collecting static assets. This is mainly for post-hoc annotation of summaries produced before static context was available; `run-playwright-feature` does this automatically for new runs when `static/assets.json` exists:

```bash
node packages/automatic-reverse-engineering/dist/cli.js annotate-static \
  --summary packages/automatic-reverse-engineering/data/runs/<run_id>/features/message.send.basic/summary.json \
  --assets packages/automatic-reverse-engineering/data/runs/<run_id>/static/assets.json \
  --static-dir packages/automatic-reverse-engineering/data/runs/<run_id>/static \
  --experiments packages/automatic-reverse-engineering/data/runs/<run_id>/static/experiments.catalog.json \
  --out packages/automatic-reverse-engineering/data/runs/<run_id>/features/message.send.basic/summary.static.json
```

This is a conservative static join. CDP initiator stack frames are preferred when present: matching script URLs/file names become high-confidence candidates, and line/column offsets are used to recover a nearby Webpack-style `module_id` when possible. If a retained Source Map v3 artifact is associated with the generated script, the candidate also includes the mapped original source file, symbol name, original line/column, and a bounded derived source-context hash when `sourcesContent` is present. Source-map paths and names are sanitized before they are written to summaries, Markdown, or SQL; reports may show an identifier-only context such as `function sendMessage`, but they never publish full `sourcesContent` source lines, raw source-map emails, or raw snowflake-looking IDs. Without initiator frames, exact Gateway event strings are high-confidence candidates; HTTP routes use exact normalized route strings when present or ordered route literals as medium-confidence candidates. When an experiment catalog is provided, experiment/feature-flag candidates must come from the same script chunk. Matching module IDs give medium confidence; if either side lacks module evidence, a small nearby source-offset window can give medium confidence; and older catalog rows with no module/offset evidence can still attach at low confidence to high-confidence static candidates. Explicit module ID mismatches are rejected instead of falling back to offset proximity.

Downloaded Source Map artifacts are redacted before durable write under `static/assets/`: string values in `sourceRoot`, `sources`, `names`, and `sourcesContent` are normalized for token-like values, emails, and snowflake-looking IDs. The upstream `hash` and `bytes` in `assets.json` still represent the fetched asset identity; `local_hash`, `local_bytes`, and `local_redacted` describe the retained audit-safe analysis copy.

## Post-Run Gates

Sanitize HAR output before keeping or sharing it. The raw HAR path is only safe as short-lived local input:

```bash
node packages/automatic-reverse-engineering/dist/cli.js sanitize-har \
  --input /tmp/network.har \
  --out packages/automatic-reverse-engineering/data/runs/<run_id>/features/message.send.basic/network.redacted.har \
  --fixtures fixtures.local.json
```

Audit the complete run directory before moving artifacts into review:

```bash
node packages/automatic-reverse-engineering/dist/cli.js validate-redaction \
  --input packages/automatic-reverse-engineering/data/runs/<run_id> \
  --out packages/automatic-reverse-engineering/data/runs/<run_id>/redaction-audit.json
```

Verify that the run has the expected static and runtime evidence. This is the completion gate; by default it fails static-only runs because live browser provenance is missing. Runtime feature audits require valid NDJSON event shapes, request-id-backed HTTP lifecycle and expected request/response pairing, monotonically ordered event timestamps, HTTP/WebSocket lifecycle consistency across CDP, Playwright convenience, and optional mitmproxy event streams, valid `summary.json` step/action/traffic shapes with step/action timestamps inside their windows, balanced step markers with end timestamps after start timestamps, deterministic PNG start/end screenshots for every audited step marker, readable report Markdown with audited identity/action/traffic evidence, redacted `ui.action` entries, summary step/action metadata, rendered report actions, expected HTTP/Gateway traffic, sanitized HAR retention as `network.redacted.har`, no other durable `.har` files, and no quarantine markers.

`validate-redaction` scans generated JSON, NDJSON, Markdown, text, HAR, SQL, and retained Source Map `.map` artifacts for raw token-like secrets, emails, and snowflake-looking IDs. It does not scan raw static `.html`, `.js`, or `.css` files; CI upload steps must stage an explicit allowlist and omit raw static assets unless they have gone through separate human review. A raw `.map` file with unsafe `sources`, `names`, or `sourcesContent` must fail the gate before artifacts are promoted.

`audit-run` verifies retained static asset files exist and checks their integrity. For unredacted retained assets it accepts `hash` and `bytes` as the expected local file identity; when `local_hash` or `local_bytes` are present, those local fields take precedence. Redacted retained artifacts such as sanitized Source Maps must include `local_hash` and `local_bytes` so the audit checks the retained safe analysis copy rather than the upstream raw asset.

```bash
node packages/automatic-reverse-engineering/dist/cli.js audit-run \
  --run-dir packages/automatic-reverse-engineering/data/runs/<run_id> \
  --features bootstrap.idle.session,message.send.basic \
  --out packages/automatic-reverse-engineering/data/runs/<run_id>/run-audit.json
```

`audit-run` also fails any feature directory that contains `failure.json`; that artifact is an explicit quarantine marker, not successful runtime evidence.

For a scheduled static-only run, keep the gate explicit:

```bash
node packages/automatic-reverse-engineering/dist/cli.js audit-run \
  --run-dir packages/automatic-reverse-engineering/data/runs/<run_id> \
  --require-runtime false \
  --out packages/automatic-reverse-engineering/data/runs/<run_id>/static-audit.json
```

Build aggregate coverage after feature summaries have been generated:

```bash
node packages/automatic-reverse-engineering/dist/cli.js coverage \
  --summaries packages/automatic-reverse-engineering/data/runs/<run_id>/features/message.send.basic/summary.json \
  --builds packages/automatic-reverse-engineering/data/runs/<run_id>/static/build.json \
  --routes packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json \
  --gateway packages/automatic-reverse-engineering/data/catalogs/gateway.catalog.json \
  --out packages/automatic-reverse-engineering/data/coverage/<run_id>
```

When `--builds`, `--routes`, or `--gateway` are provided, coverage JSON and Markdown include first/last observed run IDs, first/last build identifiers, shape history by run, and catalog annotations such as route names or Gateway event names.

Coverage suppresses traffic whose attribution is `background` by default so idle baseline noise does not count as feature coverage. Baseline subtraction is material-shape and timing aware: the same route/event is not suppressed when the request, response, status, or Gateway payload shape differs from the idle baseline, or when same-shape traffic occurs immediately after a causative redacted UI action. Gateway heartbeats stay background. Pass `--include-background true` when debugging the baseline classifier itself.

Diff a feature against a previous run:

```bash
node packages/automatic-reverse-engineering/dist/cli.js diff-feature \
  --base packages/automatic-reverse-engineering/data/runs/<previous_run_id>/features/message.send.basic/summary.json \
  --head packages/automatic-reverse-engineering/data/runs/<run_id>/features/message.send.basic/summary.json \
  --out packages/automatic-reverse-engineering/data/runs/<run_id>/features/message.send.basic/diff.json \
  --markdown-out packages/automatic-reverse-engineering/data/runs/<run_id>/features/message.send.basic/diff.md
```

Feature diffs also suppress `background` traffic by default; pass `--include-background true` when you need a full noise diagnostic diff.

Generate a build-level diff report that combines static build changes with runtime feature signature changes:

```bash
node packages/automatic-reverse-engineering/dist/cli.js diff-build \
  --base-build packages/automatic-reverse-engineering/data/runs/<previous_run_id>/static/build.json \
  --head-build packages/automatic-reverse-engineering/data/runs/<run_id>/static/build.json \
  --base-summaries packages/automatic-reverse-engineering/data/runs/<previous_run_id>/features/message.send.basic/summary.json \
  --head-summaries packages/automatic-reverse-engineering/data/runs/<run_id>/features/message.send.basic/summary.json \
  --review-queue packages/automatic-reverse-engineering/data/runs/<run_id>/review-queue.json \
  --out packages/automatic-reverse-engineering/data/runs/<run_id>/build-diff.json \
  --markdown-out packages/automatic-reverse-engineering/data/runs/<run_id>/build-diff.md
```

`diff-build` reports static build identity/source-ref/asset changes, runtime HTTP/Gateway added/removed/changed counts by feature, changed shape hashes, confidence, and review queue size. It can also consume precomputed feature diffs with `--diffs`.

Create the manual review queue from summaries, diffs, and optional failure artifacts:

```bash
node packages/automatic-reverse-engineering/dist/cli.js review-queue \
  --summaries packages/automatic-reverse-engineering/data/runs/<run_id>/features/message.send.basic/summary.json \
  --diffs packages/automatic-reverse-engineering/data/runs/<run_id>/features/message.send.basic/diff.json \
  --failures packages/automatic-reverse-engineering/data/runs/<run_id>/features/message.send.basic/failure.json \
  --routes packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json \
  --gateway packages/automatic-reverse-engineering/data/catalogs/gateway.catalog.json \
  --out packages/automatic-reverse-engineering/data/runs/<run_id>/review-queue.json
```

Review queue entries are expected for unknown routes/events, missing scenario expectations, changed observed traffic, runtime failures/aborts, and anything marked sensitive. Promote only redacted summaries, sanitized HARs, reports, coverage, and review queues to durable storage.

Review queues suppress `background` traffic by default, including new-route/new-event checks and background-only diff changes. Pass `--include-background true` for manual baseline review.

Export a SQLite-compatible local query index when you want ad hoc SQL over runs, features, steps, HTTP/Gateway observations, payload shapes, catalogs, and static candidates:

```bash
node packages/automatic-reverse-engineering/dist/cli.js export-sqlite-index \
  --summaries packages/automatic-reverse-engineering/data/runs/<run_id>/features/message.send.basic/summary.json \
  --builds packages/automatic-reverse-engineering/data/runs/<run_id>/static/build.json \
  --routes packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json \
  --gateway packages/automatic-reverse-engineering/data/catalogs/gateway.catalog.json \
  --include-samples false \
  --out packages/automatic-reverse-engineering/data/runs/<run_id>/datamine.sqlite.sql
```

Load it locally with `sqlite3 datamine.sqlite < datamine.sqlite.sql`. The export intentionally stays as SQL text so the package does not need a native SQLite or DuckDB dependency. Pass `--include-samples true` when you need redacted request/response/payload samples in SQL; either way, keep SQL exports inside the same redaction/audit workflow as summaries and reports.

After coverage and review queue generation, rerun `audit-run` with `--coverage-dir` and `--review-queue` so the machine-readable report covers the full post-run artifact set. Static audits verify retained asset integrity and every `context.manifest.json` file entry by safe relative path, copied catalog readability, SHA-256 hash, and byte length. Runtime audits require registry expectations for built-in scenarios, valid NDJSON event shapes whose `feature_id` matches the audited scenario and whose single `run_id` matches `static/build.json` or the summary run id, request-id-backed HTTP lifecycle and expected request/response pairing, monotonically ordered event timestamps, HTTP/WebSocket lifecycle consistency across CDP, Playwright convenience, and optional mitmproxy event streams, valid summary step/action/traffic shapes with sane step/action windows, response-backed HTTP summary evidence, expected-route CDP/Playwright/HAR request-response evidence, valid `network.redacted.har` shape, ZIP trace evidence with an end-of-central-directory record, deterministic PNG start/end screenshots for every audited step marker, readable report Markdown that renders the audited scenario id, summary run id, steps, actions, and observed HTTP/Gateway labels, passed feature-local `run-artifacts.json` references, and closed-shape safe relative artifact paths in both `run-artifacts.json` and `failure.json.artifacts` that resolve to existing feature-local files or directories. If `mitmproxy.redacted.ndjson` is present, the audit also requires matching redacted secondary request/response and WebSocket evidence with the same feature/run identity, but CDP evidence remains mandatory. Coverage audits require both coverage JSON files to be arrays, validate route/Gateway entry shape including feature and run IDs, require readable Markdown files to render each valid coverage entry's route/event, methods or directions, features, observed run range, shape hashes, and catalog context when present, and accept HTTP-only or Gateway-only feature runs, but fail when both coverage dimensions are empty. Review queue audits allow an empty queue, but every present item must include a feature ID, known reason, severity, and subject. `audit-run` directly redaction-scans the run directory plus external coverage/review paths, so stale redaction audit artifacts cannot hide unsafe auxiliary outputs.

## CI And Scheduling

`.github/workflows/discord-datamining-static.yml` runs the public static side of the pipeline on a 15-minute Canary cadence, an hourly PTB/stable cadence, and manual `workflow_dispatch` for `canary`, `ptb`, or `stable`.

The scheduled workflow:

- builds `@spacebar/automatic-reverse-engineering`
- resolves xHyroM/Userdoccers GitHub source refs
- collects the Discord `/login` static snapshot and downloaded assets
- imports local OpenAPI, source-route, Gateway, and docs catalogs
- imports public xHyroM route/experiment snapshots and Userdoccers route/Gateway MDX snapshots at recorded source refs
- extracts experiments from downloaded assets
- bundles the run-local static context
- runs `audit-run --require-runtime false`, including copied static context manifest hash/byte integrity checks
- reruns `validate-redaction` over the final upload contents
- stages an explicit redacted upload set containing static metadata/catalog JSON, writes `upload-manifest.json` with runner-local versus staged-upload audit scope, audits the final staged upload including that manifest, and omits raw `static/assets/` plus `static/login.html` from the GitHub Actions artifact

Runtime browser scenarios are intentionally not scheduled in CI by default because they require a dedicated Discord test account, private storage state, fixture IDs, and stricter abuse/429/CAPTCHA controls.

`.github/workflows/discord-datamining-runtime-smoke.yml` is manual-only. It expects `DISCORD_DATAMINING_STORAGE_STATE_B64`, `DISCORD_DATAMINING_STORAGE_STATE_CREATED_AT`, and `DISCORD_DATAMINING_FIXTURES_JSON` repository secrets, writes storage state and fixtures only under `$RUNNER_TEMP`, and passes the capture timestamp into preflight so decoding the secret cannot make stale storage look fresh. It collects static context in the same job, runs one built-in scenario with `run-playwright-feature`, builds coverage and review queue artifacts from the captured summary, gates upload on `validate-redaction` and `audit-run` including coverage/review checks, and uploads an allowlisted redacted artifact set with `upload-manifest.json` computed from the final staged tree. It also writes a non-blocking `runtime-readiness.json` for the full built-in suite when possible, so a smoke run can show missing fixtures for broader coverage without blocking the selected scenario. The upload staging step enforces an explicit file allowlist and omits `static/assets/`, `static/login.html`, binary trace, screenshot, and video artifacts from the uploaded smoke artifact because those are not covered by the text redaction audit. The manifest marks `completion-audit.json` as runner-local scope, while the staged upload redaction gate applies to the final uploaded file set.
