import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Config, getUrlSignature, NewUrlSignatureData } from "@spacebar/util";
import { hasMatchingRequestSignature, hasValidAttachmentRequestAuth, validateAttachmentSignedUrl } from "./AttachmentAuth";

describe("CDN attachment request authentication", () => {
    test("matches internal request signatures exactly", () => {
        assert.equal(hasMatchingRequestSignature("shared-secret", "shared-secret"), true);
        assert.equal(hasMatchingRequestSignature("wrong-secret", "shared-secret"), false);
        assert.equal(hasMatchingRequestSignature(["shared-secret"], "shared-secret"), false);
        assert.equal(hasMatchingRequestSignature("", "shared-secret"), false);
    });

    test("rejects an incorrect signature header when URL signature validation fails", () => {
        let signedUrlValidatorCalled = false;

        const valid = hasValidAttachmentRequestAuth({
            signatureHeader: "wrong-secret",
            requestSignature: "shared-secret",
            cdnSignUrls: true,
            fullUrl: "https://cdn.example.test/attachments/1/2/file.png",
            validateSignedUrl: () => {
                signedUrlValidatorCalled = true;
                return false;
            },
        });

        assert.equal(valid, false);
        assert.equal(signedUrlValidatorCalled, true);
    });

    test("falls back to signed URL validation for unrelated signature headers", () => {
        const valid = hasValidAttachmentRequestAuth({
            signatureHeader: "unrelated-proxy-signature",
            requestSignature: "shared-secret",
            cdnSignUrls: true,
            fullUrl: "https://cdn.example.test/attachments/1/2/file.png?ex=1&is=1&hm=abc",
            validateSignedUrl: () => true,
        });

        assert.equal(valid, true);
    });

    test("accepts the exact internal request signature", () => {
        const valid = hasValidAttachmentRequestAuth({
            signatureHeader: "shared-secret",
            requestSignature: "shared-secret",
            cdnSignUrls: true,
            fullUrl: "https://cdn.example.test/attachments/1/2/file.png",
            validateSignedUrl: () => false,
        });

        assert.equal(valid, true);
    });

    test("allows unsigned public attachment reads only when URL signing is disabled", () => {
        assert.equal(
            hasValidAttachmentRequestAuth({
                signatureHeader: undefined,
                requestSignature: "shared-secret",
                cdnSignUrls: false,
                fullUrl: "https://cdn.example.test/attachments/1/2/file.png",
                validateSignedUrl: () => false,
            }),
            true,
        );
    });

    test("requires signed URL validation when signing is enabled and no internal signature is present", () => {
        let signedUrlValidatorCalled = false;

        const valid = hasValidAttachmentRequestAuth({
            signatureHeader: undefined,
            requestSignature: "shared-secret",
            cdnSignUrls: true,
            fullUrl: "https://cdn.example.test/attachments/1/2/file.png?ex=1&is=1&hm=abc",
            validateSignedUrl: (auth) => {
                signedUrlValidatorCalled = true;
                assert.equal(auth.fullUrl, "https://cdn.example.test/attachments/1/2/file.png?ex=1&is=1&hm=abc");
                return true;
            },
        });

        assert.equal(valid, true);
        assert.equal(signedUrlValidatorCalled, true);
    });

    test("treats malformed signed attachment URLs as invalid", () => {
        assert.equal(
            validateAttachmentSignedUrl({
                fullUrl: "https://cdn.example.test/attachments/1/2/file.png",
                ip: "127.0.0.1",
                userAgent: "test",
            }),
            false,
        );
    });

    test("validates attachment URLs signed with the configured CDN signature key", async () => {
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

            assert.equal(validateAttachmentSignedUrl({ ...userAuth, fullUrl: signedUrl }), true);
            assert.equal(validateAttachmentSignedUrl({ ...userAuth, ip: "127.0.0.2", fullUrl: signedUrl }), false);
        } finally {
            if (oldConfigPath === undefined) delete process.env.CONFIG_PATH;
            else process.env.CONFIG_PATH = oldConfigPath;
            if (oldConfigReadonly === undefined) delete process.env.CONFIG_READONLY;
            else process.env.CONFIG_READONLY = oldConfigReadonly;

            await rm(configDir, { recursive: true, force: true });
        }
    });

    test("denies malformed URLs when signed URL auth is required", () => {
        assert.equal(
            hasValidAttachmentRequestAuth({
                signatureHeader: undefined,
                requestSignature: "shared-secret",
                cdnSignUrls: true,
                fullUrl: "not a url",
            }),
            false,
        );
    });
});
