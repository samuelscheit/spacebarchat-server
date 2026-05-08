# Embed Image Proxy

Generated link embeds keep the origin image URL and also expose a `proxy_url` from `getProxyUrl` in `src/api/util/utility/EmbedHandlers.ts`. Set `cdn.imagorServerUrl` to an Imagor-compatible image proxy base URL so clients can load embed images through the proxy instead of fetching the origin directly.

This is required for providers that block hotlinking or require origin-specific request headers. Pixiv artwork images are one known case: Pixiv embeds can be generated from page metadata, but the image usually will not render in clients unless `cdn.imagorServerUrl` is configured.

Relevant config keys:

- `cdn.imagorServerUrl`: public Imagor-compatible base URL used for embed image `proxy_url` values.
- `security.requestSignature`: HMAC secret used to sign proxy paths.
- `cdn.resizeWidthMax` and `cdn.resizeHeightMax`: maximum dimensions requested from the proxy.

When `cdn.imagorServerUrl` is unset, Spacebar logs an Imagor setup warning once and falls back to the origin image URL. That fallback is suitable only for origins that allow direct client access.
