# Redaction Policy

Redaction happens before durable artifacts are written.

## Always Redact

- `Authorization`, cookies, MFA/session headers, fingerprints, super properties, context properties, session IDs, referer/referrer, and tracking headers.
- Tokens, passwords, client secrets, access tokens, refresh tokens, and auth tickets.
- Emails, phone numbers, usernames, nicknames, profile text, message content, filenames, asset URLs, and CDN signatures.
- Fixture and observed snowflakes, UUIDs, nonce values, timestamps, analytics IDs, and hashes.
- UI action events may record action names, fixture-key labels, route/event expectations, and key names such as `Enter`; they must not record typed text, selected visible text, local file paths, raw selectors, or raw fixture IDs.

## Normalization

- API URLs normalize to typed routes such as `/channels/{channel_id}/messages`.
- Known fixture IDs normalize to typed placeholders.
- Unknown snowflakes normalize to `{snowflake}`.
- JSON bodies are converted to stable shapes and redacted examples.
- Feature summaries and Markdown reports may include only those redacted request/response/payload examples, never raw bodies or Gateway payloads.

## Gate

`NdjsonEventWriter` runs a last-pass secret scan and throws before writing if an event still resembles a token or cookie. It also rejects unsafe `ui.action` labels, including fill/type/file-input actions without `value_redacted: true`, text/label click or context-click actions without redacted values, raw snowflakes, and local file paths. Treat that as a capture failure and fix the upstream redaction path.

Runtime `failure.json` artifacts contain redacted error names/messages and feature-local artifact paths only. They intentionally omit raw stack traces and absolute local paths because Playwright and assertion stacks can include local storage-state paths, fixture values, URLs, and other sensitive runtime context.

Before sharing or publishing a run directory, run:

```bash
node packages/automatic-reverse-engineering/dist/cli.js validate-redaction \
  --input packages/automatic-reverse-engineering/data/runs/<run_id> \
  --out packages/automatic-reverse-engineering/data/runs/<run_id>/redaction-audit.json
```

The command scans JSON, NDJSON, Markdown, text, HAR, SQL export, and retained Source Map artifacts and exits non-zero on possible unredacted secrets. JSON scans also reject raw Playwright storage-state shaped artifacts even when cookie or localStorage values are not token-shaped. HAR scans require parseable HAR JSON with `log.entries` and request/response objects, so a malformed HAR cannot pass merely because its text contains no token-shaped values.

`validate-redaction` does not inspect raw static HTML, JavaScript, CSS, Playwright trace ZIPs, binary videos, or screenshots. Trace capture is disabled by default for credentialed runtime runs; use `--capture-trace true` only for local debugging. Scheduled CI uploads stage an explicit allowlist of redacted JSON/text metadata and omit `static/assets/`, `static/login.html`, trace, screenshot, and video artifacts. Treat omitted artifacts as local analysis/debugging material unless a separate human review approves promotion.

Sanitize Playwright HAR output before keeping or sharing it:

```bash
node packages/automatic-reverse-engineering/dist/cli.js sanitize-har \
  --input /tmp/network.har \
  --out packages/automatic-reverse-engineering/data/runs/<run_id>/features/message.send.basic/network.redacted.har \
  --fixtures fixtures.local.json
```

The sanitizer redacts headers, cookies, query-string values, fixture IDs in URLs, request body text, and response body text. Keep raw HARs out of committed artifacts.
