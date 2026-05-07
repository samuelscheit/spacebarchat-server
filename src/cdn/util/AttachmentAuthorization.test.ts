import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setTimeout } from "node:timers/promises";
import { describe, it } from "node:test";
import { Config, getUrlSignature, hasValidSignature, NewUrlSignatureData, NewUrlUserSignatureData, UrlSignResult } from "@spacebar/util";
import { hasMatchingRequestSignature, hasValidAttachmentRequestAuthorization } from "./AttachmentAuthorization";

describe("attachment request authorization", () => {
    it("matches internal request signatures exactly", () => {
        assert.equal(hasMatchingRequestSignature("secret", "secret"), true);
        assert.equal(hasMatchingRequestSignature("wrong", "secret"), false);
        assert.equal(hasMatchingRequestSignature(["secret"], "secret"), false);
        assert.equal(hasMatchingRequestSignature("", "secret"), false);
    });

    it("accepts the exact internal request signature", () => {
        assert.equal(
            hasValidAttachmentRequestAuthorization({
                signatureHeader: "secret",
                requestSignature: "secret",
                cdnSignUrls: true,
                fullUrl: "https://cdn.example.test/attachments/channel/message/file.png",
            }),
            true,
        );
    });

    it("rejects incorrect internal request signatures when signed URL validation fails", () => {
        let checkedSignedUrl = false;

        assert.equal(
            hasValidAttachmentRequestAuthorization({
                signatureHeader: "wrong",
                requestSignature: "secret",
                cdnSignUrls: true,
                fullUrl: "https://cdn.example.test/attachments/channel/message/file.png?ex=1&is=1&hm=abc",
                validateSignature: () => {
                    checkedSignedUrl = true;
                    return false;
                },
            }),
            false,
        );
        assert.equal(checkedSignedUrl, true);
    });

    it("falls back to signed URL validation for unrelated signature headers", () => {
        assert.equal(
            hasValidAttachmentRequestAuthorization({
                signatureHeader: "unrelated-proxy-signature",
                requestSignature: "secret",
                cdnSignUrls: true,
                fullUrl: "https://cdn.example.test/attachments/channel/message/file.png?ex=1&is=1&hm=abc",
                validateSignature: () => true,
            }),
            true,
        );
    });

    it("allows unsigned attachment requests only when CDN URL signing is disabled", () => {
        assert.equal(
            hasValidAttachmentRequestAuthorization({
                signatureHeader: undefined,
                requestSignature: "secret",
                cdnSignUrls: false,
                fullUrl: "https://cdn.example.test/attachments/channel/message/file.png",
            }),
            true,
        );
    });

    it("fails closed when signed URL parameters are missing or invalid", () => {
        assert.equal(
            hasValidAttachmentRequestAuthorization({
                signatureHeader: undefined,
                requestSignature: "secret",
                cdnSignUrls: true,
                fullUrl: "https://cdn.example.test/attachments/channel/message/file.png",
                validateSignature: () => true,
            }),
            false,
        );
    });

    it("accepts valid signed URL parameters", () => {
        assert.equal(
            hasValidAttachmentRequestAuthorization({
                signatureHeader: undefined,
                requestSignature: "secret",
                cdnSignUrls: true,
                fullUrl: "https://cdn.example.test/attachments/channel/message/file.png?ex=1&is=1&hm=abc",
                validateSignature: (_request, signature) => signature.path === "/attachments/channel/message/file.png",
            }),
            true,
        );
    });

    it("validates attachment URLs signed with the configured CDN signature key", async () => {
        const oldConfigPath = process.env.CONFIG_PATH;
        const oldConfigReadonly = process.env.CONFIG_READONLY;
        const configDir = await mkdtemp(join(tmpdir(), "spacebar-cdn-auth-"));
        const configPath = join(configDir, "config.json");

        process.env.CONFIG_PATH = configPath;
        process.env.CONFIG_READONLY = "1";

        try {
            await writeFile(
                configPath,
                JSON.stringify({
                    api: { endpointPublic: "http://localhost:3001/api/v9" },
                    cdn: { endpointPublic: "http://localhost:3001", endpointPrivate: "http://localhost:3001" },
                    gateway: { endpointPublic: "ws://localhost:3001" },
                    general: { serverName: "http://localhost:3001" },
                    security: {
                        cdnSignUrls: true,
                        cdnSignatureDuration: "24h",
                        cdnSignatureIncludeIp: true,
                        cdnSignatureIncludeUserAgent: true,
                        cdnSignatureKey: "test-cdn-signature-key",
                    },
                }),
            );
            await Config.init(true);

            const fullUrl = "https://cdn.example.test/attachments/1/2/file.png";
            const userAuth = { ip: "127.0.0.1", userAgent: "test-agent" };
            const signedUrl = getUrlSignature(new NewUrlSignatureData({ ...userAuth, url: fullUrl }))
                .applyToUrl(fullUrl)
                .toString();
            await setTimeout(1);

            assert.equal(
                hasValidAttachmentRequestAuthorization({
                    signatureHeader: undefined,
                    requestSignature: "secret",
                    cdnSignUrls: true,
                    fullUrl: signedUrl,
                    ...userAuth,
                    validateSignature: (request, signature) => hasValidSignature(new NewUrlUserSignatureData(request), new UrlSignResult(signature)),
                }),
                true,
            );
            assert.equal(
                hasValidAttachmentRequestAuthorization({
                    signatureHeader: undefined,
                    requestSignature: "secret",
                    cdnSignUrls: true,
                    fullUrl: signedUrl,
                    ...userAuth,
                    ip: "127.0.0.2",
                    validateSignature: (request, signature) => hasValidSignature(new NewUrlUserSignatureData(request), new UrlSignResult(signature)),
                }),
                false,
            );
        } finally {
            if (oldConfigPath === undefined) delete process.env.CONFIG_PATH;
            else process.env.CONFIG_PATH = oldConfigPath;
            if (oldConfigReadonly === undefined) delete process.env.CONFIG_READONLY;
            else process.env.CONFIG_READONLY = oldConfigReadonly;

            await rm(configDir, { recursive: true, force: true });
        }
    });

    it("denies malformed URLs when signed URL auth is required", () => {
        assert.equal(
            hasValidAttachmentRequestAuthorization({
                signatureHeader: undefined,
                requestSignature: "secret",
                cdnSignUrls: true,
                fullUrl: "not a url",
                validateSignature: () => true,
            }),
            false,
        );
    });
});
